'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Network, 
  Upload, 
  Trash2, 
  Clock, 
  RefreshCw, 
  Activity, 
  Eye,
  X, 
  ArrowUp, 
  ArrowDown, 
  Info, 
  AlertTriangle, 
  ClipboardList,
  UploadCloud,
  ChevronDown,
  ChevronRight,
  Link2,
  Unlink,
  Plus,
  Check,
  Search,
  Tag,
  Layers,
  Sparkles
} from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';
import SohVisualizer from '@/components/SohVisualizer';

const DEFAULT_LOGS = 
`// Hop 1: Inbound Client Gateway (CLIENT_ABC <-> GW_LAYER)
2026-06-23 10:00:00.120 [GATEWAY] IN: 8=FIX.4.4|9=115|35=D|34=101|49=CLIENT_ABC|56=GW_LAYER|52=20260623-10:00:00.120|11=CLORD_9912A|55=MSFT|54=1|38=500|44=430.50|40=2|10=050|
2026-06-23 10:00:00.160 [GATEWAY] OUT: 8=FIX.4.4|9=142|35=8|34=102|49=GW_LAYER|56=CLIENT_ABC|52=20260623-10:00:00.160|37=ORD_8892|11=CLORD_9912A|17=EXEC_01A|20=0|150=0|39=0|55=MSFT|54=1|38=500|32=0|31=0.00|10=220|

// Hop 2: Order Management Router (GW_LAYER <-> OMS_CORE)
2026-06-23 10:00:00.124 [OMS] IN: 8=FIX.4.4|9=122|35=D|34=201|49=GW_LAYER|56=OMS_CORE|52=20260623-10:00:00.124|11=OMS_REQ_881|41=CLORD_9912A|55=MSFT|54=1|38=500|44=430.50|10=185|
2026-06-23 10:00:00.155 [OMS] OUT: 8=FIX.4.4|9=145|35=8|34=202|49=OMS_CORE|56=GW_LAYER|52=20260623-10:00:00.155|37=ORD_8892|11=OMS_REQ_881|17=EXEC_01A|20=0|150=0|39=0|55=MSFT|54=1|38=500|10=210|

// Hop 3: Exchange Gateway Link (OMS_CORE <-> EXCH_GATEWAY)
2026-06-23 10:00:00.128 [EXCH] OUT: 8=FIX.4.4|9=118|35=D|34=501|49=OMS_CORE|56=EXCH_GATEWAY|52=20260623-10:00:00.128|11=OMS_REQ_881|55=MSFT|54=1|38=500|44=430.50|10=140|
2026-06-23 10:00:00.148 [EXCH] IN: 8=FIX.4.4|9=138|35=8|34=502|49=EXCH_GATEWAY|56=OMS_CORE|52=20260623-10:00:00.148|37=ORD_8892|11=OMS_REQ_881|17=EXEC_01A|20=0|150=0|39=0|55=MSFT|54=1|10=195|`;

// Parsing helper for SendingTime
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  try {
    if (timeStr.includes('-')) {
      const timePart = timeStr.split('-')[1];
      if (timePart) {
        const [hh, mm, ss] = timePart.split(':');
        const [sec, ms] = ss.split('.');
        const d = new Date();
        d.setUTCHours(parseInt(hh, 10));
        d.setUTCMinutes(parseInt(mm, 10));
        d.setUTCSeconds(parseInt(sec, 10));
        d.setUTCMilliseconds(parseInt(ms || '0', 10));
        return d.getTime();
      }
    }
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch (e) {
    return null;
  }
};

const parseLogs = (rawText, activeConfigs) => {
  if (!rawText) return [];
  return rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.includes('8=FIX'))
    .map((raw, index) => {
      const fixStart = raw.indexOf('8=FIX');
      const fixRaw = fixStart !== -1 ? raw.substring(fixStart) : raw;
      const parsed = validateFIXMessage(fixRaw);
      if (!parsed) return null;

      const sender = parsed.tags['49'] || '';
      const target = parsed.tags['56'] || '';
      
      const key1 = `${sender} ⟷ ${target}`;
      const key2 = `${target} ⟷ ${sender}`;
      let matchedConfig = activeConfigs.find(c => c.key === key1 || c.key === key2);
      
      return {
        id: `msg-${index}`,
        raw: fixRaw,
        parsed,
        time: parseTime(parsed.tags['52']),
        clOrdID: parsed.tags['11'] || '',
        origClOrdID: parsed.tags['41'] || '',
        orderID: parsed.tags['37'] || '',
        execID: parsed.tags['17'] || '',
        msgType: parsed.tags['35'] || '',
        msgTypeName: parsed.msgTypeName || 'Unknown',
        sender,
        target,
        symbol: parsed.tags['55'] || '',
        connectionKey: matchedConfig ? matchedConfig.key : null,
        configName: matchedConfig ? matchedConfig.name : `${sender} ⟷ ${target}`
      };
    })
    .filter(Boolean);
};

// ─── Message Inspection Modal ────────────────────────────────────────────────
function MessageInspectModal({ msg, onClose }) {
  const [showPayload, setShowPayload] = useState(false);
  if (!msg) return null;

  const tags = msg.parsed?.tags || {};
  const tagList = msg.parsed?.tagList || [];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 select-text animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Tag className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <span className="text-[11px] font-bold font-mono block" style={{ color: 'var(--foreground)' }}>
                {msg.msgTypeName} <span style={{ color: 'var(--text-muted)' }}>({msg.msgType})</span>
              </span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {msg.sender} → {msg.target}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">

          {/* Key Identifiers */}
          <div>
            <span className="fx-section-label block mb-2">Key Identifiers</span>
            <div
              className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border text-[9px] font-mono"
              style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
            >
              {[
                { label: 'Tag 11 — ClOrdID', value: msg.clOrdID },
                { label: 'Tag 37 — OrderID', value: msg.orderID },
                { label: 'Tag 41 — OrigClOrdID', value: msg.origClOrdID },
                { label: 'Tag 17 — ExecID', value: msg.execID },
                { label: 'Tag 49 — Sender', value: msg.sender },
                { label: 'Tag 56 — Target', value: msg.target },
                { label: 'Tag 55 — Symbol', value: msg.symbol },
                { label: 'Tag 52 — SendingTime', value: tags['52'] },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-bold break-all" style={{ color: value ? 'var(--foreground)' : 'var(--text-faint)' }}>
                    {value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All Tags — curated table */}
          <div>
            <span className="fx-section-label block mb-2">Tag Breakdown ({tagList.length} fields)</span>
            <div
              className="overflow-x-auto rounded-xl"
              style={{ border: '1px solid var(--border)' }}
            >
              <table className="w-full text-xs font-mono min-w-[320px]">
                <thead>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th className="py-2.5 px-3 text-left font-semibold">Tag</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Field Name</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {tagList.map((t, idx) => {
                    const isCrucial = ['8', '9', '35', '11', '10', '52'].includes(t.tag);
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isCrucial ? 'var(--primary-faint)' : 'transparent',
                        }}
                        className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
                      >
                        <td
                          className="py-2 px-3 font-bold"
                          style={{ color: isCrucial ? 'var(--primary)' : 'var(--foreground)' }}
                        >
                          {t.tag}
                        </td>
                        <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>
                          {t.name}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[160px]" style={{ color: 'var(--foreground)' }} title={t.val}>
                          {t.meaning && t.meaning !== t.val ? (
                            <span
                              className="underline decoration-dotted"
                              style={{ color: 'var(--primary)' }}
                              title={`Mapped: ${t.meaning}`}
                            >
                              {t.val}
                            </span>
                          ) : t.val}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Payload */}
          <div>
            <button
              className="flex items-center gap-1.5 w-full text-left mb-2"
              onClick={() => setShowPayload(p => !p)}
            >
              {showPayload
                ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
              }
              <span className="fx-section-label" style={{ color: showPayload ? 'var(--primary)' : undefined }}>
                Raw Message Payload
              </span>
            </button>
            {showPayload && (
              <div
                className="p-3 rounded-xl border text-[10px] font-mono break-all max-h-48 overflow-y-auto scrollbar-thin"
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <SohVisualizer content={msg.raw} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Manual Link Modal ───────────────────────────────────────────────────────
function ManualLinkModal({ allMessages, manualLinks, onAddLink, onRemoveLink, onClose }) {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [selectedA, setSelectedA] = useState(null);
  const [selectedB, setSelectedB] = useState(null);
  const [linkField, setLinkField] = useState('clOrdID'); // clOrdID | orderID | execID

  // IDs of messages already participating in any manual link
  const linkedIds = new Set(manualLinks.flatMap(l => [l.idA, l.idB]));

  const filtered = (search, excludeId) =>
    allMessages.filter(m => {
      if (m.id === excludeId) return false; // don't show the already-selected other side
      if (linkedIds.has(m.id)) return false; // hide already manually linked messages
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        m.clOrdID.toLowerCase().includes(s) ||
        m.orderID.toLowerCase().includes(s) ||
        m.execID.toLowerCase().includes(s) ||
        m.msgTypeName.toLowerCase().includes(s) ||
        m.sender.toLowerCase().includes(s) ||
        m.target.toLowerCase().includes(s)
      );
    });

  const handleAdd = () => {
    if (!selectedA || !selectedB || selectedA.id === selectedB.id) return;
    onAddLink({ idA: selectedA.id, idB: selectedB.id, field: linkField });
    setSelectedA(null);
    setSelectedB(null);
  };

  const MsgRow = ({ msg, selected, linked, onSelect }) => (
    <button
      onClick={() => onSelect(msg)}
      className="w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 transition-all"
      style={{
        background: selected ? 'var(--primary-faint)' : 'transparent',
        border: `1px solid ${selected ? 'var(--primary-border)' : 'transparent'}`,
        opacity: linked && !selected ? 0.45 : 1,
      }}
    >
      <span
        className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold shrink-0 mt-0.5"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--primary)' }}
      >
        {msg.msgType}
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-mono font-bold truncate" style={{ color: 'var(--foreground)' }}>
          {msg.clOrdID || msg.orderID || msg.execID || msg.sender}
        </div>
        <div className="text-[8px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
          {msg.sender} → {msg.target}{linked ? ' · linked' : ''}
        </div>
      </div>
      {selected && <Check className="h-3 w-3 shrink-0 ml-auto mt-1" style={{ color: 'var(--primary)' }} />}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 select-text animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Link2 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <span className="text-[11px] font-bold block" style={{ color: 'var(--foreground)' }}>Manual Order Linking</span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                Select two messages from any session to force-link them into a chain
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {/* Link field selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--text-muted)' }}>Link via:</span>
            {['clOrdID', 'orderID', 'execID'].map(f => (
              <button
                key={f}
                onClick={() => setLinkField(f)}
                className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition-all"
                style={{
                  background: linkField === f ? 'var(--primary-faint)' : 'var(--background)',
                  border: `1px solid ${linkField === f ? 'var(--primary-border)' : 'var(--border)'}`,
                  color: linkField === f ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Two-panel picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Message A', search: searchA, setSearch: setSearchA, selected: selectedA, setSelected: setSelectedA },
              { label: 'Message B', search: searchB, setSearch: setSearchB, selected: selectedB, setSelected: setSelectedB },
            ].map(({ label, search, setSearch, selected, setSelected }) => (
              <div key={label} className="flex flex-col gap-2">
                <span className="fx-section-label">{label}</span>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <Search className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter messages…"
                    className="flex-1 bg-transparent text-[9px] font-mono outline-none"
                    style={{ color: 'var(--foreground)' }}
                  />
                </div>
                <div
                  className="rounded-xl border overflow-y-auto max-h-52 space-y-0.5 p-1 scrollbar-thin"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  {filtered(search, selected?.id).length === 0 ? (
                    <div className="text-[9px] italic font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
                      No messages
                    </div>
                  ) : (
                    filtered(search, selected?.id).map(m => (
                      <MsgRow
                        key={m.id}
                        msg={m}
                        selected={selected?.id === m.id}
                        linked={linkedIds.has(m.id)}
                        onSelect={setSelected}
                      />
                    ))
                  )}
                </div>
                {selected && (
                  <div
                    className="px-2.5 py-1.5 rounded-lg border text-[9px] font-mono"
                    style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}
                  >
                    ✓ {selected.msgTypeName} — {selected.clOrdID || selected.orderID || selected.sender}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            disabled={!selectedA || !selectedB || selectedA.id === selectedB.id}
            className="w-full py-2 rounded-xl text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--primary-faint)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Link These Messages into Same Chain
          </button>

          {/* Active Manual Links */}
          {manualLinks.length > 0 && (
            <div>
              <span className="fx-section-label block mb-2">Active Manual Links ({manualLinks.length})</span>
              <div className="space-y-1.5">
                {manualLinks.map((link, i) => {
                  const mA = allMessages.find(m => m.id === link.idA);
                  const mB = allMessages.find(m => m.id === link.idB);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                    >
                      <Link2 className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="flex-1 text-[9px] font-mono truncate" style={{ color: 'var(--foreground)' }}>
                        {mA ? `${mA.msgTypeName} (${mA.clOrdID || mA.orderID || mA.sender})` : link.idA}
                        <span style={{ color: 'var(--text-muted)' }}> ↔ </span>
                        {mB ? `${mB.msgTypeName} (${mB.clOrdID || mB.orderID || mB.sender})` : link.idB}
                      </span>
                      <span
                        className="text-[7px] font-mono px-1 rounded"
                        style={{ background: 'var(--primary-faint)', color: 'var(--primary)' }}
                      >
                        via {link.field}
                      </span>
                      <button
                        onClick={() => onRemoveLink(i)}
                        className="shrink-0 p-0.5 rounded hover:bg-red-950/30 transition-all"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Unlink className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trace Sidebar ───────────────────────────────────────────────────────────
function TraceSidebar({ chain, manualLinks, allMessages, onClose, onInspectMessage }) {
  if (!chain) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-in sidebar from right */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[9999] w-full max-w-md flex flex-col shadow-2xl border-l animate-in slide-in-from-right duration-300"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Sidebar Header */}
        <div
          className="flex justify-between items-center px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Layers className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold block truncate" style={{ color: 'var(--foreground)' }}>
                Sequence Topology Trace
              </span>
              <span className="text-[9px] font-mono truncate block" style={{ color: 'var(--text-muted)' }}>
                {chain.clOrdID} · {chain.symbol}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800/40 shrink-0 ml-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary bar */}
        <div
          className="flex items-center gap-3 px-5 py-2.5 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
              RTT:{' '}
              <span style={{ color: chain.totalRtt !== null ? 'var(--primary)' : 'var(--text-faint)' }}>
                {chain.totalRtt !== null ? `${chain.totalRtt} ms` : 'N/A'}
              </span>
            </span>
          </div>
          <div className="w-px h-3 bg-zinc-700" />
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {chain.messages.length} msg{chain.messages.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="ml-auto">
            {chain.hasBottleneck ? (
              <span className="badge-danger">Bottleneck</span>
            ) : chain.isComplete ? (
              <span className="badge-success">Complete</span>
            ) : (
              <span className="badge-warn">Incomplete</span>
            )}
          </div>
        </div>

        {/* Scrollable trace content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <div className="relative pl-6 space-y-6">
            {/* Vertical spine */}
            <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'var(--border)' }} />

            {chain.hopTrace.map((ht, idx) => {
              const isMissing = ht.messages.length === 0;
              const delay = idx > 0 ? chain.latencies[idx - 1]?.delay : null;

              return (
                <div key={ht.config.key} className="relative">
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[22px] top-4 h-3.5 w-3.5 rounded-full border-4"
                    style={{
                      background: isMissing ? 'var(--background)' : 'var(--primary)',
                      borderColor: 'var(--card)'
                    }}
                  />

                  {/* Inter-hop delay badge */}
                  {idx > 0 && (
                    <div className="absolute -left-[26px] -top-5 h-5 flex items-center">
                      <div
                        className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border shadow-sm"
                        style={{
                          background: delay === null ? 'var(--background)' : delay > 8 ? 'rgba(239,68,68,0.1)' : 'var(--background)',
                          borderColor: delay === null ? 'var(--border)' : delay > 8 ? 'rgba(239,68,68,0.3)' : 'var(--border)',
                          color: delay === null ? 'var(--text-muted)' : delay > 8 ? '#f87171' : 'var(--primary)'
                        }}
                      >
                        {delay !== null ? `+${delay}ms` : '···'}
                      </div>
                    </div>
                  )}

                  {/* Hop card */}
                  <div
                    className="p-3.5 rounded-xl border transition-all"
                    style={{
                      background: 'var(--background)',
                      borderColor: isMissing ? 'var(--border)' : 'var(--border)',
                      borderStyle: isMissing ? 'dashed' : 'solid',
                      opacity: isMissing ? 0.55 : 1
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] font-bold font-mono block" style={{ color: 'var(--foreground)' }}>
                          {ht.config.name}
                        </span>
                        <span className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {ht.config.key}
                        </span>
                      </div>
                      {isMissing ? (
                        <span className="badge-warn text-[7px]">Missing</span>
                      ) : (
                        <span className="badge-success text-[7px]">Synced</span>
                      )}
                    </div>

                    {/* Message rows — click opens inspection modal */}
                    {!isMissing && (
                      <div className="space-y-2 mt-2.5">
                        {ht.messages.map(m => {
                          const links = (manualLinks || []).filter(l => l.idA === m.id || l.idB === m.id);
                          return (
                            <div key={m.id} className="space-y-1">
                              <button
                                onClick={() => onInspectMessage(m)}
                                className="w-full text-left p-2 rounded-lg border transition-all group flex items-center justify-between gap-2 hover:border-[var(--primary-border)]"
                                style={{
                                  background: 'var(--card)',
                                  borderColor: 'var(--border)',
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold shrink-0 ${
                                      m.msgType === 'D'
                                        ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20'
                                        : m.msgType === '8'
                                        ? 'badge-success'
                                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                    }`}
                                  >
                                    {m.msgTypeName} ({m.msgType})
                                  </span>
                                  <span className="text-[8px] font-mono truncate" style={{ color: 'var(--foreground)' }}>
                                    {m.clOrdID ? `ClOrdID: ${m.clOrdID}` : m.orderID ? `OrdID: ${m.orderID}` : m.sender}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {m.time && (
                                    <span className="text-[7px] font-mono hidden sm:flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                                      <Clock className="h-2.5 w-2.5" />
                                      {m.parsed.tags['52']?.split('-')[1] || m.parsed.tags['52']}
                                    </span>
                                  )}
                                  <Eye
                                    className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ color: 'var(--primary)' }}
                                  />
                                </div>
                              </button>
                              {links.map((link, lIdx) => {
                                const otherId = link.idA === m.id ? link.idB : link.idA;
                                const otherMsg = (allMessages || []).find(msg => msg.id === otherId);
                                return (
                                  <div 
                                    key={lIdx} 
                                    className="ml-3 px-2 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 border"
                                    style={{
                                      background: 'var(--primary-faint)',
                                      borderColor: 'var(--primary-border)',
                                      color: 'var(--primary)'
                                    }}
                                  >
                                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">
                                      Manually linked to: {otherMsg ? `${otherMsg.msgTypeName} (${otherMsg.clOrdID || otherMsg.orderID || otherMsg.sender})` : 'Unknown msg'} via {link.field}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Missing hop prompt */}
                    {isMissing && (
                      <div className="mt-2 text-[8px] font-mono italic" style={{ color: 'var(--text-muted)' }}>
                        No matching messages found for this session. Use Manual Link to connect related messages.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-3 border-t shrink-0 flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          <Info className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
            Click any message row to inspect its tags and raw payload.
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function MultiHopCorrelationPage() {
  const [rawLogs, setRawLogs] = useState('');
  const [connectionsConfig, setConnectionsConfig] = useState([]);
  const [activeInputTab, setActiveInputTab] = useState('upload');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedChainId, setSelectedChainId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState(null); // message obj for modal
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualLinks, setManualLinks] = useState([]); // [{idA, idB, field}]
  const [showPayload, setShowPayload] = useState(false); // input paste preview

  const fileInputRef = useRef(null);

  // ── localStorage persistence ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedLogs = localStorage.getItem('fixify-correlation-raw-logs');
    const cachedConfig = localStorage.getItem('fixify-correlation-connections-config');
    const cachedLinks = localStorage.getItem('fixify-correlation-manual-links');
    if (cachedLogs !== null) setRawLogs(cachedLogs);
    if (cachedConfig !== null) {
      try { setConnectionsConfig(JSON.parse(cachedConfig)); } catch {}
    }
    if (cachedLinks !== null) {
      try { setManualLinks(JSON.parse(cachedLinks)); } catch {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-correlation-raw-logs', rawLogs);
    localStorage.setItem('fixify-correlation-connections-config', JSON.stringify(connectionsConfig));
    localStorage.setItem('fixify-correlation-manual-links', JSON.stringify(manualLinks));
  }, [rawLogs, connectionsConfig, manualLinks, isLoaded]);

  // ── Auto-discover sessions ────────────────────────────────────────────────
  useEffect(() => {
    if (!rawLogs) {
      setConnectionsConfig([]);
      return;
    }
    const uniqueConnsMap = new Map();
    rawLogs.split('\n').forEach(line => {
      if (!line.includes('8=FIX')) return;
      const fixStart = line.indexOf('8=FIX');
      const fixRaw = fixStart !== -1 ? line.substring(fixStart) : line;
      const parsed = validateFIXMessage(fixRaw);
      if (parsed) {
        const sender = parsed.tags['49'] || '';
        const target = parsed.tags['56'] || '';
        if (sender && target) {
          const sorted = [sender, target].sort();
          const key = `${sorted[0]} ⟷ ${sorted[1]}`;
          if (!uniqueConnsMap.has(key)) {
            uniqueConnsMap.set(key, { sender: sorted[0], target: sorted[1] });
          }
        }
      }
    });

    setConnectionsConfig(prev => {
      const next = [...prev];
      let updated = false;
      const existingKeys = new Set(next.map(c => c.key));
      let orderMax = next.reduce((mx, c) => Math.max(mx, c.order), 0);

      uniqueConnsMap.forEach((val, key) => {
        if (!existingKeys.has(key)) {
          orderMax += 1;
          let defaultName = `Hop ${orderMax}`;
          if (key.includes('CLIENT') && key.includes('GW')) defaultName = `Hop ${orderMax}: Client Gateway`;
          else if (key.includes('GW') && key.includes('OMS')) defaultName = `Hop ${orderMax}: OMS Router`;
          else if (key.includes('OMS') && key.includes('EXCH')) defaultName = `Hop ${orderMax}: Exchange Venue`;
          next.push({ key, sender: val.sender, target: val.target, name: defaultName, order: orderMax, enabled: true });
          updated = true;
        }
      });

      const filteredNext = next.filter(c => uniqueConnsMap.has(c.key));
      if (filteredNext.length !== next.length) updated = true;
      filteredNext.sort((a, b) => a.order - b.order);
      return (updated || filteredNext.length !== prev.length) ? filteredNext : prev;
    });
  }, [rawLogs]);

  // ── Correlation Engine (DSU) ──────────────────────────────────────────────
  const { correlationChains, allParsedMessages } = useMemo(() => {
    const trackedConfigs = connectionsConfig.filter(c => c.enabled).sort((a, b) => a.order - b.order);
    if (trackedConfigs.length === 0 || !rawLogs) return { correlationChains: [], allParsedMessages: [] };

    const allMsgs = parseLogs(rawLogs, trackedConfigs);
    if (allMsgs.length === 0) return { correlationChains: [], allParsedMessages: allMsgs };

    // Build a lookup for manual links so we can assign connectionKey to unmatched messages
    // A manually-linked message with no connectionKey gets synthesized into the hop based on
    // the other side of the link that does have a connectionKey.
    const msgById = Object.fromEntries(allMsgs.map(m => [m.id, m]));

    // Resolve synthetic connection keys for manually linked messages that lack one
    const resolvedMsgs = allMsgs.map(m => ({ ...m })); // shallow clone array
    let changed = true;
    while (changed) {
      changed = false;
      manualLinks.forEach(link => {
        const mA = resolvedMsgs.find(m => m.id === link.idA);
        const mB = resolvedMsgs.find(m => m.id === link.idB);
        if (!mA || !mB) return;
        // If one side has no connectionKey, inherit the other side's
        if (mA.connectionKey && !mB.connectionKey) {
          mB.connectionKey = mA.connectionKey;
          changed = true;
        } else if (mB.connectionKey && !mA.connectionKey) {
          mA.connectionKey = mB.connectionKey;
          changed = true;
        }
      });
    }

    // Use all messages that now have a connectionKey (including synthesized ones)
    const filteredMsgs = resolvedMsgs.filter(m => m.connectionKey !== null);
    if (filteredMsgs.length === 0) return { correlationChains: [], allParsedMessages: allMsgs };

    // DSU
    const parent = {};
    const find = (x) => { if (parent[x] === x) return x; parent[x] = find(parent[x]); return parent[x]; };
    const union = (x, y) => { const rX = find(x), rY = find(y); if (rX !== rY) parent[rX] = rY; };

    filteredMsgs.forEach(m => { parent[m.id] = m.id; });

    const byClOrdID = {}, byOrderID = {}, byExecID = {};
    filteredMsgs.forEach(m => {
      if (m.clOrdID) { if (!byClOrdID[m.clOrdID]) byClOrdID[m.clOrdID] = []; byClOrdID[m.clOrdID].push(m.id); }
      if (m.origClOrdID) { if (!byClOrdID[m.origClOrdID]) byClOrdID[m.origClOrdID] = []; byClOrdID[m.origClOrdID].push(m.id); }
      if (m.orderID) { if (!byOrderID[m.orderID]) byOrderID[m.orderID] = []; byOrderID[m.orderID].push(m.id); }
      if (m.execID) { if (!byExecID[m.execID]) byExecID[m.execID] = []; byExecID[m.execID].push(m.id); }
    });

    Object.values(byClOrdID).forEach(list => { for (let i = 1; i < list.length; i++) union(list[0], list[i]); });
    Object.values(byOrderID).forEach(list => { for (let i = 1; i < list.length; i++) union(list[0], list[i]); });
    Object.values(byExecID).forEach(list => { for (let i = 1; i < list.length; i++) union(list[0], list[i]); });

    // Apply manual links — union regardless of connectionKey match
    manualLinks.forEach(link => {
      if (parent[link.idA] !== undefined && parent[link.idB] !== undefined) {
        union(link.idA, link.idB);
      }
    });

    const groups = {};
    filteredMsgs.forEach(m => {
      const root = find(m.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(m);
    });

    const chains = Object.entries(groups).map(([rootId, msgs]) => {
      msgs.sort((a, b) => {
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time;
      });

      const reqTypes = ['D', 'F', 'G'];
      let baseMsg = msgs.find(m => reqTypes.includes(m.msgType)) || msgs[0];
      const baseClOrdID = baseMsg.clOrdID || baseMsg.origClOrdID || msgs.find(m => m.clOrdID)?.clOrdID || 'Unknown_ID';
      const symbol = msgs.find(m => m.symbol)?.symbol || 'N/A';

      const msgsByConn = {};
      msgs.forEach(m => {
        if (!msgsByConn[m.connectionKey]) msgsByConn[m.connectionKey] = [];
        msgsByConn[m.connectionKey].push(m);
      });

      const hopTrace = trackedConfigs.map(cfg => {
        const hopMsgs = msgsByConn[cfg.key] || [];
        const request = hopMsgs.find(m => reqTypes.includes(m.msgType)) || hopMsgs[0] || null;
        const execution = hopMsgs.find(m => m.msgType === '8') || (hopMsgs.length > 1 ? hopMsgs[hopMsgs.length - 1] : null) || null;
        return { config: cfg, messages: hopMsgs, request, execution };
      });

      const latencies = [];
      for (let i = 0; i < hopTrace.length - 1; i++) {
        const hC = hopTrace[i], hN = hopTrace[i + 1];
        let delay = null;
        if (hC.request && hN.request && hC.request.time !== null && hN.request.time !== null) {
          delay = hN.request.time - hC.request.time;
        } else if (hC.messages.length > 0 && hN.messages.length > 0) {
          const tC = Math.min(...hC.messages.map(m => m.time).filter(t => t !== null));
          const tN = Math.min(...hN.messages.map(m => m.time).filter(t => t !== null));
          if (isFinite(tC) && isFinite(tN)) delay = tN - tC;
        }
        latencies.push({ fromHop: hC.config.name, toHop: hN.config.name, delay: delay !== null ? Math.max(0, delay) : null });
      }

      let totalRtt = null;
      const hop1 = hopTrace[0];
      if (hop1?.request && hop1?.execution && hop1.request.time !== null && hop1.execution.time !== null) {
        totalRtt = Math.max(0, hop1.execution.time - hop1.request.time);
      } else {
        const validTimes = msgs.map(m => m.time).filter(t => t !== null);
        if (validTimes.length > 1) totalRtt = Math.max(0, Math.max(...validTimes) - Math.min(...validTimes));
      }

      return {
        id: `chain-${baseClOrdID}-${rootId}`,
        symbol, clOrdID: baseClOrdID, orderTime: baseMsg.time,
        messages: msgs, hopTrace, latencies, totalRtt,
        isComplete: hopTrace.every(ht => ht.messages.length > 0) && hopTrace[0]?.execution !== null,
        hasBottleneck: latencies.some(l => l.delay !== null && l.delay > 8)
      };
    });

    chains.sort((a, b) => {
      if (a.orderTime === null) return 1;
      if (b.orderTime === null) return -1;
      return a.orderTime - b.orderTime;
    });

    return { correlationChains: chains, allParsedMessages: allMsgs };
  }, [rawLogs, connectionsConfig, manualLinks]);

  const filteredChains = useMemo(() => {
    if (activeTab === 'bottlenecks') return correlationChains.filter(c => c.hasBottleneck);
    if (activeTab === 'unmatched') return correlationChains.filter(c => !c.isComplete);
    return correlationChains;
  }, [correlationChains, activeTab]);

  const selectedChain = useMemo(() =>
    selectedChainId ? correlationChains.find(c => c.id === selectedChainId) || null : null,
    [correlationChains, selectedChainId]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const moveConfigUp = (index) => {
    if (index === 0) return;
    setConnectionsConfig(prev => {
      const next = [...prev];
      [next[index].order, next[index - 1].order] = [next[index - 1].order, next[index].order];
      return [...next].sort((a, b) => a.order - b.order);
    });
  };

  const moveConfigDown = (index) => {
    if (index === connectionsConfig.length - 1) return;
    setConnectionsConfig(prev => {
      const next = [...prev];
      [next[index].order, next[index + 1].order] = [next[index + 1].order, next[index].order];
      return [...next].sort((a, b) => a.order - b.order);
    });
  };

  const toggleConnection = (index) => {
    setConnectionsConfig(prev => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
  };

  const handleHopNameChange = (index, value) => {
    setConnectionsConfig(prev => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setRawLogs(ev.target.result); setActiveInputTab('text'); };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setRawLogs(ev.target.result); setActiveInputTab('text'); };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    setRawLogs('');
    setConnectionsConfig([]);
    setSelectedChainId(null);
    setInspectedMessage(null);
    setManualLinks([]);
  };

  const handleSelectChain = (c) => {
    setSelectedChainId(prev => prev === c.id ? null : c.id);
  };

  const handleAddManualLink = (link) => {
    setManualLinks(prev => [...prev, link]);
  };

  const handleRemoveManualLink = (index) => {
    setManualLinks(prev => prev.filter((_, i) => i !== index));
  };

  const renderControlsCard = () => {
    let workspaceLogs = "";
    if (typeof window !== "undefined") {
      const pasted = localStorage.getItem("fixify-logs-pastedText");
      if (pasted && pasted.trim()) {
        workspaceLogs = pasted;
      } else {
        const filesJson = localStorage.getItem("fixify-logs-files");
        if (filesJson) {
          try {
            const files = JSON.parse(filesJson);
            if (Array.isArray(files) && files.length > 0) {
              workspaceLogs = files.map(f => f.content || "").join("\n");
            }
          } catch (e) {}
        }
      }
    }
    const workspaceLines = workspaceLogs ? workspaceLogs.split("\n").filter(l => l.trim()).length : 0;

    return (
      <div className="fx-card space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        {workspaceLines > 0 && (
          <button
            onClick={() => {
              setRawLogs(workspaceLogs);
              setActiveInputTab('text');
            }}
            className="w-full text-left p-3 rounded-lg border text-xs flex items-center justify-between transition-all hover:opacity-90 animate-in slide-in-from-top-1 duration-200"
            style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--primary)' }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold"> Load active logs from main workspace ({workspaceLines} lines)</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--primary-border)', background: 'var(--background)' }}>Import</span>
          </button>
        )}
        <div className="flex items-center justify-between">
          <span className="fx-section-label">Log Input Source</span>
        <div className="fx-tab-group">
          <button onClick={() => setActiveInputTab('upload')} className={`fx-tab ${activeInputTab === 'upload' ? 'active' : ''}`}>
            <UploadCloud className="h-3.5 w-3.5" /><span className="hidden sm:inline">File</span>
          </button>
          <button onClick={() => setActiveInputTab('text')} className={`fx-tab ${activeInputTab === 'text' ? 'active' : ''}`}>
            <ClipboardList className="h-3.5 w-3.5" /><span className="hidden sm:inline">Paste</span>
          </button>
        </div>
      </div>

      {activeInputTab === 'text' ? (
        <div className="space-y-2">
          <textarea
            value={rawLogs}
            onChange={e => setRawLogs(e.target.value)}
            placeholder="Paste raw interleaved logs here containing multiple hop FIX messages…"
            className="fx-input w-full min-h-[200px] text-xs resize-y"
            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none' }}
          />
          <div className="text-[9px] font-mono flex justify-between px-1" style={{ color: 'var(--text-muted)' }}>
            <span>Lines: {rawLogs ? rawLogs.split('\n').length : 0}</span>
            <span>FIX msgs: {rawLogs ? rawLogs.split('\n').filter(l => l.includes('8=FIX')).length : 0}</span>
          </div>
          {/* Paste payload preview — Eye/EyeOff toggle */}
          {rawLogs.trim() && (
            <div
              className="rounded-xl border text-[11px] font-mono"
              style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <button
                className="flex items-center gap-1.5 w-full text-left px-3.5 py-2.5"
                onClick={() => setShowPayload(p => !p)}
              >
                {showPayload
                  ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                  : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                }
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Raw Payload Preview (First 3 lines)
                </span>
              </button>
              {showPayload && (
                <div className="space-y-2 max-h-48 overflow-y-auto px-3.5 pb-3.5">
                  {rawLogs.split('\n').filter(l => l.includes('8=FIX')).slice(0, 3).map((line, idx) => (
                    <div key={idx} className="p-2 rounded bg-zinc-950/40 border border-zinc-900/50">
                      <SohVisualizer content={line} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer text-center transition-colors"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Upload className="h-6 w-6 mb-2 animate-pulse" style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-semibold">Drag & drop log file here</span>
          <span className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Accepts .log, .txt, .csv</span>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".log,.txt,.csv,.logx" className="hidden" />
        </div>
      )}
    </div>
  );
};

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0 ${!rawLogs.trim() ? 'max-w-2xl mx-auto w-full' : ''}`}>
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Network className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            Multi-Hop Correlation Tracker
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Load logs, auto-discover sessions, trace individual transaction journeys across hops, and manually link unmatched orders.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {rawLogs.trim().length > 0 && (
            <button
              onClick={() => setShowManualLink(true)}
              className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
              style={{ color: manualLinks.length > 0 ? 'var(--primary)' : undefined }}
            >
              <Link2 className="h-3.5 w-3.5" />
              Manual Link
              {manualLinks.length > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                  style={{ background: 'var(--primary-faint)', color: 'var(--primary)' }}
                >
                  {manualLinks.length}
                </span>
              )}
            </button>
          )}
          {rawLogs.trim().length === 0 && (
            <button
              onClick={() => { setRawLogs(DEFAULT_LOGS); setSelectedChainId(null); setInspectedMessage(null); }}
              className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold"
            >
              Load Demo
            </button>
          )}
          {rawLogs.trim().length > 0 && (
            <button
              onClick={handleClearAll}
              className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      {!rawLogs.trim() ? (
        <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-300">
          {renderControlsCard()}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
          {/* Left: Input + Config (5/12) */}
          <div className="lg:col-span-5 space-y-4">
            {renderControlsCard()}

          {/* Session & Hop Configurator */}
          <div className="fx-card p-4 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="fx-section-label" style={{ color: 'var(--primary)' }}>Session & Hops Configurator</span>
                <span className="text-[9px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Customize tracking filters, labels, and path sequence.
                </span>
              </div>
              <RefreshCw
                onClick={() => setRawLogs(p => p + '\n ')}
                className="h-3.5 w-3.5 cursor-pointer hover:rotate-180 transition-all duration-300"
                style={{ color: 'var(--text-muted)' }}
                title="Rescan sessions"
              />
            </div>

            {connectionsConfig.length === 0 ? (
              <div className="py-6 text-center font-mono text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
                No sessions discovered yet. Input logs above to scan.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="hidden sm:grid text-[9px] font-bold uppercase tracking-wider font-mono grid-cols-12 gap-2 px-1" style={{ color: 'var(--text-muted)' }}>
                  <div className="col-span-1">On</div>
                  <div className="col-span-5">Session</div>
                  <div className="col-span-4">Hop Label</div>
                  <div className="col-span-2 text-right">Seq</div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                  {connectionsConfig.map((cfg, idx) => (
                    <div
                      key={cfg.key}
                      className="flex flex-col gap-2.5 p-2.5 rounded border transition-all sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', opacity: cfg.enabled ? 1 : 0.4 }}
                    >
                      <div className="flex items-center gap-2 sm:contents">
                        <div className="sm:col-span-1 flex justify-center shrink-0">
                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            onChange={() => toggleConnection(idx)}
                            className="h-3 w-3 cursor-pointer"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                        </div>
                        <div className="flex-1 sm:col-span-5 font-mono text-[9px] truncate font-semibold sm:font-normal" style={{ color: 'var(--foreground)' }} title={cfg.key}>
                          {cfg.sender} ➔ {cfg.target}
                        </div>
                      </div>

                      <div className="flex gap-2 items-center sm:contents">
                        <div className="flex-1 sm:col-span-4">
                          <input
                            type="text"
                            value={cfg.name}
                            disabled={!cfg.enabled}
                            onChange={e => handleHopNameChange(idx, e.target.value)}
                            className="fx-input w-full px-1.5 py-0.5 text-[9px]"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                          />
                        </div>
                        <div className="flex sm:col-span-2 items-center justify-end gap-1 shrink-0">
                          <button
                            disabled={idx === 0 || !cfg.enabled}
                            onClick={() => moveConfigUp(idx)}
                            className="p-1 rounded disabled:opacity-20"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                          >
                            <ArrowUp className="h-3 w-3" style={{ color: 'var(--foreground)' }} />
                          </button>
                          <button
                            disabled={idx === connectionsConfig.length - 1 || !cfg.enabled}
                            onClick={() => moveConfigDown(idx)}
                            className="p-1 rounded disabled:opacity-20"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                          >
                            <ArrowDown className="h-3 w-3" style={{ color: 'var(--foreground)' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chains Table (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="fx-card p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="fx-section-label" style={{ color: 'var(--primary)' }}>Correlated Transaction Chains</span>
                {correlationChains.length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-mono"
                    style={{ background: 'var(--primary-faint)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}
                  >
                    {correlationChains.length}
                  </span>
                )}
              </div>
              <div className="fx-tab-group">
                {['all', 'bottlenecks', 'unmatched'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`fx-tab ${activeTab === tab ? 'active' : ''}`}>
                    {tab === 'all' ? 'All' : tab === 'bottlenecks' ? 'Bottlenecks' : 'Incomplete'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-[10px] font-mono" style={{ color: 'var(--foreground)' }}>
                <thead>
                  <tr
                    className="border-b text-[9px] uppercase tracking-wider sticky top-0 backdrop-blur z-10"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                  >
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Base ClOrdID</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Symbol</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Delays</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>RTT</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="py-2.5 px-3 text-right" style={{ color: 'var(--text-muted)' }}>Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredChains.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center italic" style={{ color: 'var(--text-muted)' }}>
                        {rawLogs ? 'No chains matched current filters.' : 'Load or paste logs above to start correlation.'}
                      </td>
                    </tr>
                  ) : (
                    filteredChains.map(c => {
                      const isSelected = selectedChainId === c.id;
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-[var(--card-hover)] transition-colors cursor-pointer group"
                          style={{
                            background: isSelected ? 'var(--primary-faint)' : 'transparent',
                            borderLeft: isSelected ? '2px solid var(--primary)' : '2px solid transparent'
                          }}
                          onClick={() => handleSelectChain(c)}
                        >
                          <td className="py-3 px-3 font-semibold">{c.clOrdID}</td>
                          <td className="py-3 px-3 font-semibold" style={{ color: 'var(--foreground)' }}>{c.symbol}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {c.latencies.map((l, i) => (
                                <span
                                  key={i}
                                  className={`px-1 rounded text-[8px] font-mono ${l.delay === null ? '' : l.delay > 8 ? 'badge-danger' : ''}`}
                                  style={{
                                    background: l.delay !== null && l.delay <= 8 ? 'var(--background)' : undefined,
                                    border: l.delay !== null && l.delay <= 8 ? '1px solid var(--border)' : undefined,
                                    color: l.delay === null ? 'var(--text-muted)' : l.delay <= 8 ? 'var(--foreground)' : undefined,
                                  }}
                                  title={`${l.fromHop} → ${l.toHop}`}
                                >
                                  {l.delay !== null ? `${l.delay}ms` : '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold">
                            {c.totalRtt !== null
                              ? <span style={{ color: 'var(--primary)' }}>{c.totalRtt} ms</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="py-3 px-3">
                            {c.hasBottleneck
                              ? <span className="badge-danger">Bottleneck</span>
                              : c.isComplete
                              ? <span className="badge-success">Complete</span>
                              : <span className="badge-warn">Incomplete</span>}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={e => { e.stopPropagation(); handleSelectChain(c); }}
                              className="p-1.5 rounded-lg transition-all"
                              style={{
                                background: isSelected ? 'var(--primary-faint)' : 'var(--background)',
                                border: `1px solid ${isSelected ? 'var(--primary-border)' : 'var(--border)'}`,
                                color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                              }}
                              title="Open trace sidebar"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Info footer */}
            {correlationChains.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <Info className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  Click a row or the <Layers className="inline h-2.5 w-2.5 mx-0.5" /> icon to open the Trace sidebar. Click any message in the sidebar to inspect its tags.
                  {manualLinks.length === 0 && ' If orders are unlinked, use the Manual Link button above.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Trace Sidebar */}
      {selectedChain && (
        <TraceSidebar
          chain={selectedChain}
          manualLinks={manualLinks}
          allMessages={allParsedMessages}
          onClose={() => { setSelectedChainId(null); }}
          onInspectMessage={(msg) => setInspectedMessage(msg)}
        />
      )}

      {/* Message Inspection Modal */}
      {inspectedMessage && (
        <MessageInspectModal
          msg={inspectedMessage}
          onClose={() => setInspectedMessage(null)}
        />
      )}

      {/* Manual Link Modal */}
      {showManualLink && (
        <ManualLinkModal
          allMessages={allParsedMessages}
          manualLinks={manualLinks}
          onAddLink={handleAddManualLink}
          onRemoveLink={handleRemoveManualLink}
          onClose={() => setShowManualLink(false)}
        />
      )}
    </div>
  );
}
