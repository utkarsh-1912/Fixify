'use client';

import { Shield, EyeOff, Lock, ServerOff, Database, RefreshCw, Key, Cloud, Eye, FileCode, Terminal } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  const securityCheckpoints = [
    {
      icon: ServerOff,
      title: "No Remote Storage",
      desc: "All session transcripts, message lists, and XML uploads stay strictly within your browser context. No remote server logs or tracks your logs."
    },
    {
      icon: Database,
      title: "Local Session Limits",
      desc: "Your data resides strictly in volatile memory. Closing the browser tab or hitting 'Clear Logs' wipes out all calculated states and caches instantly."
    },
    {
      icon: RefreshCw,
      title: "Client-Side Compiler",
      desc: "FIX validations, RTT hop offsets, checksum calculations, and chart generators execute locally as static browser processes."
    },
    {
      icon: Key,
      title: "End-to-End P2P Encryption",
      desc: "Chat rooms utilize local shared keys to encrypt messages in the browser before socket relay. The server cannot inspect chat transcripts."
    },
    {
      icon: Cloud,
      title: "Opt-In Cloud Intelligence",
      desc: "Conversational diagnostics run offline by default (AURA). Gemini reasoning is strictly opt-in and insulates your API keys in local storage."
    },
    {
      icon: Eye,
      title: "Local Sanitizer scrubbing",
      desc: "Masking of credentials, names, CompIDs, and prices runs client-side inside the browser sandbox before any sanitised files are saved."
    },
    {
      icon: FileCode,
      title: "Isolated Dialect Schemas",
      desc: "Uploaded custom QuickFIX XML dialect schemas reside exclusively in local storage and are never uploaded or synced to external servers."
    },
    {
      icon: Database,
      title: "In-Memory Blotter Audits",
      desc: "Blotter database files (CSV/TSV/Excel) parsed in the Missing Fills analyzer are held only in temporary variables and wiped on page refresh."
    },
    {
      icon: Terminal,
      title: "Sandboxed Code Execution",
      desc: "Script templates in the Code Sandbox run entirely inside your browser sandbox, without executing arbitrary commands on your host system."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-10 px-4 py-6">
      {/* Header section with theme icon */}
      <div className="fx-page-header space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
          >
            <Shield className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Data Privacy &amp; Security
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          FIXify is built on a local-first, zero-persistence model. Read how we isolate your financial transaction details.
        </p>
      </div>

      {/* Main card panel */}
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div
          className="px-6 py-4 flex items-center gap-2.5 text-xs font-bold font-mono border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
        >
          <EyeOff className="h-4 w-4 text-[var(--primary)]" />
          Data Confidentiality Shield
        </div>

        <div className="p-6 space-y-6">
          <p className="text-xs leading-relaxed font-mono text-[var(--text-muted)]">
            As a local-first toolkit, FIXify respects the absolute security of your logs and message files. Financial institutions work with sensitive trading logs; our design enforces that logs never leave the device on which the application is running.
          </p>

          {/* Grid points */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {securityCheckpoints.map((pt, idx) => (
              <div 
                key={idx} 
                className="p-4 rounded-xl space-y-2.5 border"
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-faint)' }}>
                  <pt.icon className="h-4 w-4 text-[var(--primary)]" />
                </div>
                <h3 className="text-[11px] font-bold font-mono text-[var(--foreground)] uppercase tracking-wider">{pt.title}</h3>
                <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">{pt.desc}</p>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-[11px] font-semibold font-mono text-center"
            style={{
              background: 'var(--primary-faint)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary)',
            }}
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Local Encryption Active · Zero Database Connectivity</span>
          </div>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="text-center font-mono text-[10px] text-[var(--text-muted)]">
        Have questions about compliance auditing? Reach our support desk at{" "}
        <Link href="/contact" className="text-[var(--primary)] hover:underline">
          Contact Support
        </Link>
      </div>
    </div>
  );
}