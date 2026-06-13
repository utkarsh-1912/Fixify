'use client';

import { Info, Shield, Zap, Package, ChevronRight, Activity, Terminal, Code } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  const features = [
    {
      icon: Zap,
      title: 'Real-time Latency Diagnostics',
      desc: 'Sort, correlate, and inspect trading session records instantly. The Latency Hop Dashboard identifies network delays using auto-scaling logarithmic charts to prevent outlier squashing.',
    },
    {
      icon: Shield,
      title: 'Byte-Level Validation',
      desc: 'Verify standard protocol formats on the fly. By checking header fields (tags 8, 9, 35) and checksums (tag 10) dynamically, FIXify identifies integrity mismatches down to the byte.',
    },
    {
      icon: Code,
      title: 'Interactive Code Sandbox',
      desc: 'Test parser templates in Python, C++, and Java. Built with dynamic 3-pane/4-pane editor layouts, standard output streams, and syntax highlighting.',
    },
    {
      icon: Terminal,
      title: 'FIXi Chat Assistant',
      desc: 'An integrated protocol assistant capable of parsing FIX tags and generating diagnostics details. Features clean italics parsing and active theme-aligned UI styling.',
    },
    {
      icon: Activity,
      title: 'Order Lifecycle Tracking',
      desc: 'Trace transition flows visually via interactive state charts, and filter lifecycle logs instantly by specific Order IDs (tag 37) using built-in dropdown filters.',
    },
    {
      icon: Package,
      title: '100% Client-Side Suite',
      desc: 'No database dependencies. All logs, parsing algorithms, diagrams, and task workspaces compile entirely inside browser memory context for total local security.',
    },
  ];

  return (
    <div className="space-y-12 max-w-5xl mx-auto px-4 py-6">
      {/* Header section with gradient glow */}
      <div className="relative rounded-2xl p-8 overflow-hidden border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm">
        <div className="absolute top-0 right-0 h-40 w-40 bg-[var(--primary)] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Info className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              About FIXify Diagnostics
            </h1>
          </div>
          <p className="text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            FIXify is a high-performance web console and conformance utility for financial systems integration engineers, support analysts, and traders. Built from the ground up to unify session logs processing, flowchart generation, P2P coordination, and task management.
          </p>
        </div>
      </div>

      {/* Features grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest font-mono text-[var(--primary)]">Platform Capabilities</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Explore the core toolsets integrated into the workspace console.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl flex flex-col justify-between transition-all hover:bg-zinc-900/10 dark:hover:bg-zinc-800/10 group"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="space-y-4">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors group-hover:border-[var(--primary-border)]"
                  style={{ background: 'var(--primary-faint)', border: '1px solid var(--border)' }}
                >
                  <f.icon className="h-4.5 w-4.5" style={{ color: 'var(--primary)' }} />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[var(--foreground)]">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Static specs section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs text-[var(--text-muted)]">
        <div className="p-5 rounded-2xl space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] uppercase font-bold text-[var(--foreground)]">Security Framework</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Zero analytics tracking or cookies</li>
            <li>No database storage or cloud persistence</li>
            <li>Logs processed using memory buffers</li>
          </ul>
        </div>
        <div className="p-5 rounded-2xl space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] uppercase font-bold text-[var(--foreground)]">Compliance & Verification</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Supports standard FIX protocols 4.0 - 5.0SP2</li>
            <li>Standard checksum & body validation checks</li>
            <li>Interactive custom tag mapping reference</li>
          </ul>
        </div>
      </div>

      {/* Version banner linking to other pages */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl gap-4"
        style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
      >
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-[var(--primary)]">FIXify™ Developer Suite</p>
          <p className="text-xs text-[var(--text-muted)]">Local-first, encrypted, and isolated by default.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="text-xs font-mono text-[var(--primary)] hover:underline flex items-center gap-1">
            Privacy Policy <ChevronRight className="h-3 w-3" />
          </Link>
          <Link href="/contact" className="text-xs font-mono text-[var(--primary)] hover:underline flex items-center gap-1">
            Contact Support <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}