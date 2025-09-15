"use client";
import { useState } from "react";

export default function InterpreterPage() {
  const [query, setQuery] = useState("");
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/interpreter/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context }),
      });

      const data = await res.json();
      setAnswer(data.answer || data.error);
    } catch (err) {
      setAnswer("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">Fixify - FIX Interpreter</h1>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl flex flex-col gap-4"
      >
        <textarea
          className="border p-2 rounded"
          rows={3}
          placeholder="Enter FIX message"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <textarea
          className="border p-2 rounded"
          rows={2}
          placeholder="Optional RAG context (from docs/db)"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading? "Interpreting...": "Interpret"}
        </button>
      </form>

      {answer && (
        <div className="mt-6 w-full max-w-xl bg-white shadow p-4 rounded">
          <h2 className="font-semibold mb-2">Interpretation:</h2>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
