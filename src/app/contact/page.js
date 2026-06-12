'use client';

import { Mail, HelpCircle, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="fx-page-header space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
          >
            <Mail className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Contact Support
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Have diagnostic questions or need custom tag mapping specifications?
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
          <HelpCircle className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          Support Desk Routing
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-muted)' }}>
            For configuration guidelines, custom dictionary maps, or reporting issues, contact our developer terminal support at:
          </p>

          <div
            className="py-3 px-4 rounded-xl text-sm font-semibold font-mono text-center select-all"
            style={{
              background: 'var(--primary-faint)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary)',
            }}
          >
            support@fixify.app
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            <Clock className="h-3.5 w-3.5" />
            Typical response latency: &lt; 24–48 business hours.
          </div>
        </div>
      </div>
    </div>
  );
}