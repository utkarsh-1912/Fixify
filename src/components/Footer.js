'use client';
import Link from 'next/link';
import { ShieldAlert, BookOpen, Mail } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
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
  );
};

export default Footer;
