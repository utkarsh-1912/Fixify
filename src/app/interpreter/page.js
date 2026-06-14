'use client';

import React, { useState, useRef, useEffect } from "react";
import {
  BrainCircuit,
  Send,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  Activity,
  Terminal,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
  ChevronRight,
  X,
  User,
  Bot
} from "lucide-react";
import { validateFIXMessage } from "@/lib/fixParser";
import TagDetailsModal from "@/components/TagDetailsModal";

// Interactive suggestion chips to guide users
const SUGGESTIONS = [
  { label: "Explain Logon Flow", query: "logon flow" },
  { label: "How is Checksum calculated?", query: "checksum calculation" },
  { label: "Decode Tag 39 (OrdStatus)", query: "39" },
  { label: "Analyze New Order Single", query: "8=FIX.4.2|9=82|35=D|49=CLIENT|56=BROKER|34=1|11=ORD1|55=AAPL|54=1|38=100|44=175.00|10=082|" }
];

export default function InterpreterPage() {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hello! I am FIXi, your AI-powered companion for FIX protocol diagnostics.\n\nYou can ask me general questions about the FIX session layers, or paste a raw FIX message string (beginning with '8=FIX.') to run structural validations and tag lookup audits.",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [hfConnected, setHfConnected] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  const [activeVersion, setActiveVersion] = useState("FIX.4.4");
  const [showSidebar, setShowSidebar] = useState(false);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedMsgs = localStorage.getItem('fixify-interpreter-messages');
    if (savedMsgs) {
      try {
        setMessages(JSON.parse(savedMsgs));
      } catch (e) {
        console.error("Failed to parse saved interpreter messages", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-interpreter-messages', JSON.stringify(messages));
    } catch (e) {
      console.warn("Could not save interpreter messages", e);
    }
  }, [messages, isLoaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ping API to check connection status
  useEffect(() => {
    async function ping() {
      try {
        const savedKey = localStorage.getItem('fixify-gemini-key') || "";
        const res = await fetch("/interpreter/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gemini-key": savedKey },
          body: JSON.stringify({ query: "8=FIX.4.2|9=5|35=0|10=123|" }),
        });
        const data = await res.json();
        if (data.hfConnected !== undefined) setHfConnected(data.hfConnected);
      } catch {
        setHfConnected(false);
      }
    }
    ping();
  }, []);

  // Format bot response text containing Markdown highlights synchronously
  const formatBotResponse = (text) => {
    if (!text) return null;
    const lines = text.split("\n");

    return lines.map((line, lineIdx) => {
      let content = line;
      let isHeader = false;
      let headerLevel = 0;
      let isBullet = false;

      // Extract markdown headers
      if (line.startsWith("### ")) {
        content = line.substring(4);
        isHeader = true;
        headerLevel = 3;
      } else if (line.startsWith("## ")) {
        content = line.substring(3);
        isHeader = true;
        headerLevel = 2;
      } else if (line.startsWith("# ")) {
        content = line.substring(2);
        isHeader = true;
        headerLevel = 1;
      } else if (line.startsWith("- ")) {
        content = line.substring(2);
        isBullet = true;
      }

      // Regex parse bold **text** or __text__, code `text`, and italic *text*
      const parts = [];
      const regex = /(\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*)/g;
      let match;
      let lastIndex = 0;
      let partIdx = 0;

      while ((match = regex.exec(content)) !== null) {
        const matchIndex = match.index;
        const matchText = match[0];

        if (matchIndex > lastIndex) {
          parts.push(<span key={`txt-${lineIdx}-${partIdx}`}>{content.substring(lastIndex, matchIndex)}</span>);
          partIdx++;
        }

        if ((matchText.startsWith("**") && matchText.endsWith("**")) || (matchText.startsWith("__") && matchText.endsWith("__"))) {
          parts.push(
            <strong key={`bold-${lineIdx}-${partIdx}`} style={{ color: 'var(--primary)' }} className="font-extrabold">
              {matchText.slice(2, -2)}
            </strong>
          );
        } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
          parts.push(
            <code
              key={`code-${lineIdx}-${partIdx}`}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--primary)' }}
            >
              {matchText.slice(1, -1)}
            </code>
          );
        } else if (matchText.startsWith("*") && matchText.endsWith("*")) {
          parts.push(
            <em key={`italic-${lineIdx}-${partIdx}`} className="italic text-zinc-400 font-medium">
              {matchText.slice(1, -1)}
            </em>
          );
        }
        partIdx++;
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < content.length) {
        parts.push(<span key={`txt-end-${lineIdx}`}>{content.substring(lastIndex)}</span>);
      }

      const key = `line-${lineIdx}`;

      if (isHeader) {
        if (headerLevel === 1) return <h1 key={key} className="text-sm font-extrabold mt-4 mb-2 uppercase tracking-wider">{parts}</h1>;
        if (headerLevel === 2) return <h2 key={key} className="text-xs font-bold mt-3 mb-1.5">{parts}</h2>;
        return <h3 key={key} className="text-xs font-semibold mt-2 mb-1" style={{ color: 'var(--foreground)' }}>{parts}</h3>;
      }

      if (isBullet) {
        return (
          <div key={key} className="flex items-start gap-1.5 pl-2.5 my-1.5">
            <span style={{ color: 'var(--primary)' }} className="select-none mt-1 text-[10px]">•</span>
            <span className="flex-1 leading-relaxed text-xs">{parts}</span>
          </div>
        );
      }

      return (
        <div key={key} className={line.trim() === "" ? "h-2" : "min-h-[14px] text-xs leading-relaxed"}>
          {parts}
        </div>
      );
    });
  };

  const handleNewChat = () => {
    setMessages([
      {
        role: "bot",
        text: "Console cleared. Input a raw FIX message to analyze, or ask an integration question."
      }
    ]);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    const userQuery = input.trim();
    await sendQuery(userQuery);
  };

  const sendQuery = async (queryText) => {
    let localValidation = null;
    if (/^8=FIX\./.test(queryText)) {
      localValidation = validateFIXMessage(queryText);
    }

    // Set message validation ONLY on the bot response to avoid duplication in user bubble
    const newMessages = [...messages, { role: "user", text: queryText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const savedKey = localStorage.getItem('fixify-gemini-key') || "";
      const customDialectRaw = localStorage.getItem('fixify-custom-dialect');
      const customDialect = customDialectRaw ? JSON.parse(customDialectRaw) : null;

      const res = await fetch("/interpreter/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-key": savedKey },
        body: JSON.stringify({ query: queryText, customDialect }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "bot",
        text: data.answer || data.error,
        table: data.table || null,
        validation: localValidation // Diagnostics card rendered under bot response bubble only
      }]);
      if (data.hfConnected !== undefined) setHfConnected(data.hfConnected);
    } catch (err) {
      setMessages([...newMessages, { role: "bot", text: "Inference Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-1.5 relative"
      style={{ height: 'calc(100dvh - 110px)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900 shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <BrainCircuit className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            FIXi Interpreter
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            AI-powered FIX protocol diagnostics engine and dictionary lookup.
          </p>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-mono select-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5">
            {hfConnected ? (
              <Wifi className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-400" />
            )}
            <span style={{ color: hfConnected ? 'var(--primary)' : '#f87171' }}>
              AI: {hfConnected ? 'Online' : 'Offline'}
            </span>
          </div>
          <span style={{ color: 'var(--border)' }}>|</span>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 hover:text-[var(--foreground)] text-zinc-400 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Main chat window container */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 items-stretch">
        
        {/* Chat stream area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 rounded-2xl min-h-0"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div key={idx} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 select-none"
                    style={{
                      background: isUser
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : 'var(--primary)',
                      color: isUser ? '#ffffff' : 'var(--background)',
                      boxShadow: isUser
                        ? '0 0 0 2px rgba(99,102,241,0.1)'
                        : '0 0 0 2px var(--primary-faint)',
                    }}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className="max-w-[85vw] sm:max-w-xl md:max-w-2xl space-y-3"
                    style={{
                      background: isUser
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.03))'
                        : 'var(--background)',
                      border: `1px solid ${isUser ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
                      borderRadius: isUser ? '1rem 0.25rem 1rem 1rem' : '0.25rem 1rem 1rem 1rem',
                      padding: '0.875rem 1.25rem',
                    }}
                  >
                    {/* Render Formatted Bot Response or raw user message */}
                    {isUser ? (
                      <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap text-[var(--foreground)]">
                        {msg.text}
                      </p>
                    ) : (
                      <div className="font-mono text-zinc-300 space-y-1">
                        {formatBotResponse(msg.text)}
                      </div>
                    )}                    {/* Validation Card (rendered ONLY in bot response if present) */}
                    {!isUser && msg.validation && (
                      <div
                        className="p-4 rounded-xl space-y-2 text-xs font-mono mt-2"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                      >
                        <div
                          className="flex items-center justify-between pb-1.5"
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          <span className="fx-section-label flex items-center gap-1">
                            <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                            Parser Engine Diagnostics
                          </span>
                          {msg.validation.isValid
                            ? <span className="badge-success">Valid</span>
                            : <span className="badge-danger">Error</span>}
                        </div>

                        {msg.validation.errors.length > 0 ? (
                          <div className="space-y-1" style={{ color: '#f87171' }}>
                            {msg.validation.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>All checksums, body length, and header constraints verified.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tag Breakdown Table */}
                    {!isUser && msg.table && (
                      <div className="overflow-x-auto rounded-xl mt-3" style={{ border: '1px solid var(--border)' }}>
                        <table className="w-full text-xs font-mono min-w-[480px]">
                          <thead>
                            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                              {['Tag', 'Field Name', 'Value', 'Mapped Meaning'].map(h => (
                                <th key={h} className="py-2 px-3 text-left font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.table.map(([tag, value, tagName, mappedValue], i) => (
                              <tr 
                                key={i} 
                                onClick={() => {
                                  setActiveTag(tag);
                                  const tag8Row = msg.table.find(r => String(r[0]) === "8");
                                  setActiveVersion(tag8Row ? tag8Row[1] : "FIX.4.4");
                                }}
                                style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
                              >
                                <td className="py-2 px-3 font-bold" style={{ color: 'var(--primary)' }}>{tag}</td>
                                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>{tagName}</td>
                                <td className="py-2 px-3 font-semibold" style={{ color: 'var(--foreground)' }}>{value}</td>
                                <td className="py-2 px-3" style={{ color: 'var(--foreground)' }}>{mappedValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary)', color: 'var(--background)' }}
                >
                  <Bot className="h-4 w-4" />
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-3 text-xs font-mono"
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '1rem 1rem 1rem 0.25rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Activity className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
                  <span>FIXi is auditing the protocol flow…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Togglable Sidebar: Suggestions & Reference Quick-chips */}
        {showSidebar && (
          <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 justify-between transition-all duration-300">
            <div
              className="p-5 rounded-2xl border flex-1 space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
                  <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                  <span>Prompt Assistant</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowSidebar(false)}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Click any chip below to quickly populate and execute diagnostic lookups in the chat stream:
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(s.query);
                      sendQuery(s.query);
                    }}
                    disabled={loading}
                    className="text-left p-3 rounded-xl border transition-all text-xs font-mono hover:-translate-y-0.5 group flex items-start justify-between gap-2"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary-border)';
                      e.currentTarget.style.background = 'var(--card-hover)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--background)';
                    }}
                  >
                    <span className="text-zinc-350 leading-relaxed">{s.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity mt-0.5" style={{ color: 'var(--primary)' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 items-center p-2 rounded-2xl shrink-0"
        style={{ 
          background: 'var(--card)', 
          border: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSidebar(!showSidebar)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all border shrink-0 ${
            showSidebar
              ? 'bg-[var(--primary)] border-[var(--primary-border)] text-zinc-950 font-bold shadow-md'
              : 'hover:bg-zinc-850 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          style={{
            borderColor: showSidebar ? 'transparent' : 'var(--border)',
            background: showSidebar ? 'var(--primary)' : 'var(--background)'
          }}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
        </button>
        <input
          className="flex-1 py-2 px-3 rounded-xl text-xs font-mono min-w-0"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            outline: 'none',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type logon flow, resend, checksum, Tag 39, or paste raw: 8=FIX.4.2|9=..."
          disabled={loading}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="fx-btn-primary shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>

      {/* Shared Tag Details Modal */}
      {activeTag && (
        <TagDetailsModal
          tag={activeTag}
          version={activeVersion}
          isOpen={!!activeTag}
          onClose={() => setActiveTag(null)}
        />
      )}
    </div>
  );
}
