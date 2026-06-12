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
  ChevronRight
} from 'lucide-react';
import SettingsModal, { applyGlobalSettings } from './SettingsModal';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/',            label: 'Logs Processor',  icon: FileCog,      short: 'Logs' },
    { href: '/compare',     label: 'Comparator',       icon: GitCompare,   short: 'Compare' },
    { href: '/interpreter', label: 'FIXi Interpreter', icon: BrainCircuit, short: 'FIXi AI' },
    { href: '/flowchart',   label: 'Flowchart',        icon: Network,      short: 'Flow' },
    { href: '/tasks',       label: 'Tasks',            icon: LayoutGrid,   short: 'Tasks' },
    { href: '/coderunner',  label: 'Code Sandbox',     icon: Terminal,     short: 'Code' },
    { href: '/xml',         label: 'XML Formatter',    icon: Braces,       short: 'XML' },
    { href: '/chat',        label: 'Team Chat',        icon: MessageSquare, short: 'Chat' },
  ];

  // Apply saved settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme      = localStorage.getItem('fixify-theme')       || 'dark';
    const fontScale  = parseFloat(localStorage.getItem('fixify-font-scale') || '1.0');
    const fontFamily = localStorage.getItem('fixify-font-family') || 'sans';
    applyGlobalSettings({ theme, fontScale, fontFamily });
  }, []);

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
            {navItems.map(item => {
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
              {/* App Launcher */}
              <div className="relative">
                <button
                  onClick={() => setLauncherOpen(v => !v)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
                  title="App Launcher"
                  style={{
                    background: launcherOpen ? 'var(--primary-faint)' : 'transparent',
                    color: launcherOpen ? 'var(--primary)' : 'var(--text-muted)',
                    border: launcherOpen ? '1px solid var(--primary-border)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!launcherOpen) {
                      e.currentTarget.style.color = 'var(--foreground)';
                      e.currentTarget.style.background = 'var(--card-hover)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!launcherOpen) {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>

                {/* Launcher dropdown */}
                {launcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLauncherOpen(false)} />
                    <div
                      className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="px-4 py-3"
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <p className="fx-section-label">Workspace Apps</p>
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-3">
                        {navItems.map(item => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setLauncherOpen(false)}
                              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-center"
                              style={{
                                background: active ? 'var(--primary-faint)' : 'transparent',
                                border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                              }}
                              onMouseEnter={e => {
                                if (!active) e.currentTarget.style.background = 'var(--card-hover)';
                              }}
                              onMouseLeave={e => {
                                if (!active) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center"
                                style={{
                                  background: active ? 'var(--primary)' : 'var(--background)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                <item.icon
                                  className="h-4 w-4"
                                  style={{ color: active ? 'var(--background)' : 'var(--text-muted)' }}
                                />
                              </div>
                              <span
                                className="text-[10px] font-semibold leading-tight"
                                style={{ color: active ? 'var(--primary)' : 'var(--foreground)' }}
                              >
                                {item.short}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

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
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="xl:hidden h-8 w-8 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)'
              }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="xl:hidden py-2 px-4 space-y-0.5"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
          >
            {navItems.map(item => {
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
    </>
  );
}
