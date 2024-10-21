"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const Users_1 = require("./db/Users");
const process_1 = require("process");
require("dotenv/config");
const cors = require("cors");
const app = (0, express_1.default)();
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 4000;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
if (!DB_USER || !DB_PASSWORD) {
    console.log("Db username or password is not provided");
    (0, process_1.exit)(1);
}
const DB_URL = `mongodb+srv://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@cluster0.aruoh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000",
    },
});
// utilities funtions for db
const newUser = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = new Users_1.users({ userid: id, status: "available" });
    yield user.save();
});
const getAvailableUsers = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const availableUsers = (yield Users_1.users.find({ status: "available" })).filter((user) => {
        return user.userid !== id;
    });
    return availableUsers;
});
// connection establised with new users
io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("a user connected", socket.id);
    // socket id for the new connected user
    const id = socket.id;
    // add new connected user to the list of available users
    yield newUser(id);
    // providing the id to new user on frontend
    socket.emit("id", socket.id);
    // @onEvent: callUser - it connects the available peer to the other available peers.
    // fetches the list of available users from the database and makes the call request randomly to the available peer
    // if any peer available then it connects the calling peer to the other available peer
    // if not the it emits the `searching` event to the calling peer with message `Searching for peers`
    socket.on("callUser", (_b) => __awaiter(void 0, [_b], void 0, function* ({ signal, from }) {
        const available = yield getAvailableUsers(from);
        if (available.length === 0)
            return io.to(from).emit("searching", "Searching for peers");
        const user = available[Math.floor(Math.random() * available.length)];
        io.to([user.userid]).emit("calling", { from, signal, to: user.userid });
    }));
    // @onEvent: calAccepted - listen to the event when available peer accepts the call request
    socket.on("callAccepted", (_c) => __awaiter(void 0, [_c], void 0, function* ({ id, signal, from }) {
        yield Users_1.users.updateMany({ userid: [id, from] }, { status: "busy" });
        io.to(id).emit("accepted", { from, signal, id });
    }));
    socket.on("cutCall", (_d) => __awaiter(void 0, [_d], void 0, function* ({ id, from }) {
        yield Users_1.users.updateMany({ userid: [id, from] }, { status: "available" });
        io.to(id).emit("callEnded");
        io.to(from).emit("callEnded");
    }));
    socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("user disconnected", socket.id);
        yield Users_1.users.deleteOne({ userid: socket.id });
    }));
}));
server.listen(PORT, () => {
    console.log("server is listening on port 4000");
});
mongoose_1.default
    .connect(DB_URL)
    .then(() => {
    console.log("successfully connected to the db");
})
    .catch((err) => {
    console.log("error when connecting to the db", err);
});
