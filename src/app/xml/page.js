// ---- Updated XML Formatter Page (app/xml/page.js) with colored tags and values and improved layout ----
"use client";
import { useState } from "react";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

export default function XMLFormatterPage() {
  const [input, setInput] = useState("");
  const [formatted, setFormatted] = useState("");
  const [copied, setCopied] = useState(false);

  const formatXml = (xml) => {
    try {
      const PADDING = "  ";
      let formatted = "";
      let pad = 0;

      xml = xml.replace(/>\s*</g, ">\n<");
      const lines = xml.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const isClosing = /^<\/.+?>$/.test(line);
        const isOpening = /^<[^!?\/][^>]*?>$/.test(line) && !isClosing;
        const isSelfClosing = /^<[^>]+\/>$/.test(line);
        const isInlinePair = /^<([^>]+)><\/\1>$/.test(line);

        if (isClosing && !isInlinePair) pad--;

        formatted += PADDING.repeat(pad) + line + "\n";

        if (isOpening && !isSelfClosing && !isInlinePair) pad++;
      }

      return formatted.trim();
    } catch (err) {
      return "Invalid XML";
    }
  };

  const highlightXml = (xml) => {
    const highlighted = xml
      .replace(/(&lt;\/?\w+[^&]*?&gt;)/g, '<span class="text-blue-600 font-semibold">$1</span>')
      .replace(/(?<=&gt;)([^<]+)(?=&lt;)/g, '<span class="text-purple-700 font-bold">$1</span>');
    return highlighted;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInput("");
    setFormatted("");
  };

  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">🛠️ XML Formatter</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col relative">
          <div className="flex items-center justify-between mb-1 px-1">
            <label className="font-semibold mb-0.5">🔤 Paste Raw XML</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormatted(formatXml(input))}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1 rounded shadow"
              >
                Format
              </button>
              <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded shadow"
              >
                Reset
              </button>
            </div>
          </div>
          <textarea
            className="w-full h-[70vh] p-3 border border-gray-300 rounded shadow-sm text-sm font-mono"
            placeholder="&lt;root&gt;&lt;tag&gt;value&lt;/tag&gt;&lt;/root&gt;"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col relative">
          <div className="flex items-center justify-between mb-1 px-1 h-[30px]">
            <label className="font-semibold">🧾 Formatted Output</label>
          </div>
          <div
            className="w-full h-[70vh] p-3 border border-gray-200 rounded bg-gray-50 shadow-inner text-sm font-mono overflow-auto whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightXml(formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;')) }}
          />
          {formatted && (
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 mt-8 mr-2 bg-white border rounded p-1 hover:bg-gray-100"
              title="Copy to clipboard"
            >
              {copied ? (
                <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
