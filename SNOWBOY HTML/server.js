import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import fs from "fs-extra";
import path from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);

const ROOMS_DIR = path.join(Deno.cwd ? Deno.cwd() : process.cwd(), "rooms");
fs.ensureDirSync(ROOMS_DIR);

app.use(express.static("public"));
app.use(bodyParser.json());

// サーバー保存用API
app.post("/save/:roomId", async (req, res) => {
  const roomId = req.params.roomId;
  const data = req.body; // {html, css, js}
  const filePath = path.join(ROOMS_DIR, `room-${roomId}.json`);
  await fs.writeJson(filePath, data);
  res.json({ status: "ok" });
});

// 読み込み
app.get("/load/:roomId", async (req, res) => {
  const roomId = req.params.roomId;
  const filePath = path.join(ROOMS_DIR, `room-${roomId}.json`);
  if (await fs.pathExists(filePath)) {
    const data = await fs.readJson(filePath);
    res.json(data);
  } else {
    res.json({ html: "<h1>Hello!</h1>", css: "body{font-family:sans-serif;}", js: "" });
  }
});

const rooms = {}; // roomId -> { users: {socketId:name}, code: {html,css,js}, cursors:{} }

io.on("connection", (socket) => {
  let currentRoom = null;
  let username = `guest${Math.floor(Math.random()*1000)}`;

  socket.on("joinRoom", async (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms[roomId]) {
      // 初期化
      try {
        const filePath = path.join(ROOMS_DIR, `room-${roomId}.json`);
        const savedData = await fs.readJson(filePath);
        rooms[roomId] = { users: {}, code: savedData, cursors: {} };
      } catch {
        rooms[roomId] = { users: {}, code: {html:"<h1>Hello</h1>", css:"", js:""}, cursors:{} };
      }
    }

    rooms[roomId].users[socket.id] = username;
    socket.emit("initCode", rooms[roomId].code);
    io.to(roomId).emit("updateUsers", Object.values(rooms[roomId].users));
  });

  socket.on("setName", (name) => {
    username = name || username;
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].users[socket.id] = username;
      io.to(currentRoom).emit("updateUsers", Object.values(rooms[currentRoom].users));
    }
  });

  socket.on("codeUpdate", (data) => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].code = data;
      socket.broadcast.to(currentRoom).emit("codeUpdate", data);
    }
  });

  socket.on("cursorUpdate", (cursor) => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].cursors[socket.id] = { cursor, username };
      socket.broadcast.to(currentRoom).emit("cursorUpdate", rooms[currentRoom].cursors);
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      delete rooms[currentRoom].cursors[socket.id];
      io.to(currentRoom).emit("updateUsers", Object.values(rooms[currentRoom].users));
      io.to(currentRoom).emit("cursorUpdate", rooms[currentRoom].cursors);
    }
  });
});

server.listen(3000, () => console.log("🌐 Server running on http://localhost:3000"));
