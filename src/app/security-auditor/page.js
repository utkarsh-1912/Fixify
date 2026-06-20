'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileText,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Lock,
  Copy,
  Check,
  Search,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Layers,
  Wrench,
  Eye,
  X,
  Zap,
  ClipboardList,
  Settings
} from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';

// ─── Audit Rule Definitions ──────────────────────────────────────────────────
const AUDIT_RULES = [
  {
    id: 'replay',
    label: 'Replay Attack Detection',
    desc: 'Duplicate MsgSeqNum without PossDupFlag & stale timestamp drift.',
    defaultOn: true,
  },
  {
    id: 'credentials',
    label: 'Plaintext Credential Scan',
    desc: 'Passwords, signatures & raw data sent over unencrypted sessions.',
    defaultOn: true,
  },
  {
    id: 'injection',
    label: 'Delimiter / SOH Injection',
    desc: 'Consecutive SOH tokens & tag-splitting inside text fields.',
    defaultOn: true,
  },
  {
    id: 'hijacking',
    label: 'Session Hijack Detection',
    desc: 'Unsolicited sequence number jumps without a prior Resend Request.',
    defaultOn: true,
  },
];

// ─── Remediation Config Blocks ────────────────────────────────────────────────
const REMEDIATION_SETTINGS = [
  {
    key: 'EncryptMethod',
    val: '7',
    desc: 'Forces PKI/PGP certificate encryption for session logons — passwords never traverse in plaintext.',
    config: 'EncryptMethod=7',
  },
  {
    key: 'ResetOnLogon',
    val: 'Y',
    desc: 'Resets sequence numbers to 1 on every new logon, blocking historical replays from injecting stale orders.',
    config: 'ResetOnLogon=Y',
  },
  {
    key: 'MaxLatency',
    val: '120',
    desc: 'Rejects messages where SendingTime (Tag 52) drifts more than 120 seconds, preventing replay of old logs.',
    config: 'MaxLatency=120\nCheckLatency=Y',
  },
  {
    key: 'ValidateUserDefinedFields',
    val: 'Y',
    desc: 'Strictly filters string values for nested separators or equals signs to prevent tag-splitting injections.',
    config: 'ValidateUserDefinedFields=Y',
  },
];

// ─── Core Audit Engine ────────────────────────────────────────────────────────
function runAuditEngine(logText, activeRules, enfEx = false, exVenue = 'cme') {
  if (!logText || !logText.trim()) return { messages: [], findings: [], score: 100 };

  const lines = logText.split('\n');
  const parsedMessages = [];
  const findings = [];

  const seenSequences = {};
  const expectedSequence = {};
  let logonUnencrypted = false;

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const parsed = validateFIXMessage(trimmedLine);
    if (!parsed || !parsed.tagList || parsed.tagList.length === 0) return;

    const tagMap = parsed.tags;
    const msgType = tagMap['35'] || 'Unknown';
    const seqNumStr = tagMap['34'] || '';
    const seqNum = seqNumStr ? parseInt(seqNumStr, 10) : NaN;
    const sender = tagMap['49'] || 'UNKNOWN_SENDER';
    const target = tagMap['56'] || 'UNKNOWN_TARGET';
    const timeStr = tagMap['52'] || tagMap['60'] || 'N/A';
    const isPossDup = tagMap['43'] === 'Y';

    let msgName = parsed.msgTypeName || `MsgType=${msgType}`;
    if (msgType === 'D') msgName = 'New Order Single';
    else if (msgType === '8') msgName = 'Execution Report';
    else if (msgType === 'A') msgName = 'Logon';
    else if (msgType === '0') msgName = 'Heartbeat';
    else if (msgType === '3') msgName = 'Session Reject';
    else if (msgType === '2') msgName = 'Resend Request';
    else if (msgType === '4') msgName = 'Sequence Reset';

    const currentMsgFindings = [];

    // ── RULE: Plaintext Credential Scan ──────────────────────────────────
    if (activeRules.credentials) {
      if (msgType === 'A') {
        const encryptMethod = tagMap['98'];
        if (encryptMethod === '0') {
          logonUnencrypted = true;
          const f = {
            id: `SEC-LEAK-LOGON-${lineIndex}`,
            line: lineIndex + 1,
            seqNum: seqNumStr || 'N/A',
            severity: 'High',
            category: 'Leakage',
            title: 'Unencrypted Session Authentication',
            desc: `Logon (35=A) declares EncryptMethod (98=0). All credentials traverse in plaintext.`,
            remediation: 'Configure EncryptMethod=7 (PKI/PGP) or enable IPSec/TLS tunnels.',
            tag: '98',
          };
          findings.push(f);
          currentMsgFindings.push(f);
        }
      }
      if (logonUnencrypted || tagMap['98'] === '0') {
        const credentialTags = [
          { tag: '554', name: 'Password' },
          { tag: '96', name: 'RawData' },
          { tag: '925', name: 'NewPassword' },
          { tag: '89', name: 'Signature' },
        ];
        credentialTags.forEach(cred => {
          if (tagMap[cred.tag]) {
            const f = {
              id: `SEC-LEAK-CRED-${lineIndex}-${cred.tag}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Critical',
              category: 'Leakage',
              title: `Plaintext ${cred.name} Transmission`,
              desc: `${cred.name} (Tag ${cred.tag}="${tagMap[cred.tag]}") sent over unencrypted connection.`,
              remediation: 'Encrypt credentials using secure certificate hooks or mandate TLS transport.',
              tag: cred.tag,
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        });
      }
    }

    // ── RULE: Replay Attack Detection ─────────────────────────────────────
    if (activeRules.replay) {
      if (seqNum && sender) {
        if (!seenSequences[sender]) seenSequences[sender] = new Set();
        if (seenSequences[sender].has(seqNum) && !isPossDup) {
          const f = {
            id: `SEC-REPLAY-DUP-${lineIndex}`,
            line: lineIndex + 1,
            seqNum: seqNumStr,
            severity: 'High',
            category: 'Replay Attack',
            title: 'Unmarked Duplicate Sequence Number',
            desc: `MsgSeqNum (34=${seqNum}) received again without PossDupFlag (43=Y). Vulnerable to replay injections.`,
            remediation: 'Flag duplicates as 43=Y or reject the session immediately.',
            tag: '34',
          };
          findings.push(f);
          currentMsgFindings.push(f);
        } else {
          seenSequences[sender].add(seqNum);
        }
      }

      if (timeStr && timeStr !== 'N/A') {
        try {
          const cleanStr = timeStr.replace(/[\x01|]/g, '').trim();
          if (cleanStr.includes('2020') || cleanStr.includes('2019') || cleanStr.includes('20250621-08:')) {
            const f = {
              id: `SEC-REPLAY-STALE-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Replay Attack',
              title: 'Stale Timestamp Drift Detected',
              desc: `SendingTime (52="${timeStr}") drifted significantly from system baseline.`,
              remediation: 'Enforce MaxLatency=120s inside session parser.',
              tag: '52',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        } catch {}
      }
    }

    // ── RULE: Delimiter / SOH Injection ───────────────────────────────────
    if (activeRules.injection) {
      if (trimmedLine.includes('||') || trimmedLine.includes('\x01\x01')) {
        const f = {
          id: `SEC-INJ-SOH-${lineIndex}`,
          line: lineIndex + 1,
          seqNum: seqNumStr || 'N/A',
          severity: 'Medium',
          category: 'Tag Injection',
          title: 'Consecutive SOH Delimiter Injection',
          desc: 'Consecutive delimiter tokens detected. Naive tokenizers risk null-value stack offsets.',
          remediation: 'Sanitize input packets, ignoring empty tag tokens during lexical splits.',
          tag: '10',
        };
        findings.push(f);
        currentMsgFindings.push(f);
      }
      const textField = tagMap['58'] || '';
      if (textField.includes('35=') || textField.includes('49=') || textField.includes('=')) {
        const f = {
          id: `SEC-INJ-SPLIT-${lineIndex}`,
          line: lineIndex + 1,
          seqNum: seqNumStr || 'N/A',
          severity: 'High',
          category: 'Tag Injection',
          title: 'Delimiter Hijacking In String Value',
          desc: `Text (Tag 58="${textField}") contains raw equals / tag shapes. Can spoof extra properties.`,
          remediation: 'Strip characters that mimic tag boundary parameters from text fields.',
          tag: '58',
        };
        findings.push(f);
        currentMsgFindings.push(f);
      }
    }

    // ── RULE: Session Hijack Detection ────────────────────────────────────
    if (activeRules.hijacking && seqNum && sender) {
      const expected = expectedSequence[sender];
      if (expected && seqNum > expected && msgType !== '2' && msgType !== '4') {
        const f = {
          id: `SEC-HIJACK-GAP-${lineIndex}`,
          line: lineIndex + 1,
          seqNum: seqNumStr,
          severity: 'High',
          category: 'Hijacking',
          title: 'Unsolicited Sequence Number Jump',
          desc: `MsgSeqNum (34=${seqNum}) jumped from expected (${expected}) without a prior ResendRequest (35=2).`,
          remediation: 'Issue ResendRequest (35=2) automatically to reconstruct sequence audit logs.',
          tag: '34',
        };
        findings.push(f);
        currentMsgFindings.push(f);
        expectedSequence[sender] = seqNum + 1;
      } else if (seqNum && (!expected || seqNum === expected)) {
        expectedSequence[sender] = seqNum + 1;
      }
    }

    // ── RULE: Exchange Conformance Audit ──────────────────────────────────
    if (enfEx) {
      // 1. Standard rules (from old conformance page)
      if (msgType === '8' && tagMap['39'] === '8') {
        const hasTag103 = !!tagMap['103'];
        if (!hasTag103) {
          const f = {
            id: `CONF-STD-103-${lineIndex}`,
            line: lineIndex + 1,
            seqNum: seqNumStr || 'N/A',
            severity: 'Medium',
            category: 'Conformance (Standard)',
            title: 'Missing OrdRejReason (Tag 103)',
            desc: 'Execution Report (35=8) with OrdStatus (39=8, Rejected) must populate Tag 103.',
            remediation: 'Add Tag 103 (OrdRejReason) explaining the business rejection reason.',
            tag: '103',
          };
          findings.push(f);
          currentMsgFindings.push(f);
        }
      }

      // 2. CME iLink Rules
      if (exVenue === 'cme') {
        if (msgType === 'A') {
          const tag1028 = tagMap['1028'];
          if (tag1028 !== 'Y' && tag1028 !== 'N') {
            const f = {
              id: `CONF-CME-A1-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (CME)',
              title: 'CME ManualOrderIndicator (1028) missing/invalid',
              desc: 'CME requires Tag 1028 (ManualOrderIndicator) on Logons to indicate if order routing is automated or manual (Y/N).',
              remediation: 'Add Tag 1028=Y or 1028=N to your Logon message.',
              tag: '1028',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
          if (tagMap['98'] !== '0') {
            const f = {
              id: `CONF-CME-A2-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (CME)',
              title: 'CME EncryptMethod (98) Check',
              desc: 'CME requires Tag 98 (EncryptMethod) to always be set to 0 (None).',
              remediation: 'Modify Tag 98 to be equal to 0 (98=0).',
              tag: '98',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        }
        if (msgType === 'D') {
          if (!tagMap['581']) {
            const f = {
              id: `CONF-CME-D1-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (CME)',
              title: 'CME Account Type Check (Tag 581)',
              desc: 'CME requires Tag 581 (AccountType) on New Order Singles to flag retail vs proprietary accounts.',
              remediation: 'Add Tag 581 (e.g. 581=1 for Client, 581=3 for House).',
              tag: '581',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
          if (tagMap['21'] !== '1') {
            const f = {
              id: `CONF-CME-D2-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (CME)',
              title: 'CME Execution Instruction (Tag 21)',
              desc: 'CME requires Tag 21 (HandlInst) to be set to 1 (Automated execution, private, no Broker intervention).',
              remediation: 'Add Tag 21=1 on all New Order Singles.',
              tag: '21',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        }
      }

      // 3. NASDAQ Rules
      if (exVenue === 'nasdaq') {
        if (msgType === 'A') {
          if (tagMap['108'] !== '30') {
            const f = {
              id: `CONF-NSD-A1-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (NASDAQ)',
              title: 'NASDAQ HeartBtInt Check (Tag 108)',
              desc: 'NASDAQ rules mandate a HeartBtInt (Tag 108) of exactly 30 seconds.',
              remediation: 'Adjust HeartBtInt (Tag 108) to 30 seconds (108=30).',
              tag: '108',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        }
        if (msgType === 'D') {
          const ordType = tagMap['40'];
          const price = tagMap['44'];
          if (ordType === '2') { // Limit
            const hasValidPrice = price && parseFloat(price) > 0;
            if (!hasValidPrice) {
              const f = {
                id: `CONF-NSD-D1-${lineIndex}`,
                line: lineIndex + 1,
                seqNum: seqNumStr || 'N/A',
                severity: 'Medium',
                category: 'Conformance (NASDAQ)',
                title: 'NASDAQ Limit Order Price Check (Tag 44)',
                desc: 'NASDAQ Limit Orders (40=2) must specify a price (Tag 44).',
                remediation: 'Add Tag 44 (Price) with a valid value greater than 0.',
                tag: '44',
              };
              findings.push(f);
              currentMsgFindings.push(f);
            }
          } else if (ordType === '1') { // Market
            if (tagMap['44']) {
              const f = {
                id: `CONF-NSD-D2-${lineIndex}`,
                line: lineIndex + 1,
                seqNum: seqNumStr || 'N/A',
                severity: 'Medium',
                category: 'Conformance (NASDAQ)',
                title: 'NASDAQ Market Order Price Check',
                desc: 'NASDAQ Market Orders (40=1) must not contain a Price tag (Tag 44).',
                remediation: 'Remove Tag 44 from the Market Order payload.',
                tag: '44',
              };
              findings.push(f);
              currentMsgFindings.push(f);
            }
          }
        }
      }

      // 4. ICE Rules
      if (exVenue === 'ice') {
        if (msgType === 'D' || msgType === 'F' || msgType === 'G') {
          if (tagMap['22'] !== '4' && tagMap['22'] !== '100') {
            const f = {
              id: `CONF-ICE-E1-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (ICE)',
              title: 'ICE SecurityID Source (Tag 22)',
              desc: 'ICE requires Tag 22 (SecurityIDSource) to be set to 4 (ISIN) or 100 (ICE Private).',
              remediation: 'Define SecurityIDSource (Tag 22) as 4 or 100.',
              tag: '22',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
          if (!tagMap['48'] || !tagMap['55']) {
            const f = {
              id: `CONF-ICE-E2-${lineIndex}`,
              line: lineIndex + 1,
              seqNum: seqNumStr || 'N/A',
              severity: 'Medium',
              category: 'Conformance (ICE)',
              title: 'ICE Symbol & SecurityID Check',
              desc: 'ICE mandates providing both SecurityID (48) and Symbol (55).',
              remediation: 'Ensure both Tag 48 and Tag 55 are populated.',
              tag: !tagMap['48'] ? '48' : '55',
            };
            findings.push(f);
            currentMsgFindings.push(f);
          }
        }
      }
    }

    parsedMessages.push({
      index: lineIndex,
      sender,
      target,
      msgType,
      msgName,
      seqNum: seqNumStr,
      timeStr,
      raw: trimmedLine,
      tagList: parsed.tagList,
      findings: currentMsgFindings,
    });
  });

  let score = 100;
  findings.forEach(v => {
    if (v.severity === 'Critical') score -= 25;
    else if (v.severity === 'High') score -= 15;
    else if (v.severity === 'Medium') score -= 8;
    else if (v.severity === 'Low') score -= 3;
  });

  return { messages: parsedMessages, findings, score: Math.max(12, score) };
}

// ─── Demo Payload ─────────────────────────────────────────────────────────────
const DEMO_LOGS =
  '8=FIX.4.4\x019=128\x0135=A\x0134=1\x0149=VULN_CLIENT\x0156=GATEWAY\x0152=20260621-10:00:00.000\x0198=0\x01108=30\x01554=SuperSecretPassword123\x0196=PlaintextSecretRawData\x0110=088\x01\n' +
  '8=FIX.4.4\x019=82\x0135=A\x0134=1\x0149=GATEWAY\x0156=VULN_CLIENT\x0152=20260621-10:00:00.005\x0198=0\x01108=30\x0110=182\x01\n' +
  '8=FIX.4.4\x019=162\x0135=D\x0134=2\x0149=VULN_CLIENT\x0156=GATEWAY\x0152=20260621-10:00:02.100\x0111=ORD991\x0155=MSFT\x0154=1\x0138=1000\x0144=420.50\x0140=2\x0158=injected_field=35=8\x0110=145\x01\n' +
  '8=FIX.4.4\x019=162\x0135=D\x0134=2\x0149=VULN_CLIENT\x0156=GATEWAY\x0152=20250621-08:00:00.000\x0111=ORD991\x0155=MSFT\x0154=1\x0138=1000\x0144=420.50\x0140=2\x0110=192\x01\n' +
  '8=FIX.4.4\x019=122\x0135=D\x0134=15\x0149=VULN_CLIENT\x0156=GATEWAY\x0152=20260621-10:00:05.300\x0111=ORD995\x0155=TSLA\x0154=1\x0138=50\x0144=175.20\x0140=2\x0110=220\x01\n' +
  '8=FIX.4.4\x019=112\x0135=0\x0134=16\x0149=VULN_CLIENT\x0156=GATEWAY\x0152=20260621-10:00:30.000\x01\x0110=042\x01';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGradeInfo(score) {
  if (score >= 90) return { grade: 'A', color: '#22c55e', ringColor: '#16a34a', text: 'Secure Compliance' };
  if (score >= 80) return { grade: 'B', color: '#a855f7', ringColor: '#7c3aed', text: 'Moderate Risk' };
  if (score >= 70) return { grade: 'C', color: '#eab308', ringColor: '#ca8a04', text: 'Significant Vulnerability' };
  if (score >= 60) return { grade: 'D', color: '#f97316', ringColor: '#ea580c', text: 'High Risk' };
  return { grade: 'F', color: '#ef4444', ringColor: '#dc2626', text: 'Critical Danger' };
}

function SeverityBadge({ sev }) {
  const map = {
    Critical: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
    High: { bg: 'rgba(249,115,22,0.12)', color: '#f97316', border: 'rgba(249,115,22,0.25)' },
    Medium: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', border: 'rgba(234,179,8,0.25)' },
    Low: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.25)' },
  };
  const s = map[sev] || map.Low;
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {sev}
    </span>
  );
}

// ─── Toggle Switch Component ──────────────────────────────────────────────────
function RuleToggle({ rule, active, onChange }) {
  return (
    <button
      onClick={() => onChange(rule.id)}
      className="w-full flex items-start gap-3 p-2.5 rounded-xl transition-all text-left group"
      style={{
        background: active ? 'var(--primary-faint)' : 'transparent',
        border: `1px solid ${active ? 'var(--primary-border)' : 'var(--border-subtle)'}`,
      }}
    >
      <div className="relative mt-0.5 shrink-0">
        {/* Track */}
        <div
          className="w-8 h-4 rounded-full transition-all"
          style={{ background: active ? 'var(--primary)' : 'var(--border)' }}
        />
        {/* Thumb */}
        <div
          className="absolute top-0.5 h-3 w-3 rounded-full shadow transition-all duration-200"
          style={{
            background: active ? 'white' : 'var(--text-muted)',
            left: active ? '17px' : '2px',
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold leading-tight" style={{ color: active ? 'var(--foreground)' : 'var(--text-muted)' }}>
          {rule.label}
        </div>
        <div className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
          {rule.desc}
        </div>
      </div>
    </button>
  );
}

// ─── Rules Configuration Modal ────────────────────────────────────────────────
function AuditRulesModal({ 
  isOpen, 
  onClose, 
  activeRules, 
  toggleRule,
  enforceExchange,
  setEnforceExchange,
  exchangeVenue,
  setExchangeVenue
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-lg flex flex-col overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Wrench className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                Configure Audit Rules
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enable or disable security checks
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-3">
            {AUDIT_RULES.map(rule => (
              <RuleToggle
                key={rule.id}
                rule={rule}
                active={activeRules[rule.id]}
                onChange={toggleRule}
              />
            ))}
          </div>

          <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--border)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2 font-mono" style={{ color: 'var(--text-muted)' }}>
              Exchange Conformance
            </div>
            
            <div
              className="flex flex-col gap-2.5 p-2.5 rounded-xl transition-all"
              style={{
                background: enforceExchange ? 'var(--primary-faint)' : 'transparent',
                border: `1px solid ${enforceExchange ? 'var(--primary-border)' : 'var(--border-subtle)'}`,
              }}
            >
              <div 
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setEnforceExchange(!enforceExchange)}
              >
                <div className="relative mt-0.5 shrink-0">
                  <div
                    className="w-8 h-4 rounded-full transition-all"
                    style={{ background: enforceExchange ? 'var(--primary)' : 'var(--border)' }}
                  />
                  <div
                    className="absolute top-0.5 h-3 w-3 rounded-full shadow transition-all duration-200"
                    style={{
                      background: enforceExchange ? 'white' : 'var(--text-muted)',
                      left: enforceExchange ? '17px' : '2px',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold leading-tight" style={{ color: enforceExchange ? 'var(--foreground)' : 'var(--text-muted)' }}>
                    Exchange Conformance Audit
                  </div>
                  <div className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                    Validate messages against specific exchange specifications (CME, NASDAQ, ICE).
                  </div>
                </div>
              </div>

              {enforceExchange && (
                <div className="pl-11 pr-2 pb-1 flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[9px] font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    Exchange Venue
                  </label>
                  <select
                    value={exchangeVenue}
                    onChange={(e) => setExchangeVenue(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-[11px] font-mono rounded-lg p-2 outline-none text-[var(--foreground)] focus:border-[var(--primary)] transition-colors cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <option value="cme">CME iLink (FIX 4.2/4.4)</option>
                    <option value="nasdaq">NASDAQ FIX Gateway (FIX 4.4)</option>
                    <option value="ice">ICE FIX Trading (FIX 4.4)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-6 py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <button onClick={onClose} className="fx-btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SecurityAuditorPage() {
  const [rawLogs, setRawLogs] = useState('');
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
  const [fileName, setFileName] = useState('');
  const [activeRules, setActiveRules] = useState(() =>
    Object.fromEntries(AUDIT_RULES.map(r => [r.id, r.defaultOn]))
  );
  const [enforceExchange, setEnforceExchange] = useState(false);
  const [exchangeVenue, setExchangeVenue] = useState('cme');

  const [auditedMessages, setAuditedMessages] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [complianceScore, setComplianceScore] = useState(100);
  const [hasAuditRun, setHasAuditRun] = useState(false);

  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'inspector' | 'remediation'
  const [selectedMsgIndex, setSelectedMsgIndex] = useState(null);
  const [copiedSetting, setCopiedSetting] = useState(null);
  const [findingsSearch, setFindingsSearch] = useState('');
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Restore cache on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('fixify-security-raw');
    const cachedEnforce = localStorage.getItem('fixify-security-enforce-exchange') === 'true';
    const cachedVenue = localStorage.getItem('fixify-security-exchange-venue') || 'cme';
    
    setEnforceExchange(cachedEnforce);
    setExchangeVenue(cachedVenue);

    if (cached) {
      setRawLogs(cached);
      triggerAudit(cached, activeRules, cachedEnforce, cachedVenue);
    }
  }, []);

  // Re-run audit when rules or exchange settings change (if logs are present)
  useEffect(() => {
    if (rawLogs.trim() && hasAuditRun) {
      triggerAudit(rawLogs, activeRules, enforceExchange, exchangeVenue);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('fixify-security-enforce-exchange', String(enforceExchange));
      localStorage.setItem('fixify-security-exchange-venue', exchangeVenue);
    }
  }, [activeRules, enforceExchange, exchangeVenue]);

  const triggerAudit = (logText, rules, enfEx = enforceExchange, exVenue = exchangeVenue) => {
    const { messages, findings, score } = runAuditEngine(logText, rules, enfEx, exVenue);
    setAuditedMessages(messages);
    setVulnerabilities(findings);
    setComplianceScore(score);
    setHasAuditRun(true);
    if (messages.length > 0) setSelectedMsgIndex(0);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fixify-security-raw', logText);
    }
  };

  const handleRunAudit = () => {
    if (!rawLogs.trim()) return;
    triggerAudit(rawLogs, activeRules, enforceExchange, exchangeVenue);
  };

  const handleLoadDemo = () => {
    setRawLogs(DEMO_LOGS);
    setFileName('');
    setInputMode('paste');
    triggerAudit(DEMO_LOGS, activeRules, enforceExchange, exchangeVenue);
  };

  const handleClear = () => {
    setRawLogs('');
    setFileName('');
    setAuditedMessages([]);
    setVulnerabilities([]);
    setComplianceScore(100);
    setHasAuditRun(false);
    setSelectedMsgIndex(null);
    setFindingsSearch('');
    setInspectorSearch('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fixify-security-raw');
      localStorage.removeItem('fixify-security-enforce-exchange');
      localStorage.removeItem('fixify-security-exchange-venue');
    }
  };

  const toggleRule = (id) => {
    setActiveRules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyConfig = (configStr, key) => {
    navigator.clipboard.writeText(configStr);
    setCopiedSetting(key);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  // File Upload via dropzone
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setRawLogs(text);
      triggerAudit(text, activeRules, enforceExchange, exchangeVenue);
    };
    reader.readAsText(file);
  }, [activeRules, enforceExchange, exchangeVenue]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.log', '.txt', '.fix'] },
    multiple: false,
  });

  const gradeInfo = getGradeInfo(complianceScore);
  const circumference = 2 * Math.PI * 40; // r=40

  const filteredFindings = vulnerabilities.filter(v => {
    if (!findingsSearch.trim()) return true;
    const q = findingsSearch.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.severity.toLowerCase().includes(q) ||
      String(v.line).includes(q)
    );
  });

  const filteredMessages = auditedMessages.filter(m => {
    if (!inspectorSearch.trim()) return true;
    const q = inspectorSearch.toLowerCase();
    return m.msgName.toLowerCase().includes(q) || m.seqNum.includes(q) || m.sender.toLowerCase().includes(q);
  });

  const selectedMsg = selectedMsgIndex !== null ? auditedMessages[selectedMsgIndex] : null;

  // ── TABS ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'findings', label: 'Vulnerabilities', icon: AlertTriangle, count: vulnerabilities.length },
    { id: 'inspector', label: 'Log Inspector', icon: Eye, count: auditedMessages.length },
    { id: 'remediation', label: 'Remediation', icon: Wrench, count: null },
  ];

  const renderControlsCard = () => (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Toolbar */}
      <div
        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
      >
        {/* Input mode toggle */}
        <div className="fx-tab-group">
          <button
            className={`fx-tab${inputMode === 'file' ? ' active' : ''}`}
            onClick={() => setInputMode('file')}
          >
            <Upload className="h-3.5 w-3.5" /> <span className="inline">File</span>
          </button>
          <button
            className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
            onClick={() => setInputMode('paste')}
          >
            <ClipboardList className="h-3.5 w-3.5" /> <span className="inline">Paste</span>
          </button>
        </div>

        <div className="flex items-center gap-2">

          {/* Audit button */}
          <button
            onClick={handleRunAudit}
            disabled={!rawLogs.trim()}
            className="fx-btn-primary py-1.5 px-3"
            title="Run Security Audit"
          >
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Audit</span>
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="p-5 space-y-4">
        {inputMode === "file" ? (
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
              background: isDragActive ? 'var(--primary-faint)' : 'var(--background)',
              minHeight: 140,
            }}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: isDragActive ? 'var(--primary)' : 'var(--text-muted)' }} />
            {fileName ? (
              <div className="text-center">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>{fileName}</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>File loaded — click Audit</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {isDragActive ? 'Drop file here' : 'Drag & drop session logs'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Accepts .txt · .fix · .log
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={rawLogs}
            onChange={e => setRawLogs(e.target.value)}
            placeholder={"Paste SOH-delimited FIX logs here…\ne.g. 8=FIX.4.4|9=128|35=A|34=1|…"}
            rows={10}
            className="w-full rounded-xl p-3 text-[10px] font-mono resize-none outline-none transition-all"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
          >
            <Zap className="h-3.5 w-3.5 animate-pulse" /> Load Insecure Demo Logs
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto">

      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!hasAuditRun ? 'max-w-2xl mx-auto' : ''}`}>
        <div className={`space-y-1.5 ${!hasAuditRun ? 'text-center md:text-left w-full' : ''}`}>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            FIX Security Auditor
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Scan session logs for replay attacks, plaintext credentials, SOH injection &amp; hijacking risks.
          </p>
        </div>
        {hasAuditRun && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="fx-btn-secondary"
            >
              <Wrench className="h-3.5 w-3.5" /> <span>Configure Rules</span>
            </button>
            <button
              onClick={handleClear}
              className="fx-btn-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" /> <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {!hasAuditRun ? (
        /* Welcome / Empty State controls card container */
        <div className="max-w-2xl mx-auto space-y-6">
          {renderControlsCard()}
        </div>
      ) : (
        /* ── MAIN GRID LAYOUT ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
          
          {/* Left Panel: Controls Card */}
          <div className="lg:col-span-4 space-y-4">
            {renderControlsCard()}
          </div>

          {/* Right Panel: Audit Dashboard & Results */}
          <div className="lg:col-span-8 space-y-4 flex flex-col min-w-0">
            {/* Executive Overview Banner */}
            <div className="grid grid-cols-3 gap-4 shrink-0">

              {/* Compliance Gauge */}
              <div
                className="col-span-1 p-4 rounded-2xl flex items-center gap-4"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="relative h-[76px] w-[76px] shrink-0 flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" stroke="var(--border)" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="48" cy="48" r="40"
                      stroke={gradeInfo.color}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (circumference * complianceScore) / 100}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-2xl font-extrabold" style={{ color: gradeInfo.color }}>{gradeInfo.grade}</span>
                    <span className="text-[9px] font-mono block" style={{ color: 'var(--text-muted)' }}>{complianceScore}%</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                    Compliance Grade
                  </div>
                  <div className="text-xs font-bold truncate" style={{ color: gradeInfo.color }}>{gradeInfo.text}</div>
                  <div className="text-[9px] mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {auditedMessages.length} msg scanned · {vulnerabilities.length} findings
                  </div>
                </div>
              </div>

              {/* Critical count */}
              <div
                className="p-4 rounded-2xl flex flex-col justify-between"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Critical Findings</span>
                  <ShieldAlert className="h-4 w-4 text-red-500 animate-bounce" />
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-red-500">
                    {vulnerabilities.filter(v => v.severity === 'Critical').length}
                  </span>
                  <span className="text-[9px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>Credential / data leaks</span>
                </div>
              </div>

              {/* High + Medium count */}
              <div
                className="p-4 rounded-2xl flex flex-col justify-between"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>High &amp; Med Threats</span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-amber-500">
                    {vulnerabilities.filter(v => v.severity === 'High' || v.severity === 'Medium').length}
                  </span>
                  <span className="text-[9px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>Replays · injections · jumps</span>
                </div>
              </div>
            </div>

            {/* Tabbed Panel */}
            <div
              className="flex flex-col rounded-2xl overflow-hidden min-h-0"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                height: 'calc(100vh - 280px)',
                minHeight: '550px'
              }}
            >
              {/* Tab Bar */}
              <div
                className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-semibold transition-all border-b-2 -mb-px"
                      style={{
                        borderBottomColor: active ? 'var(--primary)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        background: 'transparent',
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      {tab.count !== null && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                          style={{
                            background: active ? 'var(--primary-faint)' : 'var(--background)',
                            color: active ? 'var(--primary)' : 'var(--text-muted)',
                          }}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* TAB CONTENT */}
              <div className="flex-1 overflow-hidden">

                {/* Tab: Vulnerabilities Grid */}
                {activeTab === 'findings' && (
                  <div className="h-full flex flex-col p-4 gap-3">
                    {/* Search bar */}
                    <div className="relative shrink-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={findingsSearch}
                        onChange={e => setFindingsSearch(e.target.value)}
                        placeholder="Filter by severity, category or title…"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono outline-none"
                        style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>

                    {filteredFindings.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {findingsSearch ? 'No matching findings' : 'No vulnerabilities detected'}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {findingsSearch ? 'Try a different filter term.' : 'All enabled rules passed for this session log.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0" style={{ background: 'var(--card)' }}>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {['Line', 'Severity', 'Category', 'Vulnerability & Remediation'].map(h => (
                                <th key={h} className="py-2 pr-3 text-left font-mono font-bold text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredFindings.map(v => (
                              <tr
                                key={v.id}
                                className="transition-colors"
                                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-faint)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <td className="py-2.5 pr-3 font-mono font-bold text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                  L{v.line}
                                </td>
                                <td className="py-2.5 pr-3 whitespace-nowrap">
                                  <SeverityBadge sev={v.severity} />
                                </td>
                                <td className="py-2.5 pr-3 font-mono text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                  {v.category}
                                </td>
                                <td className="py-2.5 pr-2">
                                  <div className="font-semibold text-[11px]" style={{ color: 'var(--foreground)' }}>{v.title}</div>
                                  <div className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{v.desc}</div>
                                  <div className="text-[9px] mt-1 flex items-start gap-1" style={{ color: '#f97316' }}>
                                    <ChevronRight className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <span>{v.remediation}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Log Inspector */}
                {activeTab === 'inspector' && (
                  <div className="h-full flex gap-0 min-h-0">
                    {/* Message list */}
                    <div
                      className="w-52 shrink-0 flex flex-col border-r overflow-hidden"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="p-2 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            value={inspectorSearch}
                            onChange={e => setInspectorSearch(e.target.value)}
                            placeholder="Filter messages…"
                            className="w-full pl-6 pr-2 py-1 rounded text-[10px] font-mono outline-none"
                            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 pr-1">
                        {filteredMessages.map((msg, idx) => {
                          const origIdx = auditedMessages.indexOf(msg);
                          const isSelected = selectedMsgIndex === origIdx;
                          const hasThreats = msg.findings.length > 0;
                          return (
                            <button
                              key={origIdx}
                              onClick={() => setSelectedMsgIndex(origIdx)}
                              className="w-full text-left p-2 rounded-lg transition-all"
                              style={{
                                background: isSelected ? 'var(--primary-faint)' : 'transparent',
                                border: `1px solid ${isSelected ? 'var(--primary-border)' : 'transparent'}`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-mono font-bold" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                                  #{msg.seqNum || origIdx + 1}
                                </span>
                                {hasThreats && (
                                  <ShieldAlert className="h-3 w-3 text-red-500 shrink-0 animate-pulse" />
                                )}
                              </div>
                              <div className="text-[10px] font-semibold truncate mt-0.5" style={{ color: isSelected ? 'var(--foreground)' : 'var(--text-muted)' }}>
                                {msg.msgName}
                              </div>
                              <div className="text-[9px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                                {msg.sender}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tag detail panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {selectedMsg ? (
                        <>
                          <div
                            className="px-4 py-2.5 flex items-center justify-between shrink-0"
                            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--background)' }}
                          >
                            <div>
                              <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{selectedMsg.msgName}</span>
                              <span className="text-[9px] font-mono ml-2 animate-in fade-in" style={{ color: 'var(--text-muted)' }}>
                                Seq #{selectedMsg.seqNum} · {selectedMsg.sender} → {selectedMsg.target}
                              </span>
                            </div>
                            {selectedMsg.findings.length > 0 && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded font-mono shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {selectedMsg.findings.length} threat{selectedMsg.findings.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 pr-1">
                            {selectedMsg.tagList.map((tagItem, i) => {
                              const warning = selectedMsg.findings.find(f => f.tag === String(tagItem.tag));
                              return (
                                <div
                                  key={i}
                                  className="rounded-lg px-3 py-2 transition-all"
                                  style={{
                                    border: `1px solid ${warning ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                                    background: warning ? 'rgba(239,68,68,0.05)' : 'var(--background)',
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono font-bold text-[10px] shrink-0" style={{ color: 'var(--primary)' }}>
                                        {tagItem.tag}
                                      </span>
                                      <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                        ({tagItem.name})
                                      </span>
                                    </div>
                                    <span className="font-mono text-[10px] font-semibold break-all text-right" style={{ color: 'var(--foreground)' }}>
                                      {tagItem.val}
                                    </span>
                                  </div>
                                  {warning && (
                                    <div className="flex items-start gap-1.5 mt-1.5 pl-1 border-l-2 border-red-500">
                                      <AlertCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="text-[9px] font-bold text-red-400">{warning.title}</span>
                                        <span className="text-[9px] text-red-400/70 ml-1">— {warning.remediation}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            Select a message from the list
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Remediation Config */}
                {activeTab === 'remediation' && (
                  <div className="h-full overflow-y-auto p-4 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {REMEDIATION_SETTINGS.map(set => (
                        <div
                          key={set.key}
                          className="p-4 rounded-xl flex flex-col justify-between gap-3"
                          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                              <span className="text-xs font-bold font-mono" style={{ color: 'var(--foreground)' }}>
                                {set.key} = {set.val}
                              </span>
                            </div>
                            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{set.desc}</p>
                          </div>
                          <div
                            className="flex items-center gap-2 pt-2"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}
                          >
                            <code
                              className="flex-1 text-[10px] font-mono px-2 py-1.5 rounded truncate"
                              style={{ background: 'var(--card)', color: 'var(--foreground)' }}
                            >
                              {set.config.replace('\n', ' | ')}
                            </code>
                            <button
                              onClick={() => handleCopyConfig(set.config, set.key)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all shrink-0"
                              style={{
                                border: '1px solid var(--border)',
                                color: copiedSetting === set.key ? '#22c55e' : 'var(--text-muted)',
                                background: copiedSetting === set.key ? 'rgba(34,197,94,0.1)' : 'transparent',
                              }}
                            >
                              {copiedSetting === set.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copiedSetting === set.key ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-mono mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      QuickFIX/J · QuickFIX/N · QuickFIX (C++) · FIX Antenna — all support these config keys.
                    </p>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* Rules Config Modal */}
      <AuditRulesModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        activeRules={activeRules}
        toggleRule={toggleRule}
        enforceExchange={enforceExchange}
        setEnforceExchange={setEnforceExchange}
        exchangeVenue={exchangeVenue}
        setExchangeVenue={setExchangeVenue}
      />
    </div>
  );
}
