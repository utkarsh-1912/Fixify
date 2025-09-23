"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { v4 as uuid } from "uuid";

let socket;

export default function TeamChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  // Assign a random user ID for demonstration
  const [userId] = useState(() => uuid());

  useEffect(() => {
    // Initialize socket
    fetch("/api/socket"); // ensure server route is alive

    socket = io({ path: "/api/socket" });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg = { id: userId, text: input, timestamp: new Date().toISOString() };
    socket.emit("chat-message", msg);
    setInput("");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">💬 Team Chat</h1>

      <div className="flex-1 flex flex-col border rounded-xl p-4 bg-gray-50 shadow overflow-y-auto space-y-3">
        {messages.map((m, i) => {
          const isSelf = m.id === userId;
          const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div
              key={i}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm
                              ${isSelf ? "bg-red-100 text-gray-900" : "bg-gray-200 text-gray-800"}`}>
                <div className="flex items-center justify-between mb-1">
                  {!isSelf && <span className="font-semibold text-gray-700 text-sm">User</span>}
                  <span className="text-gray-500 text-xs">{time}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2 mt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <button
          onClick={sendMessage}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow"
        >
          Send
        </button>
      </div>
    </main>
  );
}
