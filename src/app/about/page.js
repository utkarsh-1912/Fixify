'use client';

import { useState } from 'react';
import { 
  Info, Shield, Zap, Package, ChevronRight, Activity, Terminal, Code, 
  ArrowRightLeft, ShieldAlert, EyeOff, Layers, TrendingUp, FileCode, 
  MessageSquare, BookOpen, Cpu, GitBranch, Columns, CheckCircle2, Lock,
  Sparkles, Radio, Database, ArrowUpRight, Search, Globe2
} from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    { label: 'Integrated Toolsets', value: '20+' },
    { label: 'FIX Specifications', value: '4.0 → 5.0SP2' },
    { label: 'Data Persistence', value: '0% Cloud' },
    { label: 'Processing Speed', value: 'Client Web Workers' },
  ];

  const categories = [
    { id: 'all', label: 'All Capabilities' },
    { id: 'analysis', label: 'Log Analysis & Latency' },
    { id: 'security', label: 'Security & Compliance' },
    { id: 'tools', label: 'Generators & Tools' },
  ];

  const features = [
    {
      category: 'analysis',
      icon: Globe2,
      title: 'Global Market Hours Globe',
      badge: 'Real-Time',
      desc: 'Interactive orthographic 3D SVG globe with solar terminator shading, DST tracking, 28 global stock exchanges, local time countdowns, and knowledgebase specs.',
    },
    {
      category: 'analysis',
      icon: Columns,
      title: 'Logs Comparator & Parser',
      badge: 'Core Engine',
      desc: 'Compare FIX session logs side-by-side with automatic field-level difference highlighting, FQL query filtering, and tag-by-tag deep inspection drawers.',
    },
    {
      category: 'analysis',
      icon: Activity,
      title: 'Real-Time Latency Dashboard',
      badge: 'Diagnostics',
      desc: 'Hop-by-hop latency breakdown and RTT transit duration tracking using high-resolution microsecond timestamps, percentile distributions (p50/p95/p99), and SLA budget alerts.',
    },
    {
      category: 'analysis',
      icon: ArrowRightLeft,
      title: 'Missing Fills Analyzer',
      badge: 'Reconciliation',
      desc: 'Reconcile raw FIX Execution Reports against blotter CSV/Excel sheets. Features auto-delimiter detection, fuzzy matching, and investigation cross-routing.',
    },
    {
      category: 'analysis',
      icon: GitBranch,
      title: 'Multi-Hop Order Correlation',
      badge: 'Tracking',
      desc: 'Correlate transaction flows across multiple system layers (Client Gateway ➔ OMS ➔ Exchange) using ClOrdID, OrigClOrdID, OrderID, and ExecID chain resolution.',
    },
    {
      category: 'security',
      icon: ShieldAlert,
      title: 'FIX Security Auditor',
      badge: 'Compliance',
      desc: 'Audit logs for credential leakage (35=A/554/553), sequence reset attacks, SOH delimiter injection, and session hijacking with automated remediation guides.',
    },
    {
      category: 'security',
      icon: EyeOff,
      title: 'Log Sanitizer & Anonymizer',
      badge: 'GDPR Shield',
      desc: 'Mask sensitive fields (passwords, CompIDs, prices, sizes) with salaried hashing or custom replacements. Auto-recomputes Tag 9 BodyLength and Tag 10 Checksum.',
    },
    {
      category: 'tools',
      icon: Layers,
      title: 'Interactive Payload Generator',
      badge: 'Testing',
      desc: 'Compose valid test FIX message wire payloads with automatic length calculation, checksum validation, and sequence building (New Order ➔ Fill ➔ Cancel).',
    },
    {
      category: 'tools',
      icon: TrendingUp,
      title: 'Multi-Algo Technical Studio',
      badge: 'Quantitative',
      desc: 'Backtest technical indicators (SMA, RSI, MACD, Bollinger Bands) on market data, run dual-strategy comparisons, and simulate paper trading ledgers.',
    },
    {
      category: 'tools',
      icon: FileCode,
      title: 'Custom Dialect Manager',
      badge: 'Dictionary',
      desc: 'Upload QuickFIX XML data dictionaries to parse custom proprietary tags (5000-9999) seamlessly integrated across all tools in the platform.',
    },
    {
      category: 'tools',
      icon: MessageSquare,
      title: 'Encrypted Desk Chat',
      badge: 'P2P Team',
      desc: 'Collaborate with team members inside end-to-end encrypted rooms. Transcripts are client-side decrypted in browser memory with zero server logging.',
    },
    {
      category: 'tools',
      icon: Terminal,
      title: 'FIXi AI Protocol Interpreter',
      badge: 'Intelligence',
      desc: 'Diagnose protocol session errors, inspect checksum anomalies, and query FIX specification details via offline AURA rules or LLM integration.',
    },
    {
      category: 'tools',
      icon: Code,
      title: 'XML Formatter & Schemas',
      badge: 'Formatter',
      desc: 'Format, pretty-print, and sanitize XML dictionaries and ATDL files using DOM Parser or Regex engines with instant SOH-to-pipe conversions.',
    },
    {
      category: 'tools',
      icon: Radio,
      title: 'Live Stream Monitor',
      badge: 'Simulation',
      desc: 'Simulate live FIX session socket streaming with dynamic timelines, customizable latency spike triggers, sequence gap alerts, and replay controls.',
    },
    {
      category: 'tools',
      icon: Cpu,
      title: 'Code Sandbox Playground',
      badge: 'Developer',
      desc: 'Test custom FIX parser code in Python, C++, and Java inside a sandboxed client environment pre-loaded with QuickFIX template snippets.',
    },
    {
      category: 'tools',
      icon: Package,
      title: 'Kanban Conformance Tasks',
      badge: 'Workflow',
      desc: 'Manage onboarding milestones with drag-and-drop Kanban boards, subtask checklists, priority badges, and slide-over dependency drawers.',
    },
  ];

  const filteredFeatures = features.filter(f => {
    const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchesSearch = !searchQuery || 
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.badge.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 px-2 sm:px-6 py-4 sm:py-10">

      {/* ── Hero Banner ── */}
      <div 
        className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 overflow-hidden border shadow-2xl transition-all"
        style={{ 
          background: 'linear-gradient(135deg, var(--card) 0%, var(--primary-faint) 100%)',
          borderColor: 'var(--primary-border)' 
        }}
      >
        <div className="absolute top-0 right-0 h-64 w-64 bg-[var(--primary)] opacity-[0.07] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-5 sm:space-y-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-semibold border"
               style={{ background: 'var(--card)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}>
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Next-Gen Protocol Operations</span>
          </div>

          <div className="space-y-2 sm:space-y-3 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>
              About <span style={{ color: 'var(--primary)' }}>FIXify™</span> Diagnostics Platform
            </h1>
            <p className="text-xs sm:text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              FIXify is a local-first, high-performance web console for financial systems integration engineers, support analysts, and quant traders. Designed from the ground up to unify session log analysis, multi-hop correlation, latency auditing, and compliance testing in a single desktop-grade environment.
            </p>
          </div>

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {stats.map((s, idx) => (
              <div key={idx} className="p-3 sm:p-3.5 rounded-xl border" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
                <span className="block text-lg sm:text-xl font-bold font-mono" style={{ color: 'var(--primary)' }}>{s.value}</span>
                <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature Catalog Filter & Search ── */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-mono text-[var(--primary)]">
              Integrated Toolsets &amp; Workspaces
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
              Explore the complete suite of diagnostics and productivity utilities built into FIXify.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search capabilities..."
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 rounded-xl text-xs font-mono outline-none border transition-colors"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer"
              style={{
                background: activeCategory === cat.id ? 'var(--primary)' : 'var(--card)',
                color: activeCategory === cat.id ? 'var(--background)' : 'var(--text-muted)',
                borderColor: activeCategory === cat.id ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredFeatures.map((f, i) => (
            <div
              key={i}
              className="p-5 sm:p-6 rounded-2xl border flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-xl group"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center border transition-colors group-hover:border-[var(--primary-border)]"
                    style={{ background: 'var(--primary-faint)', borderColor: 'var(--border)' }}
                  >
                    <f.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider"
                    style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    {f.badge}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-bold font-mono text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--text-muted)]">
                    {f.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Architectural Guarantees & Security Blueprint ── */}
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-mono text-[var(--primary)]">
            Architectural Guarantees
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            Engineered for high-throughput enterprise environments with zero data leakage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          <div className="p-5 sm:p-6 rounded-2xl border space-y-2.5 sm:space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-faint)' }}>
              <Lock className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <h4 className="text-xs font-bold font-mono text-[var(--foreground)] uppercase">Local-First Sandbox</h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
              All parsed logs, CSV blotters, and calculated timeline nodes exist strictly in volatile browser RAM. Closing the tab immediately destroys all state.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl border space-y-2.5 sm:space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-faint)' }}>
              <Zap className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <h4 className="text-xs font-bold font-mono text-[var(--foreground)] uppercase">Background Web Workers</h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
              Log parsing and multi-hop latency analytics execute asynchronously on isolated Web Worker threads, ensuring zero UI thread lag even on 100,000+ line logs.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl border space-y-2.5 sm:space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-faint)' }}>
              <Shield className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <h4 className="text-xs font-bold font-mono text-[var(--foreground)] uppercase">Zero Telemetry</h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
              No tracking cookies, third-party analytics scripts, or hidden external API calls. Your trade data and passwords never leave your workstation.
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Cross-Navigation Banner ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 rounded-2xl gap-4 border shadow-lg"
        style={{ background: 'var(--card)', borderColor: 'var(--primary-border)' }}
      >
        <div className="space-y-0.5 text-left">
          <p className="text-xs sm:text-sm font-bold text-[var(--foreground)]">Ready to audit your FIX logs?</p>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">Get started by loading a session log into the Processor workspace.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <Link 
            href="/privacy" 
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Shield className="h-3.5 w-3.5 text-[var(--primary)]" /> Privacy Policy
          </Link>
          <Link 
            href="/contact" 
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Support Desk
          </Link>
          <Link 
            href="/" 
            className="w-full sm:w-auto fx-btn-primary py-2 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            Launch Console <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

    </div>
  );
}