'use client';

import { useState } from 'react';
import { 
  Mail, HelpCircle, Clock, MessageSquare, Terminal, ExternalLink, ShieldCheck, 
  Copy, Check, Send, Sparkles, ChevronDown, ChevronUp, MessageCircle, FileCode, CheckCircle2
} from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  
  // Interactive Inquiry Form State
  const [formCategory, setFormCategory] = useState('integration');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formSent, setFormSent] = useState(false);

  const supportChannels = [
    {
      icon: Mail,
      title: "Integration & Desk Support",
      badge: "General Desk",
      desc: "For general inquiries, account setup help, or onboarding assistance with complex FIX session logs.",
      email: "support@fixify.4u",
      subject: "[FIXify Support Inquiry]"
    },
    {
      icon: Terminal,
      title: "Developer & Schema Desk",
      badge: "XML & Dialects",
      desc: "For submitting custom QuickFIX XML data dictionaries, reporting tag mapping issues, or requesting ATDL specs.",
      email: "schema@fixify.4u",
      subject: "[FIXify Custom Dialect Request]"
    },
    {
      icon: ShieldCheck,
      title: "Security & Compliance Desk",
      badge: "Audit & InfoSec",
      desc: "For security inquiries, self-hosting guides, zero-persistence verifications, or compliance audit reports.",
      email: "security@fixify.4u",
      subject: "[FIXify Security Verification]"
    }
  ];

  const faqs = [
    {
      q: "Are my uploaded FIX logs or messages sent to your support servers?",
      a: "No. All FIX log processing, latency calculations, and sanitization execute 100% inside your browser environment. Support tickets do not automatically transmit log data unless you explicitly attach an anonymized snippet."
    },
    {
      q: "How do I request support for a custom QuickFIX XML dialect?",
      a: "You can load custom tags directly using the Custom Dialect Manager tool (`/custom-dialect`). For complex broker specs, email your XML schema to schema@fixify.4u for validation."
    },
    {
      q: "Can FIXify be deployed on-premise in an air-gapped corporate environment?",
      a: "Yes! Because FIXify runs as a client-side bundle without external database dependencies, it can be compiled and deployed locally on internal enterprise servers or air-gapped workstations."
    },
    {
      q: "What protocols and FIX versions are natively supported?",
      a: "FIXify natively supports standard FIX 4.0, 4.1, 4.2, 4.3, 4.4, 5.0, 5.0SP2, FIXT 1.1, CME iLink, NASDAQ FIX Gateway, ICE FIX, MDP 3.0 SBE, and custom QuickFIX XML dictionaries."
    }
  ];

  const handleCopyEmail = (emailStr) => {
    navigator.clipboard.writeText(emailStr);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSent(true);
    const mailtoUrl = `mailto:support@fixify.4u?subject=${encodeURIComponent(`[${formCategory.toUpperCase()}] ${subject}`)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10 px-2 sm:px-6 py-4 sm:py-10">

      {/* ── Hero Banner ── */}
      <div 
        className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 overflow-hidden border shadow-2xl transition-all"
        style={{ 
          background: 'linear-gradient(135deg, var(--card) 0%, var(--primary-faint) 100%)',
          borderColor: 'var(--primary-border)' 
        }}
      >
        <div className="absolute top-0 right-0 h-64 w-64 bg-[var(--primary)] opacity-[0.06] rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-semibold border"
               style={{ background: 'var(--card)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Dedicated Tech Support &amp; Integration Desks</span>
          </div>

          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Support Desk &amp; <span style={{ color: 'var(--primary)' }}>Inquiry Hub</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Get in touch with our specialized support engineering teams. Whether you need custom dialect mapping, compliance verifications, or integration help, we are here to assist.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-mono pt-1 sm:pt-2" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
              <span>Response Latency: &lt; 24-48 Hours</span>
            </div>
            <span className="hidden sm:inline text-zinc-700">•</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Zero-Data Transmit Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Support Channels Grid ── */}
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-mono text-[var(--primary)]">
            Specialized Support Desks
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            Direct dispatch addresses categorized by inquiry type.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
          {supportChannels.map((ch, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 sm:space-y-5 transition-all hover:scale-[1.01] hover:shadow-xl group"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center border group-hover:border-[var(--primary-border)] transition-colors"
                       style={{ background: 'var(--primary-faint)', borderColor: 'var(--border)' }}>
                    <ch.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider"
                        style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {ch.badge}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-bold font-mono text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                    {ch.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--text-muted)]">
                    {ch.desc}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <a
                  href={`mailto:${ch.email}?subject=${encodeURIComponent(ch.subject)}`}
                  className="w-full py-2 px-3 rounded-xl border text-center text-[11px] sm:text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 hover:bg-[var(--primary-faint)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                >
                  <Send className="h-3.5 w-3.5" /> Direct Email Dispatch
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Consolidated Single Card: Quick Support Inquiry Dispatch ── */}
      <div
        className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 border space-y-5 sm:space-y-6 shadow-xl"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Card Header */}
        <div className="space-y-1 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-[var(--foreground)] tracking-wider flex items-center gap-2">
            <Send className="h-4 w-4 text-[var(--primary)] shrink-0" />
            Quick Support Inquiry Dispatch
          </h3>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
            Draft an inquiry ticket directly to our engineering desk.
          </p>
        </div>

        {/* Inquiry Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] sm:text-xs font-mono font-bold text-[var(--foreground)]">Inquiry Category</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-mono outline-none border transition-colors cursor-pointer"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <option value="integration">Integration &amp; Log Onboarding</option>
                <option value="schema">Custom QuickFIX Dialect XML Request</option>
                <option value="security">Security &amp; Air-Gapped Deployment</option>
                <option value="feature">Feature Request &amp; Feedback</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] sm:text-xs font-mono font-bold text-[var(--foreground)]">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. CME iLink3 Custom Tag 1028 Mapping Request"
                className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-mono outline-none border transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-xs font-mono font-bold text-[var(--foreground)]">Message Details</label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your inquiry or attach anonymized tag specs..."
              className="w-full p-3 sm:p-3.5 rounded-xl text-xs font-mono outline-none border transition-colors resize-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <button
            type="submit"
            className="w-full fx-btn-primary py-2.5 sm:py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.005] transition-all"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Open Email Client with Pre-filled Inquiry
          </button>
        </form>

        {/* Card Footer: Primary Email & Operating Hours (Embedded in Single Card) */}
        <div className="pt-4 sm:pt-5 border-t grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--primary)] shrink-0" />
              <h4 className="text-[11px] sm:text-xs font-bold font-mono text-[var(--foreground)] uppercase">Primary Support Email</h4>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3"
                 style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
              <span className="font-mono text-xs font-bold select-all text-[var(--primary)] truncate">support@fixify.4u</span>
              <button
                onClick={() => handleCopyEmail('support@fixify.4u')}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-[10px] font-mono border transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer hover:bg-[var(--card)]"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {copiedEmail ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedEmail ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--primary)] shrink-0" />
              <h4 className="text-[11px] sm:text-xs font-bold font-mono text-[var(--foreground)] uppercase">Operating Hours</h4>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
              Support engineers monitor queues Monday through Friday during standard trading session hours (08:00 – 18:00 UTC). Emergency air-gapped deployment queries receive priority response.
            </p>
          </div>
        </div>
      </div>

      {/* ── FAQ Accordion Section ── */}
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-mono text-[var(--primary)]">
            Frequently Asked Questions
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            Quick answers regarding privacy, custom dialects, and compliance.
          </p>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx}
                className="rounded-2xl border transition-all overflow-hidden"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 font-mono text-[11px] sm:text-xs font-bold cursor-pointer"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span className="flex items-start sm:items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-[var(--primary)] shrink-0 mt-0.5 sm:mt-0" />
                    <span>{faq.q}</span>
                  </span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-[11px] sm:text-xs leading-relaxed text-[var(--text-muted)] border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}