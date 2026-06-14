import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, Eye, X } from 'lucide-react';

export default function ErrorAnalyticsModal({ errorType, files, isOpen, onClose, onInspect }) {
  const [copiedId, setCopiedId] = useState(null);

  if (!isOpen || !errorType) return null;

  // Gather matching error lines
  const errors = [];
  files.forEach(fileObj => {
    fileObj.parsedLines.forEach((lineObj, idx) => {
      if (lineObj.validation && !lineObj.validation.isValid) {
        const isChecksumErr = lineObj.validation.errors.some(e => e.toLowerCase().includes("checksum"));
        const isLengthErr = lineObj.validation.errors.some(e => e.toLowerCase().includes("bodylength"));
        
        if (
          (errorType === 'checksum' && isChecksumErr) ||
          (errorType === 'length' && isLengthErr)
        ) {
          errors.push({
            fileName: fileObj.name,
            lineIndex: idx + 1,
            line: lineObj
          });
        }
      }
    });
  });

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const title = errorType === 'checksum' ? 'Checksum Errors Diagnostic Report' : 'Body Length Errors Diagnostic Report';
  const color = errorType === 'checksum' ? '#f87171' : '#fb923c';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            <AlertTriangle className="h-4 w-4" style={{ color }} />
            <span>{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold" style={{ background: `${color}15`, color }}>
              {errors.length} failed
            </span>
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
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errors.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs italic">
              No matching errors found in current session.
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map(({ fileName, lineIndex, line }, idx) => {
                const seq = line.validation?.msgSeqNum || 'N/A';
                const isCopied = copiedId === line.id;
                
                return (
                  <div
                    key={line.id}
                    className="p-4 rounded-xl border space-y-3 transition-all"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold uppercase px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                          {line.validation?.msgTypeName || 'Unknown'} (35={line.msgType || '?'})
                        </span>
                        <span className="text-zinc-500">
                          Source: {fileName} · Line {lineIndex} · Seq: {seq}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(line.id, line.content)}
                          className="px-2 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-1 select-none"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-[9px] text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span className="text-[9px]">Copy Message</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => onInspect(line)}
                          className="px-2 py-1 rounded-lg border border-zinc-850 hover:border-[var(--primary-border)] bg-[var(--primary-faint)] text-[var(--primary)] hover:text-white transition-all flex items-center gap-1 select-none font-bold"
                          style={{ borderColor: 'var(--primary-border)' }}
                        >
                          <Eye className="h-3 w-3" />
                          <span className="text-[9px]">Inspect</span>
                        </button>
                      </div>
                    </div>

                    {/* Error Messages */}
                    <div className="bg-red-950/10 border border-red-900/20 rounded-lg p-3 space-y-1">
                      <p className="text-[9px] font-bold text-red-400 font-mono uppercase tracking-wider">Validation Errors</p>
                      <ul className="text-xs space-y-1 font-mono text-red-500">
                        {line.validation.errors
                          .filter(err => {
                            if (errorType === 'checksum') {
                              return err.toLowerCase().includes("checksum");
                            } else {
                              return err.toLowerCase().includes("bodylength");
                            }
                          })
                          .map((err, eIdx) => (
                            <li key={eIdx}>· {err}</li>
                          ))
                        }
                      </ul>
                    </div>

                    {/* Raw FIX Message */}
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-zinc-500 font-mono uppercase tracking-wider">Raw Payload</p>
                      <div className="p-3 rounded-lg text-[10px] break-all font-mono bg-zinc-950/60 border border-zinc-900 text-zinc-400 max-h-16 overflow-y-auto">
                        {line.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3.5 flex justify-end shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <button
            onClick={onClose}
            className="fx-btn-secondary px-4 py-1.5 text-xs font-mono"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
