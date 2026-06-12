'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Check,
  Palette,
  Type,
  X
} from 'lucide-react';

// Applies settings directly to document.body and documentElement
export function applyGlobalSettings(settings) {
  if (typeof window === 'undefined') return;
  const body = document.body;

  // Clear existing theme/font classes
  const toRemove = [];
  body.classList.forEach(cls => {
    if (cls.startsWith('theme-') || cls.startsWith('font-family-')) {
      toRemove.push(cls);
    }
  });
  toRemove.forEach(cls => body.classList.remove(cls));

  // Apply new settings
  body.classList.add(`theme-${settings.theme || 'dark'}`);
  body.classList.add(`font-family-${settings.fontFamily || 'sans'}`);
  document.documentElement.style.setProperty(
    '--font-scale',
    (settings.fontScale !== undefined ? settings.fontScale : 1.0).toString()
  );
}

const themes = [
  {
    id: 'dark',
    name: 'Dark Slate',
    desc: 'Emerald accent',
    preview: { bg: '#09090b', card: '#111113', accent: '#10b981' }
  },
  {
    id: 'light',
    name: 'Light',
    desc: 'Blue accent',
    preview: { bg: '#f8fafc', card: '#ffffff', accent: '#2563eb' }
  },
  {
    id: 'matrix',
    name: 'Matrix',
    desc: 'Green CRT',
    preview: { bg: '#010a01', card: '#030f03', accent: '#22c55e' }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Indigo accent',
    preview: { bg: '#020617', card: '#0a1120', accent: '#818cf8' }
  },
  {
    id: 'corporate',
    name: 'Corporate',
    desc: 'Amber accent',
    preview: { bg: '#f1f5f9', card: '#ffffff', accent: '#d97706' }
  },
];

export default function SettingsModal({ isOpen, onClose }) {
  const [theme, setTheme] = useState('dark');
  const [fontScale, setFontScale] = useState(1.0);
  const [fontFamily, setFontFamily] = useState('sans');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTheme(localStorage.getItem('fixify-theme') || 'dark');
    setFontScale(parseFloat(localStorage.getItem('fixify-font-scale') || '1.0'));
    setFontFamily(localStorage.getItem('fixify-font-family') || 'sans');
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('fixify-theme', theme);
    localStorage.setItem('fixify-font-scale', fontScale.toString());
    localStorage.setItem('fixify-font-family', fontFamily);
    applyGlobalSettings({ theme, fontScale, fontFamily });
    onClose();
  };

  const adjustScale = (delta) =>
    setFontScale(prev => Math.min(1.6, Math.max(0.8, parseFloat((prev + delta).toFixed(1)))));

  const fontFamilies = [
    { value: 'sans',  label: 'Sans Serif', sub: 'Geist Sans — clean & modern' },
    { value: 'mono',  label: 'Monospace',  sub: 'Geist Mono — developer terminal' },
    { value: 'serif', label: 'Serif',      sub: 'Georgia — technical literature' },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-xl flex flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Settings className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                Settings
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Personalize appearance &amp; typography
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Theme Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              <span className="fx-section-label">Theme</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {themes.map(t => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all group"
                    style={{
                      border: active
                        ? `2px solid var(--primary)`
                        : '2px solid var(--border)',
                      background: active ? 'var(--primary-faint)' : 'var(--background)',
                    }}
                    title={`${t.name} — ${t.desc}`}
                  >
                    {/* Mini preview swatch */}
                    <div
                      className="w-full h-10 rounded-lg flex items-center justify-center relative overflow-hidden"
                      style={{ background: t.preview.bg }}
                    >
                      <div
                        className="absolute bottom-1 right-1 w-3 h-3 rounded-full"
                        style={{ background: t.preview.accent }}
                      />
                      <div
                        className="w-5 h-3 rounded-sm"
                        style={{ background: t.preview.card, border: `1px solid ${t.preview.accent}22` }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-semibold text-center leading-tight"
                      style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
                    >
                      {t.name}
                    </span>
                    {active && (
                      <div
                        className="absolute top-1.5 left-1.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--primary)' }}
                      >
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Typography */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              <span className="fx-section-label">Typography</span>
            </div>

            {/* Font Family */}
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Font Family</p>
              <div className="grid grid-cols-3 gap-2">
                {fontFamilies.map(f => {
                  const active = fontFamily === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setFontFamily(f.value)}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                        border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                        background: active ? 'var(--primary-faint)' : 'var(--card)',
                      }}
                    >
                      <span
                        className="block text-xs font-semibold"
                        style={{ color: active ? 'var(--primary)' : 'var(--foreground)' }}
                      >
                        {f.label}
                      </span>
                      <span className="block text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {f.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Scale */}
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Font Scale</p>
              <div
                className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <button
                  onClick={() => adjustScale(-0.2)}
                  disabled={fontScale <= 0.8}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    opacity: fontScale <= 0.8 ? 0.4 : 1
                  }}
                >
                  −
                </button>
                <div className="flex-1 flex flex-col items-center">
                  <span
                    className="text-lg font-bold font-mono"
                    style={{ color: 'var(--primary)' }}
                  >
                    {fontScale.toFixed(1)}×
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {fontScale < 1.0 ? 'Compact' : fontScale > 1.0 ? 'Large' : 'Default'}
                  </span>
                </div>
                <button
                  onClick={() => adjustScale(0.2)}
                  disabled={fontScale >= 1.6}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    opacity: fontScale >= 1.6 ? 0.4 : 1
                  }}
                >
                  +
                </button>
              </div>
              {/* Scale bar visualization */}
              <div className="flex gap-1 px-1">
                {[0.8, 1.0, 1.2, 1.4, 1.6].map(s => (
                  <div
                    key={s}
                    onClick={() => setFontScale(s)}
                    className="flex-1 h-1 rounded-full cursor-pointer transition-all"
                    style={{
                      background: fontScale >= s ? 'var(--primary)' : 'var(--border)'
                    }}
                    title={`${s}×`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <button onClick={onClose} className="fx-btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="fx-btn-primary">
            <Check className="h-3.5 w-3.5" /> Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}
