'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  FileCog,
  Braces,
  GitCompare,
  BrainCircuit,
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
  Activity
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
    { href: '/',            label: 'Logs Processor',  icon: FileCog,      short: 'Logs' },
    { href: '/compare',     label: 'Comparator',       icon: GitCompare,   short: 'Compare' },
    { href: '/interpreter', label: 'FIXi Interpreter', icon: BrainCircuit, short: 'FIXi AI' },
    { href: '/flowchart',   label: 'Flowchart',        icon: Network,      short: 'Flow' },
    { href: '/latency',     label: 'Latency Dashboard', icon: Activity,     short: 'Latency' },
    { href: '/tasks',       label: 'Tasks',            icon: LayoutGrid,   short: 'Tasks' },
    { href: '/coderunner',  label: 'Code Sandbox',     icon: Terminal,     short: 'Code' },
    { href: '/xml',         label: 'XML Formatter',    icon: Braces,       short: 'XML' },
    { href: '/chat',        label: 'Team Chat',        icon: MessageSquare, short: 'Chat' },
    { href: '/fixtags',     label: 'FIX Dictionary',  icon: BookOpen,      short: 'Dict', inMenu: false },
  ];

  // Apply saved settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme      = localStorage.getItem('fixify-theme')       || 'dark';
    const fontScale  = parseFloat(localStorage.getItem('fixify-font-scale') || '1.0');
    const fontFamily = localStorage.getItem('fixify-font-family') || 'sans';
    applyGlobalSettings({ theme, fontScale, fontFamily });
  }, []);

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
                  const filtered = navItems.filter(item =>
                    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.short.toLowerCase().includes(searchQuery.toLowerCase())
                  );
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
                const filtered = navItems.filter(item =>
                  item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.short.toLowerCase().includes(searchQuery.toLowerCase())
                );
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
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold"
                      style={{
                        background: active ? 'var(--primary-faint)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                      }}
                      onMouseEnter={() => setSearchIndex(idx)}
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
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
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full border" style={{ borderColor: 'var(--primary-border)', color: 'var(--primary)', background: 'var(--primary-faint)' }}>
                              current
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-sans font-normal" style={{ color: 'var(--text-muted)' }}>
                          Navigate to {item.short} message sandbox
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
