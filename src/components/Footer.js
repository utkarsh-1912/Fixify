'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, BookOpen, Mail, X } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [isOnline, setIsOnline] = useState(true);
  const [dismissedOffline, setDismissedOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setDismissedOffline(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissedOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Floating Offline Alert Banner */}
      {!isOnline && !dismissedOffline && (
        <div 
          className="fixed top-0 left-0 right-0 py-2 px-4 text-center text-xs font-mono font-bold flex items-center justify-between gap-2 z-[9999] shadow-lg"
          style={{ background: '#e80909', color: '#ffffff' }}
        >
          <div className="flex-1 text-center">
            <span>⚠️ Connection Lost: FIXify is running in offline mode.</span>
          </div>
          <button
            onClick={() => setDismissedOffline(true)}
            className="p-1 hover:bg-white/15 rounded transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            title="Dismiss Warning"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <footer
        className="py-4 px-6 text-xs font-mono"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-muted)' }}
      >
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>© {currentYear}</span>
            <Link
              href="/"
              className="font-semibold transition-colors"
              style={{ color: 'var(--foreground)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
            >
              FIXify™
            </Link>
            <span style={{ color: 'var(--border)' }}>|</span>
            <div className="flex items-center gap-1.5 ml-1 select-none">
              <span 
                className={`h-2 w-2 rounded-full transition-all duration-300 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isOnline ? 'var(--text-muted)' : '#e80909' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <ul className="flex items-center gap-5">
            {[
              { href: '/about',   icon: BookOpen,    label: 'About' },
              { href: '/privacy', icon: ShieldAlert, label: 'Privacy' },
              { href: '/contact', icon: Mail,        label: 'Contact' },
            ].map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
};

export default Footer;
