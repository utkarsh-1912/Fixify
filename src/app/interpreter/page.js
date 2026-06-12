'use client';

import { useState, useRef, useEffect } from "react";
import {
  BrainCircuit,
  Send,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  Activity,
  Terminal,
  Wifi,
  WifiOff
} from "lucide-react";
import { validateFIXMessage } from "@/lib/fixParser";

export default function InterpreterPage() {
  const [messages, setMessages] = useState([{
    role: "bot",
    text: "Hello! I am FIXi, your trading systems AI companion. Paste a raw FIX message string (e.g., beginning with '8=FIX.') to extract tag mappings and validate checksums, or ask general questions about the FIX protocol.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [hfConnected, setHfConnected] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      } catch { setHfConnected(false); }
    }
    ping();
  }, []);

  function handleNewChat() {
    setMessages([{ role: "bot", text: "Console cleared. Input a raw FIX message to analyze, or ask an integration question." }]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userQuery = input.trim();
    let localValidation = null;
    if (/^8=FIX\./.test(userQuery)) localValidation = validateFIXMessage(userQuery);

    const newMessages = [...messages, { role: "user", text: userQuery, validation: localValidation }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const savedKey = localStorage.getItem('fixify-gemini-key') || "";
      const res = await fetch("/interpreter/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-key": savedKey },
        body: JSON.stringify({ query: userQuery }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "bot",
        text: data.answer || data.error,
        table: data.table || null,
        validation: localValidation
      }]);
      if (data.hfConnected !== undefined) setHfConnected(data.hfConnected);
    } catch (err) {
      setMessages([...newMessages, { role: "bot", text: "Inference Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 fx-page-header">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <BrainCircuit className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            FIXi Interpreter
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            AI-powered FIX protocol diagnostics engine and dictionary lookup.
          </p>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
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
            className="flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <PlusCircle className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat stream */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-4 rounded-2xl min-h-0"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-3xl rounded-2xl p-4 space-y-3 shadow-sm"
                style={{
                  background: isUser ? 'var(--primary-faint)' : 'var(--background)',
                  border: `1px solid ${isUser ? 'var(--primary-border)' : 'var(--border)'}`,
                  borderTopRightRadius: isUser ? '4px' : undefined,
                  borderTopLeftRadius: !isUser ? '4px' : undefined,
                }}
              >
                {/* Label */}
                <div
                  className="text-[10px] uppercase font-mono tracking-widest pb-1.5"
                  style={{
                    color: isUser ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {isUser ? 'You' : 'FIXi Console'}
                </div>

                {/* Response text */}
                <p
                  className="text-xs leading-relaxed font-mono whitespace-pre-wrap"
                  style={{ color: 'var(--foreground)' }}
                >
                  {msg.text}
                </p>

                {/* Validation card */}
                {msg.validation && (
                  <div
                    className="p-3.5 rounded-xl space-y-2 text-xs font-mono"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex items-center justify-between pb-1.5"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <span className="fx-section-label flex items-center gap-1">
                        <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                        Parser Engine
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
                        <span>All header constraints, body length, and checksums verified.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tag table */}
                {msg.table && (
                  <div className="rounded-xl overflow-hidden mt-1" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          {['Tag', 'Field Name', 'Value', 'Mapped Meaning'].map(h => (
                            <th key={h} className="py-2 px-3 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.table.map(([tag, value, tagName, mappedValue], i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
          <div className="flex items-center gap-2.5 px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            <Activity className="h-4 w-4 animate-spin" style={{ color: 'var(--primary)' }} />
            <span>FIXi is thinking…</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-3 items-center p-3 rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <span className="text-xs font-mono hidden sm:inline shrink-0" style={{ color: 'var(--text-muted)' }}>
          FIXI&gt;
        </span>
        <input
          className="flex-1 py-2 px-3 rounded-xl text-xs font-mono"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            outline: 'none',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a query or paste: 8=FIX.4.2|9=73|35=0|…"
          disabled={loading}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="fx-btn-primary"
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </button>
      </form>
    </div>
  );
}
