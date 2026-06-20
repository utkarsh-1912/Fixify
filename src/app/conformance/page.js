'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Upload, Play, Info, AlertTriangle, CheckCircle, X, ChevronRight, Download, FileText } from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';

export default function ConformancePage() {
  const [rawLogs, setRawLogs] = useState("");
  const [venue, setVenue] = useState("cme");
  const [results, setResults] = useState([]);
  const [statistics, setStatistics] = useState({ totalRules: 0, passed: 0, failed: 0 });

  // Restore cached logs on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('fixify-conformance-raw');
    const cachedVenue = localStorage.getItem('fixify-conformance-venue');
    if (cached) setRawLogs(cached);
    if (cachedVenue) setVenue(cachedVenue);
  }, []);

  const runValidation = (logText, selectedVenue) => {
    if (!logText.trim()) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('fixify-conformance-raw', logText);
      localStorage.setItem('fixify-conformance-venue', selectedVenue);
    }

    const lines = logText.split('\n');
    const checkResults = [];

    // Rules Definitions based on Venue
    lines.forEach((line, lineIndex) => {
      if (!line.trim()) return;
      const parsed = validateFIXMessage(line);
      if (!parsed || !parsed.tagList || parsed.tagList.length === 0) return;

      const tagMap = parsed.tags;
      const msgType = tagMap['35'];
      const seqNum = tagMap['34'] || String(lineIndex + 1);

      // Define standard validation rules check
      const rules = [];

      // 1. Common / Standard rules
      if (msgType === '8' && tagMap['39'] === '8') {
        rules.push({
          id: 'STD-103',
          name: 'OrdRejReason (103) presence',
          desc: 'Execution Report (35=8) with OrdStatus (39=8, Rejected) must populate Tag 103.',
          passed: !!tagMap['103'],
          fix: 'Add Tag 103 (OrdRejReason) explaining the business rejection reason.'
        });
      }

      // 2. CME iLink Rules
      if (selectedVenue === 'cme') {
        if (msgType === 'A') {
          rules.push({
            id: 'CME-A1',
            name: 'CME ManualOrderIndicator (1028)',
            desc: 'CME requires Tag 1028 (ManualOrderIndicator) on Logons to indicate if order routing is automated or manual.',
            passed: tagMap['1028'] === 'Y' || tagMap['1028'] === 'N',
            fix: 'Add Tag 1028=Y or 1028=N to your Logon message.'
          });
          rules.push({
            id: 'CME-A2',
            name: 'CME EncryptMethod (98)',
            desc: 'CME requires Tag 98 (EncryptMethod) to always be set to 0 (None).',
            passed: tagMap['98'] === '0',
            fix: 'Modify Tag 98 to be equal to 0 (98=0).'
          });
        }
        if (msgType === 'D') {
          rules.push({
            id: 'CME-D1',
            name: 'CME Account Type Check',
            desc: 'CME requires Tag 581 (AccountType) on New Order Singles to flag retail vs proprietary accounts.',
            passed: !!tagMap['581'],
            fix: 'Add Tag 581 (e.g. 581=1 for Client, 581=3 for House).'
          });
          rules.push({
            id: 'CME-D2',
            name: 'CME Execution Instruction',
            desc: 'CME requires Tag 21 (HandlInst) to be set to 1 (Automated execution, private, no Broker intervention).',
            passed: tagMap['21'] === '1',
            fix: 'Add Tag 21=1 on all New Order Singles.'
          });
        }
      }

      // 3. NASDAQ Rules
      if (selectedVenue === 'nasdaq') {
        if (msgType === 'A') {
          rules.push({
            id: 'NSD-A1',
            name: 'NASDAQ HeartBtInt Check',
            desc: 'NASDAQ rules mandate a HeartBtInt (Tag 108) of exactly 30 seconds.',
            passed: tagMap['108'] === '30',
            fix: 'Adjust HeartBtInt (Tag 108) to 30 seconds (108=30).'
          });
        }
        if (msgType === 'D') {
          const ordType = tagMap['40'];
          const price = tagMap['44'];
          if (ordType === '2') { // Limit
            rules.push({
              id: 'NSD-D1',
              name: 'NASDAQ Limit Order Price Check',
              desc: 'NASDAQ Limit Orders (40=2) must specify a price (Tag 44).',
              passed: !!price && parseFloat(price) > 0,
              fix: 'Add Tag 44 (Price) with a valid value greater than 0.'
            });
          } else if (ordType === '1') { // Market
            rules.push({
              id: 'NSD-D2',
              name: 'NASDAQ Market Order Price Check',
              desc: 'NASDAQ Market Orders (40=1) must not contain a Price tag (Tag 44).',
              passed: !tagMap['44'],
              fix: 'Remove Tag 44 from the Market Order payload.'
            });
          }
        }
      }

      // 4. ICE Rules
      if (selectedVenue === 'ice') {
        if (msgType === 'D' || msgType === 'F' || msgType === 'G') {
          rules.push({
            id: 'ICE-E1',
            name: 'ICE SecurityID Source (22)',
            desc: 'ICE requires Tag 22 (SecurityIDSource) to be set to 4 (ISIN) or 100 (ICE Private).',
            passed: tagMap['22'] === '4' || tagMap['22'] === '100',
            fix: 'Define SecurityIDSource (Tag 22) as 4 or 100.'
          });
          rules.push({
            id: 'ICE-E2',
            name: 'ICE Symbol Override check',
            desc: 'ICE mandates providing both SecurityID (48) and Symbol (55).',
            passed: !!tagMap['48'] && !!tagMap['55'],
            fix: 'Ensure both Tag 48 and Tag 55 are populated.'
          });
        }
      }

      // Collect checks
      if (rules.length > 0) {
        checkResults.push({
          lineIndex,
          seqNum,
          msgType,
          raw: line,
          rules
        });
      }
    });

    // Compute stats
    let totalRules = 0;
    let passed = 0;
    let failed = 0;

    checkResults.forEach(res => {
      res.rules.forEach(r => {
        totalRules++;
        if (r.passed) passed++;
        else failed++;
      });
    });

    setResults(checkResults);
    setStatistics({ totalRules, passed, failed });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setRawLogs(text);
      runValidation(text, venue);
    };
    reader.readAsText(file);
  };

  const handleVenueChange = (newVenue) => {
    setVenue(newVenue);
    if (rawLogs.trim()) {
      runValidation(rawLogs, newVenue);
    }
  };

  const handleClear = () => {
    setRawLogs("");
    setResults([]);
    setStatistics({ totalRules: 0, passed: 0, failed: 0 });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fixify-conformance-raw');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <ShieldCheck className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            Exchange Conformance Rules Engine
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Validate trading logs against strict execution manual specs for CME, NASDAQ, and ICE gateways.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Control Card */}
        <div
          className="p-5 rounded-2xl border space-y-4 h-fit"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Select Conformance Venue:</span>
            <select
              value={venue}
              onChange={(e) => handleVenueChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 text-xs font-mono rounded-xl p-3 outline-none text-[var(--foreground)] focus:border-[var(--primary)] transition-colors cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="cme">CME iLink (FIX 4.2/4.4)</option>
              <option value="nasdaq">NASDAQ FIX Gateway (FIX 4.4)</option>
              <option value="ice">ICE FIX Trading (FIX 4.4)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Upload logs:</span>
            <div className="flex gap-2">
              <label className="fx-btn-secondary flex-1 py-2 text-center cursor-pointer text-xs justify-center">
                <Upload className="h-4 w-4" /> Upload Log
                <input type="file" onChange={handleFileUpload} accept=".log,.txt" className="hidden" />
              </label>
              <button
                onClick={() => {
                  let demo = "";
                  if (venue === 'cme') {
                    demo = "8=FIX.4.2|9=90|35=A|34=1|49=CLIENT|56=CME|98=0|108=30|10=220|\n8=FIX.4.2|9=110|35=D|34=2|49=CLIENT|56=CME|11=ORD01|21=1|55=ESM6|54=1|38=5|40=2|44=2100.00|10=180|";
                  } else if (venue === 'nasdaq') {
                    demo = "8=FIX.4.4|9=100|35=A|34=1|49=CLIENT|56=NSDQ|98=0|108=60|10=190|\n8=FIX.4.4|9=110|35=D|34=2|49=CLIENT|56=NSDQ|11=ORD02|40=1|44=185.00|10=160|";
                  } else {
                    demo = "8=FIX.4.4|9=90|35=D|34=1|49=CLIENT|56=ICE|11=ORD03|22=5|55=BRN|10=140|";
                  }
                  setRawLogs(demo);
                  runValidation(demo, venue);
                }}
                className="fx-btn-primary py-2 text-xs flex-1 justify-center"
              >
                <Play className="h-4 w-4" /> Load Demo
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block font-mono">Log Validation Summary:</span>
            {statistics.totalRules > 0 ? (
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-900">
                  <div className="text-sm font-bold text-zinc-300">{statistics.totalRules}</div>
                  <div className="text-[8px] text-zinc-500 uppercase">Rules</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                  <div className="text-sm font-bold text-emerald-400">{statistics.passed}</div>
                  <div className="text-[8px] text-emerald-500 uppercase">Pass</div>
                </div>
                <div className="p-2 rounded-lg bg-red-950/20 border border-red-900/30">
                  <div className="text-sm font-bold text-red-400">{statistics.failed}</div>
                  <div className="text-[8px] text-red-500 uppercase">Fail</div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] italic">No checks executed yet.</p>
            )}
          </div>
        </div>

        {/* Right Form & Results panel */}
        <div className="lg:col-span-2 space-y-4 w-full">
          {results.length === 0 ? (
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Paste logs for validation:</span>
              <textarea
                className="w-full min-h-[300px] p-3 rounded-xl text-xs font-mono bg-zinc-950 border border-zinc-900 text-zinc-300 outline-none focus:border-[var(--primary)]"
                style={{ borderColor: 'var(--border)' }}
                placeholder="8=FIX.4.4|9=150|35=D|49=CLIENT|56=BROKER..."
                value={rawLogs}
                onChange={(e) => setRawLogs(e.target.value)}
              />
              <div className="flex justify-between">
                <button onClick={handleClear} className="fx-btn-secondary py-1 text-xs">Clear</button>
                <button
                  onClick={() => runValidation(rawLogs, venue)}
                  disabled={!rawLogs.trim()}
                  className="fx-btn-primary py-1 text-xs"
                >
                  Verify Compliance
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Conformance Report Results</span>
                <button onClick={handleClear} className="text-xs font-mono text-[var(--primary)] hover:underline">Clear Results</button>
              </div>

              {results.map((res, idx) => {
                const hasFail = res.rules.some(r => !r.passed);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border space-y-3"
                    style={{
                      background: 'var(--card)',
                      borderColor: hasFail ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'
                    }}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="font-mono text-xs font-bold text-zinc-200">Seq {res.seqNum} (35={res.msgType})</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${hasFail ? 'bg-red-950 text-red-400 border border-red-900/30' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'}`}>
                        {hasFail ? 'Failed' : 'Compliant'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {res.rules.map(rule => (
                        <div key={rule.id} className="text-xs font-mono p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-900 space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="flex items-start gap-2">
                            {rule.passed ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold" style={{ color: rule.passed ? 'var(--foreground)' : '#f87171' }}>
                                [{rule.id}] {rule.name}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{rule.desc}</p>
                            </div>
                          </div>
                          {!rule.passed && (
                            <div className="pl-6 pt-1 border-t border-zinc-900 mt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                              <span className="text-[9px] font-bold uppercase text-amber-500 block">Recommended Fix:</span>
                              <span className="text-[10px] text-zinc-300 leading-relaxed block mt-0.5">{rule.fix}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
