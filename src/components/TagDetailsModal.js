'use client';

import React from 'react';
import { X, BookOpen, Layers, Info, Hash } from 'lucide-react';
import fixDescriptions from '@/data/fix-description.json';
import fix40 from '@/data/FIX/FIX40.json';
import fix42 from '@/data/FIX/FIX42.json';
import fix44 from '@/data/FIX/FIX44.json';
import fix50 from '@/data/FIX/FIX50.json';
import fixt11 from '@/data/FIX/FIXT11.json';

const DICTS = {
  "FIX.4.0": fix40,
  "FIX.4.1": fix40,
  "FIX.4.2": fix42,
  "FIX.4.3": fix44,
  "FIX.4.4": fix44,
  "FIX.5.0": fix50,
  "FIXT.1.1": fixt11
};

// Helper to parse simple markdown formatting: **bold**, *italic*, `code`, and newlines
function formatRichText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/;
    const splitParts = line.split(tokenRegex);
    const formattedLine = splitParts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx} className="font-extrabold" style={{ color: 'var(--foreground)' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={partIdx} className="italic opacity-90" style={{ color: 'var(--foreground)' }}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={partIdx} className="px-1.5 py-0.5 rounded border font-mono text-[11px]" style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {formattedLine}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export default function TagDetailsModal({ tag, version = "FIX.4.4", isOpen, onClose, val1, val2, mappedVal1, mappedVal2 }) {
  if (!isOpen || !tag) return null;

  const tagStr = String(tag).trim();
  
  // Find standard description
  const descInfo = fixDescriptions.FIX_Tags_Description.find(
    (d) => String(d.tag) === tagStr
  ) || {};

  // Find version-specific field info
  const dictData = DICTS[version] || DICTS["FIX.4.4"];
  const fieldInfo = dictData?.fields?.find((f) => String(f.tag) === tagStr) || {};

  // Final metadata
  const tagName = fieldInfo.name || descInfo.name || `CustomTag_${tagStr}`;
  const tagType = fieldInfo.type || "UNKNOWN";
  const description = descInfo.description || "No description available for this tag.";
  const note = descInfo.note || null;
  const enums = fieldInfo.values || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div
        className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            <BookOpen className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span>Tag Dictionary Lookup</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Main Info Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold tracking-tight flex items-baseline gap-2" style={{ color: 'var(--foreground)' }}>
                <span className="text-[var(--primary)] font-mono">Tag {tagStr}</span>
                <span className="text-lg font-bold">{tagName}</span>
              </h2>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] uppercase font-mono font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                  {tagType}
                </span>
                <span className="text-[10px] uppercase font-mono font-bold bg-[var(--primary-faint)] text-[var(--primary)] px-2 py-0.5 rounded border border-[var(--primary-border)]">
                  {version}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <p className="fx-section-label flex items-center gap-1.5 text-zinc-400 font-mono text-[10px]">
              <Info className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Definition
            </p>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {formatRichText(description)}
            </p>
          </div>

          {/* Note if any */}
          {note && (
            <div 
              className="p-4 rounded-xl border space-y-1 text-xs"
              style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)' }}
            >
              <p className="font-bold text-[var(--primary)] font-mono uppercase tracking-wide text-[9px]">Note &amp; Usage</p>
              <p className="leading-relaxed" style={{ color: 'var(--foreground)' }}>{formatRichText(note)}</p>
            </div>
          )}

          {/* Render Compared Values if available, otherwise fallback to standard Allowed Values */}
          {(val1 !== undefined || val2 !== undefined) ? (
            <div className="space-y-2.5">
              <p className="fx-section-label flex items-center gap-1.5 text-zinc-400 font-mono text-[10px]">
                <Layers className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                Compared Message Values
              </p>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800" style={{ color: 'var(--text-muted)' }}>
                      <th className="py-2 px-3.5 font-semibold">Source</th>
                      <th className="py-2 px-3.5 font-semibold w-20">Raw Value</th>
                      <th className="py-2 px-3.5 font-semibold">Value Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                      <td className="py-2 px-3.5 font-bold" style={{ color: 'var(--foreground)' }}>Message 1</td>
                      <td className="py-2 px-3.5 font-bold" style={{ color: 'var(--primary)' }}>{val1 ?? '—'}</td>
                      <td className="py-2 px-3.5" style={{ color: 'var(--foreground)' }}>{mappedVal1 ?? '—'}</td>
                    </tr>
                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                      <td className="py-2 px-3.5 font-bold" style={{ color: 'var(--foreground)' }}>Message 2</td>
                      <td className="py-2 px-3.5 font-bold" style={{ color: 'var(--primary)' }}>{val2 ?? '—'}</td>
                      <td className="py-2 px-3.5" style={{ color: 'var(--foreground)' }}>{mappedVal2 ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            enums.length > 0 && (
              <div className="space-y-2.5">
                <p className="fx-section-label flex items-center gap-1.5 text-zinc-400 font-mono text-[10px]">
                  <Layers className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  Allowed Values ({enums.length})
                </p>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-xs font-mono text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800" style={{ color: 'var(--text-muted)' }}>
                        <th className="py-2 px-3.5 font-semibold w-16">Value</th>
                        <th className="py-2 px-3.5 font-semibold">Description / Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enums.map((val) => (
                        <tr 
                          key={val.enum} 
                          className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                        >
                          <td className="py-2 px-3.5 font-bold" style={{ color: 'var(--primary)' }}>
                            {val.enum}
                          </td>
                          <td className="py-2 px-3.5" style={{ color: 'var(--foreground)' }}>
                            {val.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
