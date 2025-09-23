"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { v4 as uuid } from "uuid";

export default function TeamChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId] = useState(() => uuid());

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetch("/api/socket");

    const s = io({ path: "/api/socket" });
    socketRef.current = s;

    s.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    s.on("chat-reaction", ({ msgId, emoji, user }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                reactions: {
                  ...m.reactions,
                  [emoji]: [...(m.reactions?.[emoji] || []), user],
                },
              }
            : m
        )
      );
    });

    return () => s.disconnect();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !socketRef.current) return;

    const msg = {
      id: uuid(),
      sender: userId,
      text: input,
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    socketRef.current.emit("chat-message", msg);
    setMessages((prev) => [...prev, msg]);
    setInput("");
  }

  function handleReaction(msgId, emoji) {
    if (!socketRef.current) return;

    socketRef.current.emit("chat-reaction", {
      msgId,
      emoji,
      user: userId,
    });

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              reactions: {
                ...m.reactions,
                [emoji]: [...(m.reactions?.[emoji] || []), userId],
              },
            }
          : m
      )
    );
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const reactionEmojis = ["👍", "😂", "❤️", "🔥", "😢"];

  return (
    <main className="p-6 max-w-5xl mx-auto flex flex-col h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">💬 Team Chat</h1>
        <button
          onClick={() => setMessages([])}
          className="ml-4 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium"
        >
          + New Chat
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto border rounded bg-gray-50 p-4 space-y-6 max-h-[65vh]">
        {messages.map((m) => {
          const isSelf = m.sender === userId;
          const time = new Date(m.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={m.id}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              {/* Group wraps bubble and tray */}
              <div className="relative group max-w-xl w-fit">
                {/* Chat bubble */}
                <div
                  className={`rounded-2xl px-4 py-2 shadow-md break-words whitespace-pre-wrap ${
                    isSelf
                      ? "bg-gray-800 text-white rounded-br-none"
                      : "bg-white text-gray-800 border rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{m.text}</p>
                  <div className="text-[10px] text-gray-400 text-right mt-1">
                    {time}
                  </div>
                </div>

                {/* Reactions below bubble */}
                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 text-sm">
                    {Object.entries(m.reactions).map(([emoji, users]) => (
                      <span
                        key={emoji}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs"
                      >
                        {emoji} {users.length}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reaction tray (on hover) */}
                <div className="absolute -bottom-10 right-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-20">
                  <div className="flex gap-1 bg-white border rounded shadow p-1">
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(m.id, emoji)}
                        className="hover:scale-125 transition-transform text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-2 w-full flex gap-2 items-end">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message to team ..."
          className="flex-1 resize-none border rounded p-3 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <button
          onClick={sendMessage}
          className="bg-gray-800 text-white px-5 py-3 rounded hover:bg-gray-700"
        >
          Send
        </button>
      </div>
    </main>
  );
}
