'use client';

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  Terminal,
  Play,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  CornerDownLeft,
  BookOpen,
  Maximize2,
  Columns,
  Layout,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const templates = {
  python: `# Standard template to parse a FIX message in Python
import re

raw_fix = "8=FIX.4.2|9=82|35=D|49=SENDER|56=TARGET|34=102|11=ORD_99|55=AAPL|54=1|38=100|44=175.50|10=084|"

print("FIX MESSAGE STRING:")
print(raw_fix)
print("\\nEXTRACTED PARSED FIELDS:")

fields = re.split(r'[\\x01|]', raw_fix)
for item in filter(None, fields):
    if '=' in item:
        tag, val = item.split('=', 1)
        print(f"Tag {tag.rjust(5)} ➔ {val}")
`,
  cpp: `// Standard template to parse a FIX message in C++
#include <iostream>
#include <string>
#include <sstream>
#include <vector>

using namespace std;

int main() {
    string raw_fix = "8=FIX.4.2|9=82|35=D|49=SENDER|56=TARGET|34=102|11=ORD_99|55=AAPL|54=1|38=100|44=175.50|10=084|";
    cout << "FIX MESSAGE STRING:\\n" << raw_fix << "\\n\\n";
    cout << "EXTRACTED PARSED FIELDS:\\n";
    
    stringstream ss(raw_fix);
    string field;
    while (getline(ss, field, '|')) {
        size_t eq_idx = field.find('=');
        if (eq_idx != string::npos) {
            string tag = field.substr(0, eq_idx);
            string val = field.substr(eq_idx + 1);
            cout << "Tag " << tag << " ➔ " << val << endl;
        }
    }
    return 0;
}
`,
  java: `// Standard template to parse a FIX message in Java
public class Main {
    public static void main(String[] args) {
        String rawFix = "8=FIX.4.2|9=82|35=D|49=SENDER|56=TARGET|34=102|11=ORD_99|55=AAPL|54=1|38=100|44=175.50|10=084|";
        System.out.println("FIX MESSAGE STRING:\\n" + rawFix + "\\n");
        System.out.println("EXTRACTED PARSED FIELDS:");
        
        String[] fields = rawFix.split("\\\\|");
        for (String field : fields) {
            String[] kv = field.split("=");
            if (kv.length == 2) {
                System.out.println("Tag " + String.format("%5s", kv[0]) + " ➔ " + kv[1]);
            }
        }
    }
}
`
};

const defaultDescription = `# Coding Interview Task: FIX Message Parsing

## Objective
Write a function or program that parses a raw FIX message string, extracts each tag-value pair, and prints it.

## Input format
The program reads the raw FIX message from standard input (stdin).
Example input:
8=FIX.4.2|9=82|35=D|49=SENDER|56=TARGET|34=102|11=ORD_99|55=AAPL|54=1|38=100|44=175.50|10=084|

## Output format
Print each tag and value on a new line:
Tag 8 ➔ FIX.4.2
Tag 9 ➔ 82
Tag 35 ➔ D
...

## Delimiters
- Handle Pipe (|) character as a delimiter.
- Handle SOH (ASCII 0x01) as a delimiter.
`;

export default function CodeRunnerPage() {
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(templates["python"]);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [layoutPaneCount, setLayoutPaneCount] = useState(4);
  const [descriptionText, setDescriptionText] = useState(defaultDescription);
  const [activeModal, setActiveModal] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial states from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedLang = localStorage.getItem('fixify-coderunner-lang');
    if (savedLang) {
      setLang(savedLang);
      const savedCode = localStorage.getItem(`fixify-coderunner-code-${savedLang}`);
      if (savedCode) setCode(savedCode);
    }
    const savedStdin = localStorage.getItem('fixify-coderunner-stdin');
    if (savedStdin) setStdin(savedStdin);
    setIsLoaded(true);
  }, []);

  // Save states to localStorage on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-coderunner-lang', lang);
  }, [lang, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem(`fixify-coderunner-code-${lang}`, code);
  }, [code, lang, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-coderunner-stdin', stdin);
  }, [stdin, isLoaded]);
  
  // Resizable panel states (percentages)
  const [leftWidth, setLeftWidth] = useState(33); // Range: 15 to 80 (or 0 when collapsed)
  const [editorHeight, setEditorHeight] = useState(50); // Range: 15 to 85 (or 0 / 100 when collapsed)
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const run = async () => {
    setRunning(true);
    setOutput("");
    setStatusInfo(null);
    try {
      const res = await fetch("coderunner/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, source: code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");
      
      const outputText = [
        data.stdout ? data.stdout : "",
        data.stderr ? `Error Output:\n${data.stderr}` : "",
        data.compile_output ? `Compile Output:\n${data.compile_output}` : "",
      ]
      .filter(Boolean)
      .join("\n\n");

      setOutput(outputText || "Execution completed. No output returned.");
      setStatusInfo({
        status: data.status?.description || "Completed",
        time: data.time || "-",
        memory: data.memory || "-",
      });

    } catch (err) {
      setOutput("Runtime error calling compiler: " + String(err.message || err));
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCode(templates[lang]);
    setStdin("");
    setOutput("");
    setStatusInfo(null);
  };

  const switchToThreePaneLayout = () => {
    setLayoutPaneCount(3);
    setLeftWidth(60);
  };

  const switchToFourPaneLayout = () => {
    setLayoutPaneCount(4);
    setLeftWidth(33);
  };

  // Drag handlers for resizers
  const startResizingWidth = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = leftWidth;
    const containerWidth = mouseDownEvent.currentTarget.parentElement.getBoundingClientRect().width;

    const doDrag = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + (deltaX / containerWidth) * 100;
      if (newWidth < 8) newWidth = 0; // Snap shut
      else if (newWidth > 80) newWidth = 80; // Bound max
      setLeftWidth(newWidth);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const startResizingHeight = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startY = mouseDownEvent.clientY;
    const startHeight = editorHeight;
    const containerHeight = mouseDownEvent.currentTarget.parentElement.getBoundingClientRect().height;

    const doDrag = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      let newHeight = startHeight + (deltaY / containerHeight) * 100;
      if (newHeight < 10) newHeight = 0; // Collapse editor
      else if (newHeight > 90) newHeight = 100; // Collapse terminal
      setEditorHeight(newHeight);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const inputStyle = {
    background: 'var(--background)',
    border: 'none',
    color: 'var(--foreground)',
    outline: 'none',
  };

  // Desktop splits styles
  const containerStyle = isDesktop ? {
    display: 'grid',
    gridTemplateColumns: `${leftWidth}% ${leftWidth === 0 ? '0px' : '6px'} 1fr`,
    background: 'var(--border)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    height: '66vh',
    position: 'relative'
  } : {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fx-page-header flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Terminal className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            Code Sandbox
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Write FIX parser templates in Python, C++, or Java and execute with stdin streams.
          </p>
        </div>

        <div className="fx-toolbar">
          <div className="flex flex-wrap items-center gap-4">
            {/* Layout panes selector */}
            <div className="flex items-center gap-2">
              <span className="fx-section-label md:hidden">Layout:</span>
              <div className="fx-tab-group">
                <button
                  type="button"
                  className={`fx-tab${layoutPaneCount === 3 ? ' active' : ''} px-2.5 py-1.5`}
                  onClick={switchToThreePaneLayout}
                  title="3 Panes Layout"
                >
                  <Columns className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`fx-tab${layoutPaneCount === 4 ? ' active' : ''} px-2.5 py-1.5`}
                  onClick={switchToFourPaneLayout}
                  title="4 Panes Layout"
                >
                  <Layout className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Language selector */}
            <div className="flex items-center gap-2 md:border-l border-[var(--border)] md:pl-4">
              <span className="fx-section-label">Language:</span>
              <select
                value={lang}
                onChange={(e) => {
                  const selected = e.target.value;
                  setLang(selected);
                  setCode(templates[selected]);
                  setOutput("");
                  setStatusInfo(null);
                }}
                className="fx-input py-1.5"
              >
                <option value="python">Python 3</option>
                <option value="cpp">C++ (GCC)</option>
                <option value="java">Java (OpenJDK)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={run} disabled={running} className="fx-btn-primary" title="Run Code">
                <Play className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{running ? 'Compiling…' : 'Run Code'}</span>
              </button>
              <button onClick={handleReset} className="fx-btn-secondary" title="Reset">
                <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor & Console Grid Layout */}
      {layoutPaneCount === 4 ? (
        <div style={containerStyle}>
          {/* Panel 1: Description/Instructions (Left) */}
          {leftWidth > 0 && (
            <div
              className="flex flex-col min-w-0 h-full overflow-hidden"
              style={{ background: 'var(--card)' }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
                <span className="fx-section-label flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  Question Details
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={switchToThreePaneLayout}
                    className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                    title="Switch to 3-pane layout"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('description')}
                    className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                    title="Open in Fullscreen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-4 bg-zinc-950/20 overflow-hidden h-full">
                <textarea
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  className="w-full h-full bg-transparent text-xs font-mono resize-none border-none outline-none leading-relaxed"
                  style={{ color: 'var(--foreground)' }}
                  placeholder="Write question/comment details here..."
                />
              </div>
            </div>
          )}

          {/* Vertical Resizer */}
          {leftWidth > 0 && (
            <div
              onMouseDown={startResizingWidth}
              className="hidden lg:block w-[6px] h-full cursor-col-resize hover:bg-[var(--primary)] bg-[var(--border)] transition-colors select-none shrink-0"
              title="Drag to resize horizontal split"
            />
          )}

          {/* Right column (Editor + I/O) */}
          <div
            className="flex flex-col min-w-0 h-full overflow-hidden relative"
            style={{
              display: isDesktop ? 'grid' : 'flex',
              gridTemplateRows: isDesktop
                ? `${editorHeight}% ${editorHeight === 0 || editorHeight === 100 ? '0px' : '6px'} 1fr`
                : 'auto',
              background: 'var(--border)'
            }}
          >
            {/* Panel 2: Editor */}
            {editorHeight > 0 && (
              <div
                className="flex flex-col min-w-0 h-full overflow-hidden"
                style={{ background: 'var(--card)' }}
              >
                <div
                  className="px-5 py-3 flex items-center justify-between shrink-0"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span className="fx-section-label flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                    Source Editor
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditorHeight(0)}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Collapse Source Editor"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveModal('editor')}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Open in Fullscreen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Editor
                    height="100%"
                    language={lang === "cpp" ? "cpp" : lang}
                    value={code}
                    onChange={(val) => setCode(val || "")}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      fontFamily: "var(--font-geist-mono), monospace",
                      lineNumbersMinChars: 3,
                      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                      roundedSelection: true,
                      cursorBlinking: "smooth"
                    }}
                  />
                </div>
              </div>
            )}

            {/* Horizontal Resizer */}
            {editorHeight > 0 && editorHeight < 100 && (
              <div
                onMouseDown={startResizingHeight}
                className="hidden lg:block h-[6px] w-full cursor-row-resize hover:bg-[var(--primary)] bg-[var(--border)] transition-colors select-none shrink-0"
                title="Drag to resize vertical split"
              />
            )}

            {/* Input & Output block (split columns) */}
            {editorHeight < 100 && (
              <div
                className="flex flex-col md:grid md:grid-cols-2 gap-px min-h-0 h-full overflow-hidden"
                style={{ background: 'var(--border)' }}
              >
                {/* Panel 3: Stdin */}
                <div
                  className="flex flex-col min-w-0 h-full overflow-hidden"
                  style={{ background: 'var(--card)' }}
                >
                  <div
                    className="px-5 py-3.5 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                  >
                    <span className="fx-section-label flex items-center gap-1.5">
                      <CornerDownLeft className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                      Stdin Stream
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditorHeight(100)}
                        className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                        title="Collapse Input/Output Console"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveModal('stdin')}
                        className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                        title="Open in Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-2">
                    <textarea
                      className="w-full h-full p-2 text-xs font-mono resize-none border-none outline-none leading-relaxed"
                      style={inputStyle}
                      placeholder="Optional input lines for compiled executable…"
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                    />
                  </div>
                </div>

                {/* Panel 4: Output Console */}
                <div
                  className="flex flex-col min-w-0 h-full overflow-hidden"
                  style={{ background: 'var(--card)' }}
                >
                  <div
                    className="px-5 py-3.5 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                  >
                    <span className="fx-section-label flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                      Console Output
                    </span>
                    <div className="flex items-center gap-2">
                      {output && (
                        <button
                          onClick={handleCopy}
                          className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                          title="Copy output"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => setEditorHeight(100)}
                        className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                        title="Collapse Input/Output Console"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveModal('output')}
                        className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                        title="Open in Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div
                    className="p-4 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap font-mono flex-1 min-h-0"
                    style={{ background: 'var(--background)', color: 'var(--foreground)' }}
                  >
                    {output || <span className="italic" style={{ color: 'var(--text-faint)' }}>Execute program to view output…</span>}
                  </div>
                  {statusInfo && (
                    <div
                      className="flex justify-between items-center px-4 py-1.5 text-[10px] font-mono shrink-0"
                      style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
                    >
                      <span className="font-semibold text-emerald-500">{statusInfo.status}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{statusInfo.time}s | {statusInfo.memory} KB</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Horizontal Collapse Notches inside Right Column */}
            {isDesktop && editorHeight === 0 && (
              <button
                type="button"
                onClick={() => setEditorHeight(50)}
                className="absolute right-1/2 translate-x-1/2 top-0 z-10 w-12 h-5 flex items-center justify-center rounded-b-md border border-t-0 shadow-md transition-all hover:bg-[var(--primary)] hover:text-[var(--background)] cursor-pointer"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
                title="Expand Editor"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
            {isDesktop && editorHeight === 100 && (
              <button
                type="button"
                onClick={() => setEditorHeight(50)}
                className="absolute right-1/2 translate-x-1/2 bottom-0 z-10 w-12 h-5 flex items-center justify-center rounded-t-md border border-b-0 shadow-md transition-all hover:bg-[var(--primary)] hover:text-[var(--background)] cursor-pointer"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
                title="Expand Input/Output Console"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grid Mode 3: Traditional 3-pane layout */
        <div style={containerStyle}>
          {/* Monaco Editor (Panel 2, Left column) */}
          {leftWidth > 0 && (
            <div
              className="flex flex-col min-w-0 h-full overflow-hidden"
              style={{ background: 'var(--card)' }}
            >
              <div
                className="px-5 py-3.5 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
                <span className="fx-section-label flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  Source Editor
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={switchToFourPaneLayout}
                    className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                    title="Switch to 4-pane layout"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('editor')}
                    className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                    title="Open in Fullscreen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Editor
                  height="100%"
                  language={lang === "cpp" ? "cpp" : lang}
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    fontFamily: "var(--font-geist-mono), monospace",
                    lineNumbersMinChars: 3,
                    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                    roundedSelection: true,
                    cursorBlinking: "smooth"
                  }}
                />
              </div>
            </div>
          )}

          {/* Vertical Resizer */}
          {leftWidth > 0 && (
            <div
              onMouseDown={startResizingWidth}
              className="hidden lg:block w-[6px] h-full cursor-col-resize hover:bg-[var(--primary)] bg-[var(--border)] transition-colors select-none shrink-0"
              title="Drag to resize horizontal split"
            />
          )}

          {/* Right column (Stdin + Output) */}
          <div
            className="flex flex-col min-w-0 h-full overflow-hidden relative"
            style={{
              display: isDesktop ? 'grid' : 'flex',
              gridTemplateRows: isDesktop
                ? `${editorHeight}% ${editorHeight === 0 || editorHeight === 100 ? '0px' : '6px'} 1fr`
                : 'auto',
              background: 'var(--border)'
            }}
          >
            {/* Panel 4: Console Output */}
            {editorHeight > 0 && (
              <div
                className="flex flex-col min-w-0 h-full overflow-hidden"
                style={{ background: 'var(--card)' }}
              >
                <div
                  className="px-5 py-3.5 flex items-center justify-between shrink-0"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span className="fx-section-label flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                    Console Output
                  </span>
                  <div className="flex items-center gap-2">
                    {output && (
                      <button
                        onClick={handleCopy}
                        className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                        title="Copy output"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => setEditorHeight(0)}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Collapse Console Output"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveModal('output')}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Open in Fullscreen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div
                  className="p-4 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap font-mono flex-1 min-h-0"
                  style={{ background: 'var(--background)', color: 'var(--foreground)' }}
                >
                  {output || <span className="italic" style={{ color: 'var(--text-faint)' }}>Execute program to view output…</span>}
                </div>
                {statusInfo && (
                  <div
                    className="flex justify-between items-center px-5 py-1.5 text-xs font-mono shrink-0"
                    style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
                  >
                    <div className="font-semibold text-emerald-500">{statusInfo.status}</div>
                    <div className="flex gap-4" style={{ color: 'var(--text-muted)' }}>
                      <span>CPU: {statusInfo.time}s</span>
                      <span>Mem: {statusInfo.memory} KB</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Horizontal Resizer */}
            {editorHeight > 0 && editorHeight < 100 && (
              <div
                onMouseDown={startResizingHeight}
                className="hidden lg:block h-[6px] w-full cursor-row-resize hover:bg-[var(--primary)] bg-[var(--border)] transition-colors select-none shrink-0"
                title="Drag to resize vertical split"
              />
            )}

            {/* Panel 3: Stdin */}
            {editorHeight < 100 && (
              <div
                className="flex flex-col min-w-0 h-full overflow-hidden"
                style={{ background: 'var(--card)' }}
              >
                <div
                  className="px-5 py-3.5 flex items-center justify-between shrink-0"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span className="fx-section-label flex items-center gap-1.5">
                    <CornerDownLeft className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                    Stdin Stream
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditorHeight(100)}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Collapse Stdin Stream"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveModal('stdin')}
                      className="p-1 hover:text-[var(--primary)] transition-colors text-zinc-500"
                      title="Open in Fullscreen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden p-2">
                  <textarea
                    className="w-full h-full p-2 text-xs font-mono resize-none border-none outline-none leading-relaxed"
                    style={inputStyle}
                    placeholder="Optional input lines for compiled executable…"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Horizontal Collapse Notches inside Right Column */}
            {isDesktop && editorHeight === 0 && (
              <button
                type="button"
                onClick={() => setEditorHeight(50)}
                className="absolute right-1/2 translate-x-1/2 top-0 z-10 w-12 h-5 flex items-center justify-center rounded-b-md border border-t-0 shadow-md transition-all hover:bg-[var(--primary)] hover:text-[var(--background)] cursor-pointer"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
                title="Expand Console Output"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
            {isDesktop && editorHeight === 100 && (
              <button
                type="button"
                onClick={() => setEditorHeight(50)}
                className="absolute right-1/2 translate-x-1/2 bottom-0 z-10 w-12 h-5 flex items-center justify-center rounded-t-md border border-b-0 shadow-md transition-all hover:bg-[var(--primary)] hover:text-[var(--background)] cursor-pointer"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
                title="Expand Stdin Stream"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Absolute Notch to restore Left Column collapsed panel */}
      {isDesktop && leftWidth === 0 && (
        <button
          type="button"
          onClick={() => setLeftWidth(layoutPaneCount === 4 ? 33 : 60)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-12 flex items-center justify-center rounded-r-md border border-l-0 shadow-md transition-all hover:bg-[var(--primary)] hover:text-[var(--background)] cursor-pointer"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--primary)',
          }}
          title="Expand Left Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Fullscreen Overlay Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
          <div
            className="w-full h-full max-w-6xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              <span className="fx-section-label flex items-center gap-2">
                {activeModal === 'description' && <BookOpen className="h-4 w-4 text-emerald-500" />}
                {activeModal === 'editor' && <Terminal className="h-4 w-4 text-emerald-500" />}
                {activeModal === 'stdin' && <CornerDownLeft className="h-4 w-4 text-emerald-500" />}
                {activeModal === 'output' && <Cpu className="h-4 w-4 text-emerald-500" />}
                <span className="font-bold">{activeModal.toUpperCase()} VIEW (FULLSCREEN)</span>
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-6" style={{ background: 'var(--background)' }}>
              {activeModal === 'description' && (
                <textarea
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  className="w-full h-full bg-transparent text-xs font-mono resize-none border-none outline-none leading-relaxed"
                  style={{ color: 'var(--foreground)' }}
                  placeholder="Type interview question details, notes, or comments here..."
                />
              )}
              {activeModal === 'editor' && (
                <div className="w-full h-full overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <Editor
                    height="100%"
                    language={lang === "cpp" ? "cpp" : lang}
                    value={code}
                    onChange={(val) => setCode(val || "")}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: true },
                      fontFamily: "var(--font-geist-mono), monospace",
                      lineNumbersMinChars: 3,
                      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                      roundedSelection: true,
                      cursorBlinking: "smooth"
                    }}
                  />
                </div>
              )}
              {activeModal === 'stdin' && (
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  className="w-full h-full bg-transparent text-xs font-mono resize-none border-none outline-none animate-none"
                  style={{ color: 'var(--foreground)' }}
                  placeholder="Input streams for execution..."
                />
              )}
              {activeModal === 'output' && (
                <div className="w-full h-full flex flex-col gap-4">
                  <div
                    className="flex-1 overflow-auto text-xs font-mono p-4 rounded-xl border whitespace-pre-wrap"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {output || "No output yet."}
                  </div>
                  {statusInfo && (
                    <div className="flex justify-between text-xs font-mono p-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-semibold text-emerald-500">{statusInfo.status}</span>
                      <span>CPU: {statusInfo.time}s | Memory: {statusInfo.memory} KB</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
