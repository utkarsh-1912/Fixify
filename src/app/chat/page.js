"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
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

// WebRTC ICE servers
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

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
  const [p2pActive, setP2pActive] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

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
  const socketRef = useRef(null);
  const pcsRef = useRef({});      // Maps socketId -> RTCPeerConnection
  const channelsRef = useRef({}); // Maps socketId -> RTCDataChannel
  const peerIdsRef = useRef(new Set()); // Room peers seen through the signaling relay

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

  // Close all peer connections
  const cleanupP2P = useCallback(() => {
    Object.keys(pcsRef.current).forEach((id) => {
      if (pcsRef.current[id]) pcsRef.current[id].close();
    });
    pcsRef.current = {};
    channelsRef.current = {};
    peerIdsRef.current = new Set();
    setP2pActive(false);
    setPeerCount(0);
  }, []);

  const syncPeerCount = useCallback(() => {
    setPeerCount(peerIdsRef.current.size);
  }, []);

  // Update connection status
  const updateP2PStatus = useCallback(() => {
    const activeChannels = Object.values(channelsRef.current).filter(
      (dc) => dc.readyState === "open"
    );
    setP2pActive(activeChannels.length > 0);
  }, []);

  // Handle incoming message
  const handleIncomingMessage = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      const updated = [...prev, msg];
      saveCache(roomId, updated);
      return updated;
    });
  }, [roomId, saveCache]);

  // Handle incoming reaction
  const handleIncomingReaction = useCallback(({ msgId, emoji, user }) => {
    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id === msgId) {
          const reactions = { ...m.reactions };
          const users = reactions[emoji] || [];
          if (!users.includes(user)) {
            reactions[emoji] = [...users, user];
          }
          return { ...m, reactions };
        }
        return m;
      });
      saveCache(roomId, updated);
      return updated;
    });
  }, [roomId, saveCache]);

  // Set up RTC DataChannel listeners
  const setupDataChannel = useCallback((socketId, dc) => {
    dc.onopen = () => {
      console.log(`🟢 WebRTC DataChannel opened with peer ${socketId}`);
      peerIdsRef.current.add(socketId);
      syncPeerCount();
      updateP2PStatus();
    };

    dc.onclose = () => {
      console.log(`🔴 WebRTC DataChannel closed with peer ${socketId}`);
      delete channelsRef.current[socketId];
      updateP2PStatus();
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat-message") {
          handleIncomingMessage(data.msg);
        } else if (data.type === "chat-reaction") {
          handleIncomingReaction(data.reaction);
        } else if (data.type === "clear-chat") {
          setMessages([]);
          saveCache(roomId, []);
        }
      } catch (err) {
        console.error("WebRTC message parse failed:", err);
      }
    };
  }, [roomId, handleIncomingMessage, handleIncomingReaction, updateP2PStatus, saveCache, syncPeerCount]);

  // Create PeerConnection
  const getOrCreatePC = useCallback((socketId, isInitiator) => {
    if (pcsRef.current[socketId]) return pcsRef.current[socketId];

    const pc = new RTCPeerConnection(rtcConfig);
    pcsRef.current[socketId] = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("signal-send", {
          targetSocketId: socketId,
          signalData: { type: "candidate", candidate: e.candidate },
          senderUserId: userId
        });
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel("chat-channel");
      setupDataChannel(socketId, dc);
      channelsRef.current[socketId] = dc;
    } else {
      pc.ondatachannel = (e) => {
        const dc = e.channel;
        setupDataChannel(socketId, dc);
        channelsRef.current[socketId] = dc;
      };
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        delete pcsRef.current[socketId];
        delete channelsRef.current[socketId];
        updateP2PStatus();
      }
    };

    return pc;
  }, [userId, setupDataChannel, updateP2PStatus]);

  // Connect to Socket server & establish mesh
  const joinChatRoom = () => {
    if (!roomId.trim() || !username.trim()) return;

    loadCache(roomId);
    setIsJoined(true);

    // Trigger API route to ensure Socket server is running on port 3001
    fetch("/api/socket").catch(err => console.error("Socket trigger failed:", err));

    const socketUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Connected to signaling server:", socket.id);
      socket.emit("join-room", { roomId, userId });
    });

    // 1. Receive list of existing peers in the room
    socket.on("room-peers", async ({ peers }) => {
      console.log("👥 Active peers in room:", peers);
      peerIdsRef.current = new Set(peers);
      syncPeerCount();
      for (const peerSocketId of peers) {
        try {
          const pc = getOrCreatePC(peerSocketId, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          socket.emit("signal-send", {
            targetSocketId: peerSocketId,
            signalData: { type: "offer", sdp: offer.sdp },
            senderUserId: userId
          });
        } catch (err) {
          console.error("Failed creating RTC offer:", err);
        }
      }
    });

    // 2. Receive notification of new peer joining
    socket.on("peer-joined", ({ socketId, userId: joinerId }) => {
      console.log(`👤 Peer joined: ${joinerId} (${socketId})`);
      peerIdsRef.current.add(socketId);
      syncPeerCount();
      getOrCreatePC(socketId, false);
    });

    // 3. Receive signaling negotiation data
    socket.on("signal-receive", async ({ senderSocketId, signalData }) => {
      try {
        const pc = getOrCreatePC(senderSocketId, false);

        if (signalData.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: signalData.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("signal-send", {
            targetSocketId: senderSocketId,
            signalData: { type: "answer", sdp: answer.sdp },
            senderUserId: userId
          });
        } else if (signalData.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: signalData.sdp }));
        } else if (signalData.type === "candidate") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch (err) {
        console.error("Signaling signal-receive process failed:", err);
      }
    });

    // 4. Server-relay fallback messages
    socket.on("chat-message", (msg) => {
      handleIncomingMessage(msg);
    });

    // 5. Server-relay fallback reactions
    socket.on("chat-reaction", (reaction) => {
      handleIncomingReaction(reaction);
    });

    // 6. Clear chat relay
    socket.on("clear-chat", () => {
      setMessages([]);
      saveCache(roomId, []);
    });

    // 7. Peer disconnected
    socket.on("peer-disconnected", ({ socketId }) => {
      console.log(`🔌 Peer disconnected: ${socketId}`);
      if (pcsRef.current[socketId]) pcsRef.current[socketId].close();
      delete pcsRef.current[socketId];
      delete channelsRef.current[socketId];
      peerIdsRef.current.delete(socketId);
      syncPeerCount();
      updateP2PStatus();
    });
  };

  const leaveChatRoom = () => {
    cleanupP2P();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsJoined(false);
  };

  // Send message function (prioritizes P2P data channels, falls back to Socket)
  const sendMessage = () => {
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

    const payload = JSON.stringify({ type: "chat-message", msg });
    let sentP2PCount = 0;

    // Try sending over peer-to-peer data channels
    Object.entries(channelsRef.current).forEach(([socketId, dc]) => {
      if (dc.readyState === "open") {
        try {
          dc.send(payload);
          sentP2PCount++;
        } catch (err) {
          console.error(`P2P send failed to socket ${socketId}:`, err);
        }
      }
    });

    // Relays through socket as a fallback or to broadcast to server log
    if (socketRef.current) {
      socketRef.current.emit("chat-message", msg);
    }

    setMessages((prev) => {
      const updated = [...prev, msg];
      saveCache(roomId, updated);
      return updated;
    });

    setInput("");
  };

  // Reaction click handler
  const handleReaction = (msgId, emoji) => {
    const reaction = { msgId, emoji, user: username, roomId };
    const payload = JSON.stringify({ type: "chat-reaction", reaction });

    // Send over P2P DataChannels
    Object.values(channelsRef.current).forEach((dc) => {
      if (dc.readyState === "open") {
        try {
          dc.send(payload);
        } catch (err) {
          console.error("P2P reaction broadcast failed:", err);
        }
      }
    });

    // Send via socket relay
    if (socketRef.current) {
      socketRef.current.emit("chat-reaction", reaction);
    }

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
  };

  // Clear chat trigger
  const clearChatHistory = () => {
    setMessages([]);
    saveCache(roomId, []);

    // Broadcast clear command P2P
    const payload = JSON.stringify({ type: "clear-chat" });
    Object.values(channelsRef.current).forEach((dc) => {
      if (dc.readyState === "open") {
        try {
          dc.send(payload);
        } catch (err) {
          console.error("P2P clear notification failed:", err);
        }
      }
    });

    // Send via socket relay
    if (socketRef.current) {
      socketRef.current.emit("clear-chat", { roomId });
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      cleanupP2P();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [cleanupP2P]);

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
              Establish a peer-to-peer WebRTC connection using a custom secret key.
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
              {p2pActive ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">P2P Mesh Link Active</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-500 font-bold">Relay (No Direct Peers)</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span>Peers: {peerCount} connected</span>
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
