'use client';

import { Info, Shield, Zap, Package, ChevronRight } from "lucide-react";

export default function AboutPage() {
  const features = [
    {
      icon: Zap,
      title: 'Developer Productivity',
      desc: 'FIXify streamlines day-to-day diagnostics for integration engineers and traders. Sort, correlate, and inspect trading session records instantly instead of grep-searching massive raw server logs.',
    },
    {
      icon: Shield,
      title: 'Strict Validation',
      desc: 'By mapping key header fields (tags 8, 9, 35) and final checksums (tag 10) dynamically, FIXify verifies standard formats on the fly and points out syntax mismatches down to the byte.',
    },
    {
      icon: Package,
      title: 'Complete Toolset',
      desc: 'From log processing and message comparison to AI interpretation, flowchart generation, and code sandboxing — FIXify is a complete diagnostic suite for FIX protocol systems.',
    },
  ];

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="fx-page-header space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
          >
            <Info className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            About FIXify
          </h1>
        </div>
        <p className="text-sm max-w-lg" style={{ color: 'var(--text-muted)' }}>
          A high-performance web console for financial systems analytics and FIX conformance testing.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl space-y-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <f.icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wide font-mono" style={{ color: 'var(--foreground)' }}>
              {f.title}
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Version banner */}
      <div
        className="flex items-center justify-between p-5 rounded-2xl"
        style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>FIXify™ Suite</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>All processing is client-side.</p>
        </div>
        <ChevronRight className="h-5 w-5" style={{ color: 'var(--primary)' }} />
      </div>
    </div>
  );
}