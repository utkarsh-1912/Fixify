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
  AlertTriangle 
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
      
      // Find if this matches any of our connection configs
      const key1 = `${sender} ⟷ ${target}`;
      const key2 = `${target} ⟷ ${sender}`;
      let matchedConfig = activeConfigs.find(c => c.key === key1 || c.key === key2);
      
      return {
        id: `msg-${index}-${Date.now()}`,
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

export default function MultiHopCorrelationPage() {
  const [rawLogs, setRawLogs] = useState(""); // Clean default state
  const [connectionsConfig, setConnectionsConfig] = useState([]);
  const [activeInputTab, setActiveInputTab] = useState("upload"); // text | upload
  const [activeTab, setActiveTab] = useState("all"); // all | bottlenecks | unmatched
  const [selectedChainId, setSelectedChainId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inspectedMessageId, setInspectedMessageId] = useState(null);

  const fileInputRef = useRef(null);
  const traceSectionRef = useRef(null);

  // Load from localstorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedLogs = localStorage.getItem('fixify-correlation-raw-logs');
    const cachedConfig = localStorage.getItem('fixify-correlation-connections-config');
    if (cachedLogs !== null) setRawLogs(cachedLogs);
    if (cachedConfig !== null) {
      try {
        setConnectionsConfig(JSON.parse(cachedConfig));
      } catch (e) {
        console.error("Failed to parse cached connections config", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localstorage on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-correlation-raw-logs', rawLogs);
    localStorage.setItem('fixify-correlation-connections-config', JSON.stringify(connectionsConfig));
  }, [rawLogs, connectionsConfig, isLoaded]);

  // Session Dynamic Discovery & Merge
  useEffect(() => {
    if (!rawLogs) return;
    
    // Scan logs and identify unique bidirectional connections
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

    // Merge with existing configuration state
    setConnectionsConfig(prev => {
      const next = [...prev];
      let updated = false;

      const existingKeys = new Set(next.map(c => c.key));
      let currentOrderMax = next.reduce((max, c) => Math.max(max, c.order), 0);

      uniqueConnsMap.forEach((val, key) => {
        if (!existingKeys.has(key)) {
          currentOrderMax += 1;
          let defaultName = `Hop ${currentOrderMax}`;
          if (key.includes('CLIENT') && key.includes('GW')) {
            defaultName = `Hop ${currentOrderMax}: Client Gateway`;
          } else if (key.includes('GW') && key.includes('OMS')) {
            defaultName = `Hop ${currentOrderMax}: OMS Router`;
          } else if (key.includes('OMS') && key.includes('EXCH')) {
            defaultName = `Hop ${currentOrderMax}: Exchange Venue`;
          }
          
          next.push({
            key,
            sender: val.sender,
            target: val.target,
            name: defaultName,
            order: currentOrderMax,
            enabled: true
          });
          updated = true;
        }
      });

      // Keep only connections that exist in the logs
      const filteredNext = next.filter(c => uniqueConnsMap.has(c.key));
      if (filteredNext.length !== next.length) {
        updated = true;
      }

      // Re-sort by sequence order
      filteredNext.sort((a, b) => a.order - b.order);

      if (updated || filteredNext.length !== prev.length) {
        return filteredNext;
      }
      return prev;
    });
  }, [rawLogs]);

  // Connected Components Graph Correlation Engine
  const correlationChains = useMemo(() => {
    const trackedConfigs = connectionsConfig
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    if (trackedConfigs.length === 0 || !rawLogs) return [];

    // Parse logs
    const allMsgs = parseLogs(rawLogs, trackedConfigs);
    const filteredMsgs = allMsgs.filter(m => m.connectionKey !== null);

    if (filteredMsgs.length === 0) return [];

    // DSU parent pointers
    const parent = {};
    const find = (x) => {
      if (parent[x] === x) return x;
      parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (x, y) => {
      const rootX = find(x);
      const rootY = find(y);
      if (rootX !== rootY) {
        parent[rootX] = rootY;
      }
    };

    // Initialize DSU
    filteredMsgs.forEach(m => {
      parent[m.id] = m.id;
    });

    // Lookup indexes
    const byClOrdID = {};
    const byOrderID = {};
    const byExecID = {};

    filteredMsgs.forEach(m => {
      if (m.clOrdID) {
        if (!byClOrdID[m.clOrdID]) byClOrdID[m.clOrdID] = [];
        byClOrdID[m.clOrdID].push(m.id);
      }
      if (m.origClOrdID) {
        if (!byClOrdID[m.origClOrdID]) byClOrdID[m.origClOrdID] = [];
        byClOrdID[m.origClOrdID].push(m.id);
      }
      if (m.orderID) {
        if (!byOrderID[m.orderID]) byOrderID[m.orderID] = [];
        byOrderID[m.orderID].push(m.id);
      }
      if (m.execID) {
        if (!byExecID[m.execID]) byExecID[m.execID] = [];
        byExecID[m.execID].push(m.id);
      }
    });

    // Perform Unions
    Object.values(byClOrdID).forEach(list => {
      for (let i = 1; i < list.length; i++) union(list[0], list[i]);
    });
    Object.values(byOrderID).forEach(list => {
      for (let i = 1; i < list.length; i++) union(list[0], list[i]);
    });
    Object.values(byExecID).forEach(list => {
      for (let i = 1; i < list.length; i++) union(list[0], list[i]);
    });

    // Group into lists
    const groups = {};
    filteredMsgs.forEach(m => {
      const root = find(m.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(m);
    });

    // Map each group to a full correlation chain object
    const chains = Object.entries(groups).map(([rootId, msgs]) => {
      msgs.sort((a, b) => {
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time;
      });

      const reqTypes = ['D', 'F', 'G'];
      let baseMsg = msgs.find(m => reqTypes.includes(m.msgType));
      if (!baseMsg) baseMsg = msgs[0];

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

        return {
          config: cfg,
          messages: hopMsgs,
          request,
          execution
        };
      });

      // Calculate latency between successive hops
      const latencies = [];
      for (let i = 0; i < hopTrace.length - 1; i++) {
        const hCurrent = hopTrace[i];
        const hNext = hopTrace[i+1];
        
        let delay = null;
        if (hCurrent.request && hNext.request && hCurrent.request.time !== null && hNext.request.time !== null) {
          delay = hNext.request.time - hCurrent.request.time;
        } else if (hCurrent.messages.length > 0 && hNext.messages.length > 0) {
          const tCurrent = Math.min(...hCurrent.messages.map(m => m.time).filter(t => t !== null));
          const tNext = Math.min(...hNext.messages.map(m => m.time).filter(t => t !== null));
          if (isFinite(tCurrent) && isFinite(tNext)) {
            delay = tNext - tCurrent;
          }
        }
        
        latencies.push({
          fromHop: hCurrent.config.name,
          toHop: hNext.config.name,
          delay: delay !== null ? Math.max(0, delay) : null
        });
      }

      // Total RTT (At the first hop)
      let totalRtt = null;
      const hop1 = hopTrace[0];
      if (hop1 && hop1.request && hop1.execution && hop1.request.time !== null && hop1.execution.time !== null) {
        totalRtt = Math.max(0, hop1.execution.time - hop1.request.time);
      } else {
        const validTimes = msgs.map(m => m.time).filter(t => t !== null);
        if (validTimes.length > 1) {
          totalRtt = Math.max(0, Math.max(...validTimes) - Math.min(...validTimes));
        }
      }

      const hasAllHops = hopTrace.every(ht => ht.messages.length > 0);
      const isComplete = hasAllHops && hopTrace[0]?.execution !== null;
      const hasBottleneck = latencies.some(l => l.delay !== null && l.delay > 8);

      return {
        id: `chain-${baseClOrdID}-${rootId}`,
        symbol,
        clOrdID: baseClOrdID,
        orderTime: baseMsg.time,
        messages: msgs,
        hopTrace,
        latencies,
        totalRtt,
        isComplete,
        hasBottleneck
      };
    });

    chains.sort((a, b) => {
      if (a.orderTime === null) return 1;
      if (b.orderTime === null) return -1;
      return a.orderTime - b.orderTime;
    });

    return chains;
  }, [rawLogs, connectionsConfig]);

  // Filtered chains for list display
  const filteredChains = useMemo(() => {
    if (activeTab === "bottlenecks") {
      return correlationChains.filter(c => c.hasBottleneck);
    }
    if (activeTab === "unmatched") {
      return correlationChains.filter(c => !c.isComplete);
    }
    return correlationChains;
  }, [correlationChains, activeTab]);

  // Retrieve currently selected chain object
  const selectedChain = useMemo(() => {
    if (!selectedChainId) return null;
    return correlationChains.find(c => c.id === selectedChainId) || null;
  }, [correlationChains, selectedChainId]);

  // Re-ordering helper handlers
  const moveConfigUp = (index) => {
    if (index === 0) return;
    setConnectionsConfig(prev => {
      const next = [...prev];
      const temp = next[index].order;
      next[index].order = next[index - 1].order;
      next[index - 1].order = temp;
      next.sort((a, b) => a.order - b.order);
      return next;
    });
  };

  const moveConfigDown = (index) => {
    if (index === connectionsConfig.length - 1) return;
    setConnectionsConfig(prev => {
      const next = [...prev];
      const temp = next[index].order;
      next[index].order = next[index + 1].order;
      next[index + 1].order = temp;
      next.sort((a, b) => a.order - b.order);
      return next;
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
    reader.onload = (event) => {
      setRawLogs(event.target.result);
      setActiveInputTab("text");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawLogs(event.target.result);
      setActiveInputTab("text");
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    setRawLogs("");
    setSelectedChainId(null);
    setInspectedMessageId(null);
  };

  const handleLoadSamples = () => {
    setRawLogs(DEFAULT_LOGS);
    setSelectedChainId(null);
    setInspectedMessageId(null);
  };

  const handleSelectChain = (c) => {
    setSelectedChainId(c.id);
    if (c.messages && c.messages.length > 0) {
      setInspectedMessageId(c.messages[0].id);
    } else {
      setInspectedMessageId(null);
    }
    setTimeout(() => {
      traceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Network className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            Multi-Hop Transaction Correlation Tracker
          </h1>
          <p className="text-xs text-[var(--text-muted)]" style={{ color: 'var(--text-muted)' }}>
            Load log files, dynamically auto-discover message sessions, custom label hops, and trace individual transaction journeys.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleLoadSamples} className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold">
            Load Demo Logs
          </button>
          <button onClick={handleClearAll} className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold border-red-900/30 text-red-400 bg-red-950/10 hover:bg-red-950/20">
            Clear Logs
          </button>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Column: Inputs and Configuration (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Input Panel */}
          <div className="fx-card space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="fx-section-label">1. Log Input Source</span>
              
              {/* Input Tab Selector */}
              <div className="fx-tab-group">
                <button
                  onClick={() => setActiveInputTab("text")}
                  className={`fx-tab ${activeInputTab === "text" ? "active" : ""}`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setActiveInputTab("upload")}
                  className={`fx-tab ${activeInputTab === "upload" ? "active" : ""}`}
                >
                  File Upload
                </button>
              </div>
            </div>

            {activeInputTab === "text" ? (
              <div className="space-y-2">
                <textarea
                  value={rawLogs}
                  onChange={(e) => setRawLogs(e.target.value)}
                  placeholder="Paste raw interleaved logs here containing multiple hop FIX messages..."
                  className="fx-input w-full min-h-[220px] text-xs resize-y"
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    outline: 'none'
                  }}
                />
                <div className="text-[9px] font-mono flex justify-between px-1" style={{ color: 'var(--text-muted)' }}>
                  <span>Lines: {rawLogs ? rawLogs.split('\n').length : 0}</span>
                  <span>Detected FIX lines: {rawLogs ? rawLogs.split('\n').filter(l => l.includes('8=FIX')).length : 0}</span>
                </div>
              </div>
            ) : (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)'
                }}
              >
                <Upload className="h-6 w-6 mb-2 animate-pulse" style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-semibold">Drag &amp; drop log file here</span>
                <span className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Accepts .log, .txt, .csv, etc.</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".log,.txt,.csv,.logx" 
                  className="hidden" 
                />
              </div>
            )}
          </div>

          {/* Dynamic Sessions & Hop Configurator */}
          <div className="fx-card p-4 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="fx-section-label" style={{ color: 'var(--primary)' }}>2. Session &amp; Hops Configurator</span>
                <span className="text-[9px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>Customize tracking filters, labels, and path sequence.</span>
              </div>
              <RefreshCw 
                onClick={() => setRawLogs(prev => prev + '\n ')} 
                className="h-3.5 w-3.5 cursor-pointer hover:rotate-180 transition-all duration-300"
                style={{ color: 'var(--text-muted)' }}
                title="Rescan sessions"
              />
            </div>

            {connectionsConfig.length === 0 ? (
              <div className="py-6 text-center font-mono text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
                No active session connections discovered yet. Input logs above to scan.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[9px] font-bold uppercase tracking-wider font-mono grid grid-cols-12 gap-2 px-1" style={{ color: 'var(--text-muted)' }}>
                  <div className="col-span-1">Track</div>
                  <div className="col-span-5">Discovered Session</div>
                  <div className="col-span-4">Hop Custom Label</div>
                  <div className="col-span-2 text-right">Seq</div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                  {connectionsConfig.map((cfg, idx) => (
                    <div 
                      key={cfg.key} 
                      className="grid grid-cols-12 gap-2 items-center p-2 rounded border transition-all"
                      style={{
                        background: 'var(--background)',
                        borderColor: 'var(--border)',
                        opacity: cfg.enabled ? 1 : 0.4
                      }}
                    >
                      {/* Toggle Track */}
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={() => toggleConnection(idx)}
                          className="h-3 w-3 cursor-pointer"
                          style={{ accentColor: 'var(--primary)' }}
                        />
                      </div>

                      {/* Connection display */}
                      <div className="col-span-5 font-mono text-[9px] truncate" style={{ color: 'var(--foreground)' }} title={cfg.key}>
                        {cfg.sender} ➔ {cfg.target}
                      </div>

                      {/* Custom Name */}
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={cfg.name}
                          disabled={!cfg.enabled}
                          onChange={(e) => handleHopNameChange(idx, e.target.value)}
                          className="fx-input w-full px-1.5 py-0.5 text-[9px]"
                          style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: 'var(--foreground)'
                          }}
                        />
                      </div>

                      {/* Sequence Buttons */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          disabled={idx === 0 || !cfg.enabled}
                          onClick={() => moveConfigUp(idx)}
                          className="p-0.5 rounded disabled:opacity-20 transition-all"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                        >
                          <ArrowUp className="h-2.5 w-2.5" style={{ color: 'var(--foreground)' }} />
                        </button>
                        <button
                          disabled={idx === connectionsConfig.length - 1 || !cfg.enabled}
                          onClick={() => moveConfigDown(idx)}
                          className="p-0.5 rounded disabled:opacity-20 transition-all"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                        >
                          <ArrowDown className="h-2.5 w-2.5" style={{ color: 'var(--foreground)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Side Column: Analysis Workspace (7/12) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Chains Table Card */}
          <div className="fx-card p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="fx-section-label" style={{ color: 'var(--primary)' }}>3. Correlated Transaction Chains</span>
              
              {/* Tabs */}
              <div className="fx-tab-group">
                {['all', 'bottlenecks', 'unmatched'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`fx-tab ${activeTab === tab ? "active" : ""}`}
                  >
                    {tab === "all" ? "All Chains" : tab === "bottlenecks" ? "Bottlenecks" : "Incomplete"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-[10px] font-mono" style={{ color: 'var(--foreground)' }}>
                <thead>
                  <tr className="border-b text-[9px] uppercase tracking-wider sticky top-0 backdrop-blur z-10" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Base ClOrdID</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Symbol</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Delays</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Total RTT</th>
                    <th className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="py-2.5 px-3 text-right" style={{ color: 'var(--text-muted)' }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredChains.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center italic" style={{ color: 'var(--text-muted)' }}>
                        No correlated transaction chains found matching configuration filters.
                      </td>
                    </tr>
                  ) : (
                    filteredChains.map((c) => {
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
                            <div className="flex items-center gap-1">
                              {c.latencies.map((l, i) => (
                                <span 
                                  key={i} 
                                  className={`px-1 rounded text-[8px] font-mono ${
                                    l.delay === null 
                                      ? 'text-zinc-500' 
                                      : l.delay > 8 
                                      ? 'badge-danger' 
                                      : ''
                                  }`}
                                  style={{
                                    background: l.delay !== null && l.delay <= 8 ? 'var(--background)' : undefined,
                                    border: l.delay !== null && l.delay <= 8 ? '1px solid var(--border)' : undefined,
                                    color: l.delay !== null && l.delay <= 8 ? 'var(--foreground)' : undefined
                                  }}
                                  title={`${l.fromHop} ➔ ${l.toHop}`}
                                >
                                  {l.delay !== null ? `${l.delay}ms` : '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold">
                            {c.totalRtt !== null ? (
                              <span style={{ color: 'var(--primary)' }}>{c.totalRtt} ms</span>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="py-3 px-3">
                            {c.hasBottleneck ? (
                              <span className="badge-danger">Bottleneck</span>
                            ) : c.isComplete ? (
                              <span className="badge-success">Complete</span>
                            ) : (
                              <span className="badge-warn">Incomplete</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectChain(c);
                              }}
                              className="fx-btn-secondary py-1 px-2.5 text-[9px] font-semibold"
                            >
                              Trace
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      </div>

      {/* Selected Chain - Sequence Topology Trace Drawer (Right Slide-out) */}
      {selectedChain && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => {
              setSelectedChainId(null);
              setInspectedMessageId(null);
            }}
          />

          {/* Slide-out Panel */}
          <div 
            ref={traceSectionRef}
            className="fixed inset-y-0 right-0 h-full w-full md:w-[600px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 border-l"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="fx-section-label" style={{ color: 'var(--primary)' }}>Sequence Topology Trace</span>
                <span className="px-2 py-0.5 text-[9px] font-mono rounded" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                  ID: {selectedChain.clOrdID} | Symbol: {selectedChain.symbol}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedChainId(null);
                  setInspectedMessageId(null);
                }}
                className="fx-btn-secondary p-1 rounded-md"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              <div className="grid grid-cols-1 gap-6">
                
                {/* Timeline Diagram Flow (7/12 Width) */}
                <div className="flex flex-col space-y-4">
                  <span className="fx-section-label">Transit Hops Timeline</span>

                  <div className="relative pl-6 space-y-6">
                    {/* Vertical Line representation */}
                    <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'var(--border)' }} />

                    {selectedChain.hopTrace.map((ht, idx) => {
                      const isMissing = ht.messages.length === 0;
                      const delay = idx > 0 ? selectedChain.latencies[idx - 1]?.delay : null;

                      return (
                        <div key={ht.config.key} className="relative group">
                          
                          {/* Connection Timeline Node dot */}
                          <div 
                            className="absolute -left-[22px] top-3.5 h-3.5 w-3.5 rounded-full border-4"
                            style={{
                              background: isMissing ? 'var(--background)' : 'var(--primary)',
                              borderColor: 'var(--card)'
                            }}
                          />

                          {/* Transition latency connector */}
                          {idx > 0 && (
                            <div className="absolute -left-[24px] -top-6 h-6 flex items-center justify-center">
                              <div 
                                className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shadow-md select-none border"
                                style={{
                                  background: delay === null ? 'var(--background)' : delay > 8 ? 'rgba(239,68,68,0.1)' : 'var(--background)',
                                  borderColor: delay === null ? 'var(--border)' : delay > 8 ? 'rgba(239,68,68,0.3)' : 'var(--border)',
                                  color: delay === null ? 'var(--text-muted)' : delay > 8 ? '#f87171' : 'var(--primary)'
                                }}
                              >
                                {delay !== null ? `➔ +${delay} ms` : '➔ Pending'}
                              </div>
                            </div>
                          )}

                          {/* Hop Block Card */}
                          <div 
                            className="p-4 rounded-xl border transition-all"
                            style={{
                              background: 'var(--background)',
                              borderColor: 'var(--border)',
                              borderStyle: isMissing ? 'dashed' : 'solid',
                              opacity: isMissing ? 0.5 : 1
                            }}
                          >
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                              <div>
                                <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--foreground)' }}>
                                  {ht.config.name}
                                </span>
                                <span className="text-[9px] font-mono block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  Session: {ht.config.key}
                                </span>
                              </div>

                              <div>
                                {isMissing ? (
                                  <span className="badge-warn" style={{ opacity: 0.6 }}>Missing</span>
                                ) : (
                                  <span className="badge-success">Synced</span>
                                )}
                              </div>
                            </div>

                            {/* List Messages in Hop */}
                            {!isMissing && (
                              <div className="space-y-2 mt-3">
                                {ht.messages.map(m => {
                                  const isInspected = inspectedMessageId === m.id;
                                  return (
                                    <div 
                                      key={m.id}
                                      onClick={() => setInspectedMessageId(m.id)}
                                      className="p-2 rounded border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                      style={{
                                        borderColor: isInspected ? 'var(--primary)' : 'var(--border)',
                                        background: isInspected ? 'var(--primary-faint)' : 'var(--card)'
                                      }}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shrink-0 ${
                                          m.msgType === 'D' 
                                            ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20' 
                                            : m.msgType === '8' 
                                            ? 'badge-success' 
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                        }`}>
                                          {m.msgTypeName} ({m.msgType})
                                        </span>
                                        <span className="text-[9px] font-mono truncate" style={{ color: 'var(--foreground)' }}>
                                          {m.clOrdID ? `ClOrdID: ${m.clOrdID}` : m.orderID ? `OrderID: ${m.orderID}` : `Sender: ${m.sender}`}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {m.time && (
                                          <span className="text-[8px] font-mono flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                            <Clock className="h-2.5 w-2.5" />
                                            {m.parsed.tags['52']}
                                          </span>
                                        )}
                                        <button 
                                          className="p-0.5 rounded transition-all"
                                          style={{ color: isInspected ? 'var(--primary)' : 'var(--text-muted)' }}
                                          title="Inspect tags"
                                        >
                                          <Eye className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Inspect Details panel (5/12 Width) */}
                <div className="flex flex-col space-y-4">
                  <span className="fx-section-label">Message SOH Inspection</span>

                  <div 
                    className="p-4 rounded-xl border flex flex-col justify-between min-h-[300px]"
                    style={{
                      background: 'var(--background)',
                      borderColor: 'var(--border)'
                    }}
                  >
                    {inspectedMessageId ? (
                      (() => {
                        const msg = selectedChain.messages.find(m => m.id === inspectedMessageId);
                        if (!msg) return <div className="text-xs italic font-mono" style={{ color: 'var(--text-muted)' }}>Message not found.</div>;
                        return (
                          <div className="space-y-4 flex-1 flex flex-col justify-between">
                            
                            <div className="space-y-3">
                              <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                                <div>
                                  <span className="text-[10px] font-bold font-mono block" style={{ color: 'var(--foreground)' }}>{msg.msgTypeName} ({msg.msgType})</span>
                                  <span className="text-[8px] font-mono block" style={{ color: 'var(--text-muted)' }}>From {msg.sender} to {msg.target}</span>
                                </div>
                                <span className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>{msg.parsed.tags['52'] || 'No Timestamp'}</span>
                              </div>

                              <div className="space-y-2">
                                <span className="fx-section-label block">Parsed Key Identifiers</span>
                                <div 
                                  className="grid grid-cols-2 gap-2 text-[9px] font-mono p-2.5 rounded border"
                                  style={{
                                    background: 'var(--card)',
                                    borderColor: 'var(--border)'
                                  }}
                                >
                                  <div>
                                    <span className="block" style={{ color: 'var(--text-muted)' }}>Tag 11 (ClOrdID):</span>
                                    <span className="font-bold">{msg.clOrdID || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block" style={{ color: 'var(--text-muted)' }}>Tag 37 (OrderID):</span>
                                    <span className="font-bold">{msg.orderID || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block" style={{ color: 'var(--text-muted)' }}>Tag 41 (OrigClOrdID):</span>
                                    <span className="font-bold">{msg.origClOrdID || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block" style={{ color: 'var(--text-muted)' }}>Tag 17 (ExecID):</span>
                                    <span className="font-bold">{msg.execID || '—'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="fx-section-label block">Raw Message Fields</span>
                                <div className="max-h-[260px] overflow-y-auto scrollbar-thin">
                                  <SohVisualizer content={msg.raw} />
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 italic font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <Info className="h-6 w-6 mb-2" style={{ color: 'var(--text-faint)' }} />
                        Select a parsed message row in the timeline trace to view tag-by-tag details.
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
