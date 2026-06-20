'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  FileCog,
  Braces,
  GitCompare,
  Brain,
  Network,
  LayoutGrid,
  Terminal,
  MessageSquare,
  Menu,
  X,
  Settings as SettingsIcon,
  ChevronRight,
  Search,
  BookOpen,
  Activity,
  ArrowRightLeft,
  ShieldCheck,
  Radio,
  ShieldAlert
} from 'lucide-react';
import SettingsModal, { applyGlobalSettings } from './SettingsModal';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const pathname = usePathname();

  const navItems = [
    { href: '/',            label: 'Logs Processor',  icon: FileCog,      short: 'Logs', desc: 'Paste multi-message FIX session logs to find gaps, Logon order, and duplicates.' },
    { href: '/compare',     label: 'Comparator',       icon: GitCompare,   short: 'Compare', desc: 'Compare FIX messages side-by-side to highlight field-level differences.' },
    { href: '/xml',         label: 'XML Formatter',    icon: Braces,       short: 'XML', desc: 'Format, minify, and search XML schemas with developer shortcuts.' },
    { href: '/chat',        label: 'Team Chat',        icon: MessageSquare, short: 'Chat', desc: 'Isolated local team room chat relay fallback with WebRTC peers.' },
    { href: '/interpreter', label: 'FIXi Interpreter', icon: Brain, short: 'FIXi AI', desc: 'Protocol AI assistant with custom tag lookup and checksum audits.' },
    { href: '/flowchart',   label: 'Flowchart',        icon: Network,      short: 'Flow', desc: 'Auto-generate sequence flow diagrams and export to Mermaid.js.' },
    { href: '/latency',     label: 'Latency Dashboard', icon: Activity,     short: 'Latency', desc: 'Audit hop latency offset timings and RTT trends.' },
    { href: '/missing-fills', label: 'Missing Fills',   icon: ArrowRightLeft, short: 'Fills', desc: 'Compare raw FIX execution reports against blotter database sheets.' },
    { href: '/tasks',       label: 'Tasks',            icon: LayoutGrid,   short: 'Tasks', desc: 'Kanban tasks board with dependencies, checklists, and slide drawer.' },
    { href: '/coderunner',  label: 'Code Sandbox',     icon: Terminal,     short: 'Code', desc: 'Compile and run FIX parser templates in C++, Python, and Java.' },
    { href: '/fixtags',     label: 'FIX Dictionary',  icon: BookOpen,      short: 'Dict', desc: 'Interactive FIX tag and enums specs dictionary explorer.', inMenu: false },
    { href: '/security-auditor', label: 'FIX Security Auditor', icon: ShieldAlert, short: 'Security', desc: 'Scan logs for replay windows, plaintext credentials, SOH injection, and hijack vulnerabilities.', inMenu: false },
    { href: '/live-streaming', label: 'Live Stream Simulator', icon: Radio, short: 'Live Stream', desc: 'Simulate live FIX session socket streaming with dynamic timelines.', inMenu: false },
  ];

  // Apply saved settings and track page visits on mount/pathchange
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme      = localStorage.getItem('fixify-theme')       || 'dark';
    const fontScale  = parseFloat(localStorage.getItem('fixify-font-scale') || '1.0');
    const fontFamily = localStorage.getItem('fixify-font-family') || 'sans';
    applyGlobalSettings({ theme, fontScale, fontFamily });

    try {
      const visits = JSON.parse(localStorage.getItem('fixify-page-visits') || '{}');
      visits[pathname] = {
        count: (visits[pathname]?.count || 0) + 1,
        lastVisited: Date.now()
      };
      localStorage.setItem('fixify-page-visits', JSON.stringify(visits));
    } catch (e) {
      console.warn("Failed to update page visit history", e);
    }
  }, [pathname]);

  // Scoring functions for Search Recommendation Engine
  const getRecommendationScore = (item) => {
    let score = 0;
    if (typeof window !== 'undefined') {
      try {
        const visits = JSON.parse(localStorage.getItem('fixify-page-visits') || '{}');
        const itemVisit = visits[item.href];
        if (itemVisit) {
          score += itemVisit.count * 10;
          const diffMs = Date.now() - itemVisit.lastVisited;
          const diffMinutes = diffMs / 60000;
          if (diffMinutes < 5) score += 50;
          else if (diffMinutes < 60) score += 25;
          else if (diffMinutes < 1440) score += 10;
        }
      } catch (e) {}
    }
    const logsRoutes = ['/', '/compare', '/missing-fills', '/security-auditor'];
    const aiRoutes = ['/interpreter', '/fixtags'];
    const sysRoutes = ['/latency', '/live-streaming', '/xml', '/coderunner', '/tasks', '/chat'];
    if (logsRoutes.includes(pathname) && logsRoutes.includes(item.href)) score += 35;
    else if (aiRoutes.includes(pathname) && aiRoutes.includes(item.href)) score += 35;
    else if (sysRoutes.includes(pathname) && sysRoutes.includes(item.href)) score += 35;
    if (item.href === '/' || item.href === '/compare' || item.href === '/interpreter') score += 5;
    return score;
  };

  const getLexicalRelevance = (item, query) => {
    if (!query) return 0;
    const q = query.toLowerCase().trim();
    const label = item.label.toLowerCase();
    const short = item.short.toLowerCase();
    const desc = (item.desc || '').toLowerCase();
    if (label === q || short === q) return 1000;
    if (label.startsWith(q) || short.startsWith(q)) return 800;
    if (label.includes(q) || short.includes(q)) return 500;
    if (desc.includes(q)) return 250;
    let matchCount = 0;
    const uniqueChars = new Set(q.split(''));
    uniqueChars.forEach(char => {
      if (label.includes(char) || short.includes(char)) matchCount++;
    });
    const overlapRatio = matchCount / uniqueChars.size;
    if (overlapRatio > 0.5) return Math.round(overlapRatio * 100);
    return 0;
  };

  const getRecommendedItems = (query) => {
    return navItems
      .map(item => {
        const lexicalScore = getLexicalRelevance(item, query);
        const recScore = getRecommendationScore(item);
        const totalScore = query ? (lexicalScore + recScore * 0.1) : recScore;
        return { item, score: totalScore, lexicalScore };
      })
      .filter(entry => {
        if (query) return entry.lexicalScore > 0;
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  };

  // Global key listener for Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Dynamic Browser Tab Title based on active page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentItem = navItems.find(item => item.href === pathname);
    if (currentItem) {
      document.title = `FIXify - ${currentItem.label}`;
    } else {
      const pageName = pathname.replace(/^\//, '');
      if (pageName) {
        const formattedName = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        document.title = `FIXify - ${formattedName}`;
      } else {
        document.title = "FIXify - Logs Processor";
      }
    }
  }, [pathname]);

  return (
    <>
      <header
        className="sticky top-0 w-full z-50 select-none"
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="shrink-0 logo-container">
            <Image
              src="/logo-full.png"
              alt="FIXify"
              width={96}
              height={30}
              className="h-7 w-auto"
              priority
            />
          </Link>

          {/* Divider */}
          <div className="hidden xl:block h-5 w-px" style={{ background: 'var(--border)' }} />

          {/* Desktop nav links */}
          <nav className="hidden xl:flex items-center gap-0.5 flex-1">
            {navItems.filter(item => item.inMenu !== false).map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    background: active ? 'var(--primary-faint)' : 'transparent',
                    border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--foreground)';
                      e.currentTarget.style.background = 'var(--card-hover)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.short}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right actions tray */}
          <div className="ml-auto flex items-center gap-1.5">

            {/* Action tray container */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              {/* App Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
                title="Search Pages (Ctrl+K)"
                style={{
                  background: searchOpen ? 'var(--primary-faint)' : 'transparent',
                  color: searchOpen ? 'var(--primary)' : 'var(--text-muted)',
                  border: searchOpen ? '1px solid var(--primary-border)' : '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!searchOpen) {
                    e.currentTarget.style.color = 'var(--foreground)';
                    e.currentTarget.style.background = 'var(--card-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!searchOpen) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
                title="Settings"
                style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--foreground)';
                  e.currentTarget.style.background = 'var(--card-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <SettingsIcon className="h-4 w-4" />
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="xl:hidden h-8 w-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  color: 'var(--text-muted)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--foreground)';
                  e.currentTarget.style.background = 'var(--card-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="xl:hidden py-2 px-4 space-y-0.5"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
          >
            {navItems.filter(item => item.inMenu !== false).map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    background: active ? 'var(--primary-faint)' : 'transparent',
                  }}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* App Search modal */}
      {searchOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] p-4"
          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Input field */}
            <div className="relative p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search tools and pages... (e.g. logs, compare, chat)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchIndex(0);
                }}
                onKeyDown={(e) => {
                  const filtered = getRecommendedItems(searchQuery);
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchIndex(prev => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSearchIndex(prev => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered[searchIndex]) {
                      window.location.href = filtered[searchIndex].href;
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                className="w-full bg-transparent text-sm outline-none font-medium"
                style={{ color: 'var(--foreground)' }}
                autoFocus
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="px-2 py-1 text-[10px] font-mono rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400 shrink-0"
              >
                ESC
              </button>
            </div>

            {/* Results list */}
            <div className="overflow-y-auto p-2 space-y-1">
              {(() => {
                const filtered = getRecommendedItems(searchQuery);
                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      No matching pages or tools found.
                    </div>
                  );
                }
                return filtered.map((item, idx) => {
                  const active = searchIndex === idx;
                  const isCurrent = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold animate-in fade-in duration-100"
                      style={{
                        background: active ? 'var(--primary-faint)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                      }}
                      onMouseEnter={() => setSearchIndex(idx)}
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                        style={{
                          background: active ? 'var(--primary)' : 'var(--background)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <item.icon className="h-4 w-4" style={{ color: active ? 'var(--background)' : 'var(--text-muted)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs" style={{ color: active ? 'var(--primary)' : 'var(--foreground)' }}>
                            {item.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full border font-mono" style={{ borderColor: 'var(--primary-border)', color: 'var(--primary)', background: 'var(--primary-faint)' }}>
                              current
                            </span>
                          )}
                          {!searchQuery && idx < 3 && (
                            <span className="text-[8px] px-1 py-0.1 rounded font-bold uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-900/40">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-sans font-normal" style={{ color: 'var(--text-muted)' }}>
                          {item.desc || `Navigate to ${item.short} workspace`}
                        </p>
                      </div>
                      {active && <ChevronRight className="h-4 w-4" />}
                    </Link>
                  );
                });
              })()}
            </div>
            <div className="p-3 text-[10px] flex items-center justify-between border-t" style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--text-faint)' }}>
              <span>Use ↑↓ arrows to navigate, Enter to select</span>
              <span>Press Ctrl+K to trigger anytime</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
