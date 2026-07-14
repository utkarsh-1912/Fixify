'use client';

import React, { useState, useEffect, useRef } from "react";
import {
  Braces,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  FileCode,
  Search,
  Upload,
  Minimize2,
  Download,
  AlertTriangle,
  X,
  ChevronUp,
  ChevronDown,
  XCircle,
  ShieldCheck
} from "lucide-react";

/* ─── Helper Functions ─────────────────────────────────────────────────── */

const sanitizeXmlForParsing = (rawXml) => {
  if (!rawXml) return "";
  return rawXml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, (match) => {
    const code = match.charCodeAt(0);
    if (code === 1) return "|";
    return `[0x${code.toString(16).padStart(2, '0').toUpperCase()}]`;
  });
};

const analyzeSanitization = (rawXml) => {
  if (!rawXml) return { sohCount: 0, ctrlCount: 0 };
  let sohCount = 0;
  let ctrlCount = 0;
  const matches = rawXml.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || [];
  matches.forEach(ch => {
    if (ch.charCodeAt(0) === 1) sohCount++;
    else ctrlCount++;
  });
  return { sohCount, ctrlCount };
};

const formatXml = (xml, mode) => {
  const PADDING = "  "; // Standard 2-space indentation
  if (mode === "regex") {
    try {
      let formattedText = "";
      let pad = 0;
      const sanitized = sanitizeXmlForParsing(xml);
      const cleaned = sanitized.replace(/>\s*</g, ">\n<");
      const lines = cleaned.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const isClosing = /^<\/.+?>$/.test(line);
        const isOpening = /^<[^!?\/][^>]*?>$/.test(line) && !isClosing;
        const isSelfClosing = /^<[^>]+\/>$/.test(line);
        const isInlinePair = /^<([^>]+)><\/\1>$/.test(line);
        if (isClosing && !isInlinePair) pad--;

        formattedText += PADDING.repeat(pad) + line + "\n";
        if (isOpening && !isSelfClosing && !isInlinePair) pad++;
      }
      return formattedText.trim();
    } catch { return "Malformed or invalid XML schema."; }
  } else {
    // DOM Parser mode
    try {
      const sanitized = sanitizeXmlForParsing(xml);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(sanitized, "application/xml");
      
      const parserError = xmlDoc.getElementsByTagName("parsererror");
      if (parserError.length > 0) {
        return "Malformed or invalid XML schema: " + parserError[0].textContent;
      }
      
      let result = "";
      
      const serializeNode = (node, depth) => {
        const indent = PADDING.repeat(depth);
        
        if (node.nodeType === 1) { // ELEMENT_NODE
          let tagStr = `${indent}<${node.nodeName}`;
          if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
              const attr = node.attributes[i];
              tagStr += ` ${attr.name}="${attr.value}"`;
            }
          }
          
          if (node.childNodes.length === 0) {
            result += `${tagStr} />\n`;
          } else if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) { // TEXT_NODE
            const textVal = node.childNodes[0].nodeValue.trim();
            result += `${tagStr}>${textVal}</${node.nodeName}>\n`;
          } else {
            result += `${tagStr}>\n`;
            for (let i = 0; i < node.childNodes.length; i++) {
              serializeNode(node.childNodes[i], depth + 1);
            }
            result += `${indent}</${node.nodeName}>\n`;
          }
        } else if (node.nodeType === 3) { // TEXT_NODE
          const textVal = node.nodeValue.trim();
          if (textVal) {
            result += `${indent}${textVal}\n`;
          }
        } else if (node.nodeType === 8) { // COMMENT_NODE
          result += `${indent}<!--${node.nodeValue}-->\n`;
        } else if (node.nodeType === 4) { // CDATA_SECTION_NODE
          result += `${indent}<![CDATA[${node.nodeValue}]]>\n`;
        } else if (node.nodeType === 9) { // DOCUMENT_NODE
          for (let i = 0; i < node.childNodes.length; i++) {
            serializeNode(node.childNodes[i], depth);
          }
        }
      };
      
      serializeNode(xmlDoc, 0);
      return result.trim();
    } catch (err) {
      return "Failed to parse and format XML: " + err.message;
    }
  }
};

/* ─── Main Component Page ────────────────────────────────────────────────── */

export default function XMLFormatterPage() {
  const [input, setInput] = useState("");
  const [formatted, setFormatted] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [formatMode, setFormatMode] = useState("regex"); // "dom" or "regex"
  const [searchQuery, setSearchQuery] = useState("");
  const [sanitizerLog, setSanitizerLog] = useState({ sohCount: 0, ctrlCount: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  // Schema Auditor states
  const [rightPanelTab, setRightPanelTab] = useState("formatted"); // "formatted" | "audit"
  const [auditErrors, setAuditErrors] = useState([]);
  const [auditWarnings, setAuditWarnings] = useState([]);
  const [auditPassed, setAuditPassed] = useState(false);
  
  const printWindowRef = useRef(null);
  const searchInputRef = useRef(null);

  // Auto-focus and select search input when toggled open
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [showSearch]);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedInput = localStorage.getItem('fixify-xml-input') || "";
    if (savedInput) setInput(savedInput);
    const savedFormatted = localStorage.getItem('fixify-xml-formatted') || "";
    if (savedFormatted) setFormatted(savedFormatted);
    const savedMode = localStorage.getItem('fixify-xml-mode') || "regex";
    setFormatMode(savedMode);
    setIsLoaded(true);
  }, []);

  // Save states on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-xml-input', input);
  }, [input, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-xml-formatted', formatted);
  }, [formatted, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-xml-mode', formatMode);
  }, [formatMode, isLoaded]);

  // Screen size breakpoint observer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Reset or update search indices and match counts
  useEffect(() => {
    if (!searchQuery.trim() || !formatted) {
      setTotalMatches(0);
      setActiveSearchIndex(0);
      return;
    }
    
    try {
      const escaped = formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})(?![^<>]*>)`, 'gi');
      const matches = escaped.match(regex);
      const count = matches ? matches.length : 0;
      
      setTotalMatches(count);
      setActiveSearchIndex(prev => {
        if (prev >= count) return 0;
        return prev;
      });
    } catch {
      setTotalMatches(0);
      setActiveSearchIndex(0);
    }
  }, [searchQuery, formatted]);

  // Scroll active match into view
  useEffect(() => {
    if (totalMatches === 0 || !printWindowRef.current) return;
    
    const container = printWindowRef.current;
    const activeEl = container.querySelector(`[data-match-index="${activeSearchIndex}"]`);
    
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    }
  }, [activeSearchIndex, totalMatches]);


  const highlightXml = (xml) => {
    const escaped = xml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let highlighted = escaped
      .replace(/(&lt;\/?[\w-][^&]*?&gt;)/g, '<span style="color:var(--primary);font-weight:600">$1</span>')
      .replace(/(?<=&gt;)([^<]+)(?=&lt;)/g, '<span style="color:var(--foreground);font-weight:500">$1</span>');

    if (searchQuery.trim()) {
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})(?![^<>]*>)`, 'gi');
      
      let matchCount = 0;
      highlighted = highlighted.replace(regex, (match) => {
        const idx = matchCount;
        matchCount++;
        const isActive = idx === activeSearchIndex;
        const style = isActive
          ? "background:rgba(245,158,11,0.9);color:#09090b;font-weight:700;padding:0 2px;border-radius:2px"
          : "background:rgba(245,158,11,0.25);border-bottom:1.5px solid #f59e0b;color:#f59e0b;padding:0 2px;border-radius:2px";
        return `<span class="xml-search-match" data-match-index="${idx}" style="${style}">${match}</span>`;
      });
    }
    return highlighted;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!formatted) return;
    const blob = new Blob([formatted], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "formatted_payload.xml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setInput("");
    setFormatted("");
    setSanitizerLog({ sohCount: 0, ctrlCount: 0 });
    setSearchQuery("");
  };

  const executeFormat = () => {
    if (!input.trim()) return;
    const rawFormatted = formatXml(input, formatMode);
    setFormatted(rawFormatted);
    const log = analyzeSanitization(input);
    setSanitizerLog(log);
  };

  const executeMinify = () => {
    if (!input.trim()) return;
    try {
      const sanitized = sanitizeXmlForParsing(input);
      const minified = sanitized.replace(/>\s*</g, "><").trim();
      setFormatted(minified);
      const log = analyzeSanitization(input);
      setSanitizerLog(log);
    } catch {
      setFormatted("Failed to minify XML schema.");
    }
  };

  const executeAudit = () => {
    setAuditErrors([]);
    setAuditWarnings([]);
    setAuditPassed(false);

    if (!input.trim()) return;

    try {
      const sanitized = sanitizeXmlForParsing(input);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(sanitized, "application/xml");
      
      const parserError = xmlDoc.getElementsByTagName("parsererror");
      if (parserError.length > 0) {
        setAuditErrors([`Invalid XML syntax: ${parserError[0].textContent}`]);
        setRightPanelTab("audit");
        return;
      }

      const errors = [];
      const warnings = [];

      const rootElement = xmlDoc.documentElement;
      const isATDL = rootElement?.localName === 'strategies' || xmlDoc.getElementsByTagName('strategies').length > 0 || xmlDoc.getElementsByTagName('strategy').length > 0;
      const isQuickFIX = rootElement?.localName === 'fix' || xmlDoc.getElementsByTagName('header').length > 0 || xmlDoc.getElementsByTagName('fields').length > 0;

      if (isATDL) {
        const strategies = xmlDoc.getElementsByTagName('strategy');
        if (strategies.length === 0) {
          errors.push("No <strategy> elements found under <strategies> root.");
        }

        // Verify parameters
        const parameters = xmlDoc.getElementsByTagName('parameter');
        const paramNames = new Set();
        const paramTags = new Set();

        for (let i = 0; i < parameters.length; i++) {
          const p = parameters[i];
          const name = p.getAttribute("name");
          const tagVal = p.getAttribute("tag");

          if (!name) {
            errors.push(`Parameter at index ${i} is missing 'name' attribute.`);
          } else {
            if (paramNames.has(name)) {
              errors.push(`Duplicate parameter name found: '${name}'.`);
            }
            paramNames.add(name);
          }

          if (tagVal) {
            const tagNum = parseInt(tagVal, 10);
            if (isNaN(tagNum) || tagNum <= 0) {
              errors.push(`Parameter '${name || i}' has invalid tag value: '${tagVal}' (must be a positive integer).`);
            } else {
              if (paramTags.has(tagNum)) {
                warnings.push(`Duplicate wire tag mapping: Tag '${tagNum}' is mapped by multiple parameters.`);
              }
              paramTags.add(tagNum);
            }
          }
        }

        // Verify layout controls
        const controls = xmlDoc.getElementsByTagName('control');
        const controlIDs = new Set();
        for (let i = 0; i < controls.length; i++) {
          const c = controls[i];
          const cId = c.getAttribute("ID");
          const pRef = c.getAttribute("parameterRef");

          if (!cId) {
            errors.push(`Control at index ${i} is missing unique 'ID' attribute.`);
          } else {
            if (controlIDs.has(cId)) {
              errors.push(`Duplicate control ID found: '${cId}'.`);
            }
            controlIDs.add(cId);
          }

          if (pRef && !paramNames.has(pRef)) {
            errors.push(`Control '${cId || i}' references undefined parameterRef: '${pRef}'.`);
          }
        }
      } else if (isQuickFIX) {
        const fields = xmlDoc.getElementsByTagName('fields');
        if (fields.length === 0) {
          errors.push("QuickFIX dictionary must contain a <fields> container block.");
        }

        const fieldNodes = xmlDoc.getElementsByTagName('field');
        const fieldNumbers = new Set();
        const fieldNames = new Set();

        for (let i = 0; i < fieldNodes.length; i++) {
          const f = fieldNodes[i];
          if (f.parentNode?.localName === 'fields') {
            const number = f.getAttribute("number");
            const name = f.getAttribute("name");
            const type = f.getAttribute("type");

            if (!number) {
              errors.push(`Field definition at index ${i} is missing 'number' attribute.`);
            } else {
              const numVal = parseInt(number, 10);
              if (isNaN(numVal) || numVal <= 0) {
                errors.push(`Field definition '${name || i}' has invalid number: '${number}'.`);
              } else {
                if (fieldNumbers.has(numVal)) {
                  errors.push(`Duplicate Field tag number defined: '${numVal}'.`);
                }
                fieldNumbers.add(numVal);
              }
            }

            if (!name) {
              errors.push(`Field definition at index ${i} is missing 'name' attribute.`);
            } else {
              if (fieldNames.has(name)) {
                errors.push(`Duplicate Field name defined: '${name}'.`);
              }
              fieldNames.add(name);
            }

            if (!type) {
              warnings.push(`Field '${name || number}' does not specify a 'type' attribute.`);
            }
          }
        }
      } else {
        warnings.push("Unknown XML schema type. Auditor works best on QuickFIX data dictionaries or FIXatdl strategies.");
      }

      setAuditErrors(errors);
      setAuditWarnings(warnings);
      setAuditPassed(errors.length === 0);
      setRightPanelTab("audit");
    } catch (e) {
      setAuditErrors([`Auditor Exception: ${e.message}`]);
      setRightPanelTab("audit");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setInput(reader.result);
      setFormatted("");
      setSanitizerLog({ sohCount: 0, ctrlCount: 0 });
      setSearchQuery("");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setInput(reader.result);
      setFormatted("");
      setSanitizerLog({ sohCount: 0, ctrlCount: 0 });
      setSearchQuery("");
    };
    reader.readAsText(file);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (formatted) {
          e.preventDefault();
          if (!showSearch) {
            setShowSearch(true);
          } else if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        e.preventDefault();
        setSearchQuery("");
        setShowSearch(false);
      }
      // Ctrl+S or Cmd+S to download formatted XML
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (formatted) {
          e.preventDefault();
          handleDownload();
        }
      }
      // F3 or Ctrl+G for next match
      if (showSearch && totalMatches > 0) {
        const isNextKey = e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g');
        if (isNextKey) {
          e.preventDefault();
          if (e.shiftKey) {
            setActiveSearchIndex(prev => (prev - 1 + totalMatches) % totalMatches);
          } else {
            setActiveSearchIndex(prev => (prev + 1) % totalMatches);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSearch, formatted, totalMatches, handleDownload]);

  const leftPanelStyle = isDesktop ? {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRight: 'none',
    borderRadius: '1rem 0 0 1rem',
    height: 'calc(100vh - 240px)',
    minHeight: '500px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '380px'
  };

  const rightPanelStyle = isDesktop ? {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '0 1rem 1rem 0',
    height: 'calc(100vh - 240px)',
    minHeight: '500px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '380px'
  };

  const hasSanitization = sanitizerLog.sohCount > 0 || sanitizerLog.ctrlCount > 0;

  return (
    <div 
      className="space-y-6 relative select-none pb-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-zinc-955/85 backdrop-blur-md border-2 border-dashed border-[var(--primary)] rounded-2xl flex flex-col items-center justify-center z-50 transition-all duration-300">
          <div className="h-16 w-16 rounded-full bg-[var(--primary-faint)] border border-[var(--primary-border)] flex items-center justify-center mb-4 animate-bounce">
            <Upload className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h3 className="text-lg font-bold text-[var(--foreground)] font-sans">Import XML file</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-sans">
            Drop your file to import and format it instantly.
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 select-text">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
              <Braces className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            XML Formatter
          </h1>
          <p className="text-sm font-sans" style={{ color: 'var(--text-muted)' }}>
            Beautify, validate, and minify XML message schemas.
          </p>
        </div>

        {/* Header Actions Tray */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          {/* Header File Upload */}
          <input 
            type="file" 
            id="xml-file-upload-header" 
            accept=".xml,.txt,.log" 
            className="hidden" 
            onChange={handleFileUpload} 
          />
          <label 
            htmlFor="xml-file-upload-header" 
            className="px-3.5 py-1.5 text-xs rounded-xl border cursor-pointer flex items-center gap-1.5 transition-all text-zinc-400 border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:text-zinc-200 select-none font-sans"
          >
            <Upload className="h-3.5 w-3.5" /> <span>Upload</span>
          </label>

          {/* Engine Switcher */}
          <div className="flex items-center gap-1 bg-zinc-900/40 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setFormatMode("dom")}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                formatMode === "dom"
                  ? "bg-[var(--primary)] text-zinc-950 font-bold shadow-md"
                  : "text-zinc-455 hover:text-zinc-200"
              }`}
            >
              DOM Parser
            </button>
            <button
              onClick={() => setFormatMode("regex")}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                formatMode === "regex"
                  ? "bg-[var(--primary)] text-zinc-950 font-bold shadow-md"
                  : "text-zinc-455 hover:text-zinc-200"
              }`}
            >
              Regex Walk
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-0 gap-6 select-text">
        
        {/* Raw XML Input Panel */}
        <div style={leftPanelStyle}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900 bg-zinc-955/20 shrink-0 select-none">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <FileCode className="h-3.5 w-3.5 hidden md:inline" style={{ color: 'var(--primary)' }} />
              Raw XML Input
            </span>
            
            {/* Desktop Action Tray */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button 
                onClick={handleReset} 
                disabled={!input.trim()}
                className="fx-btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" /> <span>Reset</span>
              </button>

              <button 
                onClick={executeMinify} 
                disabled={!input.trim()} 
                className="fx-btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 disabled:opacity-45"
              >
                <Minimize2 className="h-3 w-3" /> <span>Minify</span>
              </button>

              <button 
                onClick={executeAudit} 
                disabled={!input.trim()} 
                className="fx-btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 border-teal-900/30 text-teal-400 bg-teal-950/10 hover:bg-teal-950/20 disabled:opacity-45"
              >
                <ShieldCheck className="h-3 w-3" /> <span>Audit Schema</span>
              </button>

              <button 
                onClick={executeFormat} 
                disabled={!input.trim()} 
                className="fx-btn-primary py-1 px-3 text-[10px] flex items-center gap-1 disabled:opacity-45"
              >
                <Sparkles className="h-3 w-3" /> <span>Format</span>
              </button>
            </div>

            {/* Mobile Action Tray */}
            <div className="flex sm:hidden items-center gap-1">
              <button 
                onClick={executeFormat} 
                disabled={!input.trim()} 
                className="fx-btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1 disabled:opacity-40"
                title="Format XML"
              >
                <Sparkles className="h-3 w-3" />
              </button>
              
              <button 
                onClick={executeAudit} 
                disabled={!input.trim()} 
                className="fx-btn-secondary p-1.5 text-[10px] border-teal-900/30 text-teal-400 bg-teal-950/10 hover:bg-teal-950/20 disabled:opacity-40"
                title="Audit Schema"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </button>

              <button 
                onClick={executeMinify} 
                disabled={!input.trim()} 
                className="fx-btn-secondary p-1.5 text-[10px] disabled:opacity-40"
                title="Minify"
              >
                <Minimize2 className="h-3 w-3" />
              </button>

              <button 
                onClick={handleReset} 
                disabled={!input.trim()}
                className="fx-btn-secondary p-1.5 text-[10px] disabled:opacity-40"
                title="Reset"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <textarea
            className="flex-1 p-4 resize-none text-xs font-mono w-full"
            style={{
              background: 'var(--background)',
              border: 'none',
              color: 'var(--foreground)',
              outline: 'none',
              height: '100%'
            }}
            placeholder="<root><tag>example_value</tag></root>"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeFormat();
              } else if ((e.ctrlKey || e.metaKey) && (e.altKey || e.shiftKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                executeMinify();
              }
            }}
          />
        </div>

        {/* Formatted Output Panel */}
        <div style={rightPanelStyle}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900 bg-zinc-955/20 shrink-0 select-none">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRightPanelTab("formatted")}
                className={`flex items-center gap-1.5 text-xs font-semibold pb-0.5 transition-all outline-none border-b-2 ${
                  rightPanelTab === "formatted"
                    ? "border-[var(--primary)] text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Braces className="h-3.5 w-3.5" />
                <span>Formatted Output</span>
              </button>
              
              <button
                onClick={() => setRightPanelTab("audit")}
                className={`flex items-center gap-1.5 text-xs font-semibold pb-0.5 transition-all outline-none border-b-2 ${
                  rightPanelTab === "audit"
                    ? "border-teal-400 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-teal-450" />
                <span>Schema Auditor</span>
                {auditErrors.length > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>

              {hasSanitization && rightPanelTab === "formatted" && (
                <span 
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] bg-amber-500/10 text-amber-500 font-sans border border-amber-500/20"
                  title={`Sanitized ${sanitizerLog.sohCount} SOH delimiters and ${sanitizerLog.ctrlCount} control codes.`}
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> Sanitized
                </span>
              )}
            </div>
            
            {/* Unified Download & Copy Icon Tray */}
            {formatted && rightPanelTab === "formatted" && (
              <div className="flex items-center bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => {
                    if (showSearch) {
                      setSearchQuery("");
                    }
                    setShowSearch(!showSearch);
                  }} 
                  title="Search XML"
                  className={`p-1.5 rounded transition-all outline-none ${
                    showSearch 
                      ? "bg-[var(--primary-faint)] text-[var(--primary)]" 
                      : "hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={handleDownload} 
                  title="Download XML"
                  className="p-1.5 rounded hover:bg-zinc-850 text-zinc-400 hover:text-zinc-202 transition-all outline-none border-l border-zinc-800/80"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={handleCopy} 
                  title="Copy XML"
                  className="p-1.5 rounded hover:bg-zinc-855 text-zinc-400 hover:text-zinc-205 transition-all outline-none border-l border-zinc-800/80"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {rightPanelTab === "formatted" ? (
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--background)]">
              {/* Filter Search Bar */}
              {showSearch && formatted && (
                <div className="px-4 py-2 border-b flex items-center gap-2 bg-zinc-950/20 border-zinc-900 shrink-0 select-none animate-in slide-in-from-top-2 duration-200">
                  <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (totalMatches > 0) {
                          if (e.shiftKey) {
                            setActiveSearchIndex(prev => (prev - 1 + totalMatches) % totalMatches);
                          } else {
                            setActiveSearchIndex(prev => (prev + 1) % totalMatches);
                          }
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (totalMatches > 0) {
                          setActiveSearchIndex(prev => (prev + 1) % totalMatches);
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (totalMatches > 0) {
                          setActiveSearchIndex(prev => (prev - 1 + totalMatches) % totalMatches);
                        }
                      }
                    }}
                    placeholder="Filter nodes / values..."
                    className="flex-1 bg-transparent border-none text-[10px] font-mono outline-none text-zinc-300 placeholder-zinc-605 font-sans"
                  />
                  
                  {searchQuery.trim() && totalMatches > 0 && (
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0 select-none px-1">
                      {activeSearchIndex + 1} of {totalMatches}
                    </span>
                  )}
                  
                  {searchQuery.trim() && totalMatches === 0 && (
                    <span className="text-[10px] text-red-400 font-mono shrink-0 select-none px-1">
                      0 matches
                    </span>
                  )}

                  {searchQuery.trim() && totalMatches > 0 && (
                    <div className="flex items-center border-l border-zinc-800 pl-1 shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveSearchIndex(prev => (prev - 1 + totalMatches) % totalMatches)}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Previous match"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSearchIndex(prev => (prev + 1) % totalMatches)}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Next match"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {searchQuery ? (
                    <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-zinc-350 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => setShowSearch(false)} className="text-zinc-500 hover:text-zinc-350 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Print Window */}
              <div
                ref={printWindowRef}
                className="flex-1 p-4 overflow-auto text-xs font-mono whitespace-pre leading-relaxed w-full min-h-0"
                style={{ color: 'var(--text-muted)' }}
              >
                {formatted ? (
                  <div dangerouslySetInnerHTML={{ __html: highlightXml(formatted) }} />
                ) : (
                  <span className="italic font-sans text-xs select-none" style={{ color: 'var(--text-faint)' }}>
                    Formatted XML output will appear here…
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 p-5 overflow-auto bg-[var(--background)] space-y-4 select-text">
              {/* General Audit Status */}
              {!input.trim() ? (
                <div className="h-full flex items-center justify-center text-zinc-600 italic font-sans text-xs">
                  Please import or input XML schema, then click "Audit Schema" to view results.
                </div>
              ) : (
                <div className="space-y-4 font-sans">
                  <div className="flex items-center gap-3">
                    {auditErrors.length > 0 ? (
                      <div className="h-10 w-10 rounded-xl bg-red-950/20 border border-red-900/40 flex items-center justify-center shrink-0">
                        <XCircle className="h-5 w-5 text-red-500" />
                      </div>
                    ) : auditWarnings.length > 0 ? (
                      <div className="h-10 w-10 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-teal-950/20 border border-teal-900/40 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5 text-teal-400" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">
                        {auditErrors.length > 0 ? "Schema Audit Failed" : auditWarnings.length > 0 ? "Audit Passed with Warnings" : "Schema Audit Passed"}
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        {auditErrors.length > 0 ? `${auditErrors.length} critical issues detected.` : auditWarnings.length > 0 ? `${auditWarnings.length} warnings to review.` : "No structural or semantic issues found."}
                      </p>
                    </div>
                  </div>

                  {/* Critical Errors Block */}
                  {auditErrors.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-500 block font-mono">Critical Errors ({auditErrors.length})</span>
                      <div className="space-y-1.5">
                        {auditErrors.map((err, i) => (
                          <div key={i} className="p-2.5 bg-red-950/15 border border-red-900/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
                            <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                            <span className="font-mono text-[10px]">{err}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings Block */}
                  {auditWarnings.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 block font-mono">Warnings ({auditWarnings.length})</span>
                      <div className="space-y-1.5">
                        {auditWarnings.map((warn, i) => (
                          <div key={i} className="p-2.5 bg-amber-950/15 border border-amber-900/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                            <span className="font-mono text-[10px]">{warn}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {auditPassed && auditErrors.length === 0 && auditWarnings.length === 0 && (
                    <div className="p-8 border border-dashed border-teal-900/30 rounded-2xl flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-teal-950/20 border border-teal-900/40 flex items-center justify-center mb-3">
                        <Check className="h-6 w-6 text-teal-400" />
                      </div>
                      <h4 className="text-xs font-bold text-zinc-200">All Semantic Rules Conformant</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                        Your QuickFIX or FIXatdl Strategy XML document matches all checked schema limits and semantic references.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
