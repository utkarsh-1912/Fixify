'use client';

import { 
  Info, Shield, Zap, Package, ChevronRight, Activity, Terminal, Code, 
  ArrowRightLeft, ShieldAlert, EyeOff, Layers, TrendingUp, FileCode, 
  MessageSquare, BookOpen, Palette, Cpu, GitBranch, Columns 
} from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  const features = [
    {
      icon: Columns,
      title: 'Logs Comparator & Parser',
      desc: 'Compare session logs side-by-side, hide administrative messages, show only differences, and inspect message tags dynamically in a side-drawer.',
    },
    {
      icon: Zap,
      title: 'Real-time Latency Diagnostics',
      desc: 'Correlate, inspect, and analyze session logs using an inline background Web Worker thread. Features percentile outlier filters (99th/95th/90th bounds control), sequence table filters, and logarithmic scale timelines.',
    },
    {
      icon: ArrowRightLeft,
      title: 'Missing Fills Analyzer',
      desc: 'Compare raw FIX execution reports against blotter databases (CSV/TSV/Excel) to instantly isolate missing executions. Supports session filtering, customizable fill criteria, and dynamic CSV downloads.',
    },
    {
      icon: ShieldAlert,
      title: 'Security & Compliance Auditor',
      desc: 'Audit credential leakage (plaintext passwords/signatures), duplicate MsgSeqNum replay attacks, tag injection attempts, and sequence hijacking. Features compliance grading metrics and an interactive inspector.',
    },
    {
      icon: EyeOff,
      title: 'Log Sanitizer & Anonymizer',
      desc: 'Scrub sensitive tags (passwords, CompIDs, prices, sizes) from raw logs while preserving compliance. Auto-recalculates BodyLength (Tag 9) and Checksum (Tag 10) to keep logs structured and valid.',
    },
    {
      icon: Layers,
      title: 'Interactive Payload Generator',
      desc: 'Construct valid FIX messages using a form builder. Auto-recalculates body length/checksum on the fly, validates schemas, and outputs in SOH Visual, Pipe (|), Hex Dump, or JSON structure.',
    },
    {
      icon: TrendingUp,
      title: 'Multi-Algo Technical Trade Studio',
      desc: 'Simulate trading strategies on Yahoo Finance tickers. Features automated technical indicator signals (RSI, Bollinger Bands, MACD), backtesting engines, and a local portfolio paper-trading ledger.',
    },
    {
      icon: FileCode,
      title: 'QuickFIX XML Dialect Manager',
      desc: 'Upload custom QuickFIX XML dialect schemas to parse and explore custom fields and tag dictionaries. Plugs directly into the timeline, generator, and AI interpreter diagnostics.',
    },
    {
      icon: MessageSquare,
      title: 'Secure P2P Chat Rooms',
      desc: 'Collaborate with team members inside end-to-end encrypted chat rooms. Chat messages and pinned references are decrypted in the client browser, securing sensitive trading details.',
    },
    {
      icon: Terminal,
      title: 'FIXi Chat AI Interpreter',
      desc: 'Query protocol details via offline AURA intelligence or Google Gemini 2.5 Flash. Supports multi-line input textarea submissions and highlights AURA/Gemini keywords with glowing gradients.',
    },
    {
      icon: Code,
      title: 'XML Formatter & Key Shortcuts',
      desc: 'Format XML schemas using DOM Parser or Regex engines. Jump to nodes using match counters/chevrons, and speed up work with global developer hotkeys.',
    },
    {
      icon: GitBranch,
      title: 'Interactive Flowcharts',
      desc: 'Auto-generate interactive state flow diagrams from parsed FIX messages to inspect message sequence ordering, Logon/Logout sessions, and message lifecycles.',
    },
    {
      icon: Cpu,
      title: 'Code Sandbox Editor',
      desc: 'Execute Python, C++, and Java FIX parser templates inside a client-side execution container to test customized encoding and decoding logic.',
    },
    {
      icon: Package,
      title: 'Kanban Tasks & Slide-out Drawer',
      desc: 'Manage integration milestones with neon glassmorphic Kanban boards. Edit inline subtasks, blockers, commentary logs, and activity timelines inside a slide-over panel drawer.',
    },
    {
      icon: Palette,
      title: 'Whiteboard Sketcher',
      desc: 'Draw workflows, network topology designs, and session sequence diagrams using an interactive client-side sketchpad with undo/redo capabilities.',
    },
    {
      icon: BookOpen,
      title: 'FIX Dictionary & Search',
      desc: 'Search and browse complete FIX tag references across standard versions (4.0 to 5.0SP2) and custom dialect schemas loaded into the dialect manager.',
    },
  ];

  return (
    <div className="space-y-12 max-w-5xl mx-auto px-4 py-6">
      {/* Header section with gradient glow */}
      <div 
        className="relative rounded-2xl p-4 md:p-6 overflow-hidden backdrop-blur-sm shadow-sm animate-fade-in"
        style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
      >
        <div className="absolute top-0 right-0 h-40 w-40 bg-[var(--primary)] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Info className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              About FIXify Diagnostics
            </h1>
          </div>
          <p className="text-sm max-w-3xl leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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