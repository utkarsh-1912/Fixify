'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Upload,
  RotateCcw,
  TrendingUp,
  Activity,
  AlertOctagon,
  Clock,
  CheckCircle,
  FileText,
  Percent,
  Search,
  Filter,
  Settings,
  Trash2,
  Info
} from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';

const ORD_REJ_REASONS = {
  '0': 'Broker Option',
  '1': 'Unknown Symbol',
  '2': 'Exchange Closed',
  '3': 'Order Exceeds Limit',
  '4': 'Too Late to Enter',
  '5': 'Unknown Order',
  '6': 'Duplicate Order (ID)',
  '8': 'Stale Order',
  '13': 'Incorrect Quantity',
  '15': 'Unknown Account'
};

const ORD_STATUS_LABELS = {
  '0': 'New',
  '1': 'Partially Filled',
  '2': 'Filled',
  '3': 'Done for Day',
  '4': 'Canceled',
  '8': 'Rejected',
  'A': 'Pending New',
  'C': 'Expired'
};

function parseDateStr(ts) {
  if (!ts) return null;
  // Format: YYYYMMDD-HH:mm:ss.SSS or similar
  const parts = ts.split('-');
  if (parts.length < 2) return null;
  const datePart = parts[0];
  const timePart = parts[1];

  if (datePart.length === 8) {
    const year = parseInt(datePart.substring(0, 4), 10);
    const month = parseInt(datePart.substring(4, 6), 10) - 1;
    const day = parseInt(datePart.substring(6, 8), 10);
    const timeSplit = timePart.split(':');
    if (timeSplit.length >= 3) {
      const h = parseInt(timeSplit[0], 10);
      const m = parseInt(timeSplit[1], 10);
      const sFloat = parseFloat(timeSplit[2]);
      const s = Math.floor(sFloat);
      const ms = Math.round((sFloat - s) * 1000);
      const date = new Date(Date.UTC(year, month, day, h, m, s, ms));
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

export default function ExecutionAnalyticsPage() {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [showSetup, setShowSetup] = useState(true);
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'paste'
  
  // Table search & filters
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCharts, setShowCharts] = useState(true);
  const [fileName, setFileName] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const handleReset = () => {
    setInputText('');
    setFileName('');
    setOrders([]);
    setStats(null);
    setFilterText('');
    setStatusFilter('ALL');
    setShowCharts(true);
    setShowSetup(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const textContent = event.target.result;
      setInputText(textContent);
      performAnalysis(textContent);
    };
    reader.readAsText(file);
  };

  const handleAnalyze = () => {
    performAnalysis(inputText);
  };

  const performAnalysis = (text) => {
    if (!text.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      const lines = inputText.split(/\r?\n/);
      const ordersMap = {}; // ClOrdID -> Order object
      const unmatchedExecs = [];

      lines.forEach(line => {
        const parsed = validateFIXMessage(line, 'Auto');
        if (!parsed || !parsed.tags || !parsed.tags['35']) return;

        const msgType = parsed.msgType;
        const clOrdId = parsed.clOrdID;
        const origClOrdId = parsed.tags['41'];
        const sendingTime = parsed.sendingTime;

        if (msgType === 'D') {
          // New Order Single
          if (clOrdId) {
            ordersMap[clOrdId] = {
              clOrdId,
              symbol: parsed.tags['55'] || 'UNKNOWN',
              side: parsed.tags['54'] === '1' ? 'BUY' : (parsed.tags['54'] === '2' ? 'SELL' : 'SHORT'),
              orderQty: parseInt(parsed.tags['38'], 10) || 0,
              cumQty: 0,
              leavesQty: parseInt(parsed.tags['38'], 10) || 0,
              price: parseFloat(parsed.tags['44']) || 0,
              status: '0', // default: New
              sendingTime,
              execTime: null,
              latencyMs: null,
              rejReason: null,
              history: [{ msgType, status: '0', time: sendingTime }]
            };
          }
        } else if (msgType === '8') {
          // Execution Report
          const execType = parsed.tags['150'];
          const ordStatus = parsed.tags['39'];
          const leavesQty = parseInt(parsed.tags['151'], 10) || 0;
          const cumQty = parseInt(parsed.tags['14'], 10) || 0;
          const targetClOrdId = clOrdId || origClOrdId;

          if (targetClOrdId && ordersMap[targetClOrdId]) {
            const order = ordersMap[targetClOrdId];
            order.status = ordStatus || order.status;
            order.leavesQty = leavesQty;
            order.cumQty = cumQty;
            order.history.push({ msgType, status: ordStatus, time: sendingTime });

            // Calculate latency on first state change (execution or reject)
            if (order.latencyMs === null) {
              const start = parseDateStr(order.sendingTime);
              const end = parseDateStr(sendingTime);
              if (start && end) {
                order.latencyMs = Math.max(0, end.getTime() - start.getTime());
                order.execTime = sendingTime;
              }
            }

            if (ordStatus === '8') {
              // Rejected
              const rejCode = parsed.tags['103'];
              order.rejReason = ORD_REJ_REASONS[rejCode] || `Code ${rejCode || 'N/A'}`;
            }
          } else {
            unmatchedExecs.push({
              clOrdId: targetClOrdId || 'N/A',
              msgType,
              status: ordStatus,
              symbol: parsed.tags['55'] || 'N/A',
              cumQty,
              sendingTime
            });
          }
        } else if (msgType === '3') {
          // Reject
          const refSeqNum = parsed.tags['45'];
          const text = parsed.tags['58'] || 'Session Reject';
          // Find matching order in active map that has a sendingTime closest or matches refSeqNum
          // For session rejects, fallback search or store it as unmatched
          unmatchedExecs.push({
            clOrdId: 'N/A',
            msgType,
            status: 'Rejected',
            symbol: 'N/A',
            cumQty: 0,
            sendingTime,
            text
          });
        }
      });

      const ordersList = Object.values(ordersMap);

      // Aggregate statistics
      let filledCount = 0;
      let partialCount = 0;
      let rejectCount = 0;
      let cancelCount = 0;
      let totalLatency = 0;
      let latencyCount = 0;
      const rejectReasonSplit = {};
      const latencyBuckets = { '<5ms': 0, '5-20ms': 0, '20-100ms': 0, '>100ms': 0 };

      ordersList.forEach(o => {
        if (o.status === '2') filledCount++;
        else if (o.status === '1') partialCount++;
        else if (o.status === '8') rejectCount++;
        else if (o.status === '4') cancelCount++;

        if (o.latencyMs !== null) {
          totalLatency += o.latencyMs;
          latencyCount++;

          if (o.latencyMs < 5) latencyBuckets['<5ms']++;
          else if (o.latencyMs <= 20) latencyBuckets['5-20ms']++;
          else if (o.latencyMs <= 100) latencyBuckets['20-100ms']++;
          else latencyBuckets['>100ms']++;
        }

        if (o.rejReason) {
          rejectReasonSplit[o.rejReason] = (rejectReasonSplit[o.rejReason] || 0) + 1;
        }
      });

      const avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(1) : 'N/A';
      const fillRate = ordersList.length > 0 ? ((filledCount / ordersList.length) * 100).toFixed(1) : '0';
      const rejectRate = ordersList.length > 0 ? ((rejectCount / ordersList.length) * 100).toFixed(1) : '0';

      setOrders(ordersList);
      setStats({
        totalOrders: ordersList.length,
        filledCount,
        partialCount,
        rejectCount,
        cancelCount,
        avgLatency,
        rejectRate,
        fillRate,
        latencyBuckets,
        rejectReasonSplit,
        unmatchedCount: unmatchedExecs.length
      });
      setIsProcessing(false);
      setShowSetup(false);
    }, 400);
  };

  // Filtered list
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.clOrdId.toLowerCase().includes(filterText.toLowerCase()) ||
                         o.symbol.toLowerCase().includes(filterText.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && o.status === statusFilter;
  });

  const renderSetupPanel = () => (
    <div
      className="p-5 rounded-2xl border space-y-4 animate-in fade-in duration-200"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          Ingest Execution Logs
        </h2>
        <div className="fx-tab-group">
          <button
            className={`fx-tab${inputMode === 'file' ? ' active' : ''}`}
            onClick={() => setInputMode('file')}
          >
            <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">File</span>
          </button>
          <button
            className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
            onClick={() => setInputMode('paste')}
          >
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {inputMode === 'file' ? (
          fileName ? (
            <div className="p-6 rounded-lg border flex items-center justify-between" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--primary-faint)] border border-[var(--primary-border)] shrink-0">
                  <FileText className="h-4 w-4 text-[var(--primary)]" />
                </div>
                <div className="truncate text-left">
                  <p className="text-xs font-mono font-bold truncate text-[var(--foreground)]" title={fileName}>
                    {fileName}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">File loaded successfully</p>
                </div>
              </div>
              <button
                onClick={() => { setFileName(''); setInputText(''); }}
                className="h-7 w-7 rounded-lg border flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
                title="Remove file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg cursor-pointer hover:bg-zinc-800/10 dark:hover:bg-zinc-850/20 transition-all text-center"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <Upload className="h-6 w-6 text-[var(--text-muted)] mb-2" />
              <span className="text-xs font-semibold text-[var(--primary)]">Choose Log File</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Supports .txt · .fix · .log</p>
              <input
                type="file"
                accept=".txt,.log,.fix"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )
        ) : (
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste execution logs containing New Orders (35=D) and Execution Reports (35=8)..."
            rows={10}
            className="w-full fx-input resize-y"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        )}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={isProcessing || !inputText.trim()}
        className="w-full fx-btn-primary justify-center font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
      >
        <Activity className="h-4 w-4" />
        <span>{isProcessing ? 'Aggregating metrics...' : 'Analyze execution logs'}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!stats ? 'max-w-2xl mx-auto' : ''}`}>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Execution Analytics Blotter</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
              title="View help & usage guide"
            >
              <Info className="h-4 w-4" />
            </button>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Analyze turnaround transaction latency, order fill rates, and detailed execution metrics from raw logs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stats && (
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="fx-btn-secondary py-2 px-4 text-xs font-semibold"
              title="Toggle input sidebar"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{showSetup ? 'Hide Input' : 'Show Input'}</span>
            </button>
          )}
          {(inputText || stats) && (
            <button onClick={handleReset} className="fx-btn-secondary py-2 px-4 text-xs font-semibold">
              <RotateCcw className="h-3.5 w-3.5" /> <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {!stats ? (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
          {renderSetupPanel()}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
          {showSetup && (
            <div className="lg:col-span-4 space-y-6">
              {renderSetupPanel()}
            </div>
          )}
          <div className={showSetup ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
            {/* Dashboard view */}
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setStatusFilter('ALL')}
              className="p-5 rounded-2xl border space-y-2 flex flex-col justify-between cursor-pointer hover:scale-[1.02] hover:shadow-sm transition-all"
              style={{
                background: 'var(--card)',
                borderColor: statusFilter === 'ALL' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Total Orders</span>
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-mono font-extrabold text-[var(--foreground)]">{stats.totalOrders}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Parsed from New Order Singles</p>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === '2' ? 'ALL' : '2')}
              className="p-5 rounded-2xl border space-y-2 flex flex-col justify-between cursor-pointer hover:scale-[1.02] hover:shadow-sm transition-all"
              style={{
                background: 'var(--card)',
                borderColor: statusFilter === '2' ? '#10b981' : 'var(--border)'
              }}
            >
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Order Fill Rate</span>
                <Percent className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-extrabold text-green-400">{stats.fillRate}%</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{stats.filledCount} Filled · {stats.partialCount} Partial</p>
              </div>
            </div>

            <div
              className="p-5 rounded-2xl border space-y-2 flex flex-col justify-between"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Turnaround Latency</span>
                <Clock className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-mono font-extrabold text-[var(--primary)]">{stats.avgLatency} ms</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Avg order ack processing speed</p>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === '8' ? 'ALL' : '8')}
              className="p-5 rounded-2xl border space-y-2 flex flex-col justify-between cursor-pointer hover:scale-[1.02] hover:shadow-sm transition-all"
              style={{
                background: 'var(--card)',
                borderColor: statusFilter === '8' ? '#ef4444' : 'var(--border)'
              }}
            >
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Order Reject Rate</span>
                <AlertOctagon className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-extrabold text-red-400">{stats.rejectRate}%</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{stats.rejectCount} rejections found</p>
              </div>
            </div>
          </div>

          {/* Graphs panel */}
          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Latency distribution */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Ack Latency Distribution
              </h3>
              <div className="space-y-3.5">
                {Object.entries(stats.latencyBuckets).map(([bucket, val]) => {
                  const pct = stats.totalOrders > 0 ? ((val / stats.totalOrders) * 100).toFixed(1) : 0;
                  return (
                    <div key={bucket} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-[var(--text-muted)]">
                        <span>{bucket}</span>
                        <span>{val} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-950 overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rejection reasons */}
            <div
              className="p-5 rounded-2xl border space-y-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Rejections by Reason
              </h3>
              {Object.keys(stats.rejectReasonSplit).length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 min-h-[160px]">
                  <CheckCircle className="h-7 w-7 text-green-400 mb-2" />
                  <p className="text-xs font-bold text-[var(--foreground)]">No Order Rejections</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">All parsed orders processed without reject messages.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(stats.rejectReasonSplit).map(([reason, count]) => {
                    const pct = stats.rejectCount > 0 ? ((count / stats.rejectCount) * 100).toFixed(1) : 0;
                    return (
                      <div key={reason} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono text-[var(--text-muted)]">
                          <span className="truncate max-w-[200px]" title={reason}>{reason}</span>
                          <span>{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-950 overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}


          {/* Orders blotter table */}
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  <span>Reconstructed Order Blotter</span>
                </h3>
                <button
                  onClick={() => setShowCharts(s => !s)}
                  className="text-[10px] font-bold text-[var(--primary)] hover:underline border border-[var(--primary-border)] bg-[var(--primary-faint)] px-2 py-0.5 rounded ml-2 cursor-pointer"
                >
                  {showCharts ? 'Hide Charts' : 'Show Charts'}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search ClOrdID / Symbol..."
                    className="fx-input pl-8 py-1.5 text-xs w-48 font-mono"
                  />
                </div>

                {/* Status select */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="fx-input py-1.5 text-xs font-mono"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="2">Filled</option>
                  <option value="1">Partial</option>
                  <option value="8">Rejected</option>
                  <option value="4">Canceled</option>
                  <option value="0">New</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800" style={{ color: 'var(--text-muted)' }}>
                    <th className="py-2.5 px-3.5 font-semibold">ClOrdID</th>
                    <th className="py-2.5 px-3.5 font-semibold">Symbol</th>
                    <th className="py-2.5 px-3.5 font-semibold">Side</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Order Qty</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Cum Qty</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Price</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Ack Speed</th>
                    <th className="py-2.5 px-3.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-[var(--text-muted)] italic">
                        No orders match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const statusLabel = ORD_STATUS_LABELS[o.status] || `Code ${o.status}`;
                      
                      let badgeStyle = 'bg-zinc-950/40 text-zinc-400 border-zinc-900/30';
                      if (o.status === '2') badgeStyle = 'bg-green-950/30 text-green-400 border-green-900/20';
                      else if (o.status === '1') badgeStyle = 'bg-indigo-950/30 text-indigo-400 border-indigo-900/20';
                      else if (o.status === '8') badgeStyle = 'bg-red-950/30 text-red-400 border-red-900/20';
                      else if (o.status === '4') badgeStyle = 'bg-amber-950/30 text-amber-400 border-amber-900/20';

                      return (
                        <tr key={o.clOrdId} className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                          <td className="py-2 px-3.5 font-bold text-[var(--foreground)]">{o.clOrdId}</td>
                          <td className="py-2 px-3.5 font-extrabold text-[var(--primary)]">{o.symbol}</td>
                          <td className="py-2 px-3.5">
                            <span className={o.side === 'BUY' ? 'text-blue-400' : 'text-orange-400'}>{o.side}</span>
                          </td>
                          <td className="py-2 px-3.5 text-right font-bold">{o.orderQty.toLocaleString()}</td>
                          <td className="py-2 px-3.5 text-right">{o.cumQty.toLocaleString()}</td>
                          <td className="py-2 px-3.5 text-right font-bold">${o.price.toFixed(2)}</td>
                          <td className="py-2 px-3.5 text-right text-[var(--primary)] font-bold">
                            {o.latencyMs !== null ? `${o.latencyMs} ms` : '—'}
                          </td>
                          <td className="py-2 px-3.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                              {statusLabel}
                            </span>
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
      )}

      {infoModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setInfoModalOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-6 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Usage & Help Guide</h3>
              </div>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors text-xs font-semibold font-mono cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed scrollbar-thin">
              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">What is the Execution Analytics Blotter?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  This tool reconstructs execution logs into performance metrics and KPI dashboards. It pairs New Order Singles with their corresponding executions or rejects to measure fill rates, reject distributions, and turnaround round-trip latency.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">How to use:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Ingest Logs:</strong> Select the File tab to upload a file (automatically processed) or Paste tab to paste text and click "Analyze execution logs".</li>
                  <li><strong>KPI Dashboard Cards:</strong> Inspect aggregated statistics for Total Orders, Fill Rate, Average Latency, and Reject Rate.</li>
                  <li><strong>Interactive Filters:</strong> Click metric cards (e.g. "Order Fill Rate" or "Order Reject Rate") to instantly filter the blotter table. Click "Total Orders" to reset.</li>
                  <li><strong>Latency &amp; Rejection splits:</strong> Toggle distribution charts to inspect outlier latency brackets (&lt;5ms to &gt;100ms) and rejection split categories.</li>
                  <li><strong>Search & Filter:</strong> Use the search bar in the table header to find specific ClOrdIDs or symbols instantly.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
