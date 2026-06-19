'use client';

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  Trash2,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRightLeft,
  RefreshCw,
  Sliders,
  ChevronRight,
  TrendingUp,
  HelpCircle
} from "lucide-react";
import { validateFIXMessage, getValueMeaning } from "@/lib/fixParser";

// Standard CSV/TSV Parser with double-quote handling
function parseCSV(text) {
  if (!text || !text.trim()) return { headers: [], rows: [], delimiter: ',' };

  // Detect delimiter: check tabs first (often pasted from Excel), then commas, then semicolons
  let delimiter = ',';
  const firstLine = text.split('\n')[0];
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';')) {
    delimiter = ';';
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [], delimiter };

  const parseLine = (line) => {
    const result = [];
    let curVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(curVal.trim());
        curVal = '';
      } else {
        curVal += char;
      }
    }
    result.push(curVal.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

    const rowObj = {};
    headers.forEach((header, idx) => {
      const val = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
      rowObj[header] = val;
    });
    rows.push(rowObj);
  }

  return { headers, rows, delimiter };
}

// Robust Blotter Timestamp parser supporting various formats (e.g. "19:12:00 +0530 05/06/26" or "Mon May 25 10:23:03 EDT 2026")
function parseBlotterTimestamp(str) {
  if (!str) return null;
  const cleanStr = str.trim();

  // Try standard native parser first (in case it is an ISO or standard string)
  const nativeParsed = new Date(cleanStr);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  // 1. Check format: HH:MM:SS +offset MM/DD/YY (or DD/MM/YY) e.g., "19:12:00 +0530 05/06/26"
  // Regexp matches e.g. "19:12:00 +0530 05/06/26" or "19:12:00.000 -0400 2026/05/25"
  const hhmmssWithOffsetPattern = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s+([+-]\d{4})\s+(\d{2,4})[/-](\d{2,4})[/-](\d{2,4})$/;
  const match1 = cleanStr.match(hhmmssWithOffsetPattern);
  if (match1) {
    const hh = match1[1];
    const mm = match1[2];
    const ss = match1[3];
    const ms = match1[4] || '0';
    const offsetRaw = match1[5]; // e.g. "+0530" or "-0400"
    const valA = match1[6]; // could be year or month
    const valB = match1[7]; // could be day or month
    const valC = match1[8]; // could be year or day
    
    let year, month, day;
    if (valA.length === 4) {
      // YYYY-MM-DD
      year = valA;
      month = valB;
      day = valC;
    } else if (valC.length === 4 || valC.length === 2) {
      // MM/DD/YY or DD/MM/YY or MM/DD/YYYY
      year = valC.length === 2 ? `20${valC}` : valC;
      month = valA;
      day = valB;
    } else {
      year = new Date().getFullYear().toString();
      month = valA;
      day = valB;
    }
    
    // Format offset as "+HH:MM"
    const offsetSign = offsetRaw[0];
    const offsetHh = offsetRaw.substring(1, 3);
    const offsetMm = offsetRaw.substring(3, 5);
    const formattedOffset = `${offsetSign}${offsetHh}:${offsetMm}`;
    
    const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hh}:${mm}:${ss}.${ms.padEnd(3, '0')}${formattedOffset}`;
    const parsed = new Date(isoString);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 2. Map common timezone names (EDT, EST, etc.) to offsets
  const tzMap = {
    'EDT': '-04:00',
    'EST': '-05:00',
    'PDT': '-07:00',
    'PST': '-08:00',
    'CDT': '-05:00',
    'CST': '-06:00',
    'MDT': '-06:00',
    'MST': '-07:00',
    'GMT': '+00:00',
    'BST': '+01:00',
    'IST': '+05:30',
    'UTC': '+00:00'
  };

  let processedStr = cleanStr;
  let tzOffset = "";
  Object.entries(tzMap).forEach(([tz, offset]) => {
    const regex = new RegExp(`\\b${tz}\\b`, 'g');
    if (regex.test(processedStr)) {
      tzOffset = offset;
      processedStr = processedStr.replace(regex, ''); // remove it so native parser doesn't choke
    }
  });

  // Try parsing Mon May 25 10:23:03 EDT 2026 -> Mon May 25 10:23:03 2026 with EDT offset
  const words = processedStr.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length >= 5) {
    const monthName = words[1];
    const day = words[2];
    const time = words[3];
    const year = words[4];
    
    if (monthName && day && time && year) {
      const reordered = `${monthName} ${day} ${year} ${time} ${tzOffset || 'GMT'}`;
      const reorderedParsed = new Date(reordered);
      if (!isNaN(reorderedParsed.getTime())) return reorderedParsed;
    }
  }

  return null;
}

// Map standard missing fills data columns
const TARGET_FIELDS = [
  { key: 'execId', label: 'Exec ID (Tag 17)', aliases: ['exec id', 'execid', 'execution id', 'id', 'tag 17', '17', 'exec_id'] },
  { key: 'qty', label: 'Last Qty (Tag 32)', aliases: ['qty', 'quantity', 'lastqty', 'last qty', 'shares', 'vol', 'volume', 'tag 32', '32', 'last_qty'] },
  { key: 'price', label: 'Last Px (Tag 31)', aliases: ['price', 'px', 'lastpx', 'last px', 'rate', 'price', 'tag 31', '31', 'last_px'] },
  { key: 'symbol', label: 'Symbol (Tag 55)', aliases: ['symbol', 'sym', 'ticker', 'security', 'tag 55', '55', 'sec'] },
  { key: 'timestamp', label: 'Timestamp (Tag 52/60)', aliases: ['timestamp', 'time', 'date', 'sendingtime', 'transacttime', 'created', 'tag 52', '52', 'tag 60', '60'] },
  { key: 'lastMkt', label: 'LastMkt (Tag 30)', aliases: ['lastmkt', 'market', 'exch', 'exchange', 'mkt', 'tag 30', '30', 'last_mkt'] },
  { key: 'logicNode', label: 'LogicNode', aliases: ['logicnode', 'node', 'server', 'engine', 'logic_node'] },
  { key: 'logicNodeTime', label: 'LogicNodeTime', aliases: ['logicnodetime', 'nodetime', 'servertime', 'logic_node_time'] },
];

export default function MissingFillsPage() {
  const [blotterInputMode, setBlotterInputMode] = useState("file"); // 'file' | 'paste'
  const [fixInputMode, setFixInputMode] = useState("file"); // 'file' | 'paste'
  const [blotterRawText, setBlotterRawText] = useState("");
  const [blotterFileName, setBlotterFileName] = useState("");
  const [blotterRows, setBlotterRows] = useState([]);
  const [blotterHeaders, setBlotterHeaders] = useState([]);
  const [blotterDelimiter, setBlotterDelimiter] = useState(",");
  const [columnMappings, setColumnMappings] = useState({
    execId: "",
    qty: "",
    price: "",
    symbol: "",
    timestamp: "",
    lastMkt: "",
    logicNode: "",
    logicNodeTime: "",
  });

  const [fixRawText, setFixRawText] = useState("");
  const [fixFileName, setFixFileName] = useState("");
  
  const [matchedResults, setMatchedResults] = useState([]);
  const [fixFillsList, setFixFillsList] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("missing"); // 'missing' | 'unmapped' | 'matched' | 'all'
  const [selectedResultItem, setSelectedResultItem] = useState(null);
  const [matchTolerance, setMatchTolerance] = useState(5); // in seconds
  const [searchQuery, setSearchQuery] = useState("");
  const [execIdMatchType, setExecIdMatchType] = useState("partial"); // 'exact' | 'partial' | 'disabled'
  const [allowFuzzyMatch, setAllowFuzzyMatch] = useState(true);

  // Auto-detect columns when headers load
  useEffect(() => {
    if (blotterHeaders.length === 0) return;
    
    const newMappings = { ...columnMappings };
    TARGET_FIELDS.forEach(field => {
      // Find matching header by alias
      const matchedHeader = blotterHeaders.find(header => {
        const lowerHeader = header.toLowerCase();
        return field.aliases.some(alias => lowerHeader === alias || lowerHeader.includes(alias));
      });
      if (matchedHeader) {
        newMappings[field.key] = matchedHeader;
      } else {
        // Fallback to exact or close match if no alias matches
        const closeHeader = blotterHeaders.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === field.key.toLowerCase());
        if (closeHeader) {
          newMappings[field.key] = closeHeader;
        }
      }
    });
    setColumnMappings(newMappings);
  }, [blotterHeaders]);

  // Handle CSV/TSV File Upload
  const onBlotterDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setBlotterFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setBlotterRawText(text);
      const parsed = parseCSV(text);
      setBlotterRows(parsed.rows);
      setBlotterHeaders(parsed.headers);
      setBlotterDelimiter(parsed.delimiter);
    };
    reader.readAsText(file);
  }, [columnMappings]);

  // Handle Paste CSV
  const handleBlotterPaste = (text) => {
    setBlotterRawText(text);
    setBlotterFileName("Pasted Spreadsheet Data");
    const parsed = parseCSV(text);
    setBlotterRows(parsed.rows);
    setBlotterHeaders(parsed.headers);
    setBlotterDelimiter(parsed.delimiter);
  };

  // Handle FIX Log File Upload
  const onFixDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFixFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setFixRawText(e.target.result);
    };
    reader.readAsText(file);
  }, []);

  // Reset all
  const handleClear = () => {
    setBlotterInputMode("file");
    setFixInputMode("file");
    setBlotterRawText("");
    setBlotterFileName("");
    setBlotterRows([]);
    setBlotterHeaders([]);
    setColumnMappings({
      execId: "",
      qty: "",
      price: "",
      symbol: "",
      timestamp: "",
      lastMkt: "",
      logicNode: "",
      logicNodeTime: "",
    });
    setFixRawText("");
    setFixFileName("");
    setMatchedResults([]);
    setFixFillsList([]);
    setSelectedResultItem(null);
  };

  // Run matching logic
  const handleAnalyze = () => {
    if (!fixRawText.trim()) return;
    setIsAnalyzing(true);
    setSelectedResultItem(null);

    // 1. Parse FIX messages to find Fills
    const fixLines = fixRawText.split(/\r?\n/).filter(l => l.includes("8=FIX"));
    const parsedFills = [];

    fixLines.forEach((line, lineIdx) => {
      // Clean prefix (e.g. timestamps or headers in raw logs)
      const startIdx = line.indexOf("8=FIX");
      if (startIdx === -1) return;
      const cleanMsg = line.substring(startIdx);
      
      // Split by SOH or |
      let delimiterChar = '\x01';
      if (!cleanMsg.includes(delimiterChar) && cleanMsg.includes('|')) {
        delimiterChar = '|';
      }
      
      const parts = cleanMsg.split(delimiterChar);
      const tags = {};
      const tagList = [];
      parts.forEach(part => {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) return;
        const tag = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1).trim();
        if (tag) {
          tags[tag] = val;
          tagList.push({ tag, val, name: getTagName(tag) || `Tag_${tag}`, meaning: getValueMeaning(tag, val) || val });
        }
      });

      const msgType = tags['35'];
      const execType = tags['150'];
      const ordStatus = tags['39'];
      const lastQty = tags['32'];
      const lastPx = tags['31'];

      // Determine if ExecutionReport is a fill or partial fill
      const isExecReport = msgType === '8';
      const isFill = isExecReport && (
        ['1', '2', 'F'].includes(execType) || 
        ['1', '2'].includes(ordStatus) || 
        (lastQty && parseFloat(lastQty) > 0)
      );

      if (isFill) {
        const execId = tags['17'] || '';
        const orderId = tags['37'] || '';
        const clOrdId = tags['11'] || '';
        const symbol = tags['55'] || '';
        const qty = lastQty ? parseFloat(lastQty) : 0;
        const price = lastPx ? parseFloat(lastPx) : 0;
        const lastMkt = tags['30'] || '';
        
        // Parse FIX Timestamp (Tag 52 SendingTime or Tag 60 TransactTime)
        const timeStr = tags['52'] || tags['60'] || '';
        let timestamp = null;
        if (timeStr) {
          // Standard FIX format: YYYYMMDD-HH:MM:SS.sss or similar
          try {
            const formatted = timeStr.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:$6');
            timestamp = new Date(formatted);
          } catch (err) {
            timestamp = new Date(timeStr);
          }
        }

        parsedFills.push({
          id: `fix-fill-${lineIdx}`,
          lineIndex: lineIdx + 1,
          rawMessage: cleanMsg,
          tags,
          tagList,
          execId,
          orderId,
          clOrdId,
          symbol,
          qty,
          price,
          lastMkt,
          timestamp,
          timeStr
        });
      }
    });

    setFixFillsList(parsedFills);

    // 2. Perform Match
    const results = [];
    const matchedBlotterIndices = new Set();

    // Map helpers to retrieve values from CSV rows
    const getBlotterValue = (row, key) => {
      const header = columnMappings[key];
      return header ? row[header] : undefined;
    };

    parsedFills.forEach(fixFill => {
      let bestMatchIdx = -1;
      let matchReason = "";

      // A. Match by Exec ID
      const fixExecId = fixFill.execId.trim().toLowerCase();
      if (execIdMatchType !== "disabled" && fixExecId && columnMappings.execId) {
        bestMatchIdx = blotterRows.findIndex((row, idx) => {
          if (matchedBlotterIndices.has(idx)) return false;
          const blotterExecId = String(getBlotterValue(row, 'execId') || '').trim().toLowerCase();
          if (!blotterExecId) return false;
          
          if (execIdMatchType === 'exact') {
            return blotterExecId === fixExecId;
          } else { // partial
            return blotterExecId === fixExecId || blotterExecId.includes(fixExecId) || fixExecId.includes(blotterExecId);
          }
        });
        if (bestMatchIdx !== -1) {
          matchReason = execIdMatchType === 'exact' ? "Matched by Exec ID (Exact)" : "Matched by Exec ID (Partial/Drop)";
        }
      }

      // B. Fallback Fuzzy Match (Symbol + Price + Qty + Timestamp)
      if (allowFuzzyMatch && bestMatchIdx === -1) {
        bestMatchIdx = blotterRows.findIndex((row, idx) => {
          if (matchedBlotterIndices.has(idx)) return false;
          
          // Verify Ticker (if mapped)
          if (columnMappings.symbol) {
            const blotterSym = String(getBlotterValue(row, 'symbol') || '').trim().toLowerCase();
            if (blotterSym !== fixFill.symbol.trim().toLowerCase()) return false;
          }

          // Verify Quantity (if mapped)
          if (columnMappings.qty) {
            const blotterQty = parseFloat(getBlotterValue(row, 'qty') || '0');
            if (Math.abs(blotterQty - fixFill.qty) > 0.001) return false;
          }

          // Verify Price (if mapped)
          if (columnMappings.price) {
            const blotterPx = parseFloat(getBlotterValue(row, 'price') || '0');
            if (Math.abs(blotterPx - fixFill.price) > 0.0001) return false;
          }

          // Verify Timestamp if mapped and tolerance is set
          if (columnMappings.timestamp && fixFill.timestamp instanceof Date && !isNaN(fixFill.timestamp.getTime())) {
            const blotterTimeStr = getBlotterValue(row, 'timestamp');
            if (blotterTimeStr) {
              const blotterTime = new Date(blotterTimeStr);
              if (!isNaN(blotterTime.getTime())) {
                const diffSec = Math.abs(blotterTime.getTime() - fixFill.timestamp.getTime()) / 1000;
                if (matchTolerance !== -1 && diffSec > matchTolerance) return false;
              }
            }
          }

          return true;
        });

        if (bestMatchIdx !== -1) {
          matchReason = "Matched by Fuzzy Attributes";
        }
      }

      // Save match result
      if (bestMatchIdx !== -1) {
        matchedBlotterIndices.add(bestMatchIdx);
        const matchedRow = blotterRows[bestMatchIdx];
        results.push({
          type: "matched",
          fix: fixFill,
          blotter: {
            row: matchedRow,
            execId: getBlotterValue(matchedRow, 'execId') || '',
            qty: parseFloat(getBlotterValue(matchedRow, 'qty') || '0'),
            price: parseFloat(getBlotterValue(matchedRow, 'price') || '0'),
            symbol: getBlotterValue(matchedRow, 'symbol') || '',
            timestamp: getBlotterValue(matchedRow, 'timestamp') || '',
            lastMkt: getBlotterValue(matchedRow, 'lastMkt') || '',
            logicNode: getBlotterValue(matchedRow, 'logicNode') || '',
            logicNodeTime: getBlotterValue(matchedRow, 'logicNodeTime') || '',
          },
          matchReason
        });
      } else {
        results.push({
          type: "missing",
          fix: fixFill,
          blotter: null,
          matchReason: "No corresponding execution found in blotter"
        });
      }
    });

    // 3. Add Unmapped Blotter Fills
    blotterRows.forEach((row, idx) => {
      if (!matchedBlotterIndices.has(idx)) {
        results.push({
          type: "unmapped",
          fix: null,
          blotter: {
            row,
            execId: getBlotterValue(row, 'execId') || '',
            qty: parseFloat(getBlotterValue(row, 'qty') || '0'),
            price: parseFloat(getBlotterValue(row, 'price') || '0'),
            symbol: getBlotterValue(row, 'symbol') || '',
            timestamp: getBlotterValue(row, 'timestamp') || '',
            lastMkt: getBlotterValue(row, 'lastMkt') || '',
            logicNode: getBlotterValue(row, 'logicNode') || '',
            logicNodeTime: getBlotterValue(row, 'logicNodeTime') || '',
          },
          matchReason: "Blotter record has no matching FIX message"
        });
      }
    });

    setMatchedResults(results);
    setIsAnalyzing(false);
  };

  // Filter matched results
  const filteredResults = matchedResults.filter(item => {
    // 1. Tab Filter
    if (activeTab === "missing" && item.type !== "missing") return false;
    if (activeTab === "unmapped" && item.type !== "unmapped") return false;
    if (activeTab === "matched" && item.type !== "matched") return false;

    // 2. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const symbolMatch = (item.fix?.symbol || item.blotter?.symbol || '').toLowerCase().includes(q);
      const execIdMatch = (item.fix?.execId || item.blotter?.execId || '').toLowerCase().includes(q);
      const orderIdMatch = (item.fix?.orderId || '').toLowerCase().includes(q);
      const clOrdIdMatch = (item.fix?.clOrdId || '').toLowerCase().includes(q);
      const nodeMatch = (item.blotter?.logicNode || '').toLowerCase().includes(q);
      return symbolMatch || execIdMatch || orderIdMatch || clOrdIdMatch || nodeMatch;
    }

    return true;
  });

  // Summary Metrics
  const summary = {
    fixFills: fixFillsList.length,
    blotterFills: blotterRows.length,
    matched: matchedResults.filter(r => r.type === "matched").length,
    missing: matchedResults.filter(r => r.type === "missing").length,
    unmapped: matchedResults.filter(r => r.type === "unmapped").length,
  };

  // Export Missing Fills CSV
  const handleExportCSV = () => {
    const missingItems = matchedResults.filter(r => r.type === "missing");
    if (missingItems.length === 0) return;

    const headers = ["FIX Line", "ExecID", "OrderID", "ClOrdID", "Symbol", "Qty", "Price", "LastMkt", "Timestamp"];
    const rows = missingItems.map(item => [
      item.fix.lineIndex,
      `"${item.fix.execId}"`,
      `"${item.fix.orderId}"`,
      `"${item.fix.clOrdId}"`,
      `"${item.fix.symbol}"`,
      item.fix.qty,
      item.fix.price,
      `"${item.fix.lastMkt}"`,
      item.fix.timestamp ? item.fix.timestamp.toISOString() : item.fix.timeStr
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `missing_fills_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { getRootProps: getBlotterRootProps, getInputProps: getBlotterInputProps, isDragActive: isBlotterDragActive } = useDropzone({
    onDrop: onBlotterDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt', '.tsv'] },
    multiple: false
  });

  const { getRootProps: getFixRootProps, getInputProps: getFixInputProps, isDragActive: isFixDragActive } = useDropzone({
    onDrop: onFixDrop,
    accept: { 'text/plain': ['.txt', '.log'] },
    multiple: false
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[var(--primary)]" />
            Missing Fills Analyzer
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Compare raw FIX logs against a blotter report (CSV/Excel) to instantly isolate missing executions.
          </p>
        </div>
        
        {matchedResults.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors hover:bg-[var(--primary-faint)]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Clear Data
          </button>
        )}
      </div>

      {matchedResults.length === 0 ? (
        /* Data Imports Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column 1: Blotter Data */}
          <div className="flex flex-col rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                1. Import Blotter Fills (Excel / CSV)
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Upload a exported CSV file or copy-paste spreadsheet columns directly.
              </p>
            </div>

            {blotterRows.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border flex items-center justify-between text-xs" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--primary)]" />
                    <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">{blotterFileName}</span>
                    <span className="text-[10px] bg-[var(--primary-faint)] text-[var(--primary)] px-1.5 py-0.5 rounded font-mono">
                      {blotterRows.length} rows parsed
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setBlotterRawText("");
                      setBlotterRows([]);
                      setBlotterHeaders([]);
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Column Mappings */}
                <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5" />
                      Verify Column Mappings
                    </h3>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Auto-detected delimiter: <strong className="font-mono">{blotterDelimiter === '\t' ? 'TAB' : blotterDelimiter}</strong>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    {TARGET_FIELDS.map(field => (
                      <div key={field.key} className="flex flex-col gap-1">
                        <span className="text-[var(--text-muted)] font-medium">{field.label}:</span>
                        <select
                          value={columnMappings[field.key]}
                          onChange={(e) => setColumnMappings(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="px-2 py-1.5 rounded border outline-none bg-[var(--card)] text-[var(--foreground)] font-mono text-[10px]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="">-- Skip Field --</option>
                          {blotterHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Input Mode Selector */}
                <div className="flex p-1 rounded-lg border w-fit" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                  <button
                    onClick={() => setBlotterInputMode('file')}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${
                      blotterInputMode === 'file'
                        ? 'bg-[var(--primary)] text-[var(--background)] font-bold shadow'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setBlotterInputMode('paste')}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${
                      blotterInputMode === 'paste'
                        ? 'bg-[var(--primary)] text-[var(--background)] font-bold shadow'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Paste Text
                  </button>
                </div>

                {blotterInputMode === 'file' ? (
                  <div 
                    {...getBlotterRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 flex-1 min-h-[160px] bg-zinc-900/10 hover:opacity-90`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <input {...getBlotterInputProps()} />
                    <UploadCloud className="h-8 w-8 text-zinc-500" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs font-medium text-[var(--foreground)]">Drag & drop blotter CSV or click to select</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Supports .csv, .tsv, .txt formats</p>
                  </div>
                ) : (
                  <textarea
                    placeholder="Paste headers and row data copied from Excel here (TAB/TSV or CSV format)..."
                    onChange={(e) => handleBlotterPaste(e.target.value)}
                    className="w-full h-40 p-3 text-[10px] font-mono rounded-xl border outline-none transition-all resize-none focus:border-[var(--primary)] text-[var(--foreground)] placeholder-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Column 2: FIX Log Data */}
          <div className="flex flex-col rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                2. Import FIX Message Logs
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Upload raw FIX log file or paste messages directly. We will automatically filter for execution reports.
              </p>
            </div>

            {fixRawText.trim() ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="p-3 rounded-lg border flex items-center justify-between text-xs" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--primary)]" />
                    <span className="font-medium text-[var(--foreground)] truncate max-w-[220px]">
                      {fixFileName || "Pasted Raw FIX Messages"}
                    </span>
                    <span className="text-[10px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                      {fixRawText.split('\n').filter(l => l.includes('8=FIX')).length} msgs
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setFixRawText("");
                      setFixFileName("");
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Match Engine Settings */}
                <div className="p-4 rounded-lg border space-y-3 bg-[var(--background)]" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5" />
                    Matching Parameters
                  </h3>
                  <div className="space-y-3 text-[11px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--text-muted)] font-medium shrink-0">Exec ID Matching:</span>
                      <select
                        value={execIdMatchType}
                        onChange={(e) => setExecIdMatchType(e.target.value)}
                        className="px-2 py-1 rounded border outline-none bg-[var(--card)] text-[var(--foreground)] font-mono text-[10px] cursor-pointer"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value="partial">Partial Match (Drop Copy / Substring)</option>
                        <option value="exact">Exact Match (Strict)</option>
                        <option value="disabled">Disabled (Fuzzy Only)</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] font-medium">Fuzzy Attribute Fallback:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="allowFuzzyMatch"
                          checked={allowFuzzyMatch}
                          onChange={(e) => setAllowFuzzyMatch(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-zinc-800 bg-zinc-950 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                        />
                        <label htmlFor="allowFuzzyMatch" className="text-[10px] font-bold text-zinc-400 cursor-pointer">
                          Enabled (Sym + Qty + Px)
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--text-muted)] font-medium shrink-0">Time Drift Tolerance:</span>
                      <select
                        value={matchTolerance}
                        onChange={(e) => setMatchTolerance(Number(e.target.value))}
                        disabled={!allowFuzzyMatch}
                        className="px-2 py-1 rounded border outline-none bg-[var(--card)] text-[var(--foreground)] font-mono text-[10px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value={0}>Exact Second</option>
                        <option value={2}>Within 2s</option>
                        <option value={5}>Within 5s (Default)</option>
                        <option value={30}>Within 30s</option>
                        <option value={60}>Within 1 Minute</option>
                        <option value={300}>Within 5 Minutes</option>
                        <option value={-1}>Disable Timestamp Check</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || blotterRows.length === 0}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-center cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--primary)] text-[var(--background)] hover:opacity-90"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing Logs...
                      </>
                    ) : (
                      <>
                        Run Missing Fills Match
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Input Mode Selector */}
                <div className="flex p-1 rounded-lg border w-fit" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                  <button
                    onClick={() => setFixInputMode('file')}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${
                      fixInputMode === 'file'
                        ? 'bg-[var(--primary)] text-[var(--background)] font-bold shadow'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setFixInputMode('paste')}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${
                      fixInputMode === 'paste'
                        ? 'bg-[var(--primary)] text-[var(--background)] font-bold shadow'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Paste Logs
                  </button>
                </div>

                {fixInputMode === 'file' ? (
                  <div 
                    {...getFixRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 flex-1 min-h-[160px] bg-zinc-900/10 hover:opacity-90`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <input {...getFixInputProps()} />
                    <UploadCloud className="h-8 w-8 text-zinc-500" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs font-medium text-[var(--foreground)]">Drag & drop FIX log file or click to select</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Supports .log, .txt files</p>
                  </div>
                ) : (
                  <textarea
                    placeholder="Paste raw FIX messages here (one message per line, SOH or '|' delimited)..."
                    onChange={(e) => setFixRawText(e.target.value)}
                    className="w-full h-40 p-3 text-[10px] font-mono rounded-xl border outline-none transition-all resize-none focus:border-[var(--primary)] text-[var(--foreground)] placeholder-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Results Section */
        <div className="space-y-6">
          
          {/* Analysis Dashboard Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl border font-mono space-y-1" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">FIX Fills Logged</span>
              <span className="text-xl font-bold text-[var(--foreground)]">{summary.fixFills}</span>
            </div>
            
            <div className="p-4 rounded-xl border font-mono space-y-1" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Blotter Entries</span>
              <span className="text-xl font-bold text-[var(--foreground)]">{summary.blotterFills}</span>
            </div>

            <div className="p-4 rounded-xl border font-mono space-y-1" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Matched Execs</span>
              <span className="text-xl font-bold text-emerald-400">{summary.matched}</span>
            </div>

            <div className="p-4 rounded-xl border font-mono space-y-1 relative overflow-hidden" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Missing in Blotter</span>
              <span className="text-xl font-bold text-red-400 flex items-center gap-1.5">
                {summary.missing}
                {summary.missing > 0 && <AlertCircle className="h-4 w-4 animate-pulse shrink-0" />}
              </span>
            </div>

            <div className="p-4 rounded-xl border font-mono space-y-1" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Unmapped Blotter</span>
              <span className="text-xl font-bold text-amber-400">{summary.unmapped}</span>
            </div>
          </div>

          {/* Interactive Results Table & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Table Column */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Tab Filters and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'missing', label: 'Missing in Blotter', count: summary.missing, colorClass: 'text-red-400 border-red-500/20 bg-red-950/10' },
                    { id: 'unmapped', label: 'Unmapped Blotter', count: summary.unmapped, colorClass: 'text-amber-400 border-amber-500/20 bg-amber-950/10' },
                    { id: 'matched', label: 'Matched Fills', count: summary.matched, colorClass: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/10' },
                    { id: 'all', label: 'All Results', count: matchedResults.length, colorClass: 'text-zinc-400 border-zinc-800' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSelectedResultItem(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-2 transition-all ${
                        activeTab === tab.id 
                          ? tab.colorClass + ' opacity-100 font-bold scale-[1.02]' 
                          : 'border-transparent text-zinc-500 hover:text-zinc-300 opacity-70'
                      }`}
                    >
                      {tab.label}
                      <span className="text-[10px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Search Bar */}
                  <div className="relative flex-grow sm:flex-grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter by Symbol / ExecID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border bg-zinc-950 outline-none text-xs text-[var(--foreground)] placeholder-zinc-600 focus:border-[var(--primary)] transition-all font-mono w-full sm:w-44"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>

                  {activeTab === 'missing' && summary.missing > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[var(--background)] font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-xs text-left font-mono">
                  <thead>
                    <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th className="py-3 px-4 font-semibold">Type</th>
                      <th className="py-3 px-4 font-semibold">Symbol</th>
                      <th className="py-3 px-4 font-semibold">ExecID</th>
                      <th className="py-3 px-4 font-semibold">Qty</th>
                      <th className="py-3 px-4 font-semibold">Price</th>
                      <th className="py-3 px-4 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length > 0 ? (
                      filteredResults.map((item, idx) => {
                        const isSelected = selectedResultItem && (
                          (item.type === 'missing' && selectedResultItem.fix?.id === item.fix?.id) ||
                          (item.type === 'unmapped' && selectedResultItem.blotter?.execId === item.blotter?.execId && selectedResultItem.blotter?.qty === item.blotter?.qty) ||
                          (item.type === 'matched' && selectedResultItem.fix?.id === item.fix?.id)
                        );
                        
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedResultItem(item)}
                            className={`border-b border-zinc-900 hover:bg-zinc-800/10 cursor-pointer transition-colors ${
                              isSelected ? 'bg-zinc-800/20' : 'bg-transparent'
                            }`}
                            style={{ 
                              borderBottomColor: 'var(--border-subtle)',
                              boxShadow: isSelected ? 'inset 2px 0 0 var(--primary)' : 'none'
                            }}
                          >
                            <td className="py-2.5 px-4">
                              {item.type === "missing" ? (
                                <span className="bg-red-950/40 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-900/30">
                                  Missing
                                </span>
                              ) : item.type === "unmapped" ? (
                                <span className="bg-amber-950/40 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-900/30">
                                  Unmapped
                                </span>
                              ) : (
                                <span className="bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-900/30">
                                  Matched
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-[var(--foreground)]">
                              {item.fix?.symbol || item.blotter?.symbol || 'N/A'}
                            </td>
                            <td className="py-2.5 px-4 text-zinc-400 truncate max-w-[120px]" title={item.fix?.execId || item.blotter?.execId}>
                              {item.fix?.execId || item.blotter?.execId || 'N/A'}
                            </td>
                            <td className="py-2.5 px-4 text-[var(--foreground)]">
                              {item.fix?.qty || item.blotter?.qty}
                            </td>
                            <td className="py-2.5 px-4 text-[var(--foreground)] font-semibold">
                              {item.fix?.price || item.blotter?.price}
                            </td>
                            <td className="py-2.5 px-4 text-zinc-500">
                              {item.fix?.timestamp 
                                ? item.fix.timestamp.toISOString().split('T')[1].replace('Z', '') 
                                : item.blotter?.timestamp 
                                  ? String(item.blotter.timestamp).split(' ')[1] || item.blotter.timestamp
                                  : 'N/A'
                              }
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500 italic">
                          No executions match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* side details panel */}
            <div className="space-y-4">
              {selectedResultItem ? (
                <div className="rounded-xl border p-5 space-y-4 animate-in fade-in-25 duration-100" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  
                  {/* Header details */}
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        Execution Details
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {selectedResultItem.matchReason}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedResultItem(null)} 
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Comparisons */}
                  <div className="space-y-4">
                    
                    {selectedResultItem.type === "matched" && (
                      <div className="space-y-3.5">
                        <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">Comparison Matrix</span>
                        
                        <div className="space-y-2 text-[11px] font-mono">
                          <div className="grid grid-cols-3 pb-1 border-b border-zinc-900 text-zinc-500">
                            <span>Field</span>
                            <span>FIX Log</span>
                            <span>Blotter</span>
                          </div>
                          {[
                            { label: "Exec ID", fix: selectedResultItem.fix.execId, blotter: selectedResultItem.blotter.execId },
                            { label: "Symbol", fix: selectedResultItem.fix.symbol, blotter: selectedResultItem.blotter.symbol },
                            { label: "Qty", fix: selectedResultItem.fix.qty, blotter: selectedResultItem.blotter.qty },
                            { label: "Price", fix: selectedResultItem.fix.price, blotter: selectedResultItem.blotter.price },
                            { label: "Market", fix: selectedResultItem.fix.lastMkt, blotter: selectedResultItem.blotter.lastMkt },
                            { label: "Time", fix: selectedResultItem.fix.timeStr, blotter: selectedResultItem.blotter.timestamp },
                            { label: "LogicNode", fix: 'N/A', blotter: selectedResultItem.blotter.logicNode },
                            { label: "NodeTime", fix: 'N/A', blotter: selectedResultItem.blotter.logicNodeTime }
                          ].map((row, idx) => {
                            const isDiscrepancy = row.fix !== 'N/A' && row.blotter !== 'N/A' && String(row.fix).toLowerCase() !== String(row.blotter).toLowerCase();
                            return (
                              <div key={idx} className="grid grid-cols-3 py-1 font-mono items-center">
                                <span className="text-[var(--text-muted)]">{row.label}</span>
                                <span className="text-[var(--foreground)] truncate pr-2">{row.fix}</span>
                                <span className={`truncate ${isDiscrepancy ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
                                  {row.blotter || 'N/A'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedResultItem.type === "missing" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-950/20 p-2.5 rounded border border-red-900/30">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          This fill is missing in your blotter database.
                        </div>

                        <div className="space-y-2 text-[11px] font-mono">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Extracted FIX Tags</span>
                          <div className="p-3 rounded-lg border text-zinc-300 space-y-1 bg-zinc-950" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex justify-between"><span className="text-zinc-500">ExecID (17):</span> <span>{selectedResultItem.fix.execId}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Symbol (55):</span> <span>{selectedResultItem.fix.symbol}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">LastQty (32):</span> <span>{selectedResultItem.fix.qty}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">LastPx (31):</span> <span>{selectedResultItem.fix.price}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">OrderID (37):</span> <span>{selectedResultItem.fix.orderId || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">ClOrdID (11):</span> <span>{selectedResultItem.fix.clOrdID || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">LastMkt (30):</span> <span>{selectedResultItem.fix.lastMkt || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Time (52):</span> <span className="truncate max-w-[150px]">{selectedResultItem.fix.timeStr}</span></div>
                          </div>
                        </div>

                        <div className="space-y-2 text-[11px]">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Raw FIX Message (Line {selectedResultItem.fix.lineIndex})</span>
                          <div className="p-3 rounded-lg border text-[10px] font-mono break-all max-h-32 overflow-y-auto bg-zinc-950 text-zinc-400" style={{ borderColor: 'var(--border)' }}>
                            {selectedResultItem.fix.rawMessage}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedResultItem.type === "unmapped" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-950/20 p-2.5 rounded border border-amber-900/30">
                          <HelpCircle className="h-4 w-4 shrink-0" />
                          Blotter record has no matching FIX message.
                        </div>

                        <div className="space-y-2 text-[11px] font-mono">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Imported Blotter Values</span>
                          <div className="p-3 rounded-lg border text-zinc-300 space-y-1.5 bg-zinc-950" style={{ borderColor: 'var(--border)' }}>
                            {Object.entries(selectedResultItem.blotter.row).map(([key, val]) => (
                              <div key={key} className="flex justify-between gap-4 font-mono">
                                <span className="text-zinc-500 truncate max-w-[120px]">{key}:</span> 
                                <span className="text-zinc-300 break-all">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-12 text-center text-xs text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
                  Select an execution row to inspect comparisons and raw fields.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
