'use client';

import React, { useState, useEffect } from "react";
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
  AlertTriangle
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

  const highlightXml = (xml) => {
    const escaped = xml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let highlighted = escaped
      .replace(/(&lt;\/?[\w-][^&]*?&gt;)/g, '<span style="color:var(--primary);font-weight:600">$1</span>')
      .replace(/(?<=&gt;)([^<]+)(?=&lt;)/g, '<span style="color:var(--foreground);font-weight:500">$1</span>');

    if (searchQuery.trim()) {
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      highlighted = highlighted.replace(new RegExp(`(${escapedQuery})(?![^<>]*>)`, 'gi'), '<span style="background:rgba(245,158,11,0.3);border-bottom:1.5px solid #f59e0b;color:#f59e0b;padding:0 2px;border-radius:2px">$1</span>');
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

  const panelStyle = isDesktop ? {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
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
            <Upload className="h-3.5 w-3.5" /> <span>Upload XML</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-text">
        
        {/* Raw XML Input Panel */}
        <div style={panelStyle}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900 bg-zinc-955/20 shrink-0 select-none">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <FileCode className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
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
              >
                <Sparkles className="h-3 w-3" /> <span>Format</span>
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
          />
        </div>

        {/* Formatted Output Panel */}
        <div style={panelStyle}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900 bg-zinc-955/20 shrink-0 select-none">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Braces className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Formatted output
              {hasSanitization && (
                <span 
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] bg-amber-500/10 text-amber-500 font-sans border border-amber-500/20"
                  title={`Sanitized ${sanitizerLog.sohCount} SOH delimiters and ${sanitizerLog.ctrlCount} control codes.`}
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> Sanitized
                </span>
              )}
            </span>
            
            {/* Unified Download & Copy Icon Tray */}
            {formatted && (
              <div className="flex items-center bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
                <button 
                  onClick={handleDownload} 
                  title="Download XML"
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-205 transition-all outline-none"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={handleCopy} 
                  title="Copy XML"
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-205 transition-all outline-none"
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

          <div className="flex-1 flex flex-col min-h-0 bg-[var(--background)]">
            {/* Filter Search Bar */}
            {formatted && (
              <div className="px-4 py-2 border-b flex items-center gap-2 bg-zinc-950/20 border-zinc-900 shrink-0 select-none">
                <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter nodes / values..."
                  className="flex-1 bg-transparent border-none text-[10px] font-mono outline-none text-zinc-300 placeholder-zinc-605 font-sans"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-zinc-350">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Print Window */}
            <div
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
        </div>

      </div>
    </div>
  );
}
