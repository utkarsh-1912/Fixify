"use client";
import { useState, useRef, useEffect } from "react";

export default function InterpreterPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleNewChat() {
    setMessages([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/interpreter/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      });

      const data = await res.json();
      const botMsg = {
        role: "bot",
        text: data.answer || data.error,
        table: data.table || null,
      };

      setMessages([...newMessages, botMsg]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: "bot", text: "Error: " + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto flex flex-col h-screen">
<div className="mb-4 flex items-center justify-between">
  <h1 className="text-3xl font-bold">Fixify - FIX Interpreter</h1>
  <div className="flex items-center gap-2">
    <span className={`w-3 h-3 rounded-full ${hfConnected ? "bg-green-400" : "bg-red-400"}`} />
    <span className="text-sm">{hfConnected ? "HF Connected" : "HF Offline"}</span>
    <button
      onClick={handleNewChat}
      className="ml-4 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium"
    >
      + New Chat
    </button>
  </div>
</div>


      {/* Chat area */}
      <div className="flex-1 overflow-y-auto border rounded bg-gray-50 p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xl rounded-2xl px-4 py-3 shadow ${
                msg.role === "user"
                  ? "bg-gray-600 text-white rounded-br-none"
                  : "bg-white text-gray-800 border rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {msg.table && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border text-sm bg-white text-gray-800 rounded-lg">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border px-2 py-1">Tag</th>
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">Value</th>
                        <th className="border px-2 py-1">Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {msg.table.map(([tag, value, tagName, mappedValue], i) => (
                        <tr key={i}>
                          <td className="border px-2 py-1 font-mono">{tag}</td>
                          <td className="border px-2 py-1">{tagName}</td>
                          <td className="border px-2 py-1">{value}</td>
                          <td className="border px-2 py-1">{mappedValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <p className="text-gray-500">Interpreting...</p>}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 w-full flex gap-2 items-center"
      >
        <input
          className="flex-1 border rounded-xl p-3 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a FIX message or question..."
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-600 text-white px-5 py-2 rounded-xl hover:bg-gray-700 disabled:bg-gray-400"
        >
          Send
        </button>
      </form>
    </main>
  );
}
