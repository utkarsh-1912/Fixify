'use client';

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  UploadCloud,
  FileText,
  Trash2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowUpDown,
  Download,
  Search,
  Eye,
  ChevronDown,
  Info,
  ClipboardList,
  RefreshCw
} from "lucide-react";
import {
  extractTimestamp,
  getTagValue,
  validateFIXMessage,
  getValueMeaning,
  FIX_ORDER_MAP
} from "@/lib/fixParser";
import TagDetailsModal from "@/components/TagDetailsModal";
import ErrorAnalyticsModal from "@/components/ErrorAnalyticsModal";

function evaluateFQL(lineContent, query, delimiter = "|") {
  if (!query || !query.trim()) return true;

  const normalizedQuery = query.trim().replace(/\s+and\s+/gi, " AND ").replace(/\s+or\s+/gi, " OR ");

  const hasRelational = /=|!=|>|<|>=|<=/.test(normalizedQuery);
  if (!hasRelational) {
    return lineContent.toLowerCase().includes(query.toLowerCase());
  }

  const orParts = normalizedQuery.split(" OR ");

  return orParts.some(orPart => {
    const andParts = orPart.split(" AND ");
    return andParts.every(condition => {
      const match = condition.trim().match(/^(\d+)\s*(=|!=|>|<|>=|<=)\s*(.+)$/);
      if (!match) return false;

      const tag = match[1];
      const op = match[2];
      let expectedVal = match[3].trim();

      if (expectedVal.startsWith('"') && expectedVal.endsWith('"')) {
        expectedVal = expectedVal.slice(1, -1);
      } else if (expectedVal.startsWith("'") && expectedVal.endsWith("'")) {
        expectedVal = expectedVal.slice(1, -1);
      }

      const actualVal = getTagValue(lineContent, tag, delimiter);
      if (!actualVal) return op === "!=";

      switch (op) {
        case "=":
          return actualVal === expectedVal;
        case "!=":
          return actualVal !== expectedVal;
        case ">":
          return parseFloat(actualVal) > parseFloat(expectedVal);
        case "<":
          return parseFloat(actualVal) < parseFloat(expectedVal);
        case ">=":
          return parseFloat(actualVal) >= parseFloat(expectedVal);
        case "<=":
          return parseFloat(actualVal) <= parseFloat(expectedVal);
        default:
          return false;
      }
    });
  });
}

export default function LogsProcessorPage() {
  const [files, setFiles] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [delimiter, setDelimiter] = useState('|');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputMode, setInputMode] = useState('file');
  const [pastedText, setPastedText] = useState('');
  const [selectedLineInfo, setSelectedLineInfo] = useState(null);
  const [inspectorTab, setInspectorTab] = useState("details"); // "details" or "lifecycle"
  const [selectedOrderIdFilter, setSelectedOrderIdFilter] = useState("all");
  const [activeErrorType, setActiveErrorType] = useState(null); // 'checksum', 'length' or null

  useEffect(() => {
    setInspectorTab("details");
    setSelectedOrderIdFilter("all");
  }, [selectedLineInfo]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    validMessages: 0,
    checksumErrors: 0,
    bodyLengthErrors: 0,
    msgTypeCount: {},
    checksumFailedSeqs: [],
    bodyLengthFailedSeqs: []
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTag, setActiveTag] = useState(null);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedText = localStorage.getItem('fixify-logs-pastedText');
    if (savedText) setPastedText(savedText);
    const savedDelim = localStorage.getItem('fixify-logs-delimiter');
    if (savedDelim) setDelimiter(savedDelim || '|');
    const savedSort = localStorage.getItem('fixify-logs-sortOrder');
    if (savedSort) setSortOrder(savedSort || 'asc');
    const savedMode = localStorage.getItem('fixify-logs-inputMode');
    if (savedMode) setInputMode(savedMode || 'file');
    const savedSearch = localStorage.getItem('fixify-logs-searchTerm');
    if (savedSearch) setSearchTerm(savedSearch || '');
    
    try {
      const savedStats = localStorage.getItem('fixify-logs-stats');
      if (savedStats) setStats(JSON.parse(savedStats));
      const savedFiles = localStorage.getItem('fixify-logs-files');
      if (savedFiles) {
        const parsed = JSON.parse(savedFiles);
        const hydrated = parsed.map(file => ({
          ...file,
          parsedLines: file.parsedLines.map(line => ({
            ...line,
            timestampObj: new Date(line.timestampObj)
          }))
        }));
        setFiles(hydrated);
      }
    } catch (e) {
      console.error("Failed to parse saved Logs Processor state", e);
    }
    setIsLoaded(true);
  }, []);

  // Save states on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      if (pastedText.length > 1000000) {
        // Truncate to 1MB when writing to cache
        localStorage.setItem('fixify-logs-pastedText', pastedText.slice(0, 1000000) + "\n\n... [Log Text Truncated in Local Cache to Save Storage Space]");
      } else {
        localStorage.setItem('fixify-logs-pastedText', pastedText);
      }
    } catch (e) {
      console.warn("Could not save pasted text", e);
    }
  }, [pastedText, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-logs-delimiter', delimiter);
    } catch (e) {
      console.warn("Could not save delimiter state", e);
    }
  }, [delimiter, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-logs-sortOrder', sortOrder);
    } catch (e) {
      console.warn("Could not save sortOrder state", e);
    }
  }, [sortOrder, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-logs-inputMode', inputMode);
    } catch (e) {
      console.warn("Could not save inputMode state", e);
    }
  }, [inputMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-logs-searchTerm', searchTerm);
    } catch (e) {
      console.warn("Could not save searchTerm state", e);
    }
  }, [searchTerm, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-logs-stats', JSON.stringify(stats));
    } catch (e) {
      console.warn("Could not save stats state", e);
    }
  }, [stats, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      const cacheableFiles = files.map(f => {
        const hasLargeContent = f.content && f.content.length > 1000000;
        const hasLargeParsed = f.parsedLines && f.parsedLines.length > 3000;
        if (hasLargeContent || hasLargeParsed) {
          const truncatedContent = hasLargeContent 
            ? f.content.slice(0, 1000000) + "\n\n... [File Content Truncated in Local Cache to Save Storage Space]" 
            : f.content;
          const truncatedLines = hasLargeParsed 
            ? f.parsedLines.slice(0, 3000) 
            : f.parsedLines;
          return {
            ...f,
            content: truncatedContent,
            parsedLines: truncatedLines,
            isTruncatedInCache: true
          };
        }
        return f;
      });
      localStorage.setItem('fixify-logs-files', JSON.stringify(cacheableFiles));
    } catch (e) {
      console.warn("Could not save files state", e);
    }
  }, [files, isLoaded]);

  const onDrop = useCallback((acceptedFiles) => {
    let completed = 0;
    const tempFiles = [];
    acceptedFiles.forEach((file) => {
      const isLarge = file.size > 1500000;
      if (isLarge) {
        const confirmProceed = window.confirm(`Warning: The file "${file.name}" is very large (>1.5MB). FIXify will process all messages in memory, but will truncate the saved version in browser cache storage to prevent QuotaExceeded errors. Proceed?`);
        if (!confirmProceed) {
          completed++;
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = () => {
        const textContent = reader.result;
        const lines = textContent.split(/\r?\n/).filter(Boolean);
        const parsedLines = lines.map((line, idx) => {
          const validation = validateFIXMessage(line, delimiter);
          return {
            id: `${file.name}-${idx}-${Date.now()}`,
            content: line,
            timestampObj: extractTimestamp(line, delimiter),
            clOrdID: getTagValue(line, '11', delimiter),
            msgType: getTagValue(line, '35', delimiter),
            msgSeqNum: getTagValue(line, '34', delimiter),
            validation
          };
        });
        tempFiles.push({ 
          name: file.name, 
          content: textContent, 
          parsedLines,
          size: file.size,
          skipCache: isLarge
        });
        completed++;
        if (completed === acceptedFiles.length) {
          setFiles((prev) => [...prev, ...tempFiles]);
        }
      };
      reader.readAsText(file);
    });
  }, [delimiter]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".txt", ".fix", ".log"] },
    multiple: true,
  });

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const clearAll = () => {
    setFiles([]);
    setPastedText('');
    setStats({ totalMessages: 0, validMessages: 0, checksumErrors: 0, bodyLengthErrors: 0, msgTypeCount: {}, checksumFailedSeqs: [], bodyLengthFailedSeqs: [] });
    setSelectedLineInfo(null);
  };

  const processLogs = useCallback(() => {
    let activeFiles = [];
    if (inputMode === 'paste') {
      if (!pastedText.trim()) return;
      const lines = pastedText.split(/\r?\n/).filter(Boolean);
      const parsedLines = lines.map((line, idx) => {
        const validation = validateFIXMessage(line, delimiter);
        return {
          id: `pasted-${idx}-${Date.now()}`,
          content: line,
          timestampObj: extractTimestamp(line, delimiter),
          clOrdID: getTagValue(line, '11', delimiter),
          msgType: getTagValue(line, '35', delimiter),
          msgSeqNum: getTagValue(line, '34', delimiter),
          validation
        };
      });
      activeFiles = [{ name: "pasted_logs.txt", content: pastedText, parsedLines }];
    } else {
      activeFiles = files.map(f => {
        const lines = f.content.split(/\r?\n/).filter(Boolean);
        const parsedLines = lines.map((line, idx) => {
          const validation = validateFIXMessage(line, delimiter);
          return {
            id: `${f.name}-${idx}-${Date.now()}`,
            content: line,
            timestampObj: extractTimestamp(line, delimiter),
            clOrdID: getTagValue(line, '11', delimiter),
            msgType: getTagValue(line, '35', delimiter),
            msgSeqNum: getTagValue(line, '34', delimiter),
            validation
          };
        });
        return { ...f, parsedLines };
      });
    }
    if (activeFiles.length === 0) return;
    setIsProcessing(true);

    let aggTotal = 0, aggValid = 0, aggChecksumErr = 0, aggLengthErr = 0;
    const aggMsgTypes = {};
    const checksumFailedSeqs = [];
    const bodyLengthFailedSeqs = [];

    const updatedFiles = activeFiles.map((fileObj) => {
      const sortedLines = [...fileObj.parsedLines];
      sortedLines.sort((a, b) => {
        const timeA = a.timestampObj.getTime();
        const timeB = b.timestampObj.getTime();
        if (timeA !== timeB) return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        if (a.clOrdID && b.clOrdID && a.clOrdID !== b.clOrdID) return a.clOrdID.localeCompare(b.clOrdID);
        const orderA = FIX_ORDER_MAP[a.msgType] || 99;
        const orderB = FIX_ORDER_MAP[b.msgType] || 99;
        if (orderA !== orderB) return orderA - orderB;
        const seqA = a.msgSeqNum ? parseInt(a.msgSeqNum, 10) : 0;
        const seqB = b.msgSeqNum ? parseInt(b.msgSeqNum, 10) : 0;
        if (!isNaN(seqA) && !isNaN(seqB) && seqA !== seqB) {
          return sortOrder === 'asc' ? seqA - seqB : seqB - seqA;
        }
        return 0;
      });

      sortedLines.forEach(({ validation }) => {
        if (!validation) return;
        aggTotal++;
        if (validation.isValid) aggValid++;
        const msgSeq = validation.msgSeqNum ? `#${validation.msgSeqNum}` : `Msg ${aggTotal}`;
        if (validation.errors.some(e => e.toLowerCase().includes("checksum"))) {
          aggChecksumErr++;
          checksumFailedSeqs.push(msgSeq);
        }
        if (validation.errors.some(e => e.toLowerCase().includes("bodylength"))) {
          aggLengthErr++;
          bodyLengthFailedSeqs.push(msgSeq);
        }
        const typeName = validation.msgTypeName || "Other";
        aggMsgTypes[typeName] = (aggMsgTypes[typeName] || 0) + 1;
      });

      return { ...fileObj, parsedLines: sortedLines, sortedContent: sortedLines.map((l) => l.content).join('\n') };
    });

    setFiles(updatedFiles);
    setStats({ 
      totalMessages: aggTotal, 
      validMessages: aggValid, 
      checksumErrors: aggChecksumErr, 
      bodyLengthErrors: aggLengthErr, 
      msgTypeCount: aggMsgTypes,
      checksumFailedSeqs,
      bodyLengthFailedSeqs
    });
    setIsProcessing(false);
  }, [files, sortOrder, inputMode, pastedText, delimiter]);

  const downloadFile = (fileObj) => {
    const content = fileObj.sortedContent || fileObj.parsedLines.map((l) => l.content).join('\n');
    saveAs(new Blob([content], { type: "text/plain;charset=utf-8" }), `sorted_${fileObj.name}`);
  };

  const downloadAll = async () => {
    if (files.length === 1) { downloadFile(files[0]); return; }
    const zip = new JSZip();
    files.forEach((f) => zip.file(`sorted_${f.name}`, f.sortedContent || f.parsedLines.map(l => l.content).join('\n')));
    saveAs(await zip.generateAsync({ type: "blob" }), "sorted_FIX_logs.zip");
  };

  const getOrderLifecycleMessages = useCallback(() => {
    if (!selectedLineInfo) return [];
    const seedClOrdID = selectedLineInfo.clOrdID;
    const seedOrigClOrdID = selectedLineInfo.validation?.tags?.['41'];
    const seedOrderID = selectedLineInfo.validation?.tags?.['37'];
    const seedAllocID = selectedLineInfo.validation?.tags?.['70'];
    const seedIOIID = selectedLineInfo.validation?.tags?.['23'];

    if (!seedClOrdID && !seedOrigClOrdID && !seedOrderID && !seedAllocID && !seedIOIID) return [];

    const clOrdIDs = new Set();
    const orderIDs = new Set();
    const allocIDs = new Set();
    const ioiIDs = new Set();

    if (seedOrderID) {
      const lowerOid = seedOrderID.toLowerCase();
      orderIDs.add(lowerOid);
      if (seedClOrdID && seedClOrdID.toLowerCase() !== lowerOid) clOrdIDs.add(seedClOrdID.toLowerCase());
      if (seedOrigClOrdID && seedOrigClOrdID.toLowerCase() !== lowerOid) clOrdIDs.add(seedOrigClOrdID.toLowerCase());
    } else {
      if (seedClOrdID) clOrdIDs.add(seedClOrdID.toLowerCase());
      if (seedOrigClOrdID) clOrdIDs.add(seedOrigClOrdID.toLowerCase());
    }
    if (seedAllocID) allocIDs.add(seedAllocID.toLowerCase());
    if (seedIOIID) ioiIDs.add(seedIOIID.toLowerCase());

    let sizeChanged = true;
    let iterations = 0;
    // Transitive closure resolution (max 10 iterations to prevent infinite runs)
    while (sizeChanged && iterations < 10) {
      const prevClOrdSize = clOrdIDs.size;
      const prevOrderSize = orderIDs.size;
      const prevAllocSize = allocIDs.size;
      const prevIOISize = ioiIDs.size;

      files.forEach(fileObj => {
        fileObj.parsedLines.forEach(line => {
          const lineClOrdID = line.clOrdID ? line.clOrdID.toLowerCase() : null;
          const lineOrigClOrdID = line.validation?.tags?.['41'] ? line.validation?.tags?.['41'].toLowerCase() : null;
          const lineOrderID = line.validation?.tags?.['37'] ? line.validation?.tags?.['37'].toLowerCase() : null;
          const lineAllocID = line.validation?.tags?.['70'] ? line.validation?.tags?.['70'].toLowerCase() : null;
          const lineIOIID = line.validation?.tags?.['23'] ? line.validation?.tags?.['23'].toLowerCase() : null;

          const matchesClOrd = (lineClOrdID && clOrdIDs.has(lineClOrdID)) || 
                               (lineOrigClOrdID && clOrdIDs.has(lineOrigClOrdID));
          const matchesOrder = line.msgType !== 'D' && lineOrderID && orderIDs.has(lineOrderID);
          const matchesAlloc = lineAllocID && allocIDs.has(lineAllocID);
          const matchesIOI = lineIOIID && ioiIDs.has(lineIOIID);
          const isMatch = matchesClOrd || matchesOrder || matchesAlloc || matchesIOI;

          if (isMatch) {
            if (lineOrderID) orderIDs.add(lineOrderID);
            if (lineClOrdID && lineClOrdID !== lineOrderID && !orderIDs.has(lineClOrdID)) {
              clOrdIDs.add(lineClOrdID);
            }
            if (lineOrigClOrdID && lineOrigClOrdID !== lineOrderID && !orderIDs.has(lineOrigClOrdID)) {
              clOrdIDs.add(lineOrigClOrdID);
            }
            if (lineAllocID) allocIDs.add(lineAllocID);
            if (lineIOIID) ioiIDs.add(lineIOIID);
          }
        });
      });

      sizeChanged = (clOrdIDs.size !== prevClOrdSize) || (orderIDs.size !== prevOrderSize) || (allocIDs.size !== prevAllocSize) || (ioiIDs.size !== prevIOISize);
      iterations++;
    }

    // Gather all matching lines
    const matches = [];
    files.forEach(fileObj => {
      fileObj.parsedLines.forEach(line => {
        const lineClOrdID = line.clOrdID ? line.clOrdID.toLowerCase() : null;
        const lineOrigClOrdID = line.validation?.tags?.['41'] ? line.validation?.tags?.['41'].toLowerCase() : null;
        const lineOrderID = line.validation?.tags?.['37'] ? line.validation?.tags?.['37'].toLowerCase() : null;
        const lineAllocID = line.validation?.tags?.['70'] ? line.validation?.tags?.['70'].toLowerCase() : null;
        const lineIOIID = line.validation?.tags?.['23'] ? line.validation?.tags?.['23'].toLowerCase() : null;

        const matchesClOrd = (lineClOrdID && clOrdIDs.has(lineClOrdID)) || 
                             (lineOrigClOrdID && clOrdIDs.has(lineOrigClOrdID));
        const matchesOrder = line.msgType !== 'D' && lineOrderID && orderIDs.has(lineOrderID);
        const matchesAlloc = lineAllocID && allocIDs.has(lineAllocID);
        const matchesIOI = lineIOIID && ioiIDs.has(lineIOIID);
        const isMatch = matchesClOrd || matchesOrder || matchesAlloc || matchesIOI;

        if (isMatch) {
          matches.push(line);
        }
      });
    });

    // Sort chronologically by timestamp
    matches.sort((a, b) => a.timestampObj.getTime() - b.timestampObj.getTime());
    return matches;
  }, [selectedLineInfo, files]);

  const renderLifecycleTimeline = () => {
    const lifecycleMsgs = getOrderLifecycleMessages();
    if (lifecycleMsgs.length === 0) {
      return (
        <div className="py-12 text-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
          No linked order messages found (ClOrdID not present).
        </div>
      );
    }

    // Extract all unique OrderIDs (Tag 37), ClOrdIDs (Tag 11), AllocIDs (Tag 70), and IOIids (Tag 23) from matches
    const orderIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['37'])
        .filter(id => id && id.trim() !== "")
    ));

    const orderIdsLower = new Set(orderIds.map(oid => oid.toLowerCase()));

    const clOrdIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.clOrdID)
        .filter(id => id && id.trim() !== "" && !orderIdsLower.has(id.toLowerCase()))
    ));

    const allocIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['70'])
        .filter(id => id && id.trim() !== "")
    ));

    const ioiIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['23'])
        .filter(id => id && id.trim() !== "")
    ));

    const displayedMsgs = selectedOrderIdFilter === "all"
      ? lifecycleMsgs
      : lifecycleMsgs.filter(m => {
          const oid = m.validation?.tags?.['37'];
          if (oid && oid.toLowerCase() === selectedOrderIdFilter.toLowerCase()) return true;
          
          const mClOrd = m.clOrdID?.toLowerCase();
          const mOrigClOrd = m.validation?.tags?.['41']?.toLowerCase();
          if (!mClOrd && !mOrigClOrd) return false;

          return lifecycleMsgs.some(other => {
            const otherOid = other.validation?.tags?.['37'];
            if (!otherOid || otherOid.toLowerCase() !== selectedOrderIdFilter.toLowerCase()) return false;
            const otherClOrd = other.clOrdID?.toLowerCase();
            const otherOrigClOrd = other.validation?.tags?.['41']?.toLowerCase();
            return (mClOrd && (mClOrd === otherClOrd || mClOrd === otherOrigClOrd)) ||
                   (mOrigClOrd && (mOrigClOrd === otherClOrd || mOrigClOrd === otherOrigClOrd));
          });
        });
    
    return (
      <div className="space-y-4">
        {/* Order Info & Dropdown Filter */}
        <div 
          className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border text-[11px] font-mono mb-2" 
          style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            {clOrdIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--text-muted)' }}>ClOrdID:</span>
                <span className="font-bold text-zinc-350">{clOrdIds.join(', ')}</span>
              </div>
            )}
            {clOrdIds.length > 0 && (orderIds.length > 0 || allocIds.length > 0 || ioiIds.length > 0) && <span className="text-zinc-800">|</span>}
            
            {orderIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Order ID (Tag 37):</span>
                {orderIds.length > 1 ? (
                  <select
                    value={selectedOrderIdFilter}
                    onChange={(e) => setSelectedOrderIdFilter(e.target.value)}
                    className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 outline-none focus:border-[var(--primary)] text-[11px] font-mono cursor-pointer"
                  >
                    <option value="all">All Order IDs ({orderIds.length})</option>
                    {orderIds.map(oid => (
                      <option key={oid} value={oid}>{oid}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-bold text-zinc-350">{orderIds[0]}</span>
                )}
              </div>
            )}
            {orderIds.length > 0 && (allocIds.length > 0 || ioiIds.length > 0) && <span className="text-zinc-800">|</span>}

            {allocIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--text-muted)' }}>AllocID (Tag 70):</span>
                <span className="font-bold text-zinc-350">{allocIds.join(', ')}</span>
              </div>
            )}
            {allocIds.length > 0 && ioiIds.length > 0 && <span className="text-zinc-800">|</span>}

            {ioiIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--text-muted)' }}>IOIid (Tag 23):</span>
                <span className="font-bold text-zinc-350">{ioiIds.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 relative pl-4 border-l border-zinc-800 dark:border-zinc-850 ml-2 py-2">
          {displayedMsgs.map((msg, index) => {
            const isCurrent = msg.id === selectedLineInfo.id;
            const msgType = msg.validation?.msgTypeName || "Message";
            const ordStatus = msg.validation?.tags?.['39'];
          
          let statusText = "";
          let statusColor = "var(--text-muted)";
          if (ordStatus !== undefined) {
            const statusMap = {
              "0": { label: "New", color: "var(--primary)" },
              "1": { label: "Partially Filled", color: "#60a5fa" },
              "2": { label: "Filled", color: "#34d399" },
              "4": { label: "Canceled", color: "#f87171" },
              "8": { label: "Rejected", color: "#f87171" },
            };
            const mapped = statusMap[ordStatus];
            if (mapped) {
              statusText = `[Status: ${mapped.label}]`;
              statusColor = mapped.color;
            }
          }
          
          let latencyStr = "";
          if (index > 0) {
            const prevMsg = lifecycleMsgs[index - 1];
            const diffMs = msg.timestampObj.getTime() - prevMsg.timestampObj.getTime();
            latencyStr = `+${diffMs}ms`;
          }
          
          const qty = msg.validation?.tags?.['38'];
          const px = msg.validation?.tags?.['44'];
          const symbol = msg.validation?.tags?.['55'];
          
          return (
            <div key={msg.id} className="relative group/timeline-item">
              <div 
                className="absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 transition-all flex items-center justify-center z-10"
                style={{ 
                  background: isCurrent ? 'var(--primary)' : 'var(--background)',
                  borderColor: isCurrent ? 'var(--primary)' : 'var(--border)',
                }}
              />
              
              <div 
                onClick={() => setSelectedLineInfo(msg)}
                className={`p-3.5 rounded-xl cursor-pointer transition-all space-y-1.5 ${isCurrent ? 'bg-zinc-800/20' : 'hover:bg-zinc-800/10'}`}
                style={{ 
                  border: isCurrent ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  background: isCurrent ? 'var(--primary-faint)' : 'transparent'
                }}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="font-extrabold uppercase" style={{ color: isCurrent ? 'var(--primary)' : 'var(--foreground)' }}>
                    {msgType} ({msg.msgType})
                  </span>
                  {latencyStr && (
                    <span className="text-zinc-500 font-bold bg-zinc-950 px-1 py-0.5 rounded border border-zinc-900">
                      {latencyStr}
                    </span>
                  )}
                </div>
                
                <div className="text-[11px] font-mono space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex justify-between">
                    <span>Seq: {msg.validation?.msgSeqNum || 'N/A'}</span>
                    <span style={{ color: statusColor }}>{statusText}</span>
                  </div>
                  {(symbol || qty || px) && (
                    <div className="text-[10px] text-zinc-500">
                      {[
                        symbol ? `Sym: ${symbol}` : "",
                        qty ? `Qty: ${qty}` : "",
                        px ? `Px: ${px}` : ""
                      ].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                
                <div className="text-[9px] font-mono text-zinc-600 dark:text-zinc-500 flex justify-between items-center pt-1 border-t border-zinc-900">
                  <span className="truncate max-w-[150px]">
                    {(() => {
                      if (msg.validation?.tags?.['70']) {
                        return `AllocID: ${msg.validation.tags['70']}`;
                      }
                      if (msg.validation?.tags?.['23']) {
                        return `IOIid: ${msg.validation.tags['23']}`;
                      }
                      const hasClOrd = msg.clOrdID && !orderIdsLower.has(msg.clOrdID.toLowerCase());
                      const displayClOrd = hasClOrd ? msg.clOrdID : (clOrdIds[0] || 'N/A');
                      return `ClOrdID: ${displayClOrd}`;
                    })()}
                  </span>
                  <span>
                    {msg.timestampObj.toISOString().split('T')[1].replace('Z', '')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    );
  };

  const renderSequenceFlowDiagram = () => {
    const lifecycleMsgs = getOrderLifecycleMessages();
    if (lifecycleMsgs.length === 0) {
      return (
        <div className="py-12 text-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
          No linked order messages found.
        </div>
      );
    }

    const orderIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['37'])
        .filter(id => id && id.trim() !== "")
    ));

    const orderIdsLower = new Set(orderIds.map(oid => oid.toLowerCase()));

    const clOrdIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.clOrdID)
        .filter(id => id && id.trim() !== "" && !orderIdsLower.has(id.toLowerCase()))
    ));

    const allocIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['70'])
        .filter(id => id && id.trim() !== "")
    ));

    const ioiIds = Array.from(new Set(
      lifecycleMsgs
        .map(m => m.validation?.tags?.['23'])
        .filter(id => id && id.trim() !== "")
    ));

    const displayedMsgs = selectedOrderIdFilter === "all"
      ? lifecycleMsgs
      : lifecycleMsgs.filter(m => {
          const oid = m.validation?.tags?.['37'];
          if (oid && oid.toLowerCase() === selectedOrderIdFilter.toLowerCase()) return true;
          
          const mClOrd = m.clOrdID?.toLowerCase();
          const mOrigClOrd = m.validation?.tags?.['41']?.toLowerCase();
          if (!mClOrd && !mOrigClOrd) return false;

          return lifecycleMsgs.some(other => {
            const otherOid = other.validation?.tags?.['37'];
            if (!otherOid || otherOid.toLowerCase() !== selectedOrderIdFilter.toLowerCase()) return false;
            const otherClOrd = other.clOrdID?.toLowerCase();
            const otherOrigClOrd = other.validation?.tags?.['41']?.toLowerCase();
            return (mClOrd && (mClOrd === otherClOrd || mClOrd === otherOrigClOrd)) ||
                   (mOrigClOrd && (mOrigClOrd === otherClOrd || mOrigClOrd === otherOrigClOrd));
          });
        });

    // Extract ordered actors: default client leftmost, default server next, then others
    const firstMsg = lifecycleMsgs[0];
    const defaultSender = firstMsg?.validation?.tags?.['49'] || 'Client';
    const defaultTarget = firstMsg?.validation?.tags?.['56'] || 'Server';

    let totalIn = 0;
    let totalOut = 0;
    displayedMsgs.forEach(m => {
      const fromActor = m.validation?.tags?.['49'] || 'Client';
      if (fromActor === defaultSender) {
        totalOut++;
      } else {
        totalIn++;
      }
    });

    const otherActors = Array.from(new Set(
      lifecycleMsgs.flatMap(m => {
        const s = m.validation?.tags?.['49'] || 'Client';
        const t = m.validation?.tags?.['56'] || 'Server';
        return [s, t];
      })
    )).filter(a => a !== defaultSender && a !== defaultTarget);

    const orderedActors = [defaultSender, defaultTarget, ...otherActors];
    const numActors = orderedActors.length;

    // Grid details for SVG
    const width = 400;
    const padding = 50;
    const actorWidth = 80;
    
    // Calculate X coordinate for each actor
    const getActorX = (index) => {
      if (numActors <= 1) return width / 2;
      const step = (width - padding * 2) / (numActors - 1);
      return padding + index * step;
    };

    const rowHeight = 60;
    const headerHeight = 50;
    const svgHeight = headerHeight + displayedMsgs.length * rowHeight + 45;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1 text-[10px] font-mono mb-2 p-2.5 rounded-xl border" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {clOrdIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-muted)' }}>ClOrdID:</span>
                  <span className="font-bold text-zinc-350">{clOrdIds.join(', ')}</span>
                </div>
              )}
              {clOrdIds.length > 0 && (orderIds.length > 0 || allocIds.length > 0 || ioiIds.length > 0) && <span className="text-zinc-800">|</span>}

              {orderIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                  {orderIds.length > 1 ? (
                    <select
                      value={selectedOrderIdFilter}
                      onChange={(e) => setSelectedOrderIdFilter(e.target.value)}
                      className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 outline-none focus:border-[var(--primary)] text-[10px] font-mono cursor-pointer"
                    >
                      <option value="all">All ({orderIds.length})</option>
                      {orderIds.map(oid => (
                        <option key={oid} value={oid}>{oid}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold text-zinc-350">{orderIds[0]}</span>
                  )}
                </div>
              )}
              {orderIds.length > 0 && (allocIds.length > 0 || ioiIds.length > 0) && <span className="text-zinc-800">|</span>}

              {allocIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-muted)' }}>AllocID:</span>
                  <span className="font-bold text-zinc-350">{allocIds.join(', ')}</span>
                </div>
              )}
              {allocIds.length > 0 && ioiIds.length > 0 && <span className="text-zinc-800">|</span>}

              {ioiIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <span style={{ color: 'var(--text-muted)' }}>IOIid:</span>
                  <span className="font-bold text-zinc-350">{ioiIds.join(', ')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-zinc-500 text-[9px]">
              <span>In: <strong className="text-zinc-300 font-bold">{totalIn}</strong></span>
              <span>Out: <strong className="text-zinc-300 font-bold">{totalOut}</strong></span>
              <span className="text-zinc-700">|</span>
              <span>Actors: {numActors}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-1 bg-zinc-950/40 rounded-2xl border border-zinc-900/80 backdrop-blur-md">
          <svg viewBox={`0 0 ${width} ${svgHeight}`} className="w-full h-auto font-mono">
            {/* Draw Actor Headers & Lifelines */}
            {orderedActors.map((actor, idx) => {
              const x = getActorX(idx);
              return (
                <g key={actor}>
                  {/* Lifeline line */}
                  <line
                    x1={x}
                    y1={headerHeight - 10}
                    x2={x}
                    y2={svgHeight - 15}
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  {/* Actor Header Box */}
                  <rect
                    x={x - actorWidth / 2}
                    y={10}
                    width={actorWidth}
                    height={26}
                    rx={6}
                    fill="var(--background)"
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={26}
                    textAnchor="middle"
                    fontSize="9px"
                    fontWeight="bold"
                    fill="var(--foreground)"
                  >
                    {actor.length > 11 ? actor.slice(0, 9) + '..' : actor}
                  </text>
                </g>
              );
            })}

            {/* Draw message flows */}
            {displayedMsgs.map((msg, index) => {
              const fromActor = msg.validation?.tags?.['49'] || 'Client';
              const toActor = msg.validation?.tags?.['56'] || 'Server';
              
              const fromIdx = orderedActors.indexOf(fromActor);
              const toIdx = orderedActors.indexOf(toActor);
              
              const xFrom = getActorX(fromIdx !== -1 ? fromIdx : 0);
              const xTo = getActorX(toIdx !== -1 ? toIdx : 1);
              
              const y = headerHeight + index * rowHeight + 30;
              const isCurrent = msg.id === selectedLineInfo.id;
              
              const msgType = msg.validation?.msgTypeName || "Message";
              const typeCode = msg.msgType;
              const seq = msg.validation?.msgSeqNum || '';
              
              let latencyStr = "";
              if (index > 0) {
                const prevMsg = displayedMsgs[index - 1];
                const diffMs = msg.timestampObj.getTime() - prevMsg.timestampObj.getTime();
                latencyStr = `+${diffMs}ms`;
              }

              const execType = msg.validation?.tags?.['150'];
              const ordStatus = msg.validation?.tags?.['39'];
              let infoParts = [];
              if (execType) {
                const execTypeMeaning = getValueMeaning('150', execType);
                if (execTypeMeaning && execTypeMeaning !== execType) {
                  infoParts.push(`Exec: ${execTypeMeaning}`);
                }
              }
              if (ordStatus) {
                const ordStatusMeaning = getValueMeaning('39', ordStatus);
                if (ordStatusMeaning && ordStatusMeaning !== ordStatus) {
                  infoParts.push(`Status: ${ordStatusMeaning}`);
                }
              }
              const infoStr = infoParts.join(', ');

              // Determine arrow direction & markers
              const isLeftToRight = xFrom < xTo;
              
              return (
                <g
                  key={msg.id}
                  onClick={() => setSelectedLineInfo(msg)}
                  className="cursor-pointer group/arrow"
                >
                  {/* Invisible broad hover path for easy clicking */}
                  <line
                    x1={xFrom}
                    y1={y}
                    x2={xTo}
                    y2={y}
                    stroke="transparent"
                    strokeWidth="12"
                  />

                  {/* Visual Line */}
                  <line
                    x1={xFrom}
                    y1={y}
                    x2={xTo}
                    y2={y}
                    stroke={isCurrent ? "var(--primary)" : "var(--text-muted)"}
                    strokeWidth={isCurrent ? "2.5" : "1.5"}
                    strokeDasharray={typeCode === '3' || typeCode === '9' ? "2 2" : "none"} // Reject messages dashed
                    className="group-hover/arrow:stroke-[var(--primary)] transition-all"
                  />

                  {/* Arrowhead */}
                  {xFrom !== xTo && (
                    <polygon
                      points={
                        isLeftToRight
                          ? `${xTo - 6},${y - 4} ${xTo},${y} ${xTo - 6},${y + 4}`
                          : `${xTo + 6},${y - 4} ${xTo},${y} ${xTo + 6},${y + 4}`
                      }
                      fill={isCurrent ? "var(--primary)" : "var(--text-muted)"}
                      className="group-hover/arrow:fill-[var(--primary)] transition-all"
                    />
                  )}

                  {/* Label background highlight if selected */}
                  {isCurrent && (
                    <rect
                      x={Math.min(xFrom, xTo) + Math.abs(xFrom - xTo)/2 - 65}
                      y={y - 22}
                      width={130}
                      height={14}
                      rx={3}
                      fill="var(--primary-faint)"
                      stroke="var(--primary-border)"
                      strokeWidth="0.5"
                    />
                  )}

                  {/* Message Label */}
                  <text
                    x={xFrom + (xTo - xFrom) / 2}
                    y={y - 12}
                    textAnchor="middle"
                    fontSize="8px"
                    fontWeight={isCurrent ? "bold" : "normal"}
                    fill={isCurrent ? "var(--primary)" : "var(--foreground)"}
                    className="group-hover/arrow:fill-[var(--primary)] transition-all"
                  >
                    {msgType.length > 25 ? msgType.slice(0, 22) + '..' : msgType} ({typeCode})
                  </text>

                  {/* Latency and sequence subtext */}
                  <text
                    x={xFrom + (xTo - xFrom) / 2}
                    y={y + 11}
                    textAnchor="middle"
                    fontSize="7px"
                    fill="var(--text-muted)"
                  >
                    {seq ? `Seq: ${seq}` : ''} {latencyStr ? `(${latencyStr})` : ''} {infoStr ? `| ${infoStr}` : ''}
                  </text>

                  {/* Small circle node at source point */}
                  <circle
                    cx={xFrom}
                    cy={y}
                    r={3}
                    fill={isCurrent ? "var(--primary)" : "var(--text-muted)"}
                    className="group-hover/arrow:fill-[var(--primary)]"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const isProcessed = stats.totalMessages > 0;

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
            <UploadCloud className="h-3.5 w-3.5" /> <span className="hidden sm:inline">File</span>
          </button>
          <button
            className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
            onClick={() => setInputMode('paste')}
          >
            <ClipboardList className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Delimiter input */}
          <div className="flex items-center gap-1.5">
            <span className="fx-section-label text-[10px]">Delim:</span>
            <input
              type="text"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className="fx-input py-1 text-center w-12"
              title="Enter custom delimiter (e.g. |, SOH, or leave empty for Auto)"
              placeholder="Auto"
              maxLength={10}
            />
          </div>

          {/* Sort select */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="fx-input py-1.5 text-[11px]"
            title="Sort Order"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>

          {/* Process button */}
          <button
            onClick={processLogs}
            disabled={inputMode === "file" ? (files.length === 0 || isProcessing) : (!pastedText.trim() || isProcessing)}
            className="fx-btn-primary py-1.5 px-3"
            title="Process Logs"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isProcessing ? 'Sorting…' : 'Process'}</span>
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="p-5 space-y-4">
        {inputMode === "file" ? (
          <div className="space-y-3">
            <div
              {...getRootProps()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{
                borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
                background: isDragActive ? 'var(--primary-faint)' : 'var(--background)',
              }}
            >
              <input {...getInputProps()} />
              <UploadCloud
                className="h-10 w-10 mx-auto mb-3"
                style={{ color: isDragActive ? 'var(--primary)' : 'var(--text-muted)' }}
              />
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {isDragActive ? 'Drop files here' : 'Drag & drop session logs'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Accepts .txt · .fix · .log
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="fx-section-label">Queue ({files.length})</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {files.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="truncate flex-1 font-mono flex items-center" style={{ color: 'var(--foreground)' }}>
                        {f.name}
                        {(f.skipCache || f.isTruncatedInCache) && (
                          <span 
                            className="ml-2 text-[9px] font-semibold px-1 py-0.5 rounded border"
                            style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                            title="This file exceeds the 1MB cache threshold. Processing memory contains 100% of the messages, but the version saved in localStorage (cache) is truncated."
                          >
                            Cached (Truncated) ⚠️
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => removeFile(f.name)}
                        className="transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"Paste raw FIX logs (one per line)…\ne.g. 8=FIX.4.2|9=65|35=A|...\n    8=FIX.4.2\x019=85\x0135=D|..."}
            className="w-full h-64 p-4 rounded-xl resize-none text-xs font-mono"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        )}
      </div>

      {/* Sorting rules hint */}
      <div
        className="mx-5 mb-5 p-4 rounded-xl space-y-2"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5 fx-section-label">
          <Info className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
          Sorting Rules Applied
        </div>
        <ol className="space-y-1 text-xs pl-1" style={{ color: 'var(--text-muted)' }}>
          <li>1. Timestamp (tag 90052, fallback tag 52)</li>
          <li>2. ClOrderID cluster grouping (tag 11)</li>
          <li>3. Message execution flow hierarchy</li>
        </ol>
      </div>
    </div>
  );

  const statCards = stats.totalMessages > 0 ? [
    {
      id: 'total',
      label: 'Total Messages',
      value: stats.totalMessages,
      icon: TrendingUp,
      color: 'var(--foreground)',
      bg: 'var(--card-hover)',
      clickable: false
    },
    {
      id: 'validation',
      label: 'Validation Rate',
      value: `${((stats.validMessages / stats.totalMessages) * 100).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'var(--primary)',
      bg: 'var(--primary-faint)',
      clickable: false
    },
    {
      id: 'checksum',
      label: 'Checksum Errors',
      value: stats.checksumErrors,
      subtext: stats.checksumFailedSeqs?.length > 0 ? `Failed: ${stats.checksumFailedSeqs.slice(0, 3).join(', ')}${stats.checksumFailedSeqs.length > 3 ? '...' : ''}` : 'No mismatches',
      icon: AlertTriangle,
      color: '#f87171',
      bg: 'rgba(239,68,68,0.08)',
      clickable: stats.checksumErrors > 0
    },
    {
      id: 'length',
      label: 'Length Errors',
      value: stats.bodyLengthErrors,
      subtext: stats.bodyLengthFailedSeqs?.length > 0 ? `Failed: ${stats.bodyLengthFailedSeqs.slice(0, 3).join(', ')}${stats.bodyLengthFailedSeqs.length > 3 ? '...' : ''}` : 'No mismatches',
      icon: AlertTriangle,
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.08)',
      clickable: stats.bodyLengthErrors > 0
    },
  ] : [];

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto">

      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isProcessed ? 'max-w-2xl mx-auto' : ''}`}>
        <div className={`space-y-1.5 ${!isProcessed ? 'text-center md:text-left w-full' : ''}`}>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            FIX Logs Processor
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Upload session logs and sort chronologically by order flow priority using the FIX protocol standard.
          </p>
        </div>
        {files.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={clearAll} className="fx-btn-secondary">
              <RefreshCw className="h-3.5 w-3.5" /> <span className="inline">Reset</span>
            </button>
            <button onClick={downloadAll} className="fx-btn-primary" title="Download Sorted">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        )}
      </div>

      {!isProcessed ? (
        <div className="max-w-2xl mx-auto">
          {renderControlsCard()}
        </div>
      ) : (
        <>
          {/* Stats Dashboard */}
          {statCards.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  onClick={() => card.clickable && setActiveErrorType(card.id)}
                  className={`flex items-center gap-4 p-5 rounded-xl ${card.clickable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all' : ''}`}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    cursor: card.clickable ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (card.clickable) {
                      e.currentTarget.style.borderColor = card.color;
                      e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}15`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (card.clickable) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: card.bg }}
                  >
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold font-mono flex items-center gap-1.5" style={{ color: card.color }}>
                      {card.value}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      {card.label}
                    </div>
                    {card.subtext && (
                      <div className="text-[9px] font-mono mt-0.5 truncate opacity-75" style={{ color: 'var(--text-muted)' }} title={card.subtext}>
                        {card.subtext}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Controls (4/12) */}
            <div className="lg:col-span-4 space-y-4">
              {renderControlsCard()}
            </div>

            {/* Right: Output (8/12) */}
            <div className="lg:col-span-8">
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              >
                {/* Output panel header */}
                <div
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Processed Logs View
                  </h2>
                  <div className="flex flex-col gap-1 items-end relative w-full sm:w-80">
                    <div className="relative w-full">
                      <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                        <Search className="h-3.5 w-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Filter messages (e.g. 35=D)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono"
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          color: 'var(--foreground)',
                          outline: 'none',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--text-muted)] font-mono text-right w-full block">
                      FQL: <span className="text-[var(--primary)] font-semibold">35=D and 55=AAPL</span> or <span className="text-[var(--primary)] font-semibold">44 &gt; 150</span>
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  {files.length > 0 ? (
                    <div className="space-y-3">
                      {files.map((fileObj, fIdx) => {
                        const filteredLines = fileObj.parsedLines.filter((l) =>
                          evaluateFQL(l.content, searchTerm, delimiter)
                        );
                        return (
                          <details
                            key={fileObj.name}
                            open={fIdx === 0}
                            className="group rounded-xl overflow-hidden"
                            style={{ border: '1px solid var(--border)' }}
                          >
                            <summary
                              className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none transition-all"
                              style={{ background: 'var(--background)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'var(--background)'}
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold font-mono" style={{ color: 'var(--foreground)' }}>
                                <FileText className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                                <span>{fileObj.name}</span>
                                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                                  ({filteredLines.length} msgs)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.preventDefault(); downloadFile(fileObj); }}
                                  className="p-1.5 rounded-lg transition-all"
                                  title="Download file"
                                  style={{ color: 'var(--text-muted)' }}
                                  onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--foreground)'; }}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <ChevronDown
                                  className="h-4 w-4 group-open:rotate-180 transition-transform duration-200"
                                  style={{ color: 'var(--text-muted)' }}
                                />
                              </div>
                            </summary>

                            <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
                              {filteredLines.length === 0 ? (
                                <p className="text-xs text-center py-6 italic" style={{ color: 'var(--text-muted)' }}>
                                  No messages matching filter.
                                </p>
                              ) : (
                                <div className="font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto space-y-0.5 pr-1">
                                  {filteredLines.map((lineObj, lineIdx) => {
                                    const hasErr = lineObj.validation && !lineObj.validation.isValid;
                                    const isSelected = selectedLineInfo?.id === lineObj.id;
                                    return (
                                      <div
                                        key={lineObj.id}
                                        onClick={() => setSelectedLineInfo(lineObj)}
                                        className="group/line flex items-start gap-3 px-0.5 sm:px-1 md:px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                                        style={{
                                          background: isSelected
                                            ? 'var(--primary-faint)'
                                            : hasErr
                                              ? 'rgba(239,68,68,0.05)'
                                              : 'transparent',
                                          border: isSelected
                                            ? '1px solid var(--primary-border)'
                                            : hasErr
                                              ? '1px solid rgba(239,68,68,0.15)'
                                              : '1px solid transparent',
                                          color: isSelected ? 'var(--primary)' : hasErr ? '#ef4444' : 'var(--text-muted)',
                                        }}
                                      >
                                        <span className="text-[10px] min-w-[22px] text-right mt-0.5 select-none" style={{ color: 'var(--text-faint)' }}>
                                          {lineIdx + 1}
                                        </span>
                                        <span className="mt-1.5 select-none">
                                          {hasErr ? (
                                            <span className="block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                          ) : (
                                            <span
                                              className="block w-1.5 h-1.5 rounded-full transition-colors"
                                              style={{ background: isSelected ? 'var(--primary)' : 'var(--border)' }}
                                            />
                                          )}
                                        </span>
                                        <span className="break-all flex-1" style={{ color: isSelected ? 'var(--primary)' : 'var(--foreground)' }}>
                                          {lineObj.content}
                                        </span>
                                        <span
                                          className="opacity-0 group-hover/line:opacity-100 transition-opacity shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)' }}
                                        >
                                          <Eye className="h-3 w-3" /> <span className="hidden sm:inline">Inspect</span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-20 rounded-xl"
                      style={{ border: '2px dashed var(--border)' }}
                    >
                      <FileText className="h-12 w-12 mb-4" style={{ color: 'var(--text-faint)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                        No log files uploaded yet
                      </p>
                      <p className="text-xs mt-1 text-center max-w-xs" style={{ color: 'var(--text-faint)' }}>
                        Drag and drop a FIX trading session log or paste raw messages in the panel on the left.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Inspector Panel */}
      {selectedLineInfo && (
        <div
          className="fixed inset-y-0 right-0 w-full sm:w-[480px] shadow-2xl z-50 flex flex-col"
          style={{
            background: 'var(--card)',
            borderLeft: '1px solid var(--border)',
          }}
        >
          {/* Inspector header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                Message Inspector
              </h3>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Seq: {selectedLineInfo.validation?.msgSeqNum || 'N/A'} · Type: {selectedLineInfo.msgType || 'Unknown'}
              </p>
            </div>
            <button
              onClick={() => setSelectedLineInfo(null)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              ✕
            </button>
          </div>

          {/* Tab Selector */}
          {(selectedLineInfo.clOrdID || selectedLineInfo.validation?.tags?.['37'] || selectedLineInfo.validation?.tags?.['70'] || selectedLineInfo.validation?.tags?.['23']) && (
            <div className="flex border-b border-zinc-850 shrink-0 bg-zinc-950/20">
              <button
                className={`flex-1 py-3 text-[10px] sm:text-xs font-semibold font-mono border-b-2 transition-all ${inspectorTab === 'details' ? 'border-[var(--primary)] text-[var(--primary)] bg-zinc-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-350'}`}
                onClick={() => setInspectorTab('details')}
              >
                Details
              </button>
              <button
                className={`flex-1 py-3 text-[10px] sm:text-xs font-semibold font-mono border-b-2 transition-all ${inspectorTab === 'lifecycle' ? 'border-[var(--primary)] text-[var(--primary)] bg-zinc-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-350'}`}
                onClick={() => setInspectorTab('lifecycle')}
              >
                Timeline
              </button>
              <button
                className={`flex-1 py-3 text-[10px] sm:text-xs font-semibold font-mono border-b-2 transition-all ${inspectorTab === 'sequence' ? 'border-[var(--primary)] text-[var(--primary)] bg-zinc-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-350'}`}
                onClick={() => setInspectorTab('sequence')}
              >
                Sequence Flow
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {inspectorTab === 'details' ? (
              <>
                {/* Validation status */}
                <div>
                  <p className="fx-section-label mb-2">Diagnostics</p>
                  {selectedLineInfo.validation?.errors?.length > 0 ? (
                    <div
                      className="p-4 rounded-xl space-y-2"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#f87171' }}>
                        <AlertTriangle className="h-4 w-4" /> Message Corrupted or Invalid
                      </div>
                      <ul className="text-xs space-y-1 font-mono" style={{ color: '#ef4444' }}>
                        {selectedLineInfo.validation.errors.map((err, idx) => (
                          <li key={idx}>· {err}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div
                      className="p-4 rounded-xl flex items-center gap-2 text-xs font-semibold"
                      style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}
                    >
                      <CheckCircle className="h-4 w-4" /> Checksum &amp; Length Validation Passed
                    </div>
                  )}
                </div>

                {/* Meta grid */}
                <div
                  className="grid grid-cols-2 gap-4 p-4 rounded-xl text-xs font-mono"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <span className="block mb-0.5" style={{ color: 'var(--text-muted)' }}>Parsed Timestamp</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {(() => {
                        const ts = selectedLineInfo.timestampObj instanceof Date 
                          ? selectedLineInfo.timestampObj 
                          : new Date(selectedLineInfo.timestampObj);
                        return isNaN(ts.getTime()) || ts.getTime() === 0 ? 'N/A' : ts.toISOString();
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="block mb-0.5" style={{ color: 'var(--text-muted)' }}>ClOrdID (Tag 11)</span>
                    <span className="font-semibold break-all" style={{ color: 'var(--foreground)' }}>
                      {selectedLineInfo.clOrdID || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Tags table */}
                <div>
                  <p className="fx-section-label mb-2">
                    Tag Breakdown ({selectedLineInfo.validation?.tagList?.length || 0} fields)
                  </p>
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs font-mono min-w-[320px]">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th className="py-2.5 px-3 text-left font-semibold">Tag</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Field Name</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLineInfo.validation?.tagList?.map((t, idx) => {
                          const isCrucial = ['8', '9', '35', '11', '10', '52', '90052'].includes(t.tag);
                          return (
                            <tr
                              key={idx}
                              onClick={() => setActiveTag(t.tag)}
                              style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                background: isCrucial ? 'var(--primary-faint)' : 'transparent',
                                cursor: 'pointer'
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
                              <td className="py-2 px-3 truncate max-w-[130px]" style={{ color: 'var(--foreground)' }} title={t.val}>
                                {t.meaning !== t.val ? (
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
              </>
            ) : inspectorTab === 'lifecycle' ? (
              renderLifecycleTimeline()
            ) : (
              renderSequenceFlowDiagram()
            )}
          </div>

          {/* Raw message */}
          <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="fx-section-label mb-2">Raw Message</p>
            <div
              className="p-3 rounded-lg text-[10px] break-all font-mono max-h-20 overflow-y-auto"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {selectedLineInfo.content}
            </div>
          </div>
        </div>
      )}

      {/* Shared Tag Details Modal */}
      {activeTag && (
        <TagDetailsModal
          tag={activeTag}
          version={selectedLineInfo?.validation?.tagList?.find(t => t.tag === '8')?.val || 'FIX.4.4'}
          isOpen={!!activeTag}
          onClose={() => setActiveTag(null)}
          onTagSelect={setActiveTag}
          val1={selectedLineInfo?.validation?.tagList?.find(t => t.tag === activeTag)?.val}
          mappedVal1={selectedLineInfo?.validation?.tagList?.find(t => t.tag === activeTag)?.meaning}
        />
      )}

      {/* Diagnostics Error Analytics Modal */}
      {activeErrorType && (
        <ErrorAnalyticsModal
          errorType={activeErrorType}
          files={files}
          isOpen={!!activeErrorType}
          onClose={() => setActiveErrorType(null)}
          onInspect={(line) => {
            setSelectedLineInfo(line);
            setActiveErrorType(null);
            setInspectorTab("details");
          }}
        />
      )}
    </div>
  );
}