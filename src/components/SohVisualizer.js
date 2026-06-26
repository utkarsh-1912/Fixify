import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function SohVisualizer({ content, delimiter }) {
  const [copied, setCopied] = useState(false);

  if (!content) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-detect SOH (\x01 or \u0001), pipe (|), or default to standard SOH
  let delim = delimiter;
  if (!delim) {
    if (content.includes('\x01')) {
      delim = '\x01';
    } else if (content.includes('\u0001')) {
      delim = '\u0001';
    } else if (content.includes('^A')) {
      delim = '^A';
    } else if (content.includes('|') && !content.includes('\x01') && !content.includes('\u0001')) {
      delim = '|';
    } else {
      delim = '\x01'; // Default
    }
  }

  // Split by the resolved delimiter
  const parts = content.split(delim);

  return (
    <div className="relative group w-full">
      <div className="flex flex-wrap gap-y-1.5 gap-x-1.5 items-center font-mono text-[10px] break-all select-all leading-relaxed pr-8">
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          if (!part && isLast) return null; // Drop empty final segment if line ends with delimiter

          const tagValueMatch = part.match(/^(\d+)=(.*)$/);
          let partEl = <span className="text-[var(--text-muted)]">{part}</span>;

          if (tagValueMatch) {
            const tag = tagValueMatch[1];
            const val = tagValueMatch[2];
            
            const isHeaderTrailer = tag === '8' || tag === '9' || tag === '10';
            const isMsgType = tag === '35';

            partEl = (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 border shadow-sm transition-all"
                style={{
                  background: 'var(--card)',
                  borderColor: isHeaderTrailer ? 'var(--primary-border)' : 'var(--border-subtle)',
                  color: isMsgType ? 'var(--primary)' : 'var(--foreground)'
                }}
              >
                <span className="font-extrabold text-[9px] mr-1 opacity-75" style={{ color: 'var(--primary)' }}>{tag}=</span>
                <span className="break-all">{val}</span>
              </span>
            );
          }

          return (
            <React.Fragment key={index}>
              {part && partEl}
              {!isLast && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-mono font-bold bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 select-none shadow-sm h-4">
                  SOH
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <button
        onClick={handleCopy}
        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] shadow-sm flex items-center justify-center"
        title="Copy raw message"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
