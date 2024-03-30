import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
const cors = require("cors");

const app = express();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  socket.on("msg", (msg) => {
    console.log(msg);
  });
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  });
});

server.listen(4000, () => {
  console.log("server is listening on port 4000");
});
