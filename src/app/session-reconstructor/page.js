'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  Upload,
  RotateCcw,
  Activity,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  Trash2,
  Info
} from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';

const SESSION_MSG_TYPES = {
  'A': 'Logon',
  '5': 'Logout',
  '0': 'Heartbeat',
  '1': 'Test Request',
  '2': 'Resend Request',
  '4': 'Sequence Reset',
  '3': 'Reject'
};

export default function SessionReconstructorPage() {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [showSetup, setShowSetup] = useState(true);
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'paste'
  const [fileName, setFileName] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  
  // View settings
  const [hideHeartbeats, setHideHeartbeats] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleReset = () => {
    setInputText('');
    setFileName('');
    setSessionEvents([]);
    setStats(null);
    setSelectedEvent(null);
    setHideHeartbeats(false);
    setCompactView(false);
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
      performReconstruct(textContent);
    };
    reader.readAsText(file);
  };

  const handleReconstruct = () => {
    performReconstruct(inputText);
  };

  const performReconstruct = (text) => {
    if (!text.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      const lines = inputText.split(/\r?\n/);
      const events = [];
      
      // Keep track of expected sequence numbers for each (Sender -> Target) direction
      // Direction key: "SenderCompID->TargetCompID"
      const expectedSeqs = {};

      let totalGaps = 0;
      let totalResends = 0;
      let totalResets = 0;

      lines.forEach((line, lineIdx) => {
        const parsed = validateFIXMessage(line, 'Auto');
        if (!parsed || !parsed.tags || !parsed.tags['35']) return;

        const msgType = parsed.msgType;
        // Filter: Keep session-level messages only
        if (!Object.keys(SESSION_MSG_TYPES).includes(msgType)) return;

        const sender = parsed.senderCompID || 'CLIENT';
        const target = parsed.targetCompID || 'SERVER';
        const seqNum = parseInt(parsed.msgSeqNum, 10);
        const sendingTime = parsed.sendingTime;

        if (isNaN(seqNum)) return;

        const dirKey = `${sender}->${target}`;
        if (expectedSeqs[dirKey] === undefined) {
          expectedSeqs[dirKey] = 1; // Initialize expectation
        }

        const expected = expectedSeqs[dirKey];
        let gapDetected = false;
        let gapSize = 0;
        let isRetransmission = false;

        // Gap detection
        if (seqNum > expected) {
          gapDetected = true;
          gapSize = seqNum - expected;
          totalGaps++;
        } else if (seqNum < expected) {
          if (parsed.tags['43'] === 'Y') {
            isRetransmission = true;
          }
        }

        // Details of session actions
        let details = '';
        if (msgType === '2') {
          // Resend Request
          const begin = parsed.tags['7'] || '0';
          const end = parsed.tags['16'] || '0';
          details = `Request range: ${begin} to ${end}`;
          totalResends++;
        } else if (msgType === '4') {
          // Sequence Reset
          const newSeq = parsed.tags['36'] || '0';
          const gapFill = parsed.tags['123'] === 'Y' ? 'Gap Fill' : 'Reset';
          details = `${gapFill} to sequence ${newSeq}`;
          totalResets++;
          
          // Update expected sequence directly to NewSeqNo
          const targetNewSeq = parseInt(newSeq, 10);
          if (!isNaN(targetNewSeq)) {
            expectedSeqs[dirKey] = targetNewSeq;
          }
        } else if (msgType === 'A') {
          details = `EncryptMethod: ${parsed.tags['98'] || '0'}, HeartBtInt: ${parsed.tags['108'] || '30'}`;
        }

        // Add event
        events.push({
          id: `${lineIdx}-${seqNum}`,
          msgType,
          msgTypeName: SESSION_MSG_TYPES[msgType],
          sender,
          target,
          seqNum,
          expectedSeq: expected,
          gapDetected,
          gapSize,
          isRetransmission,
          sendingTime,
          details,
          raw: line,
          tagList: parsed.tagList
        });

        // Update expected sequence counter (if not handled by Reset)
        if (msgType !== '4') {
          expectedSeqs[dirKey] = Math.max(expectedSeqs[dirKey], seqNum) + 1;
        }
      });

      // Sort chronologically by time
      events.sort((a, b) => {
        if (!a.sendingTime || !b.sendingTime) return 0;
        return a.sendingTime.localeCompare(b.sendingTime);
      });

      setSessionEvents(events);
      setStats({
        totalSessionMsgs: events.length,
        gapsDetected: totalGaps,
        resendsRequested: totalResends,
        sequenceResets: totalResets
      });
      setIsProcessing(false);
      setShowSetup(false);
    }, 400);
  };

  // Filter events
  const visibleEvents = sessionEvents.filter(e => {
    if (hideHeartbeats && e.msgType === '0') return false;
    return true;
  });

  // Unique session names for column titles
  const getSessionActors = () => {
    if (sessionEvents.length === 0) return { client: 'CLIENT', server: 'SERVER' };
    const first = sessionEvents[0];
    return { client: first.sender, server: first.target };
  };

  const { client, server } = getSessionActors();

  const renderSetupPanel = () => (
    <div
      className="p-5 rounded-2xl border space-y-4 animate-in fade-in duration-200"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          Ingest Session Logs
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
              className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg cursor-pointer hover:bg-zinc-800/10 dark:hover:bg-zinc-855/20 transition-all text-center"
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
            placeholder="Paste raw session logs containing Logon, Logouts, Heartbeats, Sequence Resets..."
            rows={10}
            className="w-full fx-input resize-y"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        )}
      </div>

      <button
        onClick={handleReconstruct}
        disabled={isProcessing || !inputText.trim()}
        className="w-full fx-btn-primary justify-center font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
      >
        <GitBranch className="h-4 w-4" />
        <span>{isProcessing ? 'Reconstructing flow...' : 'Reconstruct session timeline'}</span>
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
              <GitBranch className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Session State Flow Reconstructor</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
              title="View help & usage guide"
            >
              <Info className="h-4 w-4" />
            </button>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Trace handshakes, sync heartbeats, discover sequence gaps, and visualize gap recovery flows chronologically.
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
            {/* Dashboard Layout */}
          {/* Telemetry Stats (Full Width) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="p-4 rounded-2xl border space-y-1"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">Control Msgs</p>
              <p className="text-xl font-mono font-extrabold text-[var(--foreground)]">{stats.totalSessionMsgs}</p>
            </div>
            <div
              className="p-4 rounded-2xl border space-y-1 animate-in fade-in"
              style={{ background: 'var(--card)', borderColor: stats.gapsDetected > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}
            >
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono">Gaps Detected</p>
              <p className="text-xl font-mono font-extrabold text-red-400">{stats.gapsDetected}</p>
            </div>
            <div
              className="p-4 rounded-2xl border space-y-1"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider font-mono">Resend Reqs</p>
              <p className="text-xl font-mono font-extrabold text-amber-500">{stats.resendsRequested}</p>
            </div>
            <div
              className="p-4 rounded-2xl border space-y-1"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Seq Resets</p>
              <p className="text-xl font-mono font-extrabold text-indigo-400">{stats.sequenceResets}</p>
            </div>
          </div>

          {/* Interactive Settings Card */}
          <div
            className="p-4 rounded-xl border flex flex-wrap items-center justify-start gap-6"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Viewing {visibleEvents.length} of {sessionEvents.length} session messages
            </span>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideHeartbeats}
                onChange={(e) => setHideHeartbeats(e.target.checked)}
                className="accent-[var(--primary)] h-4 w-4"
              />
              <span>Hide Heartbeats (35=0)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compactView}
                onChange={(e) => setCompactView(e.target.checked)}
                className="accent-[var(--primary)] h-4 w-4"
              />
              <span>Compact Flow Chart</span>
            </label>
          </div>

          {/* Vertical Flow Diagram Container */}
          <div
            className="p-5 rounded-2xl border min-h-[500px]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Timeline Header Actors */}
            <div className="grid grid-cols-3 text-center border-b pb-4 mb-8 font-mono text-xs font-bold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--foreground)' }}>
              <div className="bg-zinc-900/60 p-2.5 border border-zinc-800/40 rounded-lg truncate">{client}</div>
              <div className="flex items-center justify-center text-[var(--text-muted)] uppercase tracking-widest text-[9px]">Session Flow</div>
              <div className="bg-zinc-900/60 p-2.5 border border-zinc-800/40 rounded-lg truncate">{server}</div>
            </div>

            {/* Chronological Flow Rows */}
            <div className="space-y-6 relative before:absolute before:top-0 before:bottom-0 before:left-1/2 before:-translate-x-1/2 before:w-0.5 before:bg-zinc-800/60">
              {visibleEvents.map((event, idx) => {
                const isClientSender = event.sender === client;
                
                let bubbleBg = 'var(--background)';
                let borderCol = 'var(--border)';
                let textCol = 'var(--foreground)';

                if (event.gapDetected) {
                  bubbleBg = 'rgba(239, 68, 68, 0.08)';
                  borderCol = 'rgba(239, 68, 68, 0.3)';
                  textCol = '#ef4444';
                } else if (event.msgType === 'A') {
                  bubbleBg = 'var(--primary-faint)';
                  borderCol = 'var(--primary-border)';
                  textCol = 'var(--primary)';
                } else if (event.msgType === '2' || event.msgType === '4') {
                  bubbleBg = 'rgba(245, 158, 11, 0.08)';
                  borderCol = 'rgba(245, 158, 11, 0.3)';
                  textCol = '#f59e0b';
                }

                const isSelected = selectedEvent?.id === event.id;

                return (
                  <div key={event.id} className="relative space-y-2">
                    {/* Gap Alert prior to this sequence jump */}
                    {event.gapDetected && (
                      <div className="w-full flex justify-center z-10 relative">
                        <span className="px-3 py-1 rounded bg-red-950/40 border border-red-900/30 text-red-400 font-mono text-[9px] font-bold flex items-center gap-1.5 animate-bounce shadow-md">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>Sequence Gap Detected! Expected SeqNo: {event.expectedSeq}, Found: {event.seqNum} (+{event.gapSize})</span>
                        </span>
                      </div>
                    )}

                    {/* Retransmit alert indicator */}
                    {event.isRetransmission && (
                      <div className="w-full flex justify-center z-10 relative">
                        <span className="px-3 py-1 rounded bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 font-mono text-[9px] font-bold flex items-center gap-1.5 shadow-md">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>Retransmitted Message (PossDupFlag=Y)</span>
                        </span>
                      </div>
                    )}

                    {/* Direction Row */}
                    <div className="grid grid-cols-3 items-center relative min-h-12 z-10">
                      {/* Left client box (if sender) */}
                      <div className={`px-4 text-right ${isClientSender ? '' : 'opacity-0 select-none'}`}>
                        <span className="font-mono font-bold text-xs bg-zinc-950/60 py-1 px-2 border rounded border-zinc-900/50" style={{ color: 'var(--foreground)' }}>
                          Seq {event.seqNum}
                        </span>
                      </div>

                      {/* Mid arrow / message type card */}
                      <div className="flex flex-col items-center justify-center px-2">
                        <div
                          onClick={() => setSelectedEvent(event)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer select-none max-w-xs shadow-sm hover:scale-[1.03] ${isSelected ? 'scale-[1.03] shadow-md ring-1 ring-[var(--primary)]' : ''}`}
                          style={{ background: bubbleBg, borderColor: borderCol, color: textCol }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider font-mono">
                            {event.msgTypeName} (35={event.msgType})
                          </p>
                          {event.details && !compactView && (
                            <p className="text-[9px] opacity-80 mt-1 font-mono">{event.details}</p>
                          )}
                          <p className="text-[8px] opacity-50 font-mono mt-0.5">{event.sendingTime?.split('-')[1] || event.sendingTime}</p>
                        </div>
                        
                        {/* Directional arrow lines */}
                        <div className="flex items-center w-full justify-center mt-1.5 text-zinc-600">
                          {isClientSender ? (
                            <div className="flex items-center w-full justify-end max-w-[120px]">
                              <div className="h-0.5 bg-zinc-800/80 flex-1" />
                              <ArrowRight className="h-3 w-3 -ml-1 text-[var(--primary)] shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center w-full justify-start max-w-[120px]">
                              <ArrowLeft className="h-3 w-3 -mr-1 text-[var(--primary)] shrink-0" />
                              <div className="h-0.5 bg-zinc-800/80 flex-1" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right server box (if sender) */}
                      <div className={`px-4 text-left ${!isClientSender ? '' : 'opacity-0 select-none'}`}>
                        <span className="font-mono font-bold text-xs bg-zinc-950/60 py-1 px-2 border rounded border-zinc-900/50" style={{ color: 'var(--foreground)' }}>
                          Seq {event.seqNum}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sliding drawer details */}
          {selectedEvent && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setSelectedEvent(null)}
              />
              {/* Sliding sidebar */}
              <div
                className="fixed inset-y-0 right-0 w-full sm:w-[500px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b flex justify-between items-center bg-zinc-950/10" style={{ borderColor: 'var(--border-subtle)' }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--foreground)' }}>
                    Message Inspector
                  </h3>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="space-y-1 font-mono text-xs">
                    <p className="font-bold text-[var(--primary)] text-sm">
                      {selectedEvent.msgTypeName} (Seq {selectedEvent.seqNum})
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] pt-0.5">
                      Sender: {selectedEvent.sender} → Target: {selectedEvent.target}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Time: {selectedEvent.sendingTime || 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Parsed Tags</p>
                    <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 border rounded-lg p-2 bg-zinc-950/10" style={{ borderColor: 'var(--border)' }}>
                      {selectedEvent.tagList.map((f, i) => (
                        <div key={i} className="flex justify-between font-mono text-[10px] py-1 border-b border-zinc-900/20" style={{ color: 'var(--foreground)' }}>
                          <span className="text-[var(--primary)] font-bold">{f.tag} ({f.name}):</span>
                          <span className="truncate max-w-[200px] font-extrabold text-[var(--foreground)]" title={f.meaning}>{f.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Raw string</p>
                    <pre className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg font-mono text-[9px] leading-relaxed break-all whitespace-pre-wrap select-all text-[var(--text-muted)]">
                      {selectedEvent.raw}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          )}
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
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Usage &amp; Help Guide</h3>
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
                <p className="font-bold text-[var(--foreground)]">What is the Session State Flow Reconstructor?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  This tool traces and charts chronological sequence-syncing handshakes, heartbeats, gaps, and gap recovery sequences bidirectionally from raw session logs. It plots actors (Client and Server) on a sequence diagram.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">How to use:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Upload / Paste Logs:</strong> Select the File tab to upload a file (automatically processed) or Paste tab to paste text and click "Reconstruct session timeline".</li>
                  <li><strong>Sequence Syncing KPIs:</strong> Review telemetry metrics summarizing Control Messages, Resend Requests, Sequence Resets, and Gaps.</li>
                  <li><strong>Chronological SVG Flow:</strong> Review the message routing chart showing arrow directions, sequence numbers, and timestamps between actors.</li>
                  <li><strong>Gap &amp; Retransmit highlights:</strong> Expected vs found sequence jumps are flagged in red. Retransmitted messages (PossDupFlag=Y) are flagged in indigo.</li>
                  <li><strong>Interactive Node Inspector:</strong> Click any message block in the timeline flowchart to trigger the Message Inspector sidebar drawer detailing all parsed tags.</li>
                  <li><strong>View settings:</strong> Toggle heartbeats or enable "Compact Flow Chart" to hide details and view a high-density diagram.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
