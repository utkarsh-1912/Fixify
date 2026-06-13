"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import {
  MessageSquare,
  Send,
  Lock,
  Users,
  CheckCircle,
  Wifi,
  WifiOff,
  LogOut,
  Trash2,
  Shield,
  Key,
  Eye,
  EyeOff,
  Terminal,
  Activity,
  ArrowRight,
  Pin,
  Smile,
  Volume2,
  VolumeX,
  Info,
  Hash,
  X,
  Menu,
  ChevronLeft
} from "lucide-react";
import { encryptMessage, decryptMessage } from "@/lib/cipher";

const reactionEmojis = ["👍", "😂", "❤️", "🔥", "😢"];

const emojiCategories = {
  Smileys: ["😄", "😂", "🤣", "😊", "😍", "😉", "🤔", "👀", "🥳", "😎", "😴", "😭"],
  Gestures: ["👍", "👎", "👏", "🙌", "🎉", "🔥", "❤️", "✨", "🤝", "💪", "🙏", "✌️"],
  Tech: ["💡", "🚀", "💯", "🔔", "⚠️", "❌", "✔️", "💬", "💻", "🔒", "⚙️", "📈"]
};

const emojiList = [
  { char: "😄", name: "smile happy laugh joy grimm" },
  { char: "😂", name: "joy laugh tears crying happy" },
  { char: "🤣", name: "rofl laugh roll floor" },
  { char: "😊", name: "smile happy blush sweet" },
  { char: "😍", name: "heart eyes love adore kiss" },
  { char: "😉", name: "wink subtle tease blink" },
  { char: "🤔", name: "think wonder question ponder suspect" },
  { char: "👀", name: "eyes watch look see search" },
  { char: "🥳", name: "party celebrate hat horn balloon" },
  { char: "😎", name: "cool sunglasses shades slick style" },
  { char: "😴", name: "sleep tired zzz snore rest" },
  { char: "😭", name: "cry sob sad tears pain" },
  
  { char: "👍", name: "thumbsup ok correct yes approve good like" },
  { char: "👎", name: "thumbsdown bad no reject dislike" },
  { char: "👏", name: "clap applaud hands congrats bravo" },
  { char: "🙌", name: "raise hands celebrate hooray success" },
  { char: "🎉", name: "tada party celebrate ribbon confetti" },
  { char: "🔥", name: "fire hot flame trend lit spark" },
  { char: "❤️", name: "heart love red emotion" },
  { char: "✨", name: "sparkles shiny clean new magic" },
  { char: "🤝", name: "handshake partner deal agree meet" },
  { char: "💪", name: "muscle strong power bicep fit" },
  { char: "🙏", name: "pray please thanks bless respect hands" },
  { char: "✌️", name: "peace sign victory two" },

  { char: "💡", name: "idea lightbulb smart bright electricity" },
  { char: "🚀", name: "rocket launch speed fast up space flight" },
  { char: "💯", name: "hundred perfect score A+ high rank" },
  { char: "🔔", name: "bell ring notification alert sound" },
  { char: "⚠️", name: "warning alert danger caution check" },
  { char: "❌", name: "cross red wrong no delete cancel close" },
  { char: "✔️", name: "check mark green correct pass select" },
  { char: "💬", name: "chat speech bubble talk text message speak" },
  { char: "💻", name: "computer laptop code tech programming monitor" },
  { char: "🔒", name: "lock secure key encrypt secret shield" },
  { char: "⚙️", name: "gear setup options settings tools configure" },
  { char: "📈", name: "chart growth up analysis statistics data" }
];

export default function RoomChatPage({ params }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId.trim().toLowerCase();
  
  const router = useRouter();

  // Lobby/Creds state (prefilled if dynamic route page loads directly)
  const [secretKey, setSecretKey] = useState("fix-sec-key-101");
  const [username, setUsername] = useState("Utkarsh");
  const [isJoined, setIsJoined] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Workspace UI states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkSize = () => {
      setIsDesktopSidebar(window.innerWidth >= 1024);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);
  
  // Custom picker & reaction states
  const [soundType, setSoundType] = useState("chime");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [selectedEmojiTab, setSelectedEmojiTab] = useState("Smileys");
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [reactionSearch, setReactionSearch] = useState("");
  const [flashedMessageId, setFlashedMessageId] = useState(null);

  // Active user identity tracker
  const [userId] = useState(() => {
    if (typeof window !== "undefined") {
      const savedUid = localStorage.getItem("fixify-chat-userId");
      if (savedUid) return savedUid;
      const newUid = uuid();
      localStorage.setItem("fixify-chat-userId", newUid);
      return newUid;
    }
    return uuid();
  });

  // Chat message & polling states
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isPollingActive, setIsPollingActive] = useState(false);
  const [analytics, setAnalytics] = useState({
    present: [],
    left: [],
    history: [],
    clientIp: "127.0.0.1"
  });

  // Refs for audio and auto-scroll proximity check
  const chatEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const lastMessageIdRef = useRef(null);
  const pollingRef = useRef(null);
  const inputRef = useRef(null);

  // Load configuration on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedRoom = localStorage.getItem('fixify-chat-roomId');
    const savedKey = localStorage.getItem('fixify-chat-secretKey') || "fix-sec-key-101";
    const savedUser = localStorage.getItem('fixify-chat-username') || "Utkarsh";
    const savedIsJoined = localStorage.getItem('fixify-chat-isJoined') === 'true';

    setSecretKey(savedKey);
    setUsername(savedUser);

    const savedMute = localStorage.getItem('fixify-chat-isMuted');
    if (savedMute) setIsMuted(savedMute === 'true');
    const savedSoundType = localStorage.getItem('fixify-chat-soundType') || "chime";
    setSoundType(savedSoundType);

    const savedRecent = localStorage.getItem('fixify-chat-recentRooms');
    if (savedRecent) {
      try {
        setRecentRooms(JSON.parse(savedRecent));
      } catch (err) {}
    } else {
      setRecentRooms([roomId]);
    }

    // Auto join if room is matches
    if (savedIsJoined && savedRoom === roomId && savedUser) {
      setIsJoined(true);
    } else {
      setIsJoined(false);
    }

    setIsLoaded(true);
  }, [roomId]);

  // Cache message list helper
  const saveCache = useCallback((targetRoom, msgs) => {
    localStorage.setItem(`fixify_chat_cache_${targetRoom}`, JSON.stringify(msgs));
  }, []);

  // Web Audio API synthesised sound effects (zero external dependencies)
  const playSound = useCallback((soundMode) => {
    if (isMuted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (soundMode === "sent") {
        // Subtle tactile click/tap sound for sending
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
        return;
      }

      // Incoming notification sounds based on soundType state
      const type = soundType || "chime";
      if (type === "bubble") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "retro") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        // Default "chime"
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12); // C6
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.22);
        osc2.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {
      console.warn("Failed to play audio chime:", e);
    }
  }, [isMuted, soundType]);

  // Fetch messages handler
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/chat/api/messages?roomId=${encodeURIComponent(roomId)}&userId=${userId}&username=${encodeURIComponent(username)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(data.messages)) {
              return data.messages;
            }
            return prev;
          });
          saveCache(roomId, data.messages);
        }
        if (data.analytics) {
          setAnalytics(data.analytics);
        }
        setIsPollingActive(true);
      } else {
        setIsPollingActive(false);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setIsPollingActive(false);
    }
  }, [roomId, userId, username, saveCache]);

  // Start polling loop when room is joined
  useEffect(() => {
    if (!isLoaded || !isJoined) return;

    fetchMessages();

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchMessages, 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [roomId, username, isLoaded, isJoined, fetchMessages]);

  // Keep recent rooms directory sync
  const addRecentRoom = useCallback((roomName) => {
    setRecentRooms((prev) => {
      const filtered = prev.filter((r) => r !== roomName);
      const updated = [roomName, ...filtered].slice(0, 8);
      localStorage.setItem('fixify-chat-recentRooms', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Switch Room action
  const switchRoom = async (newRoom) => {
    const room = newRoom.trim().toLowerCase();
    if (!room || room === roomId) return;
    
    // Notify server of leave
    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          roomId,
          userId,
          username
        })
      });
    } catch (e) {}

    localStorage.setItem('fixify-chat-roomId', room);
    addRecentRoom(room);
    router.push(`/chat/${room}`);
  };

  // Join Action
  const joinChatRoom = () => {
    if (!username.trim() || !secretKey.trim()) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("fixify-chat-roomId", roomId);
      localStorage.setItem("fixify-chat-secretKey", secretKey.trim());
      localStorage.setItem("fixify-chat-username", username.trim());
      localStorage.setItem("fixify-chat-isJoined", "true");
      addRecentRoom(roomId);
    }
    setIsJoined(true);
  };

  // Send message function
  const sendMessage = async () => {
    if (!input.trim()) return;

    const encryptedText = encryptMessage(input.trim(), secretKey);
    const msg = {
      id: uuid(),
      sender: username,
      senderId: userId,
      text: encryptedText,
      timestamp: new Date().toISOString(),
      reactions: {},
      isPinned: false,
      roomId
    };

    // Optimistic UI updates
    setMessages((prev) => {
      const updated = [...prev, msg];
      saveCache(roomId, updated);
      return updated;
    });
    setInput("");
    playSound("sent");

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

  // Reaction handler
  const handleReaction = async (msgId, emoji) => {
    // Optimistic update
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

  // Pin/Unpin message handler
  const handleTogglePin = async (msgId) => {
    setMessages(prev => {
      const updated = prev.map(m => m.id === msgId ? { ...m, isPinned: !m.isPinned } : m);
      saveCache(roomId, updated);
      return updated;
    });

    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pin",
          roomId,
          msgId
        })
      });
      fetchMessages();
    } catch (err) {
      console.error("Failed to toggle pin state:", err);
    }
  };

  // Clear chat trigger
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

  // Logout/leave
  const handleLeaveRoom = async () => {
    try {
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          roomId,
          userId,
          username
        })
      });
    } catch (e) {}
    
    setIsJoined(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("fixify-chat-isJoined", "false");
    }
    router.push("/chat");
  };

  // Delete channel data and remove from sidebar recent list
  const deleteChannel = async (e, roomToDelete) => {
    e.stopPropagation();
    
    const confirmDelete = window.confirm(`Are you sure you want to delete and wipe channel #${roomToDelete}?`);
    if (!confirmDelete) return;

    try {
      // 1. Notify server to delete database history and presence for this room
      await fetch("/chat/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_room",
          roomId: roomToDelete
        })
      });

      // 2. Remove from recent rooms local state and storage
      setRecentRooms((prev) => {
        const updated = prev.filter((r) => r !== roomToDelete);
        localStorage.setItem('fixify-chat-recentRooms', JSON.stringify(updated));
        
        // 3. If we deleted the current active room, redirect
        if (roomToDelete === roomId) {
          if (updated.length > 0) {
            router.push(`/chat/${updated[0]}`);
          } else {
            localStorage.setItem('fixify-chat-isJoined', 'false');
            router.push('/chat');
          }
        }
        return updated;
      });

    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  };

  // Auto scroll logic
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      
      if (lastMessageIdRef.current && lastMessageIdRef.current !== lastMsg.id) {
        if (lastMsg.senderId !== userId) {
          playSound("incoming");
        }
      }
      lastMessageIdRef.current = lastMsg.id;

      if (isNewMessage) {
        const isOwnMessage = lastMsg?.senderId === userId;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 180;

        if (isOwnMessage || isNearBottom) {
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages, userId, playSound]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleUsernameChange = (val) => {
    setUsername(val);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-username", val);
  };

  const handleSecretKeyChange = (val) => {
    setSecretKey(val);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-secretKey", val);
  };

  const handleSoundTypeChange = (val) => {
    setSoundType(val);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-soundType", val);
  };

  const toggleMute = () => {
    const nextMuteState = !isMuted;
    setIsMuted(nextMuteState);
    if (typeof window !== "undefined") localStorage.setItem("fixify-chat-isMuted", nextMuteState.toString());
  };

  const jumpToMessage = (msgId) => {
    setShowPinnedDrawer(false);
    setTimeout(() => {
      const element = document.getElementById(`chat-msg-${msgId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlashedMessageId(msgId);
        setTimeout(() => {
          setFlashedMessageId(null);
        }, 2000);
      }
    }, 150);
  };

  const handleInsertEmoji = (emoji) => {
    const inputEl = inputRef.current;
    if (!inputEl) {
      setInput(prev => prev + emoji);
      setIsEmojiPickerOpen(false);
      return;
    }

    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    const text = inputEl.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setInput(before + emoji + after);
    setIsEmojiPickerOpen(false);

    setTimeout(() => {
      inputEl.focus();
      inputEl.selectionStart = inputEl.selectionEnd = start + emoji.length;
    }, 10);
  };

  const pinnedMessages = messages.filter(m => m.isPinned);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 font-mono text-xs">
        Connecting to secured tunnel...
      </div>
    );
  }

  // LOBBY CARD: Render credentials login form if not joined
  if (!isJoined) {
    return (
      <div className="space-y-6 max-w-screen-2xl mx-auto">
        <div className="fx-page-header">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Room Access Required
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Enter room credentials to decrypt communication stream for room <span className="font-mono text-[var(--primary)] font-bold">#{roomId}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[45vh] p-4">
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
                Room Lobby: #{roomId}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Provide decryption key and username to start messaging.
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
                disabled={!username.trim() || !secretKey.trim()}
              >
                Join Secured Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CHAT VIEW: Styled like Slack/Discord Group Channels
  // Sidebar content shared between desktop aside and mobile drawer
  const sidebarContent = (
    <>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: "var(--foreground)" }}>
            Chat Channels
          </h2>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Channels List (Recent Rooms) */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 font-bold px-1">
          Active Rooms
        </p>
        <div className="flex flex-col gap-1">
          {recentRooms.map((room) => {
            const isActive = room === roomId;
            return (
              <div
                key={room}
                className="group/channel relative w-full flex items-center"
              >
                <button
                  onClick={() => { switchRoom(room); setIsSidebarOpen(false); }}
                  className="flex-1 text-xs font-mono px-3 py-2 rounded-xl transition-all flex items-center justify-between text-left pr-8 cursor-pointer"
                  style={{
                    background: isActive ? "var(--primary-faint)" : "transparent",
                    border: isActive ? "1px solid var(--primary-border)" : "1px solid transparent",
                    color: isActive ? "var(--primary)" : "var(--text-muted)"
                  }}
                >
                  <span className="flex items-center gap-1.5 font-bold truncate">
                    <span># {room}</span>
                  </span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shrink-0 animate-pulse" />}
                </button>

                {/* Delete Button (visible on hover) */}
                <button
                  onClick={(e) => deleteChannel(e, room)}
                  className="absolute right-2 opacity-0 group-hover/channel:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-800/40 hover:text-red-400 text-zinc-550 cursor-pointer"
                  title="Delete channel and database"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* Active Members list */}
      <div className="flex flex-col flex-1 min-h-[180px]">
        <p className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 font-bold px-1 mb-2">
          Members online ({analytics.present.length})
        </p>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {analytics.present.map((u, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] font-mono px-1">
              <span className="text-zinc-200 font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[120px]">{u.username}</span>
                {u.username === username && <span className="opacity-60 text-[8px] font-bold">(You)</span>}
              </span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>online</span>
            </div>
          ))}
        </div>

        {analytics.left.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider font-mono text-zinc-650 font-bold px-1 mb-2">
              Offline ({analytics.left.length})
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 opacity-60">
              {analytics.left.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] font-mono px-1">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span className="truncate max-w-[120px]">{u.username}</span>
                  </span>
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>offline</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-120px)] max-w-screen-2xl mx-auto items-stretch relative gap-0 lg:gap-6">

      {/* ── MOBILE SIDEBAR BACKDROP ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── LEFT SIDEBAR: static on desktop, slide-in drawer on mobile ── */}
      <aside
        className={[
          // shared styles
          "flex flex-col gap-5 p-4 rounded-2xl overflow-y-auto",
          // desktop: static in flex row
          "lg:static lg:translate-x-0 lg:w-72 lg:max-h-full lg:shrink-0 lg:z-auto",
          // mobile: fixed drawer slides in from left
          "fixed inset-y-0 left-0 z-40 w-72 max-h-full",
          "transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{ border: "1px solid var(--border)", background: "var(--card)", top: 0 }}
      >
        {sidebarContent}
      </aside>

      {/* ── RIGHT COLUMN: Active Chat Room Panel ── */}
      <section className="flex-1 flex flex-col h-full gap-4 relative min-w-0">

        {/* Active Room Header */}
        <div
          className="p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm flex-wrap"
          style={{ border: "1px solid var(--border)", background: "var(--card)" }}
        >
          {/* Left group: hamburger (mobile) + room title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
              title="Open channels sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 flex-wrap" style={{ color: "var(--foreground)" }}>
                <div
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)" }}
                >
                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: "var(--primary)" }} />
                </div>
                <span className="truncate max-w-[140px] sm:max-w-none">#{roomId}</span>
                <span
                  className="text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase font-mono tracking-wider flex items-center gap-1 shrink-0"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    color: "var(--primary)"
                  }}
                >
                  <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> E2EE
                </span>
              </h1>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-1">
                <span className="flex items-center gap-1">
                  {isPollingActive ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 text-[10px]">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-500 font-bold text-[10px]">Offline</span>
                    </>
                  )}
                </span>
                <span className="text-zinc-700">·</span>
                <span className="flex items-center gap-1 text-[var(--primary)] font-semibold text-[10px]">
                  <Users className="h-3 w-3" />
                  <span>{analytics.present.length} online</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right group: action buttons */}
          <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center">
            {/* Pinned messages shortcut */}
            {pinnedMessages.length > 0 && (
              <button
                onClick={() => setShowPinnedDrawer(true)}
                className="fx-btn-secondary px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5"
                title="Pinned messages"
              >
                <Pin className="h-3.5 w-3.5 fill-[var(--primary)] text-[var(--primary)]" />
                <span className="hidden sm:inline text-[var(--primary)] font-semibold">{pinnedMessages.length}</span>
              </button>
            )}
            {/* Info toggle button */}
            <button
              onClick={() => setShowInfoDrawer(true)}
              className="fx-btn-secondary px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5"
              title="View room configuration & logs"
            >
              <Info className="h-3.5 w-3.5 text-[var(--primary)]" /> <span className="hidden sm:inline">Room Info</span>
            </button>
            <button onClick={clearChatHistory} className="fx-btn-secondary px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 text-red-400" /> <span className="hidden sm:inline">Clear</span>
            </button>
            <button onClick={handleLeaveRoom} className="fx-btn-secondary border-red-500/20 text-red-400 hover:bg-red-500/5 px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5" title="Leave room">
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* Message Screen */}
        <div
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-5 space-y-5 rounded-2xl min-h-0"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {messages.length === 0 && (
            <div
              className="flex flex-col items-center justify-center h-full py-10 rounded-xl"
              style={{ border: "2px dashed var(--border)", color: "var(--text-muted)" }}
            >
              <MessageSquare className="h-10 w-10 mb-3" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm">No messages in channel #{roomId} — start the conversation!</p>
              <p className="text-[10px] mt-1 opacity-70">All messages sent here are end-to-end encrypted.</p>
            </div>
          )}
          {messages.map((m) => {
            const isSelf = m.senderId === userId;
            const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const decryptedText = decryptMessage(m.text, secretKey);
            const isDecryptionFailed = decryptedText.includes("Decryption Failed");

            return (
              <div 
                key={m.id} 
                id={`chat-msg-${m.id}`} 
                className={`flex ${isSelf ? "justify-end" : "justify-start"} transition-all duration-500 rounded-2xl relative group`}
                style={{
                  backgroundColor: flashedMessageId === m.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
                  boxShadow: flashedMessageId === m.id ? "0 0 0 2px var(--primary)" : "none",
                  padding: flashedMessageId === m.id ? "6px" : "0px",
                }}
              >
                <div className="relative max-w-xl w-fit">
                  
                  {/* Pin label indicator */}
                  {m.isPinned && (
                    <span 
                      className="text-[8px] font-mono font-bold flex items-center gap-1 mb-0.5"
                      style={{ color: "var(--primary)" }}
                    >
                      <Pin className="h-2.5 w-2.5 fill-[var(--primary)]" /> Pinned message
                    </span>
                  )}

                  {/* Sender Name tag */}
                  {!isSelf && (
                    <span className="text-[9px] font-mono block mb-1 font-bold ml-1 text-emerald-400">
                      {m.sender}
                    </span>
                  )}

                  {/* Message Bubble */}
                  <div
                    className="rounded-2xl px-4 py-3 break-words whitespace-pre-wrap shadow-sm relative"
                    style={{
                      background: isSelf ? "var(--primary)" : "var(--background)",
                      border: `1px solid ${isDecryptionFailed ? "rgba(239, 68, 68, 0.3)" : m.isPinned ? "var(--primary-border)" : isSelf ? "transparent" : "var(--border)"}`,
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

                  {/* Floating Options tray (OVERLAPS top boundary so it won't disappear when clicking!) */}
                  <div className="absolute -top-3.5 right-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-20">
                    <div
                      className="flex gap-0.5 px-1 py-1 rounded-xl shadow-lg items-center"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      {/* Toggle Pin button */}
                      <button
                        onClick={() => handleTogglePin(m.id)}
                        className="p-1 hover:bg-zinc-800/30 rounded transition-colors mr-1"
                        title={m.isPinned ? "Unpin message" : "Pin message"}
                      >
                        <Pin className={`h-3 w-3 ${m.isPinned ? "fill-[var(--primary)] text-[var(--primary)]" : "text-zinc-400 hover:text-zinc-200"}`} />
                      </button>

                      {/* Reactions Emojis */}
                      {reactionEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(m.id, emoji)}
                          className="hover:scale-125 transition-transform text-sm px-0.5"
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Custom "+" Reaction Trigger */}
                      <div className="relative border-l border-zinc-800 pl-1 ml-0.5 flex items-center">
                        <button
                          onClick={() => {
                            setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id);
                            setReactionSearch("");
                          }}
                          className="hover:scale-125 transition-transform text-xs px-1 text-zinc-400 hover:text-[var(--primary)] font-bold"
                          title="React with custom emoji"
                        >
                          +
                        </button>

                        {activeReactionMsgId === m.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => { setActiveReactionMsgId(null); setReactionSearch(""); }} />
                            <div
                              className="absolute bottom-full mb-2 right-0 rounded-2xl p-2.5 shadow-2xl z-45 w-56 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
                              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                            >
                              <input
                                type="text"
                                placeholder="Search reaction..."
                                value={reactionSearch}
                                onChange={(e) => setReactionSearch(e.target.value)}
                                className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-mono text-zinc-300 outline-none focus:border-emerald-500"
                              />
                              <div className="grid grid-cols-6 gap-1.5 max-h-24 overflow-y-auto pr-1">
                                {(reactionSearch.trim()
                                  ? emojiList.filter(item => item.name.toLowerCase().includes(reactionSearch.toLowerCase().trim())).map(item => item.char)
                                  : emojiList.map(item => item.char).slice(0, 18)
                                ).map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      handleReaction(m.id, emoji);
                                      setActiveReactionMsgId(null);
                                      setReactionSearch("");
                                    }}
                                    className="hover:scale-125 transition-transform text-base p-0.5"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
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
          className="flex gap-3 items-end p-3 rounded-2xl relative"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {/* Sound Toggle Button next to Input */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl transition-all hover:bg-zinc-850/40 shrink-0"
            style={{ color: isMuted ? "#f87171" : "var(--primary)" }}
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          {/* Emoji Popover Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setIsEmojiPickerOpen(!isEmojiPickerOpen);
                setEmojiSearch("");
              }}
              className="p-2 rounded-xl transition-all hover:bg-zinc-850/40 text-zinc-400 hover:text-zinc-100"
              title="Add emoji"
            >
              <Smile className="h-5 w-5" />
            </button>

            {/* Custom Advanced Emoji Picker Popover */}
            {isEmojiPickerOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { setIsEmojiPickerOpen(false); setEmojiSearch(""); }} />
                <div
                  className="absolute bottom-full mb-3 left-0 rounded-2xl p-3.5 shadow-2xl z-40 w-64 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  {/* Category Tabs */}
                  <div className="flex gap-1 border-b border-zinc-850 pb-1.5 text-[9px] font-mono shrink-0">
                    {Object.keys(emojiCategories).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedEmojiTab(cat)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${selectedEmojiTab === cat ? 'bg-zinc-800 text-[var(--primary)] font-bold' : 'text-zinc-500 hover:text-zinc-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Search Bar */}
                  <input
                    type="text"
                    placeholder="Search emoji..."
                    value={emojiSearch}
                    onChange={(e) => setEmojiSearch(e.target.value)}
                    className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-300 outline-none focus:border-emerald-500 shrink-0"
                  />

                  {/* Emoji Grid */}
                  <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {(emojiSearch.trim()
                      ? emojiList.filter(item => item.name.toLowerCase().includes(emojiSearch.toLowerCase().trim())).map(item => item.char)
                      : emojiCategories[selectedEmojiTab]
                    ).map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { handleInsertEmoji(emoji); setEmojiSearch(""); }}
                        className="hover:scale-125 transition-transform text-base p-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Encrypted message to channel #${roomId}...`}
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

        {/* Pinned Messages Sidebar Drawer Overlay */}
        {showPinnedDrawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowPinnedDrawer(false)} />
            <aside
              className="fixed inset-y-0 right-0 z-50 w-[350px] max-w-[85vw] p-5 flex flex-col space-y-4 shadow-2xl"
              style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                  <Pin className="h-4 w-4 fill-[var(--primary)] text-[var(--primary)]" /> Pinned Messages ({pinnedMessages.length})
                </span>
                <button
                  onClick={() => setShowPinnedDrawer(false)}
                  className="px-2 py-1 text-[10px] font-mono rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400"
                  style={{ borderColor: "var(--border)" }}
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {pinnedMessages.length === 0 ? (
                  <div className="text-center py-10 italic text-[var(--text-muted)] text-xs">
                    No pinned messages in this room. Hover over any chat bubble to pin it.
                  </div>
                ) : (
                  pinnedMessages.map((m) => {
                    const decryptedText = decryptMessage(m.text, secretKey);
                    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div 
                        key={m.id} 
                        onClick={() => jumpToMessage(m.id)}
                        className="p-3 rounded-xl space-y-2 border text-xs font-mono relative group cursor-pointer hover:border-[var(--primary)] transition-all"
                        style={{ background: "var(--background)", borderColor: "var(--border)" }}
                        title="Click to scroll to message"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-emerald-400 text-[10px]">{m.sender}</span>
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{time}</span>
                        </div>
                        <p style={{ color: "var(--foreground)" }}>{decryptedText}</p>
                        <button
                          onClick={() => handleTogglePin(m.id)}
                          className="text-[9px] text-red-400 hover:underline flex items-center gap-0.5 mt-1"
                        >
                          Unpin message
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </>
        )}

        {/* Room Info Sidebar Drawer Overlay (Hides credential inputs/access logs from active room view) */}
        {showInfoDrawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowInfoDrawer(false)} />
            <aside
              className="fixed inset-y-0 right-0 z-50 w-[360px] max-w-[85vw] p-5 flex flex-col space-y-5 shadow-2xl overflow-y-auto"
              style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
            >
              {/* Drawer Header */}
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                  <Info className="h-4 w-4 text-[var(--primary)]" /> Room Configurations
                </span>
                <button
                  onClick={() => setShowInfoDrawer(false)}
                  className="px-2 py-1 text-[10px] font-mono rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400"
                  style={{ borderColor: "var(--border)" }}
                >
                  Close
                </button>
              </div>

              {/* Pinned Messages shortcut button */}
              {pinnedMessages.length > 0 && (
                <button 
                  onClick={() => {
                    setShowInfoDrawer(false);
                    setShowPinnedDrawer(true);
                  }}
                  className="w-full flex items-center justify-between text-[11px] font-mono font-bold px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}
                >
                  <span className="flex items-center gap-1.5"><Pin className="h-3.5 w-3.5 fill-[var(--primary)]" /> Pinned Messages ({pinnedMessages.length})</span>
                  <span className="text-[10px]">View all →</span>
                </button>
              )}

              {/* Credentials / Setup config */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-500">
                  Secure Credentials
                </p>
                
                <div className="space-y-1">
                  <label className="fx-section-label">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-full fx-input py-1.5 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="fx-section-label">Secret Decryption Key</label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? "text" : "password"}
                      value={secretKey}
                      onChange={(e) => handleSecretKeyChange(e.target.value)}
                      className="w-full fx-input py-1.5 pr-9 text-xs font-mono"
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

                <div className="space-y-1">
                  <label className="fx-section-label">Active Room Identifier</label>
                  <input
                    type="text"
                    value={roomId}
                    disabled
                    className="w-full fx-input py-1.5 text-xs font-mono opacity-50 cursor-not-allowed bg-zinc-950"
                  />
                </div>

                <div 
                  className="flex items-center justify-between p-2.5 rounded-xl text-[10px] font-mono"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>TRACKING IP:</span>
                  <span className="font-semibold text-emerald-400">{analytics.clientIp}</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)" }} />

              {/* Sound effect profiles */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-500">
                  Audio Notification Preferences
                </p>
                <div className="flex gap-2">
                  <select
                    value={soundType}
                    onChange={(e) => handleSoundTypeChange(e.target.value)}
                    className="flex-1 text-[11px] font-mono bg-zinc-950 border rounded px-2.5 py-1.5"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    title="Select sound effect profile"
                  >
                    <option value="chime">Chime Effect</option>
                    <option value="bubble">Bubble Effect</option>
                    <option value="retro">8-Bit Effect</option>
                  </select>

                  <button
                    onClick={toggleMute}
                    className="px-3 rounded-lg border transition-colors hover:bg-zinc-800/20 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    title={isMuted ? "Unmute sounds" : "Mute sounds"}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-[var(--primary)]" />}
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)" }} />

              {/* Access timeline logs */}
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <p className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-500 flex items-center gap-1 shrink-0">
                  <Terminal className="h-3.5 w-3.5" /> Access Timeline
                </p>
                <div 
                  className="flex-1 overflow-y-auto p-3 rounded-xl font-mono text-[9px] leading-relaxed space-y-1.5 min-h-[140px]"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  {analytics.history.length === 0 ? (
                    <span className="text-zinc-650 block text-center mt-6 italic">No timeline logs</span>
                  ) : (
                    analytics.history.map((h, idx) => {
                      const t = new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                      const isJoin = h.type === "join";
                      return (
                        <div key={idx} className={isJoin ? "text-emerald-400/90" : "text-zinc-500"}>
                          [{t}] <span className="font-semibold">{h.username}</span> {isJoin ? "joined" : "departed"} ({h.ip})
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </>
        )}
      </section>
    </div>
  );
}
