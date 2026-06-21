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
import { validateFIXMessage, getValueMeaning, getTagName } from "@/lib/fixParser";
import SohVisualizer from "@/components/SohVisualizer";

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

// Robust FIX Timestamp parser to correctly parse UTC SendingTime (Tag 52) or TransactTime (Tag 60)
function parseFixTimestamp(timeStr) {
  if (!timeStr) return null;
  const cleanStr = timeStr.trim();

  // Try to parse standard FIX format: YYYYMMDD-HH:MM:SS.sss or YYYYMMDD-HH:MM:SS
  const fixPattern = /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;
  const match = cleanStr.match(fixPattern);
  if (match) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    const hh = match[4];
    const mm = match[5];
    const ss = match[6];
    const ms = match[7] || '000';
    // Construct ISO string explicitly in UTC (appending 'Z')
    const iso = `${year}-${month}-${day}T${hh}:${mm}:${ss}.${ms.padEnd(3, '0').substring(0, 3)}Z`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to native parsing, but treat as UTC if it looks like ISO without offset
  const nativeParsed = new Date(cleanStr);
  if (!isNaN(nativeParsed.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanStr) && !cleanStr.endsWith('Z') && !/[+-]\d{2}/.test(cleanStr)) {
      const utcParsed = new Date(cleanStr + 'Z');
      if (!isNaN(utcParsed.getTime())) return utcParsed;
    }
    return nativeParsed;
  }

  return null;
}

// Robust Blotter Timestamp parser supporting various formats (e.g. "19:12:00 +0530 05/06/26" or "Mon May 25 10:23:03 EDT 2026")
function parseBlotterTimestamp(str, referenceDate) {
  if (!str) return null;
  const cleanStr = str.trim();

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
    } else {
      // MM/DD/YY or DD/MM/YY
      const yearVal = valC.length === 2 ? `20${valC}` : valC;
      
      const monthA = parseInt(valA, 10);
      const dayA = parseInt(valB, 10);
      const monthB = parseInt(valB, 10);
      const dayB = parseInt(valA, 10);
      
      if (referenceDate) {
        // Disambiguate using reference month from FIX logs
        const refMonthLocal = referenceDate.getMonth() + 1;
        const refMonthUTC = referenceDate.getUTCMonth() + 1;
        const refYearLocal = referenceDate.getFullYear();
        const refYearUTC = referenceDate.getUTCFullYear();

        if ((monthB === refMonthLocal && String(refYearLocal) === yearVal) || (monthB === refMonthUTC && String(refYearUTC) === yearVal)) {
          year = yearVal;
          month = String(monthB);
          day = String(dayB);
        } else {
          year = yearVal;
          month = String(monthA);
          day = String(dayA);
        }
      } else {
        year = yearVal;
        month = String(monthA);
        day = String(dayA);
      }
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

  // Try standard native parser last (as fallback)
  const nativeParsed = new Date(cleanStr);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  return null;
}


// Helper to format Date object cleanly as UTC YYYY-MM-DD HH:mm:ss.SSS
function formatUTC(date) {
  if (!date || isNaN(date.getTime())) return 'N/A';
  const iso = date.toISOString(); // e.g. "2026-05-25T14:23:03.000Z"
  const datePart = iso.split('T')[0];
  const timePart = iso.split('T')[1].replace('Z', '');
  return `${datePart} ${timePart}`;
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

  // Advanced filters and execution report criteria
  const [execTypesToConsider, setExecTypesToConsider] = useState({
    '1': true, // Partial Fill
    '2': true, // Fill
    'F': true, // Trade
    '0': false, // New
    '4': false, // Canceled
    '5': false, // Replaced
    '8': false, // Rejected
  });
  const [ordStatusesToConsider, setOrdStatusesToConsider] = useState({
    '1': true, // Partial Fill
    '2': true, // Fill
    '0': false, // New
    '4': false, // Canceled
    '8': false, // Rejected
  });
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [filterOrderId, setFilterOrderId] = useState("");
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);

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

  // Session auto-discovery from raw FIX text
  useEffect(() => {
    if (!fixRawText.trim()) {
      setAvailableSessions([]);
      setSelectedSessions([]);
      return;
    }
    const lines = fixRawText.split(/\r?\n/).filter(l => l.includes("8=FIX"));
    const sessionsMap = new Set();
    lines.forEach(line => {
      const startIdx = line.indexOf("8=FIX");
      if (startIdx === -1) return;
      const cleanMsg = line.substring(startIdx);
      let delimiterChar = '\x01';
      if (!cleanMsg.includes(delimiterChar) && cleanMsg.includes('|')) {
        delimiterChar = '|';
      }
      
      const parts = cleanMsg.split(delimiterChar);
      let sender = '';
      let target = '';
      for (const part of parts) {
        if (part.startsWith('49=')) sender = part.substring(3).trim();
        if (part.startsWith('56=')) target = part.substring(3).trim();
        if (sender && target) break;
      }
      if (sender && target) {
        // Group bidirectionally by sorting sender and target alphabetically
        const sessionKey = [sender, target].sort().join(' ↔ ');
        sessionsMap.add(sessionKey);
      }
    });
    const sessionsList = Array.from(sessionsMap);
    setAvailableSessions(sessionsList);
    setSelectedSessions(sessionsList); // default select all
  }, [fixRawText]);

  // Load cached settings and raw data on initial mount
  useEffect(() => {
    try {
      const cachedBlotterRaw = localStorage.getItem("fixify_blotter_raw");
      const cachedBlotterName = localStorage.getItem("fixify_blotter_name");
      const cachedMappings = localStorage.getItem("fixify_column_mappings");
      
      const cachedFixRaw = localStorage.getItem("fixify_fix_raw");
      const cachedFixName = localStorage.getItem("fixify_fix_name");
      
      const cachedTolerance = localStorage.getItem("fixify_match_tolerance");
      const cachedMatchType = localStorage.getItem("fixify_match_type");
      const cachedFuzzy = localStorage.getItem("fixify_allow_fuzzy");
      const cachedOrderId = localStorage.getItem("fixify_filter_order_id");
      const cachedSelectedSessions = localStorage.getItem("fixify_selected_sessions");
      
      const cachedExecTypes = localStorage.getItem("fixify_exec_types_to_consider");
      const cachedOrdStatuses = localStorage.getItem("fixify_ord_statuses_to_consider");

      if (cachedBlotterRaw) {
        setBlotterRawText(cachedBlotterRaw);
        const parsed = parseCSV(cachedBlotterRaw);
        setBlotterRows(parsed.rows);
        setBlotterHeaders(parsed.headers);
        setBlotterDelimiter(parsed.delimiter);
      }
      if (cachedBlotterName) setBlotterFileName(cachedBlotterName);
      if (cachedMappings) setColumnMappings(JSON.parse(cachedMappings));
      
      if (cachedFixRaw) setFixRawText(cachedFixRaw);
      if (cachedFixName) setFixFileName(cachedFixName);
      
      if (cachedTolerance) setMatchTolerance(Number(cachedTolerance));
      if (cachedMatchType) setExecIdMatchType(cachedMatchType);
      if (cachedFuzzy) setAllowFuzzyMatch(cachedFuzzy === "true");
      if (cachedOrderId) setFilterOrderId(cachedOrderId);
      
      if (cachedExecTypes) setExecTypesToConsider(JSON.parse(cachedExecTypes));
      if (cachedOrdStatuses) setOrdStatusesToConsider(JSON.parse(cachedOrdStatuses));

      if (cachedSelectedSessions) setSelectedSessions(JSON.parse(cachedSelectedSessions));
    } catch (err) {
      console.warn("Failed to load cached Missing Fills settings:", err);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("fixify_blotter_raw", blotterRawText || "");
      localStorage.setItem("fixify_blotter_name", blotterFileName || "");
      localStorage.setItem("fixify_column_mappings", JSON.stringify(columnMappings));
      localStorage.setItem("fixify_fix_raw", fixRawText || "");
      localStorage.setItem("fixify_fix_name", fixFileName || "");
      localStorage.setItem("fixify_match_tolerance", String(matchTolerance));
      localStorage.setItem("fixify_match_type", execIdMatchType);
      localStorage.setItem("fixify_allow_fuzzy", String(allowFuzzyMatch));
      localStorage.setItem("fixify_filter_order_id", filterOrderId || "");
      localStorage.setItem("fixify_selected_sessions", JSON.stringify(selectedSessions));
      localStorage.setItem("fixify_exec_types_to_consider", JSON.stringify(execTypesToConsider));
      localStorage.setItem("fixify_ord_statuses_to_consider", JSON.stringify(ordStatusesToConsider));
    } catch (err) {
      console.warn("Failed to cache Missing Fills settings:", err);
    }
  }, [
    blotterRawText,
    blotterFileName,
    columnMappings,
    fixRawText,
    fixFileName,
    matchTolerance,
    execIdMatchType,
    allowFuzzyMatch,
    filterOrderId,
    selectedSessions,
    execTypesToConsider,
    ordStatusesToConsider
  ]);

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
    setExecTypesToConsider({
      '1': true,
      '2': true,
      'F': true,
      '0': false,
      '4': false,
      '5': false,
      '8': false,
    });
    setOrdStatusesToConsider({
      '1': true,
      '2': true,
      '0': false,
      '4': false,
      '8': false,
    });
    setAvailableSessions([]);
    setSelectedSessions([]);
    setFilterOrderId("");

    // Clear localStorage cache
    try {
      localStorage.removeItem("fixify_blotter_raw");
      localStorage.removeItem("fixify_blotter_name");
      localStorage.removeItem("fixify_column_mappings");
      localStorage.removeItem("fixify_fix_raw");
      localStorage.removeItem("fixify_fix_name");
      localStorage.removeItem("fixify_match_tolerance");
      localStorage.removeItem("fixify_match_type");
      localStorage.removeItem("fixify_allow_fuzzy");
      localStorage.removeItem("fixify_filter_order_id");
      localStorage.removeItem("fixify_selected_sessions");
      localStorage.removeItem("fixify_exec_types_to_consider");
      localStorage.removeItem("fixify_ord_statuses_to_consider");
    } catch (err) {
      console.warn("Failed to clear cached Missing Fills settings:", err);
    }
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

      // Session Filter Check
      const sender = tags['49'] || '';
      const target = tags['56'] || '';
      const sessionKey = [sender, target].sort().join(' ↔ ');
      if (selectedSessions.length > 0 && !selectedSessions.includes(sessionKey)) {
        return;
      }

      // Order ID Filter Check
      const orderId = tags['37'] || '';
      const clOrdId = tags['11'] || '';
      if (filterOrderId.trim()) {
        const filterIds = filterOrderId.split(',').map(id => id.trim().toLowerCase()).filter(Boolean);
        if (filterIds.length > 0) {
          const matchOrder = filterIds.some(id => 
            orderId.toLowerCase().includes(id) || 
            clOrdId.toLowerCase().includes(id)
          );
          if (!matchOrder) return;
        }
      }

      // Determine if ExecutionReport is a fill based on configuration
      const isExecReport = msgType === '8';
      if (!isExecReport) return;

      const matchExecType = execType && execTypesToConsider[execType];
      const matchOrdStatus = ordStatus && ordStatusesToConsider[ordStatus];
      
      // Fallback: if no criteria checks are enabled, default to LastQty > 0
      const noCriteriaEnabled = Object.values(execTypesToConsider).every(v => !v) && Object.values(ordStatusesToConsider).every(v => !v);
      const isFill = matchExecType || matchOrdStatus || (noCriteriaEnabled && lastQty && parseFloat(lastQty) > 0);

      if (isFill) {
        const execId = tags['17'] || '';
        const symbol = tags['55'] || '';
        const qty = lastQty ? parseFloat(lastQty) : 0;
        const price = lastPx ? parseFloat(lastPx) : 0;
        const lastMkt = tags['30'] || '';
        
        // Parse FIX Timestamp using robust parseFixTimestamp
        const timeStr = tags['52'] || tags['60'] || '';
        const timestamp = parseFixTimestamp(timeStr);

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

    // Find reference date from FIX fills
    let fixReferenceDate = null;
    for (const fixFill of parsedFills) {
      if (fixFill.timestamp && !isNaN(fixFill.timestamp.getTime())) {
        fixReferenceDate = fixFill.timestamp;
        break;
      }
    }

    // Pre-parse blotter row timestamps and logic node times using the FIX reference date
    const blotterParsedRows = blotterRows.map(row => {
      const timeStr = getBlotterValue(row, 'timestamp');
      const nodeTimeStr = getBlotterValue(row, 'logicNodeTime');
      const timestampObj = timeStr ? parseBlotterTimestamp(timeStr, fixReferenceDate) : null;
      const logicNodeTimeObj = nodeTimeStr ? parseBlotterTimestamp(nodeTimeStr, fixReferenceDate) : null;
      return {
        row,
        timestampObj,
        logicNodeTimeObj
      };
    });

    parsedFills.forEach(fixFill => {
      let bestMatchIdx = -1;
      let matchReason = "";

      // A. Match by Exec ID
      const fixExecId = fixFill.execId.trim().toLowerCase();
      if (execIdMatchType !== "disabled" && fixExecId && columnMappings.execId) {
        bestMatchIdx = blotterParsedRows.findIndex((pRow, idx) => {
          if (matchedBlotterIndices.has(idx)) return false;
          const blotterExecId = String(getBlotterValue(pRow.row, 'execId') || '').trim().toLowerCase();
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
        bestMatchIdx = blotterParsedRows.findIndex((pRow, idx) => {
          if (matchedBlotterIndices.has(idx)) return false;
          const row = pRow.row;
          
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
            const blotterTime = pRow.timestampObj;
            if (blotterTime && !isNaN(blotterTime.getTime())) {
              const diffSec = Math.abs(blotterTime.getTime() - fixFill.timestamp.getTime()) / 1000;
              if (matchTolerance !== -1 && diffSec > matchTolerance) return false;
            } else {
              return false; // If time is mapped but can't be parsed, fail the check
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
        const pMatched = blotterParsedRows[bestMatchIdx];
        const matchedRow = pMatched.row;
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
            timestampObj: pMatched.timestampObj,
            lastMkt: getBlotterValue(matchedRow, 'lastMkt') || '',
            logicNode: getBlotterValue(matchedRow, 'logicNode') || '',
            logicNodeTime: getBlotterValue(matchedRow, 'logicNodeTime') || '',
            logicNodeTimeObj: pMatched.logicNodeTimeObj,
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
    blotterParsedRows.forEach((pRow, idx) => {
      if (!matchedBlotterIndices.has(idx)) {
        const row = pRow.row;
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
            timestampObj: pRow.timestampObj,
            lastMkt: getBlotterValue(row, 'lastMkt') || '',
            logicNode: getBlotterValue(row, 'logicNode') || '',
            logicNodeTime: getBlotterValue(row, 'logicNodeTime') || '',
            logicNodeTimeObj: pRow.logicNodeTimeObj,
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

  // Export active results CSV
  const handleExportCSV = () => {
    let itemsToExport = [];
    let filename = "";
    let headers = [];
    let rows = [];

    if (activeTab === "missing") {
      itemsToExport = matchedResults.filter(r => r.type === "missing");
      filename = `missing_fills_${Date.now()}.csv`;
      headers = ["FIX Line", "ExecID", "OrderID", "ClOrdID", "Symbol", "Qty", "Price", "LastMkt", "Timestamp"];
      rows = itemsToExport.map(item => [
        item.fix.lineIndex,
        `"${item.fix.execId}"`,
        `"${item.fix.orderId || ''}"`,
        `"${item.fix.clOrdId || ''}"`,
        `"${item.fix.symbol}"`,
        item.fix.qty,
        item.fix.price,
        `"${item.fix.lastMkt || ''}"`,
        item.fix.timestamp ? item.fix.timestamp.toISOString() : item.fix.timeStr
      ]);
    } else if (activeTab === "unmapped") {
      itemsToExport = matchedResults.filter(r => r.type === "unmapped");
      filename = `unmapped_blotter_${Date.now()}.csv`;
      headers = ["ExecID", "Symbol", "Qty", "Price", "Timestamp", "LogicNode", "LogicNodeTime"];
      rows = itemsToExport.map(item => [
        `"${item.blotter.execId || ''}"`,
        `"${item.blotter.symbol || ''}"`,
        item.blotter.qty,
        item.blotter.price,
        item.blotter.timestamp || '',
        `"${item.blotter.logicNode || ''}"`,
        item.blotter.logicNodeTime || ''
      ]);
    } else if (activeTab === "matched") {
      itemsToExport = matchedResults.filter(r => r.type === "matched");
      filename = `matched_fills_${Date.now()}.csv`;
      headers = [
        "ExecID", "Symbol", 
        "Qty (FIX)", "Qty (Blotter)", 
        "Price (FIX)", "Price (Blotter)", 
        "Timestamp (FIX)", "Timestamp (Blotter)", 
        "LogicNode", "Match Reason"
      ];
      rows = itemsToExport.map(item => [
        `"${item.fix.execId}"`,
        `"${item.fix.symbol}"`,
        item.fix.qty,
        item.blotter.qty,
        item.fix.price,
        item.blotter.price,
        item.fix.timestamp ? item.fix.timestamp.toISOString() : item.fix.timeStr,
        item.blotter.timestamp || '',
        `"${item.blotter.logicNode || ''}"`,
        `"${item.matchReason}"`
      ]);
    } else {
      // "all"
      itemsToExport = filteredResults;
      filename = `all_comparison_results_${Date.now()}.csv`;
      headers = ["Type", "ExecID", "Symbol", "Qty", "Price", "Timestamp", "Match Details"];
      rows = itemsToExport.map(item => {
        const type = item.type;
        const execId = item.fix?.execId || item.blotter?.execId || '';
        const symbol = item.fix?.symbol || item.blotter?.symbol || '';
        const qty = item.fix?.qty || item.blotter?.qty || '';
        const price = item.fix?.price || item.blotter?.price || '';
        const timestamp = item.fix?.timestamp 
          ? item.fix.timestamp.toISOString() 
          : item.blotter?.timestampObj
            ? item.blotter.timestampObj.toISOString()
            : item.blotter?.timestamp || item.fix?.timeStr || '';
        const details = item.matchReason || '';
        return [
          `"${type}"`,
          `"${execId}"`,
          `"${symbol}"`,
          qty,
          price,
          `"${timestamp}"`,
          `"${details}"`
        ];
      });
    }

    if (rows.length === 0) return;

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
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
    <div className="max-w-screen-2xl mx-auto px-4 space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            {filteredResults.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[var(--background)] font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export {activeTab === 'all' ? 'All' : activeTab === 'missing' ? 'Missing' : activeTab === 'unmapped' ? 'Unmapped' : 'Matched'} CSV
              </button>
            )}
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors hover:bg-[var(--primary-faint)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {matchedResults.length === 0 ? (
        /* Data Imports Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column 1: Blotter Data */}
          <div className="flex flex-col rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                1. Import Blotter Fills (Excel / CSV)
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Upload a exported CSV file or copy-paste spreadsheet columns directly.
              </p>
            </div>

            {blotterRows.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg flex items-center justify-between text-xs" style={{ backgroundColor: 'var(--background)' }}>
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
                <div className="p-4 rounded-lg space-y-3" style={{ backgroundColor: 'var(--background)' }}>
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
                2. Import FIX Message Logs
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Upload raw FIX log file or paste messages directly. We will automatically filter for execution reports.
              </p>
            </div>

            {fixRawText.trim() ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="p-3 rounded-lg flex items-center justify-between text-xs" style={{ backgroundColor: 'var(--background)' }}>
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
                <div className="p-4 rounded-lg space-y-3 bg-[var(--background)]">
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
                          className="h-3.5 w-3.5 rounded bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
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

                    <div className="flex items-center justify-between border-t pt-2 border-[var(--border-subtle)] mt-2">
                      <span className="text-[var(--text-muted)] font-medium shrink-0">Pass-Through / Criteria:</span>
                      <button
                        onClick={() => setIsCriteriaModalOpen(true)}
                        className="px-2 py-1.5 bg-[var(--primary-faint)] border rounded hover:opacity-90 font-bold cursor-pointer text-[10px]"
                        style={{ borderColor: 'var(--primary)', color: 'var(--foreground)' }}
                      >
                        Filters ({selectedSessions.length === availableSessions.length ? 'All' : `${selectedSessions.length}/${availableSessions.length}`} Sessions)
                      </button>
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
                  <div className="flex flex-col gap-2 flex-1">
                    <textarea
                      value={fixRawText}
                      placeholder="Paste raw FIX messages here (one message per line, SOH or '|' delimited)..."
                      onChange={(e) => setFixRawText(e.target.value)}
                      className="w-full h-40 p-3 text-[10px] font-mono rounded-xl border outline-none transition-all resize-none focus:border-[var(--primary)] text-[var(--foreground)] placeholder-[var(--text-muted)]"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                    />
                    {fixRawText.trim() && (
                      <div className="p-3.5 rounded-xl border text-[11px] font-mono space-y-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Raw Payload Preview (First 3 lines):</span>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {fixRawText.split('\n').filter(l => l.includes('8=FIX')).slice(0, 3).map((line, idx) => (
                            <div key={idx} className="p-2 rounded bg-zinc-950/40 border border-zinc-900/50">
                              <SohVisualizer content={line} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
            <div 
              onClick={() => { setActiveTab('all'); setSelectedResultItem(null); }}
              className="p-4 rounded-xl border font-mono space-y-1 cursor-pointer transition-all hover:scale-[1.02] hover:bg-zinc-800/10" 
              style={{ 
                backgroundColor: 'var(--card)', 
                borderColor: activeTab === 'all' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">FIX Fills Logged</span>
              <span className="text-xl font-bold text-[var(--foreground)]">{summary.fixFills}</span>
            </div>
            
            <div 
              onClick={() => { setActiveTab('all'); setSelectedResultItem(null); }}
              className="p-4 rounded-xl border font-mono space-y-1 cursor-pointer transition-all hover:scale-[1.02] hover:bg-zinc-800/10" 
              style={{ 
                backgroundColor: 'var(--card)', 
                borderColor: activeTab === 'all' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Blotter Entries</span>
              <span className="text-xl font-bold text-[var(--foreground)]">{summary.blotterFills}</span>
            </div>

            <div 
              onClick={() => { setActiveTab('matched'); setSelectedResultItem(null); }}
              className="p-4 rounded-xl border font-mono space-y-1 cursor-pointer transition-all hover:scale-[1.02] hover:bg-emerald-950/10" 
              style={{ 
                backgroundColor: 'var(--card)', 
                borderColor: activeTab === 'matched' ? '#10b981' : 'var(--border)'
              }}
            >
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Matched Execs</span>
              <span className="text-xl font-bold text-emerald-400">{summary.matched}</span>
            </div>

            <div 
              onClick={() => { setActiveTab('missing'); setSelectedResultItem(null); }}
              className="p-4 rounded-xl border font-mono space-y-1 relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:bg-red-950/10" 
              style={{ 
                backgroundColor: 'var(--card)', 
                borderColor: activeTab === 'missing' ? '#ef4444' : 'var(--border)'
              }}
            >
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Missing in Blotter</span>
              <span className="text-xl font-bold text-red-400 flex items-center gap-1.5">
                {summary.missing}
                {summary.missing > 0 && <AlertCircle className="h-4 w-4 animate-pulse shrink-0" />}
              </span>
            </div>

            <div 
              onClick={() => { setActiveTab('unmapped'); setSelectedResultItem(null); }}
              className="p-4 rounded-xl border font-mono space-y-1 cursor-pointer transition-all hover:scale-[1.02] hover:bg-amber-950/10" 
              style={{ 
                backgroundColor: 'var(--card)', 
                borderColor: activeTab === 'unmapped' ? '#f59e0b' : 'var(--border)'
              }}
            >
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Unmapped Blotter</span>
              <span className="text-xl font-bold text-amber-400">{summary.unmapped}</span>
            </div>
          </div>

          {/* Interactive Results Table & Controls */}
          <div className="w-full space-y-4">
            
            {/* Table Column */}
            <div className="w-full space-y-4">
              
              {/* Tab Filters and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'missing', label: 'Missing in Blotter', count: summary.missing, activeStyle: { color: 'var(--foreground)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' } },
                    { id: 'unmapped', label: 'Unmapped Blotter', count: summary.unmapped, activeStyle: { color: 'var(--foreground)', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' } },
                    { id: 'matched', label: 'Matched Fills', count: summary.matched, activeStyle: { color: 'var(--foreground)', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' } },
                    { id: 'all', label: 'All Results', count: matchedResults.length, activeStyle: { color: 'var(--foreground)', backgroundColor: 'var(--primary-faint)', borderColor: 'var(--border)' } }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSelectedResultItem(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-2 transition-all ${
                        activeTab === tab.id 
                          ? 'opacity-100 font-bold scale-[1.02]' 
                          : 'border-transparent text-zinc-500 hover:text-zinc-300 opacity-70'
                      }`}
                      style={activeTab === tab.id ? tab.activeStyle : {}}
                    >
                      {tab.label}
                      <span className="text-[10px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded text-[var(--foreground)] opacity-80">
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
                            className={`hover:bg-zinc-800/10 cursor-pointer transition-colors ${
                              isSelected ? 'bg-zinc-800/20' : 'bg-transparent'
                            }`}
                            style={{ 
                              borderBottom: '1px solid var(--border-subtle)',
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
                                : item.blotter?.timestampObj 
                                  ? item.blotter.timestampObj.toISOString().split('T')[1].replace('Z', '')
                                  : item.blotter?.timestamp || 'N/A'
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

          </div>

        </div>
      )}

      {/* Floating Inspector Panel */}
      {selectedResultItem && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setSelectedResultItem(null)}
          />
          <div
            className="fixed inset-y-0 right-0 w-full sm:w-[500px] shadow-2xl z-50 flex flex-col bg-[var(--card)] border-l"
            style={{
              borderColor: 'var(--border)',
            }}
          >
            {/* Inspector header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Execution Details
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                  {selectedResultItem.matchReason}
                </p>
              </div>
              <button 
                onClick={() => setSelectedResultItem(null)} 
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:bg-zinc-800/50"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              
              {/* Comparisons */}
              <div className="space-y-4">
                
                {selectedResultItem.type === "matched" && (
                  <div className="space-y-3.5">
                    <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">Comparison Matrix</span>
                    
                    <div className="space-y-2 text-[11px] font-mono">
                      <div className="grid grid-cols-3 pb-1 text-zinc-500 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
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
                        { 
                          label: "Time (UTC)", 
                          fix: selectedResultItem.fix.timestamp ? formatUTC(selectedResultItem.fix.timestamp) : 'N/A', 
                          blotter: selectedResultItem.blotter.timestampObj ? formatUTC(selectedResultItem.blotter.timestampObj) : 'N/A' 
                        },
                        { 
                          label: "Time (Raw)", 
                          fix: selectedResultItem.fix.timeStr, 
                          blotter: selectedResultItem.blotter.timestamp 
                        },
                        { label: "LogicNode", fix: 'N/A', blotter: selectedResultItem.blotter.logicNode },
                        { 
                          label: "NodeTime (UTC)", 
                          fix: 'N/A', 
                          blotter: selectedResultItem.blotter.logicNodeTimeObj ? formatUTC(selectedResultItem.blotter.logicNodeTimeObj) : 'N/A' 
                        },
                        { 
                          label: "NodeTime (Raw)", 
                          fix: 'N/A', 
                          blotter: selectedResultItem.blotter.logicNodeTime 
                        }
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
                      <div className="p-3 rounded-lg text-[var(--foreground)] space-y-1 bg-[var(--background)]">
                        <div className="flex justify-between"><span className="text-zinc-500">ExecID (17):</span> <span>{selectedResultItem.fix.execId}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Symbol (55):</span> <span>{selectedResultItem.fix.symbol}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">LastQty (32):</span> <span>{selectedResultItem.fix.qty}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">LastPx (31):</span> <span>{selectedResultItem.fix.price}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">OrderID (37):</span> <span>{selectedResultItem.fix.orderId || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">ClOrdID (11):</span> <span>{selectedResultItem.fix.clOrdId || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">LastMkt (30):</span> <span>{selectedResultItem.fix.lastMkt || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Time (52):</span> <span className="truncate max-w-[180px]">{selectedResultItem.fix.timeStr}</span></div>
                      </div>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Raw FIX Message (Line {selectedResultItem.fix.lineIndex})</span>
                      <div className="p-3 rounded-lg text-[10px] font-mono break-all max-h-36 overflow-y-auto bg-[var(--background)]">
                        <SohVisualizer content={selectedResultItem.fix.rawMessage} />
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
                      <div className="p-3 rounded-lg text-[var(--foreground)] space-y-1.5 bg-[var(--background)]">
                        {Object.entries(selectedResultItem.blotter.row).map(([key, val]) => (
                          <div key={key} className="flex justify-between gap-4 font-mono">
                            <span className="text-zinc-500 truncate max-w-[120px]">{key}:</span> 
                            <span className="text-[var(--foreground)] break-all">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </>
      )}

      {/* Criteria & Session Filters Modal */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div 
            className="w-full max-w-lg rounded-xl border p-5 space-y-4 shadow-xl flex flex-col max-h-[90vh]" 
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-[var(--primary)]" />
                  Advanced Execution Filters
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Configure sessions and message criteria for the log analysis.
                </p>
              </div>
              <button 
                onClick={() => setIsCriteriaModalOpen(false)} 
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-1 text-xs text-[var(--foreground)] flex-1">
              
              {/* Session Filter */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">Session Filter (Tag 49 → 56)</span>
                {availableSessions.length === 0 ? (
                  <div className="p-3 rounded bg-[var(--background)] text-center text-[10px] text-[var(--text-muted)] italic">
                    No sessions detected. Please load a FIX log first.
                  </div>
                ) : (
                  <div className="p-3 rounded bg-[var(--background)] space-y-2 max-h-36 overflow-y-auto border" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between border-b pb-1.5 mb-1.5 border-[var(--border-subtle)] text-[10px]">
                      <button 
                        onClick={() => setSelectedSessions(availableSessions)} 
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={() => setSelectedSessions([])} 
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    {availableSessions.map(session => {
                      const isChecked = selectedSessions.includes(session);
                      return (
                        <label key={session} className="flex items-center gap-2 font-mono text-[10px] cursor-pointer hover:opacity-80">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSessions(prev => [...prev, session]);
                              } else {
                                setSelectedSessions(prev => prev.filter(s => s !== session));
                              }
                            }}
                            className="h-3.5 w-3.5 rounded bg-[var(--card)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                            style={{ borderColor: 'var(--border)' }}
                          />
                          <span>{session}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order ID / ClOrdID Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">Filter by Order ID / ClOrdID</label>
                <input 
                  type="text"
                  placeholder="Enter specific Order IDs (comma-separated)..."
                  value={filterOrderId}
                  onChange={(e) => setFilterOrderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-[var(--background)] outline-none text-xs text-[var(--foreground)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] transition-all font-mono"
                  style={{ borderColor: 'var(--border)' }}
                />
                <span className="text-[9px] text-[var(--text-muted)] block">Leave blank to process all execution reports. Matches tags 37 or 11.</span>
              </div>

              {/* Execution Types to Match */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* ExecType Checkboxes */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">ExecType (Tag 150)</span>
                  <div className="p-3 rounded bg-[var(--background)] space-y-2 border font-mono text-[10px]" style={{ borderColor: 'var(--border)' }}>
                    {[
                      { key: '1', label: '1 - Partial Fill' },
                      { key: '2', label: '2 - Fill' },
                      { key: 'F', label: 'F - Trade' },
                      { key: '0', label: '0 - New' },
                      { key: '4', label: '4 - Canceled' },
                      { key: '5', label: '5 - Replaced' },
                      { key: '8', label: '8 - Rejected' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                        <input 
                          type="checkbox"
                          checked={execTypesToConsider[item.key]}
                          onChange={(e) => setExecTypesToConsider(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded bg-[var(--card)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* OrdStatus Checkboxes */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">OrdStatus (Tag 39)</span>
                  <div className="p-3 rounded bg-[var(--background)] space-y-2 border font-mono text-[10px]" style={{ borderColor: 'var(--border)' }}>
                    {[
                      { key: '1', label: '1 - Partial Fill' },
                      { key: '2', label: '2 - Fill' },
                      { key: '0', label: '0 - New' },
                      { key: '4', label: '4 - Canceled' },
                      { key: '8', label: '8 - Rejected' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                        <input 
                          type="checkbox"
                          checked={ordStatusesToConsider[item.key]}
                          onChange={(e) => setOrdStatusesToConsider(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded bg-[var(--card)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => {
                  setIsCriteriaModalOpen(false);
                  handleAnalyze(); // Re-run analysis with the new criteria
                }}
                className="px-4 py-2 bg-[var(--primary)] text-[var(--background)] font-bold rounded-lg text-xs hover:opacity-90 transition-opacity cursor-pointer shadow"
              >
                Apply & Analyze
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
