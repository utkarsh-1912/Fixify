'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Clipboard,
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Code,
  FileText,
  Settings,
  Play,
  ArrowRightLeft,
  Info,
  HelpCircle,
  Activity,
  RotateCcw
} from 'lucide-react';
import { getTagName } from '@/lib/fixParser';

// ─── Constants ────────────────────────────────────────────────────────────────
const DYNAMIC_FIELDS_BY_MSGTYPE = {
  'A': { '98': '0', '108': '30', '553': 'TEST_USER', '554': 'SecretPass99' }, // Logon
  '0': {}, // Heartbeat
  'D': { '11': 'ORD_1001', '21': '1', '55': 'AAPL', '54': '1', '60': '', '38': '100', '40': '2', '44': '150.00' }, // New Order Single
  '8': { '37': 'ORD_37001', '17': 'EXEC_17001', '150': '0', '39': '0', '55': 'AAPL', '54': '1', '151': '100', '14': '0', '6': '0.00' }, // Execution Report
  'F': { '41': 'ORD_1001', '11': 'ORD_1002', '55': 'AAPL', '54': '1', '60': '' }, // Order Cancel Request
  '3': { '45': '1', '371': '54', '372': 'D', '373': '1', '58': 'Required tag missing' } // Session Reject
};

const MSG_TYPE_LABELS = {
  'A': 'Logon (35=A)',
  '0': 'Heartbeat (35=0)',
  'D': 'New Order Single (35=D)',
  '8': 'Execution Report (35=8)',
  'F': 'Order Cancel Request (35=F)',
  '3': 'Session Reject (35=3)'
};

// Helper to format date as YYYYMMDD-HH:mm:ss.SSS
function getUtcFixTimestamp(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const mss = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${yyyy}${mm}${dd}-${hh}:${min}:${ss}.${mss}`;
}

// Convert string to hex bytes
function toHexDump(str) {
  const hexes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hexes.push(code.toString(16).toUpperCase().padStart(2, '0'));
  }
  return hexes.join(' ');
}

export default function PayloadGeneratorPage() {
  const [fixVersion, setFixVersion] = useState('FIX.4.4');
  const [msgType, setMsgType] = useState('D'); // default: New Order Single
  const [senderCompId, setSenderCompId] = useState('CLIENT');
  const [targetCompId, setTargetCompId] = useState('SERVER');
  const [msgSeqNum, setMsgSeqNum] = useState(1);
  const [autoSendingTime, setAutoSendingTime] = useState(true);
  const [sendingTimeManual, setSendingTimeManual] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  
  // Dynamic fields by message type
  const [bodyFields, setBodyFields] = useState(() => {
    // Deep clone initial fields
    return JSON.parse(JSON.stringify(DYNAMIC_FIELDS_BY_MSGTYPE));
  });

  // Custom tags
  const [customFields, setCustomFields] = useState([]);
  
  // Output format tab
  const [formatTab, setFormatTab] = useState('soh'); // 'soh' | 'pipe' | 'hex' | 'json'
  
  // Copy state
  const [copied, setCopied] = useState(false);
  
  // Timer for current time
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!autoSendingTime) return;
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [autoSendingTime]);

  // Handle changing specific body fields
  const handleFieldChange = (mType, tag, val) => {
    setBodyFields(prev => ({
      ...prev,
      [mType]: {
        ...prev[mType],
        [tag]: val
      }
    }));
  };

  // Add custom tag
  const handleAddCustomField = () => {
    setCustomFields(prev => [
      ...prev,
      { id: Math.random().toString(), tag: '', val: '' }
    ]);
  };

  // Update custom tag
  const handleCustomFieldChange = (id, key, value) => {
    setCustomFields(prev =>
      prev.map(f => (f.id === id ? { ...f, [key]: value } : f))
    );
  };

  // Remove custom tag
  const handleRemoveCustomField = (id) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleReset = () => {
    setFixVersion('FIX.4.4');
    setMsgType('D');
    setSenderCompId('CLIENT');
    setTargetCompId('SERVER');
    setMsgSeqNum(1);
    setAutoSendingTime(true);
    setSendingTimeManual('');
    setBodyFields(JSON.parse(JSON.stringify(DYNAMIC_FIELDS_BY_MSGTYPE)));
    setCustomFields([]);
    setFormatTab('soh');
    setCopied(false);
    setShowSetup(true);
  };

  // Compose standard + dynamic + custom fields list
  const getActiveFields = () => {
    const timeVal = autoSendingTime ? getUtcFixTimestamp(currentTime) : (sendingTimeManual || getUtcFixTimestamp(currentTime));
    const list = [
      { tag: '8', val: fixVersion },
      { tag: '35', val: msgType },
      { tag: '49', val: senderCompId },
      { tag: '56', val: targetCompId },
      { tag: '34', val: String(msgSeqNum) },
      { tag: '52', val: timeVal }
    ];

    // Add MsgType-specific dynamic body fields
    const spec = bodyFields[msgType] || {};
    Object.entries(spec).forEach(([tag, val]) => {
      // Auto-update TransactTime (60) if active
      if (tag === '60' && autoSendingTime) {
        list.push({ tag: '60', val: getUtcFixTimestamp(currentTime) });
      } else {
        list.push({ tag, val: String(val) });
      }
    });

    // Add custom fields
    customFields.forEach(f => {
      if (f.tag.trim()) {
        list.push({ tag: f.tag.trim(), val: f.val });
      }
    });

    return list;
  };

  // Calculate body length & checksum
  const compileFIX = () => {
    const fields = getActiveFields();
    
    // Split header elements
    const tag8Val = fields.find(f => f.tag === '8')?.val || 'FIX.4.4';
    const tag35Val = fields.find(f => f.tag === '35')?.val || '0';
    
    // Filter standard tags that exist after Tag 9
    const otherFields = fields.filter(f => f.tag !== '8' && f.tag !== '9' && f.tag !== '10');
    
    const headerTags = ['49', '56', '34', '52'];
    const headers = [];
    const body = [];
    
    otherFields.forEach(f => {
      if (headerTags.includes(f.tag)) {
        headers.push(f);
      } else {
        body.push(f);
      }
    });
    
    // Sort standard headers
    headers.sort((a, b) => headerTags.indexOf(a.tag) - headerTags.indexOf(b.tag));
    
    const orderedBodyFields = [
      { tag: '35', val: tag35Val },
      ...headers,
      ...body
    ];
    
    const delimiter = '\x01';
    const bodyStr = orderedBodyFields.map(f => `${f.tag}=${f.val}`).join(delimiter) + delimiter;
    const bodyLength = bodyStr.length;
    
    const partialMsg = `8=${tag8Val}${delimiter}9=${bodyLength}${delimiter}${bodyStr}`;
    
    // Calculate Checksum sum of bytes
    let sum = 0;
    for (let i = 0; i < partialMsg.length; i++) {
      sum += partialMsg.charCodeAt(i);
    }
    const checksumVal = String(sum % 256).padStart(3, '0');
    
    const finalMsg = `${partialMsg}10=${checksumVal}${delimiter}`;
    
    const orderedFieldsList = [
      { tag: '8', val: tag8Val },
      { tag: '9', val: String(bodyLength) },
      ...orderedBodyFields,
      { tag: '10', val: checksumVal }
    ];

    return {
      rawSoh: finalMsg,
      rawPipe: finalMsg.replace(/\x01/g, '|'),
      hexDump: toHexDump(finalMsg),
      bodyLength,
      checksum: checksumVal,
      partialMsg,
      bodyStr,
      orderedFields: orderedFieldsList
    };
  };

  const compiled = compileFIX();

  // Mandatory checks list
  const getValidationChecks = () => {
    const list = [];
    const spec = bodyFields[msgType] || {};

    // Standard headers
    list.push({
      label: 'Standard Header (8=BeginString, 9=BodyLength)',
      passed: !!fixVersion && compiled.bodyLength > 0,
      desc: 'Message begins with version identifier followed immediately by calculated length.'
    });
    list.push({
      label: 'MsgType Present (35)',
      passed: !!msgType,
      desc: 'Declares message type header for payload classification.'
    });
    list.push({
      label: 'Session Routing Identifiers (49, 56)',
      passed: !!senderCompId && !!targetCompId,
      desc: 'Contains sender (Tag 49) and target (Tag 56) identifiers.'
    });
    list.push({
      label: 'SeqNum & Timestamp (34, 52)',
      passed: !!msgSeqNum && (autoSendingTime || !!sendingTimeManual),
      desc: 'Contains message sequence number (Tag 34) and sending timestamp (Tag 52).'
    });

    // Message specific mandatory tags
    if (msgType === 'A') {
      list.push({
        label: 'Logon Parameters (98, 108)',
        passed: spec['98'] !== undefined && !!spec['108'],
        desc: 'Logon must contain EncryptMethod (Tag 98) and HeartBtInt (Tag 108).'
      });
    } else if (msgType === 'D') {
      list.push({
        label: 'Order Details (11, 21, 55, 54, 38, 40)',
        passed: !!spec['11'] && !!spec['21'] && !!spec['55'] && !!spec['54'] && !!spec['38'] && !!spec['40'],
        desc: 'New Order Single requires ClOrdID, HandlInst, Symbol, Side, OrderQty, and OrdType.'
      });
      if (spec['40'] === '2') {
        list.push({
          label: 'Limit Order Price Check (44)',
          passed: !!spec['44'] && parseFloat(spec['44']) > 0,
          desc: 'Limit orders (40=2) must declare a valid Price (Tag 44).'
        });
      } else if (spec['40'] === '1') {
        list.push({
          label: 'Market Order Price Check (No Tag 44)',
          passed: !spec['44'],
          desc: 'Market orders (40=1) should not contain a Price tag (Tag 44).'
        });
      }
    } else if (msgType === '8') {
      list.push({
        label: 'Exec Identifiers (37, 17, 150, 39)',
        passed: !!spec['37'] && !!spec['17'] && !!spec['150'] && !!spec['39'],
        desc: 'Execution reports require OrderID, ExecID, ExecType, and OrdStatus.'
      });
    } else if (msgType === 'F') {
      list.push({
        label: 'Cancel Identifiers (41, 11, 55, 54)',
        passed: !!spec['41'] && !!spec['11'] && !!spec['55'] && !!spec['54'],
        desc: 'Cancel request requires OrigClOrdID, ClOrdID, Symbol, and Side.'
      });
    } else if (msgType === '3') {
      list.push({
        label: 'RefSeqNum Present (45)',
        passed: !!spec['45'],
        desc: 'Session Reject requires RefSeqNum (Tag 45) to point to the rejected sequence.'
      });
    }

    return list;
  };

  const handleCopy = () => {
    let copyText = '';
    if (formatTab === 'soh') copyText = compiled.rawSoh;
    else if (formatTab === 'pipe') copyText = compiled.rawPipe;
    else if (formatTab === 'hex') copyText = compiled.hexDump;
    else if (formatTab === 'json') {
      const obj = {};
      compiled.orderedFields.forEach(f => {
        obj[f.tag] = f.val;
      });
      copyText = JSON.stringify(obj, null, 2);
    }
    
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeChecks = getValidationChecks();
  const allPassed = activeChecks.every(c => c.passed);

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Layers className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>FIX Message Generator</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Compose valid test FIX messages with real-time length audits, checksum validation, and dynamic schema forms.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="fx-btn-secondary py-2 px-4 text-xs font-semibold"
            title="Toggle configuration sidebar"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{showSetup ? 'Hide Controls' : 'Show Controls'}</span>
          </button>
          <button onClick={handleReset} className="fx-btn-secondary py-2 px-4 text-xs font-semibold">
            <RotateCcw className="h-3.5 w-3.5" /> <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form controls */}
        {showSetup && (
          <div className="lg:col-span-5 space-y-5">
            {/* Card 1: FIX Version & MsgType */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                1. Base Protocol Config
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    BeginString (8)
                  </label>
                  <select
                    value={fixVersion}
                    onChange={(e) => setFixVersion(e.target.value)}
                    className="w-full fx-input py-2 cursor-pointer"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="FIX.4.2">FIX 4.2 (BeginString=FIX.4.2)</option>
                    <option value="FIX.4.4">FIX 4.4 (BeginString=FIX.4.4)</option>
                    <option value="FIXT.1.1">FIX 5.0 (BeginString=FIXT.1.1)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    MsgType (35)
                  </label>
                  <select
                    value={msgType}
                    onChange={(e) => setMsgType(e.target.value)}
                    className="w-full fx-input py-2 cursor-pointer"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {Object.entries(MSG_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Standard Headers */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                2. Standard Header Fields
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    SenderCompID (49)
                  </label>
                  <input
                    type="text"
                    value={senderCompId}
                    onChange={(e) => setSenderCompId(e.target.value)}
                    placeholder="e.g. CLIENT"
                    className="w-full fx-input"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    TargetCompID (56)
                  </label>
                  <input
                    type="text"
                    value={targetCompId}
                    onChange={(e) => setTargetCompId(e.target.value)}
                    placeholder="e.g. SERVER"
                    className="w-full fx-input"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    MsgSeqNum (34)
                  </label>
                  <input
                    type="number"
                    value={msgSeqNum}
                    onChange={(e) => setMsgSeqNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full fx-input"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <button
                    onClick={() => setAutoSendingTime(v => !v)}
                    className="w-full flex items-center justify-between p-2.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      borderColor: 'var(--border)',
                      background: autoSendingTime ? 'var(--primary-faint)' : 'transparent',
                      color: autoSendingTime ? 'var(--primary)' : 'var(--text-muted)'
                    }}
                  >
                    <span>Auto-update Time</span>
                    {autoSendingTime ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-dashed border-zinc-700" />}
                  </button>
                </div>
              </div>

              {!autoSendingTime && (
                <div className="space-y-1.5 pt-1 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    Manual SendingTime (52)
                  </label>
                  <input
                    type="text"
                    value={sendingTimeManual}
                    onChange={(e) => setSendingTimeManual(e.target.value)}
                    placeholder="YYYYMMDD-HH:mm:ss.SSS"
                    className="w-full fx-input"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              )}
            </div>

            {/* Card 3: Dynamic Body Fields */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                3. Message Body Fields ({MSG_TYPE_LABELS[msgType]?.split(' ')[0]})
              </h2>
              
              {Object.keys(bodyFields[msgType] || {}).length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">No specific body fields required for this message type.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(bodyFields[msgType] || {}).map(([tag, val]) => {
                    const name = getTagName(tag) || `Field_${tag}`;
                    const isTime = tag === '60';
                    return (
                      <div key={tag} className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono truncate block" title={`${name} (${tag})`}>
                          {name} ({tag})
                        </label>
                        {isTime && autoSendingTime ? (
                          <div
                            className="w-full border text-xs font-mono rounded-lg p-2.5 text-[var(--text-muted)] select-none italic"
                            style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                          >
                            Auto Sync Active
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleFieldChange(msgType, tag, e.target.value)}
                            placeholder={`Enter Tag ${tag}`}
                            className="w-full fx-input"
                            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 4: Custom Fields */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                  4. User Defined Fields (Custom)
                </h2>
                <button
                  onClick={handleAddCustomField}
                  className="flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Field
                </button>
              </div>

              {customFields.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">No custom fields added yet. Tag range 5000-9999 is reserved for custom dialects.</p>
              ) : (
                <div className="space-y-3">
                  {customFields.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
                      <input
                        type="text"
                        value={f.tag}
                        onChange={(e) => handleCustomFieldChange(f.id, 'tag', e.target.value)}
                        placeholder="Tag (e.g. 5001)"
                        className="w-24 fx-input"
                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      />
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                      <input
                        type="text"
                        value={f.val}
                        onChange={(e) => handleCustomFieldChange(f.id, 'val', e.target.value)}
                        placeholder="Value"
                        className="flex-1 min-w-0 fx-input"
                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      />
                      <button
                        onClick={() => handleRemoveCustomField(f.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center border hover:border-red-500/30 hover:bg-red-500/5 text-[var(--text-muted)] hover:text-red-400 transition-all shrink-0 cursor-pointer"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Panel: Output & Real-Time Auditing */}
        <div className={showSetup ? "lg:col-span-7 space-y-6" : "lg:col-span-12 space-y-6"}>
          {/* Card 5: Computed Output */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Toolbar */}
            <div
              className="px-5 py-3.5 flex items-center justify-between border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${formatTab === 'soh' ? ' active' : ''}`}
                  onClick={() => setFormatTab('soh')}
                >
                  <Layers className="h-3.5 w-3.5" /> <span className="inline">SOH Visual</span>
                </button>
                <button
                  className={`fx-tab${formatTab === 'pipe' ? ' active' : ''}`}
                  onClick={() => setFormatTab('pipe')}
                >
                  <FileText className="h-3.5 w-3.5" /> <span className="inline">Pipe (|)</span>
                </button>
                <button
                  className={`fx-tab${formatTab === 'hex' ? ' active' : ''}`}
                  onClick={() => setFormatTab('hex')}
                >
                  <Code className="h-3.5 w-3.5" /> <span className="inline">Hex Dump</span>
                </button>
                <button
                  className={`fx-tab${formatTab === 'json' ? ' active' : ''}`}
                  onClick={() => setFormatTab('json')}
                >
                  <Settings className="h-3.5 w-3.5" /> <span className="inline">JSON</span>
                </button>
              </div>

              <button onClick={handleCopy} className="fx-btn-primary py-1.5 px-3 text-xs font-semibold">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Output view area */}
            <div className="p-5">
              {formatTab === 'soh' && (
                <div
                  className="w-full min-h-[140px] p-3.5 rounded-xl border font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap flex flex-wrap gap-y-2 gap-x-1.5 select-all"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  {compiled.orderedFields.map((f, i) => (
                    <React.Fragment key={i}>
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 border shadow-sm transition-all"
                        style={{
                          background: 'var(--card)',
                          borderColor: f.tag === '8' || f.tag === '9' || f.tag === '10' ? 'var(--primary-border)' : 'var(--border-subtle)',
                          color: f.tag === '35' ? 'var(--primary)' : 'var(--foreground)'
                        }}
                      >
                        <span className="font-extrabold text-[9px] mr-1 opacity-75" style={{ color: 'var(--primary)' }}>{f.tag}=</span>
                        <span className="break-all">{f.val}</span>
                      </span>
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-mono font-bold bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 select-none shadow-sm">
                        SOH
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {formatTab === 'pipe' && (
                <pre
                  className="w-full min-h-[140px] p-4 rounded-xl border font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap select-all"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {compiled.rawPipe}
                </pre>
              )}

              {formatTab === 'hex' && (
                <pre
                  className="w-full min-h-[140px] p-4 rounded-xl border font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap select-all"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {compiled.hexDump}
                </pre>
              )}

              {formatTab === 'json' && (
                <pre
                  className="w-full min-h-[140px] p-4 rounded-xl border font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap select-all"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {(() => {
                    const obj = {};
                    compiled.orderedFields.forEach(f => {
                      obj[f.tag] = f.val;
                    });
                    return JSON.stringify(obj, null, 2);
                  })()}
                </pre>
              )}
            </div>
          </div>

          {/* Card 6: Real-Time Audit Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* BodyLength (Tag 9) Audit */}
            <div
              className="p-5 rounded-2xl border space-y-3 flex flex-col justify-between"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Tag 9: BodyLength</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-green-950/30 text-green-400 border border-green-900/30">
                    {compiled.bodyLength} bytes
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                  Length is calculated by counting all characters in the body string starting immediately after the Tag 9 delimiter (the start of MsgType <code className="font-mono text-[9px] text-[var(--foreground)]">35=</code>) up to and including the delimiter of the tag right before Checksum.
                </p>
              </div>

              <div
                className="p-2.5 rounded-lg border font-mono text-[9px] break-all leading-normal"
                style={{ background: 'var(--background)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <span className="font-bold text-[var(--foreground)]">Counted string:</span>
                <div className="mt-1 truncate">{compiled.bodyStr.replace(/\x01/g, '•')}</div>
              </div>
            </div>

            {/* Checksum (Tag 10) Audit */}
            <div
              className="p-5 rounded-2xl border space-y-3 flex flex-col justify-between"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Tag 10: Checksum</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-green-950/30 text-green-400 border border-green-900/30">
                    10={compiled.checksum}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                  Computed by summing the ASCII binary byte values of all characters in the message up to (but not including) the Tag 10 key (<code className="font-mono text-[9px] text-[var(--foreground)]">10=</code>). The sum is then modulo 256 and zero-padded to three digits.
                </p>
              </div>

              <div
                className="p-2.5 rounded-lg border font-mono text-[9px] flex items-center justify-between"
                style={{ background: 'var(--background)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <span>Sum calculation:</span>
                <span className="font-bold text-[var(--foreground)]">
                  {(() => {
                    let total = 0;
                    for (let i = 0; i < compiled.partialMsg.length; i++) {
                      total += compiled.partialMsg.charCodeAt(i);
                    }
                    return `${total} % 256 = ${total % 256}`;
                  })()}
                </span>
              </div>
            </div>

          </div>

          {/* Card 7: Conformance & Structure Audit */}
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--foreground)' }}>
                  Protocol Conformance Auditor
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${allPassed ? 'bg-green-950/30 text-green-400 border border-green-900/20' : 'bg-red-950/30 text-red-400 border border-red-900/20'}`}>
                {allPassed ? 'Valid Schema' : 'Mandatory Missing'}
              </span>
            </div>

            <div className="space-y-3">
              {activeChecks.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: 'var(--background)',
                    border: `1px solid ${check.passed ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.15)'}`
                  }}
                >
                  <div className="mt-0.5 shrink-0">
                    {check.passed ? (
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold leading-tight" style={{ color: check.passed ? 'var(--foreground)' : '#ef4444' }}>
                      {check.label}
                    </div>
                    <div className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {check.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
