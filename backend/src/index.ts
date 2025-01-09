import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { users } from "./db/Users";
import { exit } from "process";
import "dotenv/config";

const cors = require("cors");

const app = express();
const PORT = process.env.PORT ?? 4000;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const CLIENT = process.env.CLIENT;

if (!DB_USER || !DB_PASSWORD) {
  console.log("Db username or password is not provided");
  exit(1);
}

const DB_URL = `mongodb+srv://${encodeURIComponent(
  DB_USER
)}:${encodeURIComponent(
  DB_PASSWORD
)}@cluster0.aruoh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const server = createServer(app);

app.use(cors());

app.get("/health", (req, res) => {
  res.status(200).json({ health: "excellent" });
});

const io = new Server(server, {
  cors: {
    origin: CLIENT,
    methods: ["GET", "POST"],
  },
});

// utilities funtions for db

const newUser = async (id: string) => {
  const user = new users({ userid: id, status: "available" });
  await user.save();
};

const getAvailableUsers = async (id: string) => {
  const availableUsers = (await users.find({ status: "available" })).filter(
    (user) => {
      return user.userid !== id;
    }
  );
  return availableUsers;
};

// connection establised with new users
io.on("connection", async (socket) => {
  console.log("a user connected", socket.id);
  // socket id for the new connected user
  const id = socket.id;

  // add new connected user to the list of available users
  await newUser(id);

  // providing the id to new user on frontend
  socket.emit("id", socket.id);

  // @onEvent: callUser - it connects the available peer to the other available peers.
  // fetches the list of available users from the database and makes the call request randomly to the available peer
  // if any peer available then it connects the calling peer to the other available peer
  // if not the it emits the `searching` event to the calling peer with message `Searching for peers`

  socket.on("callUser", async ({ signal, from }) => {
    const available = await getAvailableUsers(from);
    if (available.length === 0)
      return io.to(from).emit("searching", "Searching for peers");
    const user = available[Math.floor(Math.random() * available.length)];
    io.to([user.userid]).emit("calling", { from, signal, to: user.userid });
  });

  // @onEvent: calAccepted - listen to the event when available peer accepts the call request
  socket.on("callAccepted", async ({ id, signal, from }) => {
    await users.updateMany({ userid: [id, from] }, { status: "busy" });
    io.to(id).emit("accepted", { from, signal, id });
  });

  socket.on("cutCall", async ({ id, from }) => {
    await users.updateMany({ userid: [id, from] }, { status: "available" });
    io.to(id).emit("callEnded");
    io.to(from).emit("callEnded");
  });

  socket.on("disconnect", async () => {
    console.log("user disconnected", socket.id);
    await users.deleteOne({ userid: socket.id });
  });
  socket.on("mediaStateUpdate", ({ to, audio, video }) => {
    io.to(to).emit("mediaStateUpdate", { audio, video });
  });
});

server.listen(PORT, () => {
  console.log("server is listening on port 4000");
});

mongoose
  .connect(DB_URL)
  .then(() => {
    console.log("successfully connected to the db");
  })
  .catch((err) => {
    console.log("error when connecting to the db", err);
  });
