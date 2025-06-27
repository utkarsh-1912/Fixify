// ---- Updated XML Formatter Page (app/xml/page.js) with colored tags and values ----
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
      const reg = /(>)(<)(\/*)/g;
      let xmlFormatted = "";
      let pad = 0;

      xml = xml.replace(reg, "$1\r\n$2");
      const lines = xml.split("\r\n");

      for (let i = 0; i < lines.length; i++) {
        const node = lines[i].trim();

        if (!node) continue;

        let indent = 0;
        if (/^<\/.+>/.test(node)) {
          pad -= 1;
        }

        xmlFormatted += PADDING.repeat(pad) + node + "\n";

        if (/^<[^!?\/][^>]*[^/]?>/.test(node) && !/<\/[^>]+>\s*$/.test(node)) {
          indent = 1;
        }

        pad += indent;
      }

      return xmlFormatted.trim();
    } catch {
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

  const handleReset = ()=>{
    setInput("");
    setFormatted(""); 
  } 

  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">🛠️ XML Formatter</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col">
          <label className="font-semibold mb-1">🔤 Paste Raw XML</label>
          <textarea
            className="w-full h-[70vh] p-3 border border-gray-300 rounded shadow-sm text-sm font-mono"
            placeholder="&lt;root&gt;&lt;tag&gt;value&lt;/tag&gt;&lt;/root&gt;"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col relative">
          <label className="font-semibold mb-1">🧾 Formatted Output</label>
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
      <div className="flex gap-2">
      <button
        onClick={() => setFormatted(formatXml(input))}
        className="mt-6 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded shadow-md"
      >
        Format XML
      </button>
      <button
        onClick={handleReset}
        className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded shadow-md"
      >
        Reset
      </button>
      </div>
    </main>
  );
}
