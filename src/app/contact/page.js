'use client';

import { Mail, HelpCircle, Clock, MessageSquare, Terminal, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const supportChannels = [
    {
      icon: Mail,
      title: "General & Integration Support",
      desc: "For general inquiries, account setup help, or custom client onboarding assistance.",
      actionLabel: "Email Integration Support",
      href: "mailto:support@fixify.4u?subject=[FIXify Support Inquiry]"
    },
    {
      icon: Terminal,
      title: "Developer & Schema Dictionary Desk",
      desc: "For submitting custom FIX dictionaries, reports, or tag mapping specification requests.",
      actionLabel: "Email Schema Team",
      href: "mailto:support@fixify.4u?subject=[FIXify Schema Customization]"
    },
    {
      icon: ShieldCheck,
      title: "Security & Compliance Auditing",
      desc: "For inquiries regarding browser containment, sandboxed scripts, or self-hosted builds.",
      actionLabel: "Email Security Team",
      href: "mailto:security@fixify.4u?subject=[FIXify Security Verification]"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 px-4 py-6">
      {/* Page Header */}
      <div className="fx-page-header space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
          >
            <Mail className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Support Desk
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Get in touch with our specialized support desks. All data analysis is kept strictly local.
        </p>
      </div>

      {/* Grid of contact desks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {supportChannels.map((ch, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl border flex flex-col justify-between space-y-5 transition-all hover:bg-zinc-900/10 dark:hover:bg-zinc-800/10 group"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="space-y-4">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center border transition-colors group-hover:border-[var(--primary-border)]"
                style={{ background: 'var(--primary-faint)', borderColor: 'var(--border)' }}
              >
                <ch.icon className="h-4.5 w-4.5" style={{ color: 'var(--primary)' }} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xs font-bold font-mono text-[var(--foreground)] uppercase tracking-wider">
                  {ch.title}
                </h2>
                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {ch.desc}
                </p>
              </div>
            </div>

            <a
              href={ch.href}
              className="w-full py-2 px-3 rounded-lg border text-center text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 hover:bg-[var(--primary-faint)]"
              style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
            >
              {ch.actionLabel} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      {/* General Dispatch Card */}
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div
          className="px-6 py-4 flex items-center gap-2 text-xs font-bold font-mono border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
        >
          <HelpCircle className="h-4 w-4 text-[var(--primary)]" />
          Technical Desk Availability
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3 font-mono text-xs text-[var(--text-muted)]">
            <p className="leading-relaxed">
              Our support desks process tickets Monday through Friday. If you require standard compliance logs onboarding, you can also mail pre-formatted JSON schemas to speed up custom dict matching:
            </p>
            <div className="flex items-center gap-2 text-[10px]">
              <Clock className="h-4 w-4 text-[var(--primary)] shrink-0" />
              <span>Response Latency: &lt; 24-48 Business Hours</span>
            </div>
          </div>

          <div
            className="p-5 rounded-xl border flex flex-col items-center justify-center space-y-3 bg-zinc-950/40"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Direct General Address</span>
            <div className="text-sm font-bold font-mono select-all text-[var(--primary)]">
              support@fixify.4u
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}