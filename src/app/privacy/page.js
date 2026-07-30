'use client';

import { 
  Shield, EyeOff, Lock, ServerOff, Database, RefreshCw, Key, Cloud, Eye, 
  FileCode, Terminal, CheckCircle2, AlertCircle, ArrowUpRight, Sparkles, Cpu
} from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  const securityCheckpoints = [
    {
      icon: ServerOff,
      title: "No Remote Storage",
      badge: "Zero Persistence",
      desc: "All session transcripts, message lists, and XML uploads stay strictly within your browser context. No remote server logs or tracks your logs."
    },
    {
      icon: Database,
      title: "Volatile Memory Sandbox",
      badge: "In-Memory",
      desc: "Your data resides strictly in volatile RAM. Closing the browser tab or clicking 'Clear Logs' wipes out all calculated states and caches instantly."
    },
    {
      icon: RefreshCw,
      title: "Client-Side Processing",
      badge: "Web Workers",
      desc: "FIX validations, RTT hop offsets, checksum calculations, and chart generators execute locally as static browser worker threads."
    },
    {
      icon: Key,
      title: "End-to-End P2P Encryption",
      badge: "AES-256",
      desc: "Chat rooms utilize local shared keys to encrypt messages in the browser before socket relay. The server cannot inspect chat transcripts."
    },
    {
      icon: Cloud,
      title: "Opt-In Intelligence",
      badge: "Offline AI",
      desc: "Conversational diagnostics run offline by default (AURA engine). External API integrations are strictly opt-in and store keys locally."
    },
    {
      icon: EyeOff,
      title: "Local Sanitization Shield",
      badge: "PII Masking",
      desc: "Masking of credentials, names, CompIDs, and prices runs client-side inside the browser sandbox before any sanitised files are saved."
    },
    {
      icon: FileCode,
      title: "Isolated Custom Schemas",
      badge: "QuickFIX XML",
      desc: "Uploaded custom QuickFIX XML dialect schemas reside exclusively in local browser storage and are never uploaded to external servers."
    },
    {
      icon: Database,
      title: "In-Memory Blotter Audits",
      badge: "Reconciliation",
      desc: "Blotter database files (CSV/TSV/Excel) parsed in the Missing Fills analyzer are held only in temporary variables and wiped on page refresh."
    },
    {
      icon: Terminal,
      title: "Sandboxed Code Execution",
      badge: "Developer",
      desc: "Script templates in the Code Sandbox run entirely inside your browser sandbox, without executing arbitrary commands on your host system."
    }
  ];

  const complianceGuarantees = [
    { title: "Zero Tracking Cookies & Third-Party Telemetry", detail: "We do not embed Google Analytics, Mixpanel, or advertising trackers." },
    { title: "Zero Database Infrastructure", detail: "FIXify backend operates without any database storing trading messages." },
    { title: "Client-Side Cryptographic Hashing", detail: "Salaried cyrb128 hashing runs 100% inside your browser environment." },
    { title: "Enterprise Firewall Friendly", detail: "Runs completely offline inside air-gapped corporate environments." },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10 px-3 sm:px-6 py-6 sm:py-10">

      {/* ── Hero Banner ── */}
      <div 
        className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 overflow-hidden border shadow-2xl transition-all"
        style={{ 
          background: 'linear-gradient(135deg, var(--card) 0%, var(--primary-faint) 100%)',
          borderColor: 'var(--primary-border)' 
        }}
      >
        <div className="absolute top-0 right-0 h-64 w-64 bg-[var(--primary)] opacity-[0.06] rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-semibold border"
               style={{ background: 'var(--card)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}>
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Local-First Zero-Persistence Architecture</span>
          </div>

          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Data Privacy &amp; <span style={{ color: 'var(--primary)' }}>Security Shield</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Financial institutions process highly confidential trading logs and order execution reports. FIXify is designed from the ground up so that your logs **never leave your local workstation**.
            </p>
          </div>

          {/* Environment Status Badge */}
          <div 
            className="inline-flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-3.5 rounded-2xl border text-[11px] sm:text-xs font-mono w-full sm:w-auto"
            style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span style={{ color: 'var(--foreground)' }}>
              Current Status: <strong className="text-[var(--primary)]">Local Memory Isolated</strong> — 0 bytes sent remotely
            </span>
          </div>
        </div>
      </div>

      {/* ── Security Checkpoints Grid ── */}
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-mono text-[var(--primary)]">
            Security Checkpoints &amp; Protections
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            How FIXify guarantees confidentiality across every toolset in the suite.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
          {securityCheckpoints.map((pt, idx) => (
            <div 
              key={idx} 
              className="p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-3.5 sm:space-y-4 transition-all hover:scale-[1.01] hover:shadow-lg group"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center border" style={{ background: 'var(--primary-faint)', borderColor: 'var(--border)' }}>
                    <pt.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[var(--primary)]" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {pt.badge}
                  </span>
                </div>
                <h3 className="text-xs font-bold font-mono text-[var(--foreground)] uppercase tracking-wider group-hover:text-[var(--primary)] transition-colors">
                  {pt.title}
                </h3>
                <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--text-muted)]">
                  {pt.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Compliance Checklist ── */}
      <div 
        className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 border space-y-4 sm:space-y-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-faint)' }}>
            <CheckCircle2 className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-[var(--foreground)]">Enterprise Compliance Checklist</h3>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">Verified guarantees for info-sec and compliance teams</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {complianceGuarantees.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl border" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
              <CheckCircle2 className="h-4 w-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold font-mono text-[var(--foreground)]">{item.title}</p>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contact Navigation Footer ── */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 rounded-2xl border gap-4"
        style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)' }}
      >
        <div className="space-y-0.5 text-left">
          <p className="text-xs sm:text-sm font-bold text-[var(--primary)]">Have compliance or security auditing questions?</p>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">Contact our security desk for self-hosting or air-gapped deployment guides.</p>
        </div>
        <Link 
          href="/contact" 
          className="w-full sm:w-auto fx-btn-primary py-2 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
        >
          Contact Security Desk <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

    </div>
  );
}