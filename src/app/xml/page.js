'use client';

import { useState, useEffect } from "react";
import {
  Braces,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  CheckCircle,
  FileCode
} from "lucide-react";

export default function XMLFormatterPage() {
  const [input, setInput] = useState("");
  const [formatted, setFormatted] = useState("");
  const [copied, setCopied] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedInput = localStorage.getItem('fixify-xml-input');
    if (savedInput) setInput(savedInput);
    const savedFormatted = localStorage.getItem('fixify-xml-formatted');
    if (savedFormatted) setFormatted(savedFormatted);
    const savedLeftWidth = localStorage.getItem('fixify-xml-leftWidth');
    if (savedLeftWidth) setLeftWidth(Number(savedLeftWidth));
    setIsLoaded(true);
  }, []);

  // Save state on change
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
    localStorage.setItem('fixify-xml-leftWidth', String(leftWidth));
  }, [leftWidth, isLoaded]);

  // Screen size breakpoint observer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const formatXml = (xml) => {
    try {
      const PADDING = "  ";
      let formattedText = "";
      let pad = 0;
      const cleaned = xml.replace(/>\s*</g, ">\n<");
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
  };

  const highlightXml = (xml) => {
    const escaped = xml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/(&lt;\/?[\w][^&]*?&gt;)/g, '<span style="color:var(--primary);font-weight:600">$1</span>')
      .replace(/(?<=&gt;)([^<]+)(?=&lt;)/g, '<span style="color:var(--foreground);font-weight:500">$1</span>');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => { setInput(""); setFormatted(""); };
  const executeFormat = () => { if (!input.trim()) return; setFormatted(formatXml(input)); };

  // Resizing mouse handler
  const startResizingWidth = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = leftWidth;
    const containerWidth = mouseDownEvent.currentTarget.parentElement.getBoundingClientRect().width;

    const doDrag = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + (deltaX / containerWidth) * 100;
      if (newWidth < 15) newWidth = 15;
      else if (newWidth > 85) newWidth = 85;
      setLeftWidth(newWidth);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const containerStyle = isDesktop ? {
    display: 'grid',
    gridTemplateColumns: `${leftWidth}% 6px 1fr`,
    background: 'var(--border)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    height: '66vh',
    position: 'relative'
  } : {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const panelStyle = isDesktop ? {
    background: 'var(--card)',
    border: 'none',
    borderRadius: '0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '350px'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fx-page-header flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
              <Braces className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            XML Formatter
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Format, beautify, and syntax-highlight nested XML messages.
          </p>
        </div>
      </div>

      {/* Split panel */}
      <div style={containerStyle}>

        {/* Input */}
        <div style={panelStyle}>
          <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <span className="fx-section-label flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Raw XML Message
            </span>
            <div className="flex gap-2">
              <button onClick={executeFormat} disabled={!input.trim()} className="fx-btn-primary">
                <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Format</span>
              </button>
              <button onClick={handleReset} className="fx-btn-secondary">
                <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset</span>
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

        {/* Vertical Resizer Divider */}
        {isDesktop && (
          <div
            onMouseDown={startResizingWidth}
            className="hidden lg:block w-[6px] h-full cursor-col-resize hover:bg-[var(--primary)] bg-[var(--border)] transition-colors select-none shrink-0"
            title="Drag to resize columns"
          />
        )}

        {/* Output */}
        <div style={panelStyle}>
          <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <span className="fx-section-label flex items-center gap-1.5">
              <Braces className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Highlighted Output
            </span>
            {formatted && (
              <button onClick={handleCopy} className="fx-btn-secondary">
                {copied ? (
                  <><CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} /> <span className="hidden sm:inline">Copied!</span></>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy</span></>
                )}
              </button>
            )}
          </div>
          <div
            className="flex-1 p-4 overflow-auto text-xs font-mono whitespace-pre leading-relaxed w-full h-full"
            style={{ background: 'var(--background)', color: 'var(--text-muted)' }}
          >
            {formatted ? (
              <div dangerouslySetInnerHTML={{ __html: highlightXml(formatted) }} />
            ) : (
              <span className="italic" style={{ color: 'var(--text-faint)' }}>
                Formatted XML output will appear here…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
