"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { v4 as uuid } from "uuid";
import {
  MessageSquare,
  Send,
  PlusCircle,
  Lock,
  Users,
  CheckCircle,
  Wifi,
  WifiOff,
  LogOut,
  Trash2,
  Shield,
  Key
} from "lucide-react";
import { encryptMessage, decryptMessage } from "@/lib/cipher";

const reactionEmojis = ["👍", "😂", "❤️", "🔥", "😢"];

export default function TeamChatPage() {
  // Room selection lobby state
  const [roomId, setRoomId] = useState("conformance-desk");
  const [secretKey, setSecretKey] = useState("fix-sec-key-101");
  const [username, setUsername] = useState("Utkarsh");
  const [isJoined, setIsJoined] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Chat message state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId] = useState(() => uuid());
  const [isPollingActive, setIsPollingActive] = useState(false);

  // Load lobby settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedRoom = localStorage.getItem('fixify-chat-roomId');
    if (savedRoom) setRoomId(savedRoom);
    const savedKey = localStorage.getItem('fixify-chat-secretKey');
    if (savedKey) setSecretKey(savedKey);
    const savedUser = localStorage.getItem('fixify-chat-username');
    if (savedUser) setUsername(savedUser);
    setIsLoaded(true);
  }, []);

  // Save lobby settings on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-chat-roomId', roomId);
  }, [roomId, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-chat-secretKey', secretKey);
  }, [secretKey, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-chat-username', username);
  }, [username, isLoaded]);

  const chatEndRef = useRef(null);
  const pollingRef = useRef(null);

  // Load from cache helper
  const loadCache = useCallback((targetRoom) => {
    const cached = localStorage.getItem(`fixify_chat_cache_${targetRoom}`);
    if (cached) {
      try {
        setMessages(JSON.parse(cached));
      } catch (err) {
        console.error("Failed to parse chat cache:", err);
      }
    } else {
      setMessages([]);
    }
  }, []);

  // Save to cache helper
  const saveCache = useCallback((targetRoom, msgs) => {
    localStorage.setItem(`fixify_chat_cache_${targetRoom}`, JSON.stringify(msgs));
  }, []);

  // Fetch messages handler
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/chat/api/messages?roomId=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
          saveCache(roomId, data.messages);
          setIsPollingActive(true);
        }
      } else {
        setIsPollingActive(false);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setIsPollingActive(false);
    }
  }, [roomId, saveCache]);

  // Connect to room & start polling
  const joinChatRoom = () => {
    if (!roomId.trim() || !username.trim()) return;

    loadCache(roomId);
    setIsJoined(true);

    // Initial fetch
    fetchMessages();

    // Start polling every 2.5 seconds
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchMessages, 2500);
  };

  const leaveChatRoom = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsJoined(false);
    setIsPollingActive(false);
  };

  // Send message function (POST to serverless API)
  const sendMessage = async () => {
    if (!input.trim()) return;

    // Encrypt the message text
    const encryptedText = encryptMessage(input.trim(), secretKey);

    const msg = {
      id: uuid(),
      sender: username,
      senderId: userId,
      text: encryptedText,
      timestamp: new Date().toISOString(),
      reactions: {},
      roomId
    };

    // Optimistically update locally
    setMessages((prev) => {
      const updated = [...prev, msg];
      saveCache(roomId, updated);
      return updated;
    });
    setInput("");

    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          roomId,
          message: msg
        })
      });
      fetchMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Reaction click handler (POST to serverless API)
  const handleReaction = async (msgId, emoji) => {
    // Optimistic UI update
    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id === msgId) {
          const reactions = { ...m.reactions };
          const users = reactions[emoji] || [];
          if (!users.includes(username)) {
            reactions[emoji] = [...users, username];
          }
          return { ...m, reactions };
        }
        return m;
      });
      saveCache(roomId, updated);
      return updated;
    });

    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "react",
          roomId,
          msgId,
          emoji,
          username
        })
      });
      fetchMessages();
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  // Clear chat trigger (POST to serverless API)
  const clearChatHistory = async () => {
    setMessages([]);
    saveCache(roomId, []);

    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear",
          roomId
        })
      });
      fetchMessages();
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Lobby rendering (if not joined)
  if (!isJoined) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div
          className="w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {/* Header info */}
          <div className="text-center space-y-2">
            <div
              className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)" }}
            >
              <Shield className="h-6 w-6" style={{ color: "var(--primary)" }} />
            </div>
            <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-mono)" }}>
              E2EE Encrypted Chat Lobby
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Securely connect to an E2EE room using client-side encryption.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border)" }} />

          {/* Form details */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="fx-section-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Utkarsh"
                className="w-full fx-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="fx-section-label">Room Identifier</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. general"
                className="w-full fx-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="fx-section-label flex items-center gap-1">
                <Key className="h-3 w-3" /> Secret Decryption Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Key for message encryption..."
                className="w-full fx-input"
              />
            </div>
            <button onClick={joinChatRoom} className="w-full fx-btn-primary justify-center font-bold">
              Join Secured Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Chat view rendering
  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-5">
      {/* Active Room Header */}
      <div className="fx-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: "var(--foreground)" }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)" }}
            >
              <Lock className="h-5 w-5" style={{ color: "var(--primary)" }} />
            </div>
            <span>Room: {roomId}</span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider flex items-center gap-1"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "var(--primary)"
              }}
            >
              <CheckCircle className="h-3 w-3" /> E2EE Active
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1.5">
              {isPollingActive ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Sync Live (Polling)</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-500 font-bold">Sync Offline</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button onClick={clearChatHistory} className="fx-btn-secondary">
            <Trash2 className="h-3.5 w-3.5 text-red-400" /> <span className="hidden sm:inline">Clear History</span>
          </button>
          <button onClick={leaveChatRoom} className="fx-btn-secondary border-red-500/20 text-red-400 hover:bg-red-500/5">
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Message Screen */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-5 rounded-2xl min-h-0"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full py-10 rounded-xl"
            style={{ border: "2px dashed var(--border)", color: "var(--text-muted)" }}
          >
            <MessageSquare className="h-10 w-10 mb-3" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm">No messages in room {roomId} — start the conversation!</p>
            <p className="text-[10px] mt-1 opacity-70">All messages sent here are end-to-end encrypted.</p>
          </div>
        )}
        {messages.map((m) => {
          const isSelf = m.senderId === userId;
          const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const decryptedText = decryptMessage(m.text, secretKey);
          const isDecryptionFailed = decryptedText.includes("Decryption Failed");

          return (
            <div key={m.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
              <div className="relative group max-w-xl w-fit">
                {/* Sender Name tag */}
                {!isSelf && (
                  <span className="text-[9px] font-mono block mb-1 font-bold ml-1 text-emerald-400">
                    {m.sender}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  className="rounded-2xl px-4 py-3 break-words whitespace-pre-wrap shadow-sm"
                  style={{
                    background: isSelf ? "var(--primary)" : "var(--background)",
                    border: `1px solid ${isDecryptionFailed ? "rgba(239, 68, 68, 0.3)" : isSelf ? "transparent" : "var(--border)"}`,
                    color: isDecryptionFailed ? "#f87171" : isSelf ? "var(--background)" : "var(--foreground)",
                    borderTopRightRadius: isSelf ? "4px" : undefined,
                    borderTopLeftRadius: !isSelf ? "4px" : undefined,
                    fontFamily: "var(--font-mono)",
                    fontWeight: isSelf ? 600 : 400,
                  }}
                >
                  <p className="text-xs">{decryptedText}</p>
                  <div
                    className="text-[9px] mt-1 text-right"
                    style={{ color: isSelf ? "rgba(0,0,0,0.4)" : "var(--text-muted)" }}
                  >
                    {time}
                  </div>
                </div>

                {/* Reactions list */}
                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 text-xs justify-end">
                    {Object.entries(m.reactions).map(([emoji, users]) => (
                      <span
                        key={emoji}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        {emoji} {users.length}
                      </span>
                    ))}
                  </div>
                )}

                {/* Floating Reaction drawer */}
                <div className="absolute -bottom-9 right-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-20">
                  <div
                    className="flex gap-0.5 px-1.5 py-1 rounded-xl shadow-lg"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(m.id, emoji)}
                        className="hover:scale-125 transition-transform text-sm px-0.5"
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
      <div
        className="flex gap-3 items-end p-3 rounded-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Encrypted message to room ${roomId}...`}
          className="flex-1 resize-none py-2 px-3 rounded-xl text-xs font-mono"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            outline: "none",
            minHeight: "38px",
            maxHeight: "80px",
          }}
          onFocus={e => e.target.style.borderColor = "var(--primary)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <button onClick={sendMessage} className="fx-btn-primary">
          <Send className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
}
