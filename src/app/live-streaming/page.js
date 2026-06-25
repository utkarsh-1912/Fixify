'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Play, 
  Square, 
  Pause, 
  ShieldAlert, 
  Activity, 
  Wifi, 
  WifiOff, 
  ChevronRight, 
  ChevronDown,
  Eye,
  EyeOff,
  Info, 
  RotateCcw,
  Sliders,
  Settings,
  X,
  Maximize2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { validateFIXMessage } from '@/lib/fixParser';
import SohVisualizer from "@/components/SohVisualizer";

export default function LiveStreamingPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [feedLogs, setFeedLogs] = useState([]);
  const [sessionState, setSessionState] = useState("DISCONNECTED");
  const [profile, setProfile] = useState("order-gateway");
  const [stats, setStats] = useState({ receivedCount: 0, gapDetections: 0, avgLatency: 0 });
  const [timelinePoints, setTimelinePoints] = useState([]);
  
  // Real-time WebSocket connection states
  const [connectionMode, setConnectionMode] = useState("simulated"); // "simulated" | "websocket"
  const [wsUrl, setWsUrl] = useState("ws://localhost:8080");
  const wsRef = useRef(null);
  const expectedSeqNumRef = useRef(1);
  
  // Custom states for modals, hover tooltips, and timeout stop safeguard
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [selectedLogMsg, setSelectedLogMsg] = useState(null);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(10);
  const [showPayload, setShowPayload] = useState(false);
  
  // 5-minute activity check — wall-clock timer (not message-count based)
  const ACTIVITY_CHECK_MS = 5 * 60 * 1000; // 300 000 ms
  const timerRef = useRef(null);
  const activityTimerRef = useRef(null); // fires after ACTIVITY_CHECK_MS
  const countdownIntervalRef = useRef(null);
  const seqNumRef = useRef(1);
  const isPausedRef = useRef(false); // mirrors isPaused state for use inside setInterval
  const logsEndRef = useRef(null);

  useEffect(() => {
    return () => {
      stopFeed();
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Sync scrolling of logs console
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feedLogs]);

  // Keep isPausedRef in sync so setInterval closures always read the latest value
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Handle countdown timer for auto-stop confirm modal
  useEffect(() => {
    if (showConfirmModal) {
      setConfirmCountdown(10);
      countdownIntervalRef.current = setInterval(() => {
        setConfirmCountdown(prev => {
          if (prev <= 1) {
            // Timeout reached! Auto stop the feed
            clearInterval(countdownIntervalRef.current);
            setShowConfirmModal(false);
            stopFeed();
            setSessionState("INACTIVE_TIMEOUT");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showConfirmModal]);

  // Schedule the 5-minute activity check
  const scheduleActivityCheck = () => {
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => {
      setShowConfirmModal(true);
    }, ACTIVITY_CHECK_MS);
  };

  const handleIncomingRawMessage = (rawMsg, customLatency = null, customGap = null) => {
    if (!rawMsg || !rawMsg.trim()) return;
    const parsed = validateFIXMessage(rawMsg);
    if (!parsed) return;

    const msgType = parsed.tags['35'] || '0';
    const msgName = parsed.msgTypeName || 'Unknown';
    const seqNum = parseInt(parsed.tags['34'] || '0', 10);

    let latency = customLatency;
    if (latency === null) {
      latency = 5;
      const sendingTimeStr = parsed.tags['52'];
      if (sendingTimeStr) {
        try {
          let date = null;
          if (sendingTimeStr.includes('-')) {
            const timePart = sendingTimeStr.split('-')[1];
            if (timePart) {
              const [hh, mm, ss] = timePart.split(':');
              const [sec, ms] = ss.split('.');
              date = new Date();
              date.setUTCHours(parseInt(hh, 10));
              date.setUTCMinutes(parseInt(mm, 10));
              date.setUTCSeconds(parseInt(sec, 10));
              date.setUTCMilliseconds(parseInt(ms || '0', 10));
            }
          } else {
            date = new Date(sendingTimeStr);
          }
          if (date && !isNaN(date.getTime())) {
            const diff = Date.now() - date.getTime();
            if (diff > 0 && diff < 100000) {
              latency = diff;
            }
          }
        } catch (e) {}
      }
    }

    let isGap = customGap;
    if (isGap === null) {
      isGap = false;
      if (expectedSeqNumRef.current > 1 && seqNum > expectedSeqNumRef.current) {
        isGap = true;
      }
      expectedSeqNumRef.current = seqNum + 1;
    }

    const logItem = {
      time: new Date().toLocaleTimeString(),
      seqNum,
      msgType,
      msgName,
      latency,
      isGap,
      raw: rawMsg
    };

    setFeedLogs(prev => [...prev.slice(-29), logItem]);
    setTimelinePoints(prev => {
      const lastX = prev.length > 0 ? prev[prev.length - 1].x : 0;
      return [...prev.slice(-29), { x: lastX + 1, y: latency, isGap, msgType }];
    });
    setStats(prev => {
      const count = prev.receivedCount + 1;
      const totalLat = prev.avgLatency * prev.receivedCount + latency;
      return {
        receivedCount: count,
        gapDetections: prev.gapDetections + (isGap ? 1 : 0),
        avgLatency: parseFloat((totalLat / count).toFixed(2))
      };
    });
  };

  const startFeed = () => {
    setIsRunning(true);
    setIsPaused(false);
    setFeedLogs([]);
    setTimelinePoints([]);
    setStats({ receivedCount: 0, gapDetections: 0, avgLatency: 0 });
    seqNumRef.current = 1;
    expectedSeqNumRef.current = 1;

    scheduleActivityCheck();

    if (connectionMode === "websocket") {
      setSessionState("CONNECTING");
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setSessionState("ESTABLISHED");
        };

        ws.onmessage = (event) => {
          if (isPausedRef.current || showConfirmModal) return;
          handleIncomingRawMessage(event.data);
        };

        ws.onerror = () => {
          setSessionState("ERROR");
        };

        ws.onclose = () => {
          setSessionState("DISCONNECTED");
          setIsRunning(false);
        };
      } catch (err) {
        setSessionState("ERROR");
        setIsRunning(false);
        alert("WebSocket Connection Failed: " + err.message);
      }
    } else {
      setSessionState("CONNECTING");
      let step = 0;
      timerRef.current = setInterval(() => {
        if (isPausedRef.current || showConfirmModal) return;

        step++;

        let newMsg = "";
        let latency = 5;
        let msgType = "0";
        let msgName = "Heartbeat";

        if (profile === "market-data") {
          latency = Math.floor(Math.random() * 4) + 1; // 1-4ms
        } else if (profile === "drop-copy") {
          latency = Math.floor(Math.random() * 20) + 20; // 20-39ms
        } else {
          latency = Math.floor(Math.random() * 8) + 5; // 5-12ms standard order-gateway
        }

        if (step === 1) {
          setSessionState("LOGON_SENT");
          msgType = "A";
          msgName = "Logon Initiated";
          newMsg = `8=FIX.4.4|9=72|35=A|34=${seqNumRef.current}|49=LIVE_CLIENT|56=TEST_GATEWAY|52=${new Date().toISOString()}|98=0|108=30|10=180|`;
        } else if (step === 2) {
          setSessionState("ESTABLISHED");
          msgType = "A";
          msgName = "Logon Established (Acceptor Reply)";
          newMsg = `8=FIX.4.4|9=72|35=A|34=1|49=TEST_GATEWAY|56=LIVE_CLIENT|52=${new Date().toISOString()}|98=0|108=30|10=182|`;
          seqNumRef.current--; // Keep align seq
        } else {
          const roll = Math.random();
          
          if (profile === "market-data") {
            if (roll < 0.25) {
              msgType = "0";
              msgName = "Heartbeat";
              newMsg = `8=FIX.4.4|9=60|35=0|34=${seqNumRef.current}|49=MD_FEED|56=LIVE_CLIENT|52=${new Date().toISOString()}|10=114|`;
            } else {
              msgType = "X";
              msgName = "Market Data Incremental Refresh";
              const bid = (180 + Math.random() * 10).toFixed(2);
              const ask = (parseFloat(bid) + 0.05).toFixed(2);
              newMsg = `8=FIX.4.4|9=152|35=X|34=${seqNumRef.current}|49=MD_FEED|56=LIVE_CLIENT|52=${new Date().toISOString()}|262=MD_REQ_1|268=2|269=0|270=${bid}|271=100|269=1|270=${ask}|271=150|10=199|`;
            }
          } else if (profile === "drop-copy") {
            if (roll < 0.2) {
              msgType = "0";
              msgName = "Heartbeat";
              newMsg = `8=FIX.4.4|9=60|35=0|34=${seqNumRef.current}|49=DROP_COPY|56=LIVE_CLIENT|52=${new Date().toISOString()}|10=114|`;
            } else {
              msgType = "8";
              msgName = "Execution Report (Drop Copy Allocation)";
              latency += Math.floor(Math.random() * 15);
              const prc = (120 + Math.random() * 15).toFixed(2);
              newMsg = `8=FIX.4.4|9=162|35=8|34=${seqNumRef.current}|49=DROP_COPY|56=LIVE_CLIENT|52=${new Date().toISOString()}|37=DC_${Date.now()}|17=E_${Date.now()}|150=F|39=2|55=MSFT|38=200|32=200|31=${prc}|10=210|`;
            }
          } else {
            if (roll < 0.35) {
              msgType = "0";
              msgName = "Heartbeat";
              newMsg = `8=FIX.4.4|9=60|35=0|34=${seqNumRef.current}|49=LIVE_CLIENT|56=TEST_GATEWAY|52=${new Date().toISOString()}|10=114|`;
            } else if (roll < 0.7) {
              msgType = "D";
              msgName = "New Order Single";
              const qty = [100, 200, 500, 1000][Math.floor(Math.random() * 4)];
              const prc = (150 + Math.random() * 30).toFixed(2);
              newMsg = `8=FIX.4.4|9=120|35=D|34=${seqNumRef.current}|49=LIVE_CLIENT|56=TEST_GATEWAY|52=${new Date().toISOString()}|11=CL_${Date.now()}|55=AAPL|54=1|38=${qty}|44=${prc}|40=2|10=044|`;
            } else {
              msgType = "8";
              msgName = "Execution Report (Trade Fill)";
              latency += Math.floor(Math.random() * 10) + 5;
              const prc = (150 + Math.random() * 30).toFixed(2);
              newMsg = `8=FIX.4.4|9=140|35=8|34=${seqNumRef.current}|49=TEST_GATEWAY|56=LIVE_CLIENT|52=${new Date().toISOString()}|37=O_${Date.now()}|17=E_${Date.now()}|150=F|39=2|55=AAPL|38=100|32=100|31=${prc}|10=190|`;
            }
          }
        }

        let isGap = false;
        if (step > 4 && step % 12 === 0) {
          seqNumRef.current += 3; // artificial gap
          isGap = true;
        }

        handleIncomingRawMessage(newMsg, latency, isGap);
        seqNumRef.current++;
      }, 1500);
    }
  };

  const stopFeed = () => {
    setIsRunning(false);
    setIsPaused(false);
    setSessionState("DISCONNECTED");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    stopFeed();
    setFeedLogs([]);
    setTimelinePoints([]);
    seqNumRef.current = 1;
    expectedSeqNumRef.current = 1;
    setStats({ receivedCount: 0, gapDetections: 0, avgLatency: 0 });
  };

  const handleConfirmContinue = () => {
    setShowConfirmModal(false);
    // Reset the 5-min watchdog so the user gets a fresh window
    scheduleActivityCheck();
  };

  const renderSVGChart = (w = 500, h = 80) => {
    const paddingLeft = 35;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;
    const chartWidth = w - paddingLeft - paddingRight;
    const chartHeight = h - paddingTop - paddingBottom;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible select-none">
        {/* Grid background lines & Y axis ticks */}
        {[0, 10, 20, 30, 40, 50].map((val) => {
          const y = (h - paddingBottom) - (val / 50) * chartHeight;
          return (
            <g key={val}>
              <line x1={paddingLeft} y1={y} x2={w - paddingRight} y2={y} stroke="#18181b" strokeWidth="1" strokeDasharray="3 3" />
              <text x={paddingLeft - 5} y={y + 3} textAnchor="end" fill="#52525b" className="text-[8px] font-mono font-semibold">
                {val}ms
              </text>
            </g>
          );
        })}
        
        {/* X Axis line */}
        <line x1={paddingLeft} y1={h - paddingBottom} x2={w - paddingRight} y2={h - paddingBottom} stroke="var(--border)" strokeWidth="1.5" />
        
        {timelinePoints.length > 0 ? (
          <>
            {/* SVG Path representing latency curve */}
            <path
              d={`M ${timelinePoints.map((pt, i) => `${paddingLeft + (i / Math.max(1, timelinePoints.length - 1)) * chartWidth},${(h - paddingBottom) - (pt.y / 50) * chartHeight}`).join(' L ')}`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              className="transition-all duration-300"
            />

            {/* Scatter dots */}
            {timelinePoints.map((pt, i) => {
              const xPos = paddingLeft + (i / Math.max(1, timelinePoints.length - 1)) * chartWidth;
              const yPos = (h - paddingBottom) - (pt.y / 50) * chartHeight;
              return (
                <circle
                  key={i}
                  cx={xPos}
                  cy={yPos}
                  r={pt.isGap ? "3.5" : "2.5"}
                  fill={pt.isGap ? "#ef4444" : "var(--background)"}
                  stroke={pt.isGap ? "#ef4444" : "var(--primary)"}
                  strokeWidth="1.5"
                  className="transition-all cursor-pointer hover:scale-150"
                  onMouseEnter={() => {
                    setHoveredPoint({
                      x: xPos,
                      y: yPos,
                      latency: pt.y,
                      msgType: pt.msgType
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}
          </>
        ) : null}
        
        <text x={paddingLeft + chartWidth / 2} y={h - 3} textAnchor="middle" fill="#52525b" className="text-[8px] font-mono font-semibold uppercase tracking-wider">
          Chronological Message Sequence Timeline (Last 30)
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Header with Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight flex flex-wrap items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Radio className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Live Session Socket Feed Simulator</span>
            
            {/* Relocated Connection Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ml-1.5 transition-all uppercase tracking-wider"
              style={{
                borderColor: sessionState === "ESTABLISHED" ? 'rgba(34, 197, 94, 0.3)' : sessionState === "CONNECTING" || sessionState === "LOGON_SENT" ? 'rgba(234, 179, 8, 0.3)' : 'var(--border)',
                background: sessionState === "ESTABLISHED" ? 'rgba(34, 197, 94, 0.08)' : sessionState === "CONNECTING" || sessionState === "LOGON_SENT" ? 'rgba(234, 179, 8, 0.08)' : 'var(--background)',
                color: sessionState === "ESTABLISHED" ? '#22c55e' : sessionState === "CONNECTING" || sessionState === "LOGON_SENT" ? '#eab308' : sessionState === "INACTIVE_TIMEOUT" ? '#ef4444' : 'var(--text-muted)'
              }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sessionState === "ESTABLISHED" ? 'bg-green-500 animate-pulse' : sessionState === "CONNECTING" || sessionState === "LOGON_SENT" ? 'bg-yellow-500 animate-pulse' : sessionState === "INACTIVE_TIMEOUT" ? 'bg-red-500 animate-ping' : 'bg-zinc-600'}`} />
              {sessionState === "INACTIVE_TIMEOUT" ? "STOPPED (TIMEOUT)" : sessionState}
            </div>
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Monitor dynamic real-time simulated FIX session traffic and observe processing sequence gaps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        
        {/* Connection Control Console */}
        <div
          className="p-5 rounded-2xl border space-y-4 lg:col-span-1 h-fit"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Connection Mode Toggle */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">Connection Mode:</span>
            <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                disabled={isRunning}
                onClick={() => setConnectionMode("simulated")}
                className={`py-1 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                  connectionMode === "simulated" 
                    ? "bg-[var(--primary)] text-zinc-950 font-bold" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Simulation
              </button>
              <button
                disabled={isRunning}
                onClick={() => setConnectionMode("websocket")}
                className={`py-1 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                  connectionMode === "websocket" 
                    ? "bg-[var(--primary)] text-zinc-950 font-bold" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                WebSocket
              </button>
            </div>
          </div>

          {connectionMode === "simulated" ? (
            /* Presets Profile Selector */
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">Session Profile:</span>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                disabled={isRunning}
                className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-2 outline-none focus:border-zinc-700 text-zinc-350"
              >
                <option value="order-gateway">Order Routing (Balanced)</option>
                <option value="market-data">Market Data Feed (Fast)</option>
                <option value="drop-copy">Drop Copy Allocation (Spiky)</option>
              </select>
            </div>
          ) : (
            /* WebSocket Connection Config */
            <div className="space-y-2 animate-fade-in">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">WebSocket URL:</span>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                disabled={isRunning}
                className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-2 outline-none focus:border-zinc-750 text-zinc-300"
                placeholder="ws://localhost:8080"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {!isRunning ? (
              <button
                onClick={startFeed}
                className="fx-btn-primary w-full justify-center py-2"
              >
                <Play className="h-4 w-4" /> Start Feed
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={togglePause}
                  className="fx-btn-secondary flex-1 justify-center py-2 text-xs font-semibold"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={stopFeed}
                  className="fx-btn-secondary flex-1 justify-center py-2 border-red-900/30 text-red-400 bg-red-950/10 hover:bg-red-950/20 text-xs font-semibold"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              </div>
            )}
            <button
              onClick={handleReset}
              className="fx-btn-secondary w-full justify-center py-2 border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold"
            >
              <RotateCcw className="h-4 w-4" /> Reset Session
            </button>
          </div>

          {/* Stats Summary */}
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block font-mono">Telemetry Data:</span>
            <div className="space-y-1.5 text-xs font-mono text-zinc-400">
              <div className="flex justify-between"><span>Received count:</span> <span className="font-bold text-zinc-200">{stats.receivedCount}</span></div>
              <div className="flex justify-between"><span>Sequence gaps:</span> <span className="font-bold text-red-400">{stats.gapDetections}</span></div>
              <div className="flex justify-between"><span>Avg latency:</span> <span className="font-bold text-[var(--primary)]">{stats.avgLatency} ms</span></div>
            </div>
          </div>
        </div>

        {/* Real-time Streaming Graph and Console Panel */}
        <div className="lg:col-span-3 space-y-4 w-full">
          
          {/* Real-time latency chart */}
          <div
            className="p-5 rounded-2xl border space-y-3 relative overflow-visible"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--primary)]">Live Processing Latency Timeline</span>
                <button
                  onClick={() => setChartExpanded(true)}
                  title="Expand Chart View"
                  className="p-1 rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-500">
                <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> Latency</div>
                <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Sequence Gap</div>
              </div>
            </div>

            {/* Line chart timeline visualizer */}
            <div className="h-36 bg-zinc-950/40 rounded-lg border border-zinc-900 flex items-center justify-center p-2 relative overflow-visible" style={{ borderColor: 'var(--border-subtle)' }}>
              {timelinePoints.length > 0 ? (
                renderSVGChart(500, 110)
              ) : (
                <span className="text-[10px] text-zinc-500 font-mono italic">Start feed to stream latency timeline...</span>
              )}

              {/* Floating Tooltip inside SVG container */}
              {hoveredPoint && (
                <div 
                  className="absolute z-30 p-2.5 rounded-xl border text-[9px] font-mono shadow-2xl bg-zinc-950/95 backdrop-blur-md pointer-events-none"
                  style={{
                    left: `${(hoveredPoint.x / 500) * 100}%`,
                    top: `${(hoveredPoint.y / 110) * 100 - 32}%`,
                    transform: 'translateX(-50%)',
                    borderColor: 'var(--primary-border)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <div className="font-bold text-zinc-100">Latency: <span className="text-[var(--primary)]">{hoveredPoint.latency}ms</span></div>
                  <div>Type: <span className="text-zinc-400">{
                    hoveredPoint.msgType === 'A' ? 'Logon (35=A)' :
                    hoveredPoint.msgType === '0' ? 'Heartbeat (35=0)' :
                    hoveredPoint.msgType === 'D' ? 'NewOrder (35=D)' :
                    hoveredPoint.msgType === '8' ? 'ExecReport (35=8)' :
                    hoveredPoint.msgType === 'X' ? 'MarketData (35=X)' : `Type=${hoveredPoint.msgType}`
                  }</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Scrolling log console */}
          <div
            className="p-5 rounded-2xl border space-y-3 flex flex-col animate-in fade-in duration-300"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', height: '42vh' }}
          >
            <div className="flex justify-between items-center pb-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--primary)]">Live Feed Log Stream</span>
              <span className="text-[9px] font-mono text-zinc-500 italic">Memory Autoprune Active (showing last 30 logs)</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] font-mono text-zinc-400 scrollbar-thin">
              {feedLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 italic">
                  Console idle. Press Start Feed to capture live network log signals.
                </div>
              ) : (
                feedLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setSelectedLogMsg(log); setShowPayload(false); }}
                    className="space-y-0.5 border-b pb-1 last:border-0 hover:bg-zinc-950/30 p-1.5 rounded-lg transition-all cursor-pointer border-transparent" 
                    style={{ borderColor: 'var(--border-subtle)' }}
                    title="Click to view message tags details modal"
                  >
                    <div className="flex items-center justify-between text-zinc-500 text-[9px]">
                      <span>{log.time}</span>
                      <div className="flex gap-2">
                        {log.isGap && (
                          <span className="text-[8px] px-1 bg-red-950 text-red-500 border border-red-900/40 rounded font-bold uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <ShieldAlert className="h-2.5 w-2.5" /> Gap Alert
                          </span>
                        )}
                        <span>Seq #{log.seqNum}</span>
                        <span style={{ color: log.latency > 25 ? '#ef4444' : log.latency > 12 ? '#fbbf24' : 'var(--primary)' }}>+{log.latency}ms</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 shrink-0 text-zinc-600 mt-0.5" />
                      <span className="text-zinc-200 font-semibold">{log.msgName}</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 break-all pl-4 truncate">{log.raw}</p>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>

      {/* ─── MODAL 1: Message Details Inspector ────────────────────────── */}
      {selectedLogMsg && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedLogMsg(null)}>
          <div className="w-full max-w-xl rounded-2xl border flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-200" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-[var(--primary)]" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-200">
                  Message Details (Seq #{selectedLogMsg.seqNum})
                </h3>
              </div>
              <button onClick={() => setSelectedLogMsg(null)} className="p-1 rounded hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono border-b pb-3" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <div>Name: <span className="font-bold text-zinc-200">{selectedLogMsg.msgName}</span></div>
                <div>Time: <span className="text-zinc-300">{selectedLogMsg.time}</span></div>
                <div>MsgType: <span className="text-zinc-300">Tag 35={selectedLogMsg.msgType}</span></div>
                <div>Latency: <span className="text-[var(--primary)] font-bold">+{selectedLogMsg.latency}ms</span></div>
              </div>

              <div className="space-y-1">
                <button
                  className="flex items-center gap-1.5 w-full text-left"
                  onClick={() => setShowPayload(p => !p)}
                >
                  {showPayload
                    ? <EyeOff className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                    : <Eye className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  }
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Raw Payload</span>
                </button>
                {showPayload && (
                  <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-900 select-all overflow-y-auto max-h-36">
                    <SohVisualizer content={selectedLogMsg.raw} />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Parsed tag-value mappings:</span>
                <div className="border border-zinc-900 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-4 bg-zinc-950/40 p-2 text-[9px] font-mono text-zinc-500 font-bold border-b border-zinc-900">
                    <div>Tag</div>
                    <div>Field Name</div>
                    <div>Value</div>
                    <div>Description/Meaning</div>
                  </div>
                  <div className="divide-y divide-zinc-900 text-[10px] max-h-48 overflow-y-auto">
                    {(() => {
                      const parsed = validateFIXMessage(selectedLogMsg.raw);
                      if (!parsed || !parsed.tagList) return <div className="p-3 text-center text-zinc-600 italic">No tags parsed</div>;
                      return parsed.tagList.map(tagItem => (
                        <div key={tagItem.tag} className="grid grid-cols-4 p-2 font-mono hover:bg-zinc-900/10">
                          <div className="font-bold text-[var(--primary)]">{tagItem.tag}</div>
                          <div className="text-zinc-400">{tagItem.name}</div>
                          <div className="text-zinc-300 break-all pr-1 select-all">{tagItem.val}</div>
                          <div className="text-zinc-500 italic">{tagItem.meaning || '-'}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Expanded Chart Overlay ────────────────────────── */}
      {chartExpanded && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setChartExpanded(false)}>
          <div className="w-full max-w-4xl rounded-2xl border flex flex-col p-6 animate-in zoom-in-95 duration-200 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-[var(--primary)]" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                  Latency Timeline Analysis View (Log Scale Details)
                </span>
              </div>
              <button onClick={() => setChartExpanded(false)} className="p-1 rounded hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="h-72 bg-zinc-950/50 rounded-xl border border-zinc-900 flex items-center justify-center p-4 relative overflow-visible">
              {renderSVGChart(800, 240)}
              
              {/* Detailed floating hover tooltip in expanded modal */}
              {hoveredPoint && (
                <div 
                  className="absolute z-30 p-2.5 rounded-xl border text-[10px] font-mono shadow-2xl bg-zinc-950"
                  style={{
                    left: `${(hoveredPoint.x / 800) * 100}%`,
                    top: `${(hoveredPoint.y / 240) * 100 - 24}%`,
                    transform: 'translateX(-50%)',
                    borderColor: 'var(--primary-border)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <div className="font-bold text-zinc-100">Latency Value: <span className="text-[var(--primary)]">{hoveredPoint.latency}ms</span></div>
                  <div>Message Type: <span className="text-zinc-400">{
                    hoveredPoint.msgType === 'A' ? 'Logon (35=A)' :
                    hoveredPoint.msgType === '0' ? 'Heartbeat (35=0)' :
                    hoveredPoint.msgType === 'D' ? 'NewOrder (35=D)' :
                    hoveredPoint.msgType === '8' ? 'ExecReport (35=8)' :
                    hoveredPoint.msgType === 'X' ? 'MarketData (35=X)' : `Type=${hoveredPoint.msgType}`
                  }</span></div>
                </div>
              )}
            </div>
            
            <div className="p-3 text-[10px] font-mono text-zinc-500 bg-zinc-950/30 rounded-lg flex justify-between">
              <span>Timeline displays the latency points of the last 30 socket messages.</span>
              <span>Average Session Latency: {stats.avgLatency} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Overuse / Activity Stopper Safeguard Prompt ───────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border p-6 text-center space-y-4 animate-in zoom-in-95 duration-200" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-full bg-amber-950/40 text-amber-500 border border-amber-900/40 flex items-center justify-center mx-auto mb-2 animate-bounce">
              <AlertCircle className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-mono">
                Still Monitoring Feed?
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                To prevent background CPU and memory misuse, please confirm you are still observing the simulated socket connection.
              </p>
            </div>

            <div className="p-2 bg-zinc-950/40 rounded-lg border border-zinc-900 text-xs font-mono text-red-400">
              Disconnecting automatically in <span className="font-bold text-sm text-red-500 animate-pulse">{confirmCountdown}</span> seconds
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleConfirmContinue}
                className="fx-btn-primary flex-1 justify-center py-2 text-xs font-semibold"
              >
                Continue Stream
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  stopFeed();
                }}
                className="fx-btn-secondary flex-1 justify-center py-2 border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold"
              >
                Disconnect Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
