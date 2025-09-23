// src/app/api/socket/route.js
import { Server } from "socket.io";

let io;

export async function GET(req) {
  if (!io) {
    console.log("🔌 Initializing Socket.IO...");
    io = new Server(global.server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
      console.log("✅ User connected:", socket.id);

      socket.on("chat-message", (msg) => {
        io.emit("chat-message", { id: socket.id, text: msg });
      });

      socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
      });
    });
  }

  return new Response("Socket.IO server running", { status: 200 });
}
