'use client';

import { useState } from "react";
import {
  Braces,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  CheckCircle,
  FileCode
} from "lucide-react";

export default function XMLFormatterPage() {
  const [input, setInput] = useState("");
  const [formatted, setFormatted] = useState("");
  const [copied, setCopied] = useState(false);

  const formatXml = (xml) => {
    try {
      const PADDING = "  ";
      let formattedText = "";
      let pad = 0;
      const cleaned = xml.replace(/>\s*</g, ">\n<");
      const lines = cleaned.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const isClosing = /^<\/.+?>$/.test(line);
        const isOpening = /^<[^!?\/][^>]*?>$/.test(line) && !isClosing;
        const isSelfClosing = /^<[^>]+\/>$/.test(line);
        const isInlinePair = /^<([^>]+)><\/\1>$/.test(line);
        if (isClosing && !isInlinePair) pad--;
        formattedText += PADDING.repeat(pad) + line + "\n";
        if (isOpening && !isSelfClosing && !isInlinePair) pad++;
      }
      return formattedText.trim();
    } catch { return "Malformed or invalid XML schema."; }
  };

  const highlightXml = (xml) => {
    const escaped = xml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/(&lt;\/?[\w][^&]*?&gt;)/g, '<span style="color:var(--primary);font-weight:600">$1</span>')
      .replace(/(?<=&gt;)([^<]+)(?=&lt;)/g, '<span style="color:var(--foreground);font-weight:500">$1</span>');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => { setInput(""); setFormatted(""); };
  const executeFormat = () => { if (!input.trim()) return; setFormatted(formatXml(input)); };

  const inputStyle = {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    outline: 'none',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fx-page-header flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
              <Braces className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            XML Formatter
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Format, beautify, and syntax-highlight nested XML message payloads.
          </p>
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

        {/* Input */}
        <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <span className="fx-section-label flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Raw XML Payload
            </span>
            <div className="flex gap-2">
              <button onClick={executeFormat} disabled={!input.trim()} className="fx-btn-primary">
                <Sparkles className="h-3.5 w-3.5" /> Format
              </button>
              <button onClick={handleReset} className="fx-btn-secondary">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>
          <textarea
            className="flex-1 p-4 resize-none text-xs font-mono"
            style={{ ...inputStyle, minHeight: '65vh' }}
            placeholder="<root><tag>example_value</tag></root>"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'transparent'}
            onBlur={e => e.target.style.borderColor = 'transparent'}
          />
        </div>

        {/* Output */}
        <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <span className="fx-section-label flex items-center gap-1.5">
              <Braces className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Highlighted Output
            </span>
            {formatted && (
              <button onClick={handleCopy} className="fx-btn-secondary">
                {copied ? <><CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </button>
            )}
          </div>
          <div
            className="flex-1 p-4 overflow-auto text-xs font-mono whitespace-pre leading-relaxed"
            style={{ background: 'var(--background)', minHeight: '65vh', color: 'var(--text-muted)' }}
          >
            {formatted ? (
              <div dangerouslySetInnerHTML={{ __html: highlightXml(formatted) }} />
            ) : (
              <span className="italic" style={{ color: 'var(--text-faint)' }}>
                Formatted XML output will appear here…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
