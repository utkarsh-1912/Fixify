'use client';

import { Shield, EyeOff, Lock } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="fx-page-header space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
          >
            <Shield className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Data Security &amp; Privacy
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          How we handle session messages and logs.
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-6 py-4 flex items-center gap-2 text-xs font-bold font-mono"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
        >
          <EyeOff className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          100% Client-Side Processing
        </div>

        <div className="px-6 py-5 space-y-4 text-xs font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <p>
            At FIXify, your transaction details are secure. All uploaded logs, parsed timestamps,
            and checksum calculations are processed directly inside your browser memory context.
          </p>
          <p>
            Message files are <strong style={{ color: 'var(--foreground)' }}>never</strong> uploaded to servers,
            cached, or transmitted to external endpoints. The workspace acts entirely as a local static compiler.
          </p>

          <div
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[11px] font-semibold"
            style={{
              background: 'var(--primary-faint)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary)',
            }}
          >
            <Lock className="h-3.5 w-3.5" />
            Encrypted locally. No database persistence.
          </div>
        </div>
      </div>
    </div>
  );
}