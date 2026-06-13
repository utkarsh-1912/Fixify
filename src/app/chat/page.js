"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Key, Eye, EyeOff } from "lucide-react";

export default function ChatLobbyPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("conformance-desk");
  const [secretKey, setSecretKey] = useState("fix-sec-key-101");
  const [username, setUsername] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedRoom = localStorage.getItem("fixify-chat-roomId") || "conformance-desk";
    const savedKey = localStorage.getItem("fixify-chat-secretKey") || "fix-sec-key-101";
    const savedUser = localStorage.getItem("fixify-chat-username");
    const savedIsJoined = localStorage.getItem("fixify-chat-isJoined") === "true";

    setRoomId(savedRoom);
    setSecretKey(savedKey);
    if (savedUser) setUsername(savedUser);

    if (savedIsJoined && savedRoom && savedUser) {
      router.push(`/chat/${savedRoom}`);
    } else {
      setIsLoaded(true);
      fetch("/chat/api/messages")
        .then(res => res.json())
        .then(data => {
          if (data.rooms) setActiveRooms(data.rooms);
        })
        .catch(err => console.error("Lobby room fetch fail:", err));
    }
  }, [router]);

  const joinChatRoom = () => {
    if (!username.trim() || !roomId.trim() || !secretKey.trim()) return;
    const room = roomId.trim().toLowerCase();
    
    if (typeof window !== "undefined") {
      localStorage.setItem("fixify-chat-roomId", room);
      localStorage.setItem("fixify-chat-secretKey", secretKey.trim());
      localStorage.setItem("fixify-chat-username", username.trim());
      localStorage.setItem("fixify-chat-isJoined", "true");
    }

    router.push(`/chat/${room}`);
  };

  const handleSecretKeyChange = (val) => {
    setSecretKey(val);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-secretKey", val);
  };

  const handleUsernameChange = (val) => {
    setUsername(val);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-username", val);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 font-mono text-xs">
        Verifying secure chat session...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">

      {/* Center Card */}
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div
          className="w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
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
              Establish a secure E2EE connection using a custom secret key.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border)" }} />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="fx-section-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="e.g. Utkarsh"
                className="w-full fx-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="fx-section-label">Room Identifier</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => {
                  const val = e.target.value;
                  setRoomId(val);
                  if (typeof window !== "undefined") localStorage.setItem("fixify-chat-roomId", val.trim().toLowerCase());
                }}
                placeholder="e.g. general"
                className="w-full fx-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="fx-section-label flex items-center gap-1">
                <Key className="h-3 w-3" /> Secret Decryption Key (E2EE)
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? "text" : "password"}
                  value={secretKey}
                  onChange={(e) => handleSecretKeyChange(e.target.value)}
                  placeholder="Key for message encryption..."
                  className="w-full fx-input pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={joinChatRoom}
              className="w-full fx-btn-primary justify-center font-bold"
              disabled={!username.trim() || !roomId.trim() || !secretKey.trim()}
            >
              Join Secured Room
            </button>

            {activeRooms.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-zinc-800/80">
                <p className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-500">
                  Or join an active channel
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeRooms.map(room => (
                    <button
                      key={room}
                      onClick={() => {
                        setRoomId(room);
                        if (typeof window !== "undefined") localStorage.setItem("fixify-chat-roomId", room);
                      }}
                      className="text-[10px] font-mono px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-[var(--primary)] hover:border-[var(--primary-border)] transition-all cursor-pointer"
                    >
                      # {room}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
