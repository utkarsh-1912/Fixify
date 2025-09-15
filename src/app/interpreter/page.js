"use client";
import { useState } from "react";

export default function InterpreterPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-white text-gray-800 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">Fixify - FIX Interpreter Chat</h1>

      <div className="w-full max-w-2xl flex-1 overflow-y-auto border rounded bg-gray-50 p-4 mb-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg ${
              msg.role === "user"
                ? "bg-blue-100 text-right"
                : "bg-gray-200 text-left"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.text}</p>

            {msg.table && (
              <table className="mt-3 w-full border text-sm bg-white">
                <thead>
                  <tr className="bg-gray-300">
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
            )}
          </div>
        ))}
        {loading && <p className="text-gray-500">Interpreting...</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl flex gap-2 items-center"
      >
        <input
          className="flex-1 border p-2 rounded bg-white text-gray-800"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a FIX message or question..."
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Send
        </button>
      </form>
    </div>
  );
}
