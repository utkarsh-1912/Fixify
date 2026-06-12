// src/app/chat/api/socket/route.js
import { Server } from "socket.io";
import http from "http";

let io;
let server;

export async function GET(req) {
  if (!io) {
    console.log("🔌 Initializing Socket.IO on port 3001...");
    try {
      server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Socket Server Running");
      });

      io = new Server(server, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
        },
      });

      io.on("connection", (socket) => {
        console.log("✅ User connected:", socket.id);

        socket.on("join-room", ({ roomId, userId }) => {
          socket.join(roomId);
          console.log(`👤 User ${userId} (${socket.id}) joined room: ${roomId}`);
          
          // Get other clients in this room
          const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
          const peers = clients.filter(id => id !== socket.id);
          
          // Send existing peers to the joiner
          socket.emit("room-peers", { peers });
          
          // Notify existing peers
          socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });
        });

        socket.on("signal-send", ({ targetSocketId, signalData, senderUserId }) => {
          io.to(targetSocketId).emit("signal-receive", {
            senderSocketId: socket.id,
            signalData,
            senderUserId
          });
        });

        // Fallback message relay
        socket.on("chat-message", (msg) => {
          if (msg.roomId) {
            socket.to(msg.roomId).emit("chat-message", msg);
          }
        });

        // Fallback reaction relay
        socket.on("chat-reaction", (reaction) => {
          if (reaction.roomId) {
            socket.to(reaction.roomId).emit("chat-reaction", reaction);
          }
        });

        // Clear chat history relay
        socket.on("clear-chat", ({ roomId }) => {
          if (roomId) {
            socket.to(roomId).emit("clear-chat");
          }
        });

        socket.on("disconnecting", () => {
          for (const room of socket.rooms) {
            if (room !== socket.id) {
              socket.to(room).emit("peer-disconnected", { socketId: socket.id });
            }
          }
        });

        socket.on("disconnect", () => {
          console.log("❌ User disconnected:", socket.id);
        });
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log("⚠️ Port 3001 already in use. Assuming Socket.IO server is already running.");
        } else {
          console.error("Socket server error:", err);
        }
      });

      server.listen(3001, () => {
        console.log("🚀 Socket server listening on port 3001");
      });
    } catch (err) {
      console.error("Failed to initialize Socket.IO server:", err);
    }
  }

  return new Response("Socket.IO server running on port 3001", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    }
  });
}
