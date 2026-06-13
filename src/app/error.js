'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, RotateCcw, Home, Terminal, ChevronDown, ChevronRight, Bug } from 'lucide-react';

export default function GlobalError({ error, reset }) {
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    // Log the error to an analytics or error tracking service in production if needed
    console.error('System Exception Detected:', error);
  }, [error]);

  const mockFixFields = [
    { tag: '8', name: 'BeginString', value: 'FIX.4.4', desc: 'Protocol version' },
    { tag: '35', name: 'MsgType', value: 'j', desc: 'Business Message Reject (Execution failed)' },
    { tag: '34', name: 'MsgSeqNum', value: '500', desc: 'Sequence number representing status code' },
    { tag: '49', name: 'SenderCompID', value: 'FIXIFY', desc: 'The application hosting engine' },
    { tag: '56', name: 'TargetCompID', value: 'VISITOR', desc: 'Client consumer' },
    { tag: '380', name: 'BusinessRejectReason', value: '5', desc: 'Conditionally Required Field Missing / Processing Failure' },
    { tag: '58', name: 'Text', value: error.message || 'Unknown Exception Intercepted', desc: 'Exception string details' },
    { tag: '10', name: 'CheckSum', value: '042', desc: 'Message checksum' },
  ];

  const rawFixMessage = `8=FIX.4.4\x019=168\x0135=j\x0134=500\x0149=FIXIFY\x0156=VISITOR\x01380=5\x0158=${error.message || 'Unknown Exception Intercepted'}\x0110=042\x01`;

  return (
    <div className="flex flex-col items-center justify-center py-10 md:py-16 max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Alert Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-2" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <AlertOctagon className="h-8 w-8 text-red-500 animate-pulse" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight font-mono" style={{ color: 'var(--foreground)' }}>
          CRASH <span style={{ color: 'var(--primary)' }}>_</span>
        </h1>
        <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
          Execution Reject Intercepted
        </h2>
        <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
          The local session encountered an unhandled application loop warning or processing boundary error. A Reject (35=j) packet has been generated.
        </p>
      </div>

      {/* Raw Reject Packet Panel */}
      <div className="w-full fx-card space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <span className="fx-section-label flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 animate-pulse" style={{ color: 'var(--primary)' }} />
            Business Reject Packet (RAW)
          </span>
          <span className="badge-success bg-red-500/10 border-red-500/20 text-red-400 font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">
            EXEC_REJECT
          </span>
        </div>

        <div 
          className="p-3.5 rounded-lg text-xs break-all font-mono leading-relaxed" 
          style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          {rawFixMessage.replaceAll('\x01', ' | ')}
        </div>

        {/* Parsed Fields Table */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Parsed Tag Analysis
          </p>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-[11px] font-mono text-left">
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-3 font-semibold w-12 text-center">Tag</th>
                  <th className="py-2 px-3 font-semibold">Field Name</th>
                  <th className="py-2 px-3 font-semibold">Value</th>
                  <th className="py-2 px-3 font-semibold hidden sm:table-cell">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {mockFixFields.map((field) => (
                  <tr key={field.tag} className="border-b hover:bg-zinc-800/10 dark:hover:bg-zinc-900/30" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="py-2 px-3 font-bold text-center" style={{ color: 'var(--primary)' }}>{field.tag}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--foreground)' }}>{field.name}</td>
                    <td className="py-2 px-3 font-semibold text-red-400 break-all">{field.value}</td>
                    <td className="py-2 px-3 text-[10px] hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{field.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* JavaScript Exception Details */}
        {error.stack && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setShowStack(!showStack)}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              {showStack ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Bug className="h-3.5 w-3.5" /> View JavaScript Stack Trace
            </button>

            {showStack && (
              <div 
                className="mt-3 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-48 border select-all"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <div className="font-bold text-red-400 mb-1">{error.name}: {error.message}</div>
                <pre className="whitespace-pre">{error.stack}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <button
          onClick={() => reset()}
          className="fx-btn-primary justify-center cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" /> Reset Session &amp; Retry
        </button>
        <Link href="/" className="fx-btn-secondary justify-center">
          <Home className="h-4 w-4" /> Return to Console
        </Link>
      </div>
    </div>
  );
}
