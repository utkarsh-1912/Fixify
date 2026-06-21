"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  Trash2,
  Clock,
  Zap,
  Activity,
  ArrowRightLeft,
  Search,
  Info,
  Download,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import SohVisualizer from "@/components/SohVisualizer";
// Standard parser helpers specifically for latency tracking
function extractTagValue(line, tag, delimiter = "|") {
  if (!line) return "";
  const rx = new RegExp(`(?:^|${escapeRegExp(delimiter)})${tag}=([^${escapeRegExp(delimiter)}]+)`);
  const match = line.match(rx);
  return match ? match[1] : "";
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMsgTypeName(msgType) {
  const types = {
    "0": "Heartbeat",
    "1": "Test Request",
    "2": "Resend Request",
    "3": "Reject",
    "4": "Sequence Reset",
    "5": "Logout",
    "8": "Execution Report",
    "9": "Order Cancel Reject",
    "A": "Logon",
    "D": "New Order Single",
    "F": "Order Cancel Request",
    "G": "Order Cancel/Replace Request",
    "H": "Order Status Request",
    "J": "Allocation Instruction",
    "W": "Market Data Snapshot",
    "X": "Market Data Incremental"
  };
  return types[msgType] || `Other (${msgType})`;
}

// Parse FIX Timestamp to absolute microseconds since epoch
function parseFixTimestampToMicroseconds(ts) {
  if (!ts) return null;
  // Match YYYYMMDD-HH:MM:SS.ssssss or HH:MM:SS.ssssss or YYYYMMDD-HH:MM:SS.sss
  const match = ts.match(/^(?:(\d{4})(\d{2})(\d{2})-)?(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return null;

  const year = match[1] ? parseInt(match[1], 10) : 2026;
  const month = match[2] ? parseInt(match[2], 10) - 1 : 0;
  const day = match[3] ? parseInt(match[3], 10) : 1;
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = parseInt(match[6], 10);

  let microseconds = 0;
  let milliseconds = 0;
  if (match[7]) {
    const fraction = match[7];
    const microstr = fraction.padEnd(6, '0').slice(0, 6);
    microseconds = parseInt(microstr, 10);
    milliseconds = Math.floor(microseconds / 1000);
  }

  // Construct UTC date
  const dateObj = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
  const epochMs = dateObj.getTime();
  if (isNaN(epochMs)) return null;

  const totalMicroseconds = (epochMs * 1000) + (microseconds % 1000);
  return {
    totalMicroseconds,
    dateObj,
    formattedTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${microseconds.toString().padStart(6, '0')}`
  };
}

const SAMPLE_LATENCY_LOGS = `8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1001|52=20260613-12:00:00.100120|11=ORD_9901|55=AAPL|54=1|60=20260613-12:00:00.102340|38=500|44=175.50|10=220|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2001|52=20260613-12:00:00.106550|37=EX_019|11=ORD_9901|17=EXEC_01|20=0|150=0|39=0|55=AAPL|54=1|38=500|60=20260613-12:00:00.104210|10=185|
8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1002|52=20260613-12:00:01.250440|11=ORD_9902|55=MSFT|54=2|60=20260613-12:00:01.254180|38=200|44=420.20|10=210|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2002|52=20260613-12:00:01.258900|37=EX_020|11=ORD_9902|17=EXEC_02|20=0|150=2|39=2|55=MSFT|54=2|38=200|60=20260613-12:00:01.256880|10=190|
8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1003|52=20260613-12:00:02.500210|11=ORD_9903|55=NVDA|54=1|60=20260613-12:00:02.508540|38=1000|44=125.00|10=205|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2003|52=20260613-12:00:02.515900|37=EX_021|11=ORD_9903|17=EXEC_03|20=0|150=0|39=0|55=NVDA|54=1|38=1000|60=20260613-12:00:02.511300|10=195|
8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1004|52=20260613-12:00:04.110500|11=ORD_9904|55=TSLA|54=1|60=20260613-12:00:04.112150|38=100|44=180.10|10=200|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2004|52=20260613-12:00:04.118200|37=EX_022|11=ORD_9904|17=EXEC_04|20=0|150=0|39=0|55=TSLA|54=1|38=100|60=20260613-12:00:04.115890|10=180|
8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1005|52=20260613-12:00:06.880150|11=ORD_9905|55=GOOGL|54=2|60=20260613-12:00:06.885600|38=150|44=170.80|10=205|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2005|52=20260613-12:00:06.892400|37=EX_023|11=ORD_9905|17=EXEC_05|20=0|150=2|39=2|55=GOOGL|54=2|38=150|60=20260613-12:00:06.889330|10=185|
8=FIX.4.4|9=112|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1006|52=20260613-12:00:09.115200|11=ORD_9906|55=MSFT|54=1|60=20260613-12:00:09.119100|38=300|44=421.00|10=200|
8=FIX.4.4|9=145|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2006|52=20260613-12:00:09.123500|37=EX_024|11=ORD_9906|17=EXEC_06|20=0|150=0|39=0|55=MSFT|54=1|38=300|60=20260613-12:00:09.121000|10=180|`;

const WORKER_CODE = `
  function escapeRegExp(string) {
    return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  }

  function extractTagValue(line, tag, delimiter) {
    if (!line) return "";
    const rx = new RegExp("(?:^|" + escapeRegExp(delimiter) + ")" + tag + "=([^" + escapeRegExp(delimiter) + "]+)");
    const match = line.match(rx);
    return match ? match[1] : "";
  }

  function getMsgTypeName(msgType) {
    const types = {
      "0": "Heartbeat",
      "1": "Test Request",
      "2": "Resend Request",
      "3": "Reject",
      "4": "Sequence Reset",
      "5": "Logout",
      "8": "Execution Report",
      "9": "Order Cancel Reject",
      "A": "Logon",
      "D": "New Order Single",
      "F": "Order Cancel Request",
      "G": "Order Cancel/Replace Request",
      "H": "Order Status Request",
      "J": "Allocation Instruction",
      "W": "Market Data Snapshot",
      "X": "Market Data Incremental"
    };
    return types[msgType] || "Other (" + msgType + ")";
  }

  function parseFixTimestampToMicroseconds(ts) {
    if (!ts) return null;
    const match = ts.match(/^(?:([0-9]{4})([0-9]{2})([0-9]{2})-)?([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.([0-9]+))?$/);
    if (!match) return null;

    const year = match[1] ? parseInt(match[1], 10) : 2026;
    const month = match[2] ? parseInt(match[2], 10) - 1 : 0;
    const day = match[3] ? parseInt(match[3], 10) : 1;
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = parseInt(match[6], 10);

    let microseconds = 0;
    let milliseconds = 0;
    if (match[7]) {
      const fraction = match[7];
      const microstr = fraction.padEnd(6, '0').slice(0, 6);
      microseconds = parseInt(microstr, 10);
      milliseconds = Math.floor(microseconds / 1000);
    }

    const epochMs = Date.UTC(year, month, day, hours, minutes, seconds, milliseconds);
    if (isNaN(epochMs)) return null;

    const totalMicroseconds = (epochMs * 1000) + (microseconds % 1000);
    return {
      totalMicroseconds,
      formattedTime: hours.toString().padStart(2, '0') + ":" + minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0') + "." + microseconds.toString().padStart(6, '0')
    };
  }

  self.onmessage = function(e) {
    const { rawLogsText, delimiter } = e.data;
    if (!rawLogsText || !rawLogsText.trim()) {
      self.postMessage({ messages: [], pairs: [], stats: {} });
      return;
    }
    const lines = rawLogsText.split(/\\r?\\n/).filter(Boolean);
    const messages = [];
    const clOrdIdMap = {};

    lines.forEach((line, index) => {
      const msgType = extractTagValue(line, "35", delimiter);
      const sendingTimeVal = extractTagValue(line, "52", delimiter);
      const transactTimeVal = extractTagValue(line, "60", delimiter);
      const clOrdId = extractTagValue(line, "11", delimiter);
      const seqNum = extractTagValue(line, "34", delimiter);
      const sender = extractTagValue(line, "49", delimiter);
      const target = extractTagValue(line, "56", delimiter);

      const parsedSend = parseFixTimestampToMicroseconds(sendingTimeVal);
      const parsedTransact = parseFixTimestampToMicroseconds(transactTimeVal);

      let hopLatency = null;
      if (parsedSend && parsedTransact) {
        hopLatency = Math.abs(parsedTransact.totalMicroseconds - parsedSend.totalMicroseconds);
      }

      const msgInfo = {
        id: "msg-" + index + "-" + Date.now(),
        seqNum: seqNum || "" + (index + 1),
        msgType,
        msgTypeName: getMsgTypeName(msgType),
        sendingTime: sendingTimeVal,
        transactTime: transactTimeVal,
        parsedSend,
        parsedTransact,
        hopLatency,
        clOrdId,
        sender,
        target,
        content: line
      };

      messages.push(msgInfo);

      if (clOrdId) {
        if (["D", "F", "G"].includes(msgType)) {
          clOrdIdMap[clOrdId] = msgInfo;
        }
      }
    });

    const pairs = [];
    messages.forEach((msg) => {
      if (msg.clOrdId && ["8", "9"].includes(msg.msgType)) {
        const reqMsg = clOrdIdMap[msg.clOrdId];
        if (reqMsg && reqMsg.parsedSend && msg.parsedSend) {
          const rtt = msg.parsedSend.totalMicroseconds - reqMsg.parsedSend.totalMicroseconds;
          if (rtt > 0) {
            pairs.push({
              clOrdId: msg.clOrdId,
              requestSeq: reqMsg.seqNum,
              responseSeq: msg.seqNum,
              reqTime: reqMsg.parsedSend.formattedTime,
              respTime: msg.parsedSend.formattedTime,
              rttMicroseconds: rtt,
              symbol: extractTagValue(msg.content, "55", delimiter) || "N/A"
            });
            msg.rttMicroseconds = rtt;
          }
        }
      }
    });

    const latencyValues = messages.map(m => m.hopLatency).filter(l => l !== null);
    const rttValues = pairs.map(p => p.rttMicroseconds);

    const hasLatency = latencyValues.length;
    const avgHopLatency = hasLatency ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / hasLatency) : 0;
    const maxHopLatency = hasLatency ? Math.max(...latencyValues) : 0;
    const minHopLatency = hasLatency ? Math.min(...latencyValues) : 0;

    const totalRttPairs = rttValues.length;
    const avgRtt = totalRttPairs ? Math.round(rttValues.reduce((a, b) => a + b, 0) / totalRttPairs) : 0;

    self.postMessage({
      messages,
      pairs,
      stats: {
        totalMessages: messages.length,
        hasLatency,
        avgHopLatency,
        maxHopLatency,
        minHopLatency,
        avgRtt,
        totalRttPairs
      }
    });
  };
`;

export default function LatencyDashboard() {
  const [pastedText, setPastedText] = useState("");
  const [delimiter, setDelimiter] = useState("|");
  const [inputMode, setInputMode] = useState("file");
  const [files, setFiles] = useState([]);
  const [parsedData, setParsedData] = useState([]);
  const [rttPairs, setRttPairs] = useState([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    hasLatency: 0,
    avgHopLatency: 0,
    maxHopLatency: 0,
    minHopLatency: 0,
    avgRtt: 0,
    totalRttPairs: 0
  });

  const [activeTab, setActiveTab] = useState("hop"); // "hop" or "rtt"
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredPoint, setHoveredPoint] = useState(null); // Chart tooltip details
  const [loading, setLoading] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null); // "timeline", "distribution" or null
  const [percentileScale, setPercentileScale] = useState("max"); // "max", "99", "95", "90"
  const [hideOutliersFromTable, setHideOutliersFromTable] = useState(false);

  // Zoom range states
  const [zoomRange, setZoomRange] = useState(null); // { start: number, end: number } or null
  const [dragStart, setDragStart] = useState(null); // SVG coordinate X
  const [dragCurrent, setDragCurrent] = useState(null); // SVG coordinate X
  const [isDragging, setIsDragging] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset zoom & page when data/tab/filters change
  useEffect(() => {
    setZoomRange(null);
    setCurrentPage(1);
    setHoveredPoint(null);
  }, [parsedData, activeTab, searchTerm, percentileScale, hideOutliersFromTable]);

  // Fallback synchronous parser
  const runSyncParsing = useCallback((rawLogsText) => {
    if (!rawLogsText.trim()) return;
    const lines = rawLogsText.split(/\r?\n/).filter(Boolean);
    
    const messages = [];
    const clOrdIdMap = {};

    lines.forEach((line, index) => {
      const msgType = extractTagValue(line, "35", delimiter);
      const sendingTimeVal = extractTagValue(line, "52", delimiter);
      const transactTimeVal = extractTagValue(line, "60", delimiter);
      const clOrdId = extractTagValue(line, "11", delimiter);
      const seqNum = extractTagValue(line, "34", delimiter);
      const sender = extractTagValue(line, "49", delimiter);
      const target = extractTagValue(line, "56", delimiter);

      const parsedSend = parseFixTimestampToMicroseconds(sendingTimeVal);
      const parsedTransact = parseFixTimestampToMicroseconds(transactTimeVal);

      let hopLatency = null;
      if (parsedSend && parsedTransact) {
        hopLatency = Math.abs(parsedTransact.totalMicroseconds - parsedSend.totalMicroseconds);
      }

      const msgInfo = {
        id: `msg-${index}-${Date.now()}`,
        seqNum: seqNum || `${index + 1}`,
        msgType,
        msgTypeName: getMsgTypeName(msgType),
        sendingTime: sendingTimeVal,
        transactTime: transactTimeVal,
        parsedSend,
        parsedTransact,
        hopLatency,
        clOrdId,
        sender,
        target,
        content: line
      };

      messages.push(msgInfo);

      if (clOrdId) {
        if (["D", "F", "G"].includes(msgType)) {
          clOrdIdMap[clOrdId] = msgInfo;
        }
      }
    });

    const pairs = [];
    messages.forEach((msg) => {
      if (msg.clOrdId && ["8", "9"].includes(msg.msgType)) {
        const reqMsg = clOrdIdMap[msg.clOrdId];
        if (reqMsg && reqMsg.parsedSend && msg.parsedSend) {
          const rtt = msg.parsedSend.totalMicroseconds - reqMsg.parsedSend.totalMicroseconds;
          if (rtt > 0) {
            pairs.push({
              clOrdId: msg.clOrdId,
              requestSeq: reqMsg.seqNum,
              responseSeq: msg.seqNum,
              reqTime: reqMsg.parsedSend.formattedTime,
              respTime: msg.parsedSend.formattedTime,
              rttMicroseconds: rtt,
              symbol: extractTagValue(msg.content, "55", delimiter) || "N/A"
            });
            msg.rttMicroseconds = rtt;
          }
        }
      }
    });

    const latencyValues = messages.map(m => m.hopLatency).filter(l => l !== null);
    const rttValues = pairs.map(p => p.rttMicroseconds);

    const hasLatency = latencyValues.length;
    const avgHopLatency = hasLatency ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / hasLatency) : 0;
    const maxHopLatency = hasLatency ? Math.max(...latencyValues) : 0;
    const minHopLatency = hasLatency ? Math.min(...latencyValues) : 0;

    const totalRttPairs = rttValues.length;
    const avgRtt = totalRttPairs ? Math.round(rttValues.reduce((a, b) => a + b, 0) / totalRttPairs) : 0;

    setParsedData(messages);
    setRttPairs(pairs);
    setStats({
      totalMessages: messages.length,
      hasLatency,
      avgHopLatency,
      maxHopLatency,
      minHopLatency,
      avgRtt,
      totalRttPairs
    });
  }, [delimiter]);

  // Processes raw logs and extracts latencies via Web Worker
  const processLatencyLogs = useCallback((rawLogsText) => {
    if (!rawLogsText.trim()) return;
    setLoading(true);

    if (typeof window !== "undefined" && window.Worker) {
      const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        const { messages, pairs, stats } = e.data;
        setParsedData(messages);
        setRttPairs(pairs);
        setStats(stats);
        setLoading(false);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };

      worker.onerror = (err) => {
        console.error("Worker error, falling back to main thread:", err);
        runSyncParsing(rawLogsText);
        setLoading(false);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };

      worker.postMessage({ rawLogsText, delimiter });
    } else {
      runSyncParsing(rawLogsText);
      setLoading(false);
    }
  }, [delimiter, runSyncParsing]);

  // CSV Report Downloader
  const exportCSV = () => {
    if (parsedData.length === 0) return;
    
    const headers = [
      "Sequence",
      "Msg Type",
      "Msg Name",
      "ClOrdID",
      "Sender",
      "Target",
      "SendingTime (52)",
      "TransactTime (60)",
      "Hop Latency (ms)",
      "RTT Duration (ms)"
    ];
    
    const rows = parsedData.map(m => [
      `#${m.seqNum}`,
      m.msgType,
      m.msgTypeName,
      m.clOrdId || "",
      m.sender || "",
      m.target || "",
      m.parsedSend ? m.parsedSend.formattedTime : "",
      m.parsedTransact ? m.parsedTransact.formattedTime : "",
      m.hopLatency !== null ? (m.hopLatency / 1000).toFixed(3) : "",
      m.rttMicroseconds !== undefined ? (m.rttMicroseconds / 1000).toFixed(3) : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `fixify_latency_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dropzone load files handler
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (file.size > 1500000) {
      const confirmProceed = window.confirm(`Warning: The file "${file.name}" is very large (>1.5MB) and may cause performance lag or memory limits. Do you want to proceed?`);
      if (!confirmProceed) return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const textContent = reader.result;
      setFiles(acceptedFiles);
      processLatencyLogs(textContent);
    };
    reader.readAsText(file);
  }, [processLatencyLogs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".txt", ".fix", ".log"] },
    multiple: false,
  });

  const loadSampleData = () => {
    setPastedText(SAMPLE_LATENCY_LOGS);
    setInputMode("paste");
    processLatencyLogs(SAMPLE_LATENCY_LOGS);
  };

  const clearAll = () => {
    setFiles([]);
    setPastedText("");
    setParsedData([]);
    setRttPairs([]);
    setStats({
      totalMessages: 0,
      hasLatency: 0,
      avgHopLatency: 0,
      maxHopLatency: 0,
      minHopLatency: 0,
      avgRtt: 0,
      totalRttPairs: 0
    });
  };

  // SVG Chart Renderer
  const renderSVGChart = () => {
    if (allDataPoints.length === 0) {
      return (
        <div 
          className="h-64 flex flex-col items-center justify-center border border-dashed rounded-xl"
          style={{ borderColor: "var(--border)" }}
        >
          <Activity className="h-8 w-8 mb-2 text-zinc-600 animate-pulse" style={{ color: "var(--text-muted)" }} />
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            No data points to render. Upload logs with tags 52, 60, and 11.
          </p>
        </div>
      );
    }

    const dataPoints = zoomRange 
      ? allDataPoints.slice(zoomRange.start, zoomRange.end + 1)
      : allDataPoints;

    const svgWidth = 800;
    const svgHeight = 280;
    const paddingLeft = 60;
    const paddingRight = 40;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    // Get Y bounds for displayed range
    const displayValues = activeTab === "hop" 
      ? dataPoints.map(d => d.hopLatency)
      : dataPoints.map(d => d.rttMicroseconds);

    // Calculate timeline stats (Min, Max) based on displayed range
    const maxVal = displayValues.length > 0 ? Math.max(...displayValues) : 0;
    const minVal = displayValues.length > 0 ? Math.min(...displayValues) : 0;

    // Automatically determine if logarithmic scale is needed to prevent peak squashing (evaluated using limitMax)
    const useLogScale = (limitMax / median) > 10 && limitMax > 10000;
    
    // Transform values if log scale is enabled
    const transformValue = (val) => {
      if (useLogScale) {
        // Log base 10 scale (in milliseconds to keep ranges small and clean)
        const ms = val / 1000;
        return ms > 0 ? Math.log10(ms + 1) * 1000 : 0;
      }
      return val;
    };

    const values = displayValues.map(v => transformValue(Math.min(v, limitMax)));
    const maxValue = transformValue(limitMax);
    const minValue = 0; // standard floor for RTT/latency
    const valueRange = (maxValue - minValue) || 1;

    // Build SVG coordinates
    const coordinates = dataPoints.map((dp, idx) => {
      const rawVal = activeTab === "hop" ? dp.hopLatency : dp.rttMicroseconds;
      const isOutlier = rawVal > limitMax;
      const val = transformValue(Math.min(rawVal, limitMax));
      const x = paddingLeft + (idx / Math.max(1, dataPoints.length - 1)) * chartWidth;
      const y = isOutlier
        ? paddingTop + 2
        : paddingTop + chartHeight - ((val - minValue) / valueRange) * chartHeight;
      const originalIndex = zoomRange ? zoomRange.start + idx : idx;
      return { x, y, data: dp, val: rawVal, originalIndex, isOutlier };
    });

    // Construct path line
    let pathD = "";
    if (coordinates.length > 0) {
      pathD = `M ${coordinates[0].x} ${coordinates[0].y}`;
      for (let i = 1; i < coordinates.length; i++) {
        pathD += ` L ${coordinates[i].x} ${coordinates[i].y}`;
      }
    }

    // Grid ticks (Y-axis)
    const yTicks = 4;
    const gridLines = Array.from({ length: yTicks + 1 }).map((_, idx) => {
      const val = minValue + (idx / yTicks) * valueRange;
      const y = paddingTop + chartHeight - (idx / yTicks) * chartHeight;
      return { val, y };
    });

    // Helper to format axis tick labels depending on log scale
    const formatTickLabel = (val) => {
      if (useLogScale) {
        // Reverse log scale calculation: ms = 10^(val/1000) - 1
        const ms = Math.pow(10, val / 1000) - 1;
        return `${ms.toFixed(2)} ms`;
      }
      return `${(val / 1000).toFixed(2)} ms`;
    };

    const getSvgX = (clientX, svgElement) => {
      if (!svgElement) return 0;
      const rect = svgElement.getBoundingClientRect();
      const x = clientX - rect.left;
      return (x / rect.width) * svgWidth;
    };

    return (
      <div className="space-y-4">
        <div className="relative w-full overflow-visible rounded-xl border border-zinc-900 bg-zinc-950/20">
          {zoomRange && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-zinc-950/80 px-2 py-1 rounded border border-zinc-900">
                Zoomed: displaying {zoomRange.start + 1} - {zoomRange.end + 1} of {allDataPoints.length}
              </span>
              <button
                onClick={() => setZoomRange(null)}
                className="text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all"
                style={{
                  background: 'var(--primary-faint)',
                  borderColor: 'var(--primary-border)',
                  color: 'var(--primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-faint)';
                }}
              >
                Reset Zoom
              </button>
            </div>
          )}
          <div className="overflow-x-auto w-full p-2">
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              style={{ width: "100%" }} 
              className="h-auto select-none overflow-visible transition-all duration-200 cursor-crosshair"
              onMouseDown={(e) => {
                const x = getSvgX(e.clientX, e.currentTarget);
                if (x >= paddingLeft && x <= svgWidth - paddingRight) {
                  setDragStart(x);
                  setDragCurrent(x);
                  setIsDragging(true);
                }
              }}
              onMouseMove={(e) => {
                if (!isDragging || dragStart === null) return;
                const x = getSvgX(e.clientX, e.currentTarget);
                setDragCurrent(Math.max(paddingLeft, Math.min(svgWidth - paddingRight, x)));
              }}
              onMouseUp={(e) => {
                if (!isDragging || dragStart === null || dragCurrent === null) return;
                const x1 = Math.min(dragStart, dragCurrent);
                const x2 = Math.max(dragStart, dragCurrent);
                if (x2 - x1 > 5) {
                  const startIndex = Math.max(0, Math.floor(((x1 - paddingLeft) / chartWidth) * (allDataPoints.length - 1)));
                  const endIndex = Math.min(allDataPoints.length - 1, Math.ceil(((x2 - paddingLeft) / chartWidth) * (allDataPoints.length - 1)));
                  if (endIndex > startIndex) {
                    setZoomRange({ start: startIndex, end: endIndex });
                  }
                }
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
              }}
              onMouseLeave={() => {
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
              }}
            >
              {/* Background grid */}
              {gridLines.map((gl, i) => (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={gl.y}
                    x2={svgWidth - paddingRight}
                    y2={gl.y}
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={gl.y + 4}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-[var(--text-muted)]"
                  >
                    {formatTickLabel(gl.val)}
                  </text>
                </g>
              ))}

              {/* Selection overlay for dragging */}
              {isDragging && dragStart !== null && dragCurrent !== null && (
                <rect
                  x={Math.min(dragStart, dragCurrent)}
                  y={paddingTop}
                  width={Math.abs(dragStart - dragCurrent)}
                  height={chartHeight}
                  fill="var(--primary)"
                  fillOpacity="0.15"
                  stroke="var(--primary)"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              )}

              {/* Line Path */}
              <path
                d={pathD}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Data Nodes */}
              {coordinates.map((pt, idx) => {
                const isHovered = hoveredPoint && hoveredPoint.index === pt.originalIndex;
                return (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : pt.isOutlier ? 3.5 : 4}
                    fill={isHovered ? "var(--primary)" : pt.isOutlier ? "#ef4444" : "var(--background)"}
                    stroke={pt.isOutlier ? "#ef4444" : "var(--primary)"}
                    strokeWidth={isHovered ? 3 : 2}
                    className="cursor-pointer transition-all duration-100"
                    onMouseEnter={(e) => {
                      setHoveredPoint({
                        index: pt.originalIndex,
                        val: pt.val,
                        data: pt.data,
                        x: pt.x,
                        y: pt.y,
                        isOutlier: pt.isOutlier
                      });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* X-axis indicators */}
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight}
                x2={svgWidth - paddingRight}
                y2={paddingTop + chartHeight}
                stroke="var(--border)"
                strokeWidth="1.5"
              />
              <text
                x={paddingLeft + chartWidth / 2}
                y={svgHeight - 10}
                textAnchor="middle"
                className="text-[10px] font-mono fill-[var(--text-muted)]"
              >
                Captured Session Message Sequence Timeline
              </text>
            </svg>
          </div>

          {/* Floating Tooltip details */}
          {hoveredPoint && (
            <div
              className="absolute z-30 p-3 rounded-xl border pointer-events-none text-xs font-mono shadow-xl bg-zinc-950"
              style={{
                background: "var(--card)",
                borderColor: hoveredPoint.isOutlier ? "#ef4444" : "var(--primary-border)",
                left: `${Math.min(85, Math.max(15, ((hoveredPoint.x / svgWidth) * 100)))}%`,
                top: hoveredPoint.y < 80 
                  ? `${(hoveredPoint.y / svgHeight) * 100 + 6}%` 
                  : hoveredPoint.y > svgHeight - 80 
                    ? `${(hoveredPoint.y / svgHeight) * 100 - 6}%`
                    : hoveredPoint.y < svgHeight / 2 
                      ? `${(hoveredPoint.y / svgHeight) * 100 + 6}%` 
                      : `${(hoveredPoint.y / svgHeight) * 100 - 6}%`,
                transform: hoveredPoint.y < 80 
                  ? "translate(-50%, 0)" 
                  : hoveredPoint.y > svgHeight - 80 
                    ? "translate(-50%, -100%)"
                    : hoveredPoint.y < svgHeight / 2 
                      ? "translate(-50%, 0)" 
                      : "translate(-50%, -100%)"
              }}
            >
              {activeTab === "hop" ? (
                <>
                  <p className="font-bold text-center mb-1 flex items-center justify-center gap-1.5" style={{ color: hoveredPoint.isOutlier ? "#ef4444" : "var(--primary)" }}>
                    {hoveredPoint.isOutlier && (
                      <span className="text-[9px] font-bold bg-red-950 text-red-400 px-1 py-0.5 rounded border border-red-900/30">
                        Outlier
                      </span>
                    )}
                    Latency: {(hoveredPoint.val / 1000).toFixed(3)} ms
                  </p>
                  <div className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                    <p>Seq: #{hoveredPoint.data.seqNum}</p>
                    <p>Type: {hoveredPoint.data.msgTypeName}</p>
                    <p>Tag 52 (Send): {hoveredPoint.data.parsedSend?.formattedTime}</p>
                    <p>Tag 60 (Trans): {hoveredPoint.data.parsedTransact?.formattedTime}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-bold text-center mb-1 flex items-center justify-center gap-1.5" style={{ color: hoveredPoint.isOutlier ? "#ef4444" : "var(--primary)" }}>
                    {hoveredPoint.isOutlier && (
                      <span className="text-[9px] font-bold bg-red-950 text-red-400 px-1 py-0.5 rounded border border-red-900/30">
                        Outlier
                      </span>
                    )}
                    RTT: {(hoveredPoint.val / 1000).toFixed(3)} ms
                  </p>
                  <div className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                    <p>ClOrdID: {hoveredPoint.data.clOrdId}</p>
                    <p>Symbol: {hoveredPoint.data.symbol}</p>
                    <p>Req Seq: #{hoveredPoint.data.requestSeq}</p>
                    <p>Resp Seq: #{hoveredPoint.data.responseSeq}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Statistical Summary Panel */}
        <div className="grid grid-cols-2 gap-x-0 gap-y-2 text-[10px] font-mono p-3 rounded-xl border border-zinc-900 bg-zinc-950/40">
          <div className="space-y-1 pr-4 fx-v-divider">
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Min:</span> <span className="font-bold text-emerald-400">{(minVal / 1000).toFixed(3)} ms</span></p>
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Max:</span> <span className="font-bold text-red-400">{(maxVal / 1000).toFixed(3)} ms</span></p>
          </div>
          <div className="space-y-1 pl-4">
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">90th %ile:</span> <span className="font-bold text-indigo-400">{(p90Val / 1000).toFixed(3)} ms</span></p>
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">99th %ile:</span> <span className="font-bold text-amber-400">{(p99Val / 1000).toFixed(3)} ms</span></p>
          </div>
        </div>
      </div>
    );
  };

  const renderDistributionCurve = () => {
    const allDataPoints = activeTab === "hop" 
      ? parsedData.filter(d => d.hopLatency !== null)
      : rttPairs;

    const dataPoints = zoomRange 
      ? allDataPoints.slice(zoomRange.start, zoomRange.end + 1)
      : allDataPoints;

    if (dataPoints.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center border border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-mono text-[var(--text-muted)]">No data for distribution</p>
        </div>
      );
    }

    const values = activeTab === "hop" 
      ? dataPoints.map(d => d.hopLatency)
      : dataPoints.map(d => d.rttMicroseconds);

    // Math Calculations
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance) || 1;

    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;

    const svgWidth = 380;
    const svgHeight = 180;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    // Helper to generate bell curve bands path
    const getBandPath = (zStart, zEnd) => {
      const steps = 30;
      let path = `M ${paddingLeft + ((zStart - (-3.5)) / 7.0) * chartWidth} ${paddingTop + chartHeight}`;
      for (let i = 0; i <= steps; i++) {
        const z = zStart + (i / steps) * (zEnd - zStart);
        const x = paddingLeft + ((z - (-3.5)) / 7.0) * chartWidth;
        const y = paddingTop + chartHeight - Math.exp(-0.5 * z * z) * (chartHeight - 10);
        path += ` L ${x} ${y}`;
      }
      path += ` L ${paddingLeft + ((zEnd - (-3.5)) / 7.0) * chartWidth} ${paddingTop + chartHeight} Z`;
      return path;
    };

    // Main line path
    let curvePath = "";
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const z = -3.5 + (i / steps) * 7.0;
      const x = paddingLeft + (i / steps) * chartWidth;
      const y = paddingTop + chartHeight - Math.exp(-0.5 * z * z) * (chartHeight - 10);
      curvePath += (i === 0 ? "M" : " L") + ` ${x} ${y}`;
    }

    const zMedian = (median - mean) / stdDev;
    const medianX = paddingLeft + ((Math.max(-3.5, Math.min(3.5, zMedian)) - (-3.5)) / 7.0) * chartWidth;
    const meanX = paddingLeft + 0.5 * chartWidth;

    return (
      <div className="space-y-4">
        <div className="relative w-full rounded-xl border border-zinc-900 bg-zinc-950/20 p-2">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: "100%" }} className="h-auto select-none overflow-visible">
            {/* Shaded Standard Dev Bands */}
            <path d={getBandPath(-3, -2)} fill="rgba(245, 158, 11, 0.04)" />
            <path d={getBandPath(2, 3)} fill="rgba(245, 158, 11, 0.04)" />
            <path d={getBandPath(-2, -1)} fill="rgba(59, 130, 246, 0.08)" />
            <path d={getBandPath(1, 2)} fill="rgba(59, 130, 246, 0.08)" />
            <path d={getBandPath(-1, 1)} fill="rgba(16, 185, 129, 0.1)" />

            {/* Bell Curve Main Line */}
            <path d={curvePath} fill="none" stroke="var(--primary)" strokeWidth="2" />

            {/* Mean & Median indicator lines */}
            <line x1={meanX} y1={paddingTop} x2={meanX} y2={paddingTop + chartHeight} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1={medianX} y1={paddingTop} x2={medianX} y2={paddingTop + chartHeight} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />

            {/* Labels at lines */}
            <text x={meanX + 4} y={paddingTop + 12} className="text-[8px] font-mono fill-[#ef4444] font-bold">Mean (μ)</text>
            <text x={medianX - 4} y={paddingTop + 24} textAnchor="end" className="text-[8px] font-mono fill-[#10b981] font-bold">Med</text>

            {/* X-axis ticks */}
            <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={svgWidth - paddingRight} y2={paddingTop + chartHeight} stroke="var(--border)" strokeWidth="1.5" />
            {[-3, -2, -1, 0, 1, 2, 3].map((z) => {
              const x = paddingLeft + ((z - (-3.5)) / 7.0) * chartWidth;
              const val = mean + z * stdDev;
              return (
                <g key={z}>
                  <line x1={x} y1={paddingTop + chartHeight} x2={x} y2={paddingTop + chartHeight + 4} stroke="var(--border)" />
                  <text x={x} y={paddingTop + chartHeight + 12} textAnchor="middle" className="text-[7px] font-mono fill-[var(--text-muted)]">
                    {z === 0 ? "μ" : `${z > 0 ? "+" : ""}${z}σ`}
                  </text>
                  <text x={x} y={paddingTop + chartHeight + 20} textAnchor="middle" className="text-[6.5px] font-mono fill-[var(--primary)]">
                    {(val / 1000).toFixed(1)}ms
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Statistical Summary Panel */}
        <div className="grid grid-cols-2 gap-x-0 gap-y-2 text-[10px] font-mono p-3 rounded-xl border border-zinc-900 bg-zinc-950/40">
          <div className="space-y-1 pr-4 fx-v-divider">
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Mean (μ):</span> <span className="font-bold text-zinc-300">{(mean / 1000).toFixed(3)} ms</span></p>
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Median:</span> <span className="font-bold text-emerald-400">{(median / 1000).toFixed(3)} ms</span></p>
          </div>
          <div className="space-y-1 pl-4">
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Std Dev (σ):</span> <span className="font-bold text-indigo-400">{(stdDev / 1000).toFixed(3)} ms</span></p>
            <p className="flex justify-between"><span className="text-[var(--text-muted)]">Variance (σ²):</span> <span className="font-bold text-amber-400">{(variance / 1000000).toFixed(4)} ms²</span></p>
          </div>
        </div>
      </div>
    );
  };



  const isProcessed = parsedData.length > 0;

  // Calculate limitMax and cutoff calculations in component body scope
  const allDataPoints = activeTab === "hop" 
    ? parsedData.filter(d => d.hopLatency !== null)
    : rttPairs;

  const rawValues = allDataPoints.map(d => activeTab === "hop" ? d.hopLatency : d.rttMicroseconds);
  const absoluteMax = rawValues.length > 0 ? Math.max(...rawValues) : 1000;
  const sortedValues = [...rawValues].sort((a, b) => a - b);
  const sortedAllValues = [...rawValues].sort((a, b) => a - b); // sorted values of active selection
  const median = sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 1;

  const p90Idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * 0.9) - 1));
  const p90Val = sortedValues.length > 0 ? sortedValues[p90Idx] : 0;
  const p99Idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * 0.99) - 1));
  const p99Val = sortedValues.length > 0 ? sortedValues[p99Idx] : 0;

  let cutoffValue = absoluteMax;
  if (percentileScale === "99" && sortedAllValues.length > 0) {
    const idx = Math.min(sortedAllValues.length - 1, Math.max(0, Math.ceil(sortedAllValues.length * 0.99) - 1));
    cutoffValue = sortedAllValues[idx] || absoluteMax;
  } else if (percentileScale === "95" && sortedAllValues.length > 0) {
    const idx = Math.min(sortedAllValues.length - 1, Math.max(0, Math.ceil(sortedAllValues.length * 0.95) - 1));
    cutoffValue = sortedAllValues[idx] || absoluteMax;
  } else if (percentileScale === "90" && sortedAllValues.length > 0) {
    const idx = Math.min(sortedAllValues.length - 1, Math.max(0, Math.ceil(sortedAllValues.length * 0.90) - 1));
    cutoffValue = sortedAllValues[idx] || absoluteMax;
  }

  const limitMax = percentileScale === "max" ? absoluteMax : cutoffValue;

  const filteredLogs = parsedData.filter((m) => {
    const matchesSearch = m.seqNum.includes(searchTerm) ||
      m.msgTypeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.clOrdId && m.clOrdId.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (hideOutliersFromTable) {
      if (activeTab === "hop") {
        if (m.hopLatency !== null && m.hopLatency > limitMax) return false;
      } else {
        if (m.rttMicroseconds !== undefined && m.rttMicroseconds > limitMax) return false;
      }
    }

    return true;
  });

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isProcessed ? 'max-w-2xl mx-auto' : ''}`}>
        <div className={`space-y-1.5 ${!isProcessed ? 'text-center md:text-left w-full' : ''}`}>
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5" style={{ color: "var(--foreground)" }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)" }}
            >
              <Activity className="h-5 w-5" style={{ color: "var(--primary)" }} />
            </div>
            <span>Latency Hop Dashboard</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Analyze time-offsets between SendingTime (tag 52) and TransactTime (tag 60) for network hops, and track round-trip time (RTT) trends.
          </p>
        </div>

        {isProcessed && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={exportCSV} className="fx-btn-primary py-2 px-4 flex items-center gap-1.5 text-xs font-semibold" disabled={loading}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={clearAll} className="fx-btn-secondary py-2 px-4 text-xs font-semibold" disabled={loading}>
              Clear Logs
            </button>
          </div>
        )}
      </div>

      {parsedData.length === 0 ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <div
            className="rounded-xl overflow-hidden animate-fade-in"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${inputMode === "file" ? " active" : ""}`}
                  onClick={() => setInputMode("file")}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> <span className="hidden sm:inline">File</span>
                </button>
                <button
                  className={`fx-tab${inputMode === "paste" ? " active" : ""}`}
                  onClick={() => setInputMode("paste")}
                >
                  <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste logs</span>
                </button>
              </div>
              <button onClick={loadSampleData} className="fx-btn-primary py-1 px-3 text-[10px]">
                Load Sample logs
              </button>
            </div>

            <div className="p-6">

              {inputMode === "file" ? (
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
                  style={{
                    borderColor: isDragActive ? "var(--primary)" : "var(--border)",
                    background: isDragActive ? "var(--primary-faint)" : "var(--background)"
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadCloud
                    className="h-10 w-10 mx-auto mb-3"
                    style={{ color: isDragActive ? "var(--primary)" : "var(--text-muted)" }}
                  />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {loading ? "Analyzing logs via Web Worker..." : "Drag & drop trading session logs"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {loading ? "Calculating latencies in the background thread..." : "Supports .txt · .fix · .log"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste FIX logs with tag 52 (SendingTime) and tag 60 (TransactTime) here..."
                    className="w-full h-64 p-4 rounded-xl resize-none text-xs font-mono outline-none"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)"
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--primary)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                    disabled={loading}
                  />
                  {pastedText.trim() && (
                    <div className="p-3.5 rounded-xl border text-[11px] font-mono space-y-2 mt-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Raw Payload Preview (First 3 lines):</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {pastedText.split('\n').filter(l => l.includes('8=FIX')).slice(0, 3).map((line, idx) => (
                          <div key={idx} className="p-2 rounded bg-zinc-950/40 border border-zinc-900/50">
                            <SohVisualizer content={line} delimiter={delimiter} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => processLatencyLogs(pastedText)}
                    disabled={!pastedText.trim() || loading}
                    className="w-full fx-btn-primary justify-center py-2"
                  >
                    {loading ? "Analyzing logs via Web Worker..." : "Analyze Latencies"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stat metrics cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              className="p-5 rounded-xl flex items-center gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="h-10 w-10 rounded-xl items-center justify-center shrink-0 hidden sm:flex"
                style={{ background: "var(--background)" }}
              >
                <FileText className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--foreground)" }}>
                  {stats.totalMessages}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Total Messages
                </p>
              </div>
            </div>

            <div 
              className="p-5 rounded-xl flex items-center gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="h-10 w-10 rounded-xl items-center justify-center shrink-0 hidden sm:flex"
                style={{ background: "rgba(16,185,129,0.08)" }}
              >
                <Clock className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-emerald-400">
                  {stats.avgHopLatency ? `${(stats.avgHopLatency / 1000).toFixed(3)} ms` : "N/A"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Avg Hop Latency
                </p>
              </div>
            </div>

            <div 
              className="p-5 rounded-xl flex items-center gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="h-10 w-10 rounded-xl items-center justify-center shrink-0 hidden sm:flex"
                style={{ background: "var(--primary-faint)" }}
              >
                <ArrowRightLeft className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--primary)" }}>
                  {stats.totalRttPairs}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Matched RTT Pairs
                </p>
              </div>
            </div>

            <div 
              className="p-5 rounded-xl flex items-center gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="h-10 w-10 rounded-xl items-center justify-center shrink-0 hidden sm:flex"
                style={{ background: "rgba(251,191,36,0.08)" }}
              >
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-amber-400">
                  {stats.avgRtt ? `${(stats.avgRtt / 1000).toFixed(3)} ms` : "N/A"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Average RTT
                </p>
              </div>
            </div>
          </div>

          {/* Diagnostic View Mode Bar */}
          <div 
            className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl border"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              
              {/* Percentile Dropdown */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[var(--text-muted)]">Bounds:</span>
                <select
                  value={percentileScale}
                  onChange={(e) => setPercentileScale(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 text-[10px] font-mono rounded p-2 outline-none text-[var(--foreground)] focus:border-[var(--primary)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="max">Max (Unfiltered)</option>
                  <option value="99">99th Percentile</option>
                  <option value="95">95th Percentile</option>
                  <option value="90">90th Percentile</option>
                </select>
              </div>

              {/* Hide Outliers Table Toggle */}
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideOutliersFromTable}
                  onChange={(e) => setHideOutliersFromTable(e.target.checked)}
                  className="h-3.5 w-3.5 rounded bg-zinc-950 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                />
                <span className="text-[var(--text-muted)]">Hide Outliers</span>
              </label>
            </div>
            
            <div className="fx-tab-group shrink-0">
              <button
                className={`fx-tab${activeTab === "hop" ? " active" : ""}`}
                onClick={() => setActiveTab("hop")}
              >
                Hop Latency (52 to 60)
              </button>
              <button
                className={`fx-tab${activeTab === "rtt" ? " active" : ""}`}
                onClick={() => setActiveTab("rtt")}
              >
                Round-Trip Time (RTT)
              </button>
            </div>
          </div>

          {/* Charts Visualizer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Timeline Visualizer Card */}
            <div 
              className="rounded-xl overflow-hidden flex flex-col justify-between"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="px-5 py-4 flex items-center justify-between gap-3"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
              >
                <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                  <Activity className="h-4 w-4 text-[var(--primary)]" /> Latency Timeline
                </span>
                <button
                  onClick={() => setExpandedChart("timeline")}
                  className="p-1 rounded hover:bg-zinc-800 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  title="Expand timeline view"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                {renderSVGChart()}
              </div>
            </div>

            {/* Standard Deviation Distribution Card */}
            <div 
              className="rounded-xl overflow-hidden flex flex-col justify-between"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div 
                className="px-5 py-4 flex items-center justify-between gap-3"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
              >
                <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                  <Activity className="h-4 w-4 text-[var(--primary)]" /> Standard Deviation
                </span>
                <button
                  onClick={() => setExpandedChart("distribution")}
                  className="p-1 rounded hover:bg-zinc-800 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  title="Expand distribution view"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                {renderDistributionCurve()}
              </div>
            </div>

          </div>

          {/* Interactive Logs Table */}
          <div 
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div 
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
            >
              <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                <FileText className="h-4 w-4 text-[var(--primary)]" /> Measured Session Log Details
              </span>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter by Seq/Type/ClOrdID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs font-mono outline-none"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)"
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead 
                  className="text-[10px] uppercase tracking-wider"
                  style={{ background: "var(--background)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  <tr>
                    <th className="py-3 px-4">Seq</th>
                    <th className="py-3 px-4">Msg Type</th>
                    <th className="py-3 px-4">ClOrdID</th>
                    <th className="py-3 px-4">SendingTime (52)</th>
                    <th className="py-3 px-4">TransactTime (60)</th>
                    <th className="py-3 px-4 text-right">Hop Latency</th>
                    <th className="py-3 px-4 text-right">RTT Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: "var(--border)" }}>
                  {paginatedLogs.map((m) => {
                    const hasHop = m.hopLatency !== null;
                    const hasRtt = m.rttMicroseconds !== undefined;
                    return (
                      <tr key={m.id} className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/25 transition-colors">
                        <td className="py-3 px-4" style={{ color: "var(--text-muted)" }}>#{m.seqNum}</td>
                        <td className="py-3 px-4">
                          <span style={{ color: "var(--foreground)" }}>{m.msgTypeName}</span>
                          <span 
                            className="ml-1.5 text-[9px] font-bold px-1 border rounded"
                            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                          >
                            {m.msgType}
                          </span>
                        </td>
                        <td className="py-3 px-4 truncate max-w-[120px]" style={{ color: "var(--text-muted)" }} title={m.clOrdId}>
                          {m.clOrdId || "—"}
                        </td>
                        <td className="py-3 px-4" style={{ color: "var(--text-muted)" }}>
                          {m.parsedSend ? m.parsedSend.formattedTime : "—"}
                        </td>
                        <td className="py-3 px-4" style={{ color: "var(--text-muted)" }}>
                          {m.parsedTransact ? m.parsedTransact.formattedTime : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                          {hasHop ? `${(m.hopLatency / 1000).toFixed(3)} ms` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-400">
                          {hasRtt ? `${(m.rttMicroseconds / 1000).toFixed(3)} ms` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 italic" style={{ color: "var(--text-muted)" }}>
                        No matching parsed latency data rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div 
                className="px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <div className="text-xs font-mono text-[var(--text-muted)]">
                  Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} to {Math.min(totalItems, currentPage * pageSize)} of {totalItems} entries
                </div>
                
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Page Size Select */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span style={{ color: "var(--text-muted)" }}>Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 outline-none focus:border-[var(--primary)] text-xs font-mono cursor-pointer"
                    >
                      {[10, 25, 50, 100].map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Page Navigation buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1 rounded bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-all flex items-center justify-center animate-fade-in border"
                      style={{ borderColor: 'var(--border)' }}
                      title="First Page"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-all flex items-center justify-center animate-fade-in border"
                      style={{ borderColor: 'var(--border)' }}
                      title="Previous Page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-mono text-zinc-400 px-1 select-none">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-all flex items-center justify-center animate-fade-in border"
                      style={{ borderColor: 'var(--border)' }}
                      title="Next Page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-all flex items-center justify-center animate-fade-in border"
                      style={{ borderColor: 'var(--border)' }}
                      title="Last Page"
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expanded Chart Modal */}
      {expandedChart && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 select-none animate-fade-in"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
            style={{ 
              background: 'var(--card)', 
              borderColor: 'var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              <span className="font-semibold text-sm uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                <Activity className="h-4 w-4 text-[var(--primary)]" /> 
                {expandedChart === "timeline" && "Latency Timeline"}
                {expandedChart === "distribution" && "Standard Deviation"}
              </span>
              
              <div className="flex items-center gap-3.5 flex-wrap">
                {/* Modal view mode toggle */}
                <div className="fx-tab-group">
                  <button
                    className={`fx-tab${activeTab === "hop" ? " active" : ""}`}
                    onClick={() => setActiveTab("hop")}
                  >
                    Hop Latency (52 to 60)
                  </button>
                  <button
                    className={`fx-tab${activeTab === "rtt" ? " active" : ""}`}
                    onClick={() => setActiveTab("rtt")}
                  >
                    Round-Trip Time (RTT)
                  </button>
                </div>

                <button
                  onClick={() => setExpandedChart(null)}
                  className="hidden md:inline p-1.5 rounded-lg hover:bg-zinc-800 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[80vh] flex-1">
              {expandedChart === "timeline" && (
                <div className="w-full h-auto">
                  {renderSVGChart()}
                </div>
              )}
              {expandedChart === "distribution" && (
                <div className="w-full h-auto">
                  {renderDistributionCurve()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
