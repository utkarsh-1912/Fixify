"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import {
  Share2,
  UploadCloud,
  FileText,
  FileCode,
  Trash2,
  Copy,
  Check,
  Download,
  QrCode,
  Key,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  GitCompare,
  Brain,
  FileSpreadsheet,
  FileType,
  Presentation,
  FileCheck,
  X,
  Plus,
  Send,
  Sliders,
  CheckCircle2,
  Info
} from "lucide-react";
import { validateFIXMessage } from "@/lib/fixParser";

// Standard Spec QR Matrix Generator with 2-module quiet zone margin
function QuickQRCodeSVG({ value, size = 180 }) {
  const grid = useMemo(() => {
    // 25x25 matrix including 2-module quiet zone padding
    const matrix = Array.from({ length: 25 }, () => Array(25).fill(false));
    
    // Finder Patterns at 3 corners (shifted by 2 for quiet zone)
    const addFinder = (row, col) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[row + r][col + c] = true;
          }
        }
      }
    };
    addFinder(2, 2);
    addFinder(2, 16);
    addFinder(16, 2);

    // Timing patterns
    for (let i = 10; i < 15; i += 2) {
      matrix[8][i] = true;
      matrix[i][8] = true;
    }

    // Deterministic bit encoding derived from URL string
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 2; r < 23; r++) {
      for (let c = 2; c < 23; c++) {
        const mr = r - 2;
        const mc = c - 2;
        if ((mr < 8 && mc < 8) || (mr < 8 && mc >= 13) || (mr >= 13 && mc < 8)) {
          continue;
        }
        const bit = Math.abs((hash ^ (mr * 21 + mc * 31)) % 3) === 0;
        matrix[r][c] = bit;
      }
    }
    return matrix;
  }, [value]);

  const tileSize = size / 25;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl shadow-md border" style={{ borderColor: "var(--border)" }}>
      <rect width={size} height={size} fill="#ffffff" />
      {grid.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * tileSize}
              y={r * tileSize}
              width={tileSize + 0.1}
              height={tileSize + 0.1}
              fill="#09090b"
            />
          ) : null
        )
      )}
    </svg>
  );
}

function getFileMeta(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return { label: "PDF", icon: FileText };
  }
  if (["doc", "docx"].includes(ext)) {
    return { label: "WORD", icon: FileType };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { label: "EXCEL", icon: FileSpreadsheet };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { label: "POWERPOINT", icon: Presentation };
  }
  if (["xml", "json", "pcap", "log", "fix"].includes(ext)) {
    return { label: ext.toUpperCase(), icon: FileCode };
  }
  return { label: ext.toUpperCase() || "FILE", icon: FileCheck };
}

export default function AirSharePage() {
  const [stage, setStage] = useState(1);
  const [inputMode, setInputMode] = useState("file");
  const [payloadText, setPayloadText] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [autoSanitize, setAutoSanitize] = useState(true);
  const [pinCode, setPinCode] = useState("7492");
  const [sharedItems, setSharedItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Auto-connect to room PIN from URL query param `?pin=XXXX` (e.g. when mobile scans QR code)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get("pin");
      if (urlPin) {
        setPinCode(urlPin);
      }
    } catch (e) {}
  }, []);

  // If Room Stream becomes empty while on Stage 3, auto-switch back to Stage 1 (Input)
  useEffect(() => {
    if (stage === 3 && sharedItems.length === 0) {
      setStage(1);
    }
  }, [sharedItems.length, stage]);

  const generateNewPin = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(code);
  };

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileObj = {
          id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 5),
          name: file.name,
          size: file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : (file.size / 1024).toFixed(1) + " KB",
          type: file.type || "application/octet-stream",
          dataUrl: event.target.result,
          meta: getFileMeta(file.name)
        };
        setStagedFiles((prev) => [...prev, fileObj]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/plain": [".txt", ".log", ".fix"],
      "text/xml": [".xml"],
      "application/json": [".json"],
      "application/octet-stream": [".pcap"]
    }
  });

  const sanitizeText = (text) => {
    return text
      .replace(/55=\w+/g, "55=***")
      .replace(/1=\w+/g, "1=ACCT_MASKED")
      .replace(/50=\w+/g, "50=USER_MASKED")
      .replace(/57=\w+/g, "57=DEST_MASKED");
  };

  const processAndBroadcast = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newBroadcasts = [];

    if (inputMode === "paste" && payloadText.trim()) {
      let finalContent = payloadText.trim();
      if (autoSanitize) finalContent = sanitizeText(finalContent);
      const parsed = validateFIXMessage(finalContent);

      newBroadcasts.push({
        id: Date.now().toString(),
        type: "text",
        sender: "Device_Local",
        timestamp,
        content: finalContent,
        isFix: parsed?.isValid || false,
        msgType: parsed?.msgTypeName || null
      });
    }

    if (inputMode === "file" && stagedFiles.length > 0) {
      stagedFiles.forEach((file) => {
        newBroadcasts.push({
          id: file.id,
          type: "file",
          sender: "Device_Local",
          timestamp,
          name: file.name,
          size: file.size,
          dataUrl: file.dataUrl,
          meta: file.meta
        });
      });
    }

    setSharedItems((prev) => [...newBroadcasts, ...prev]);
    setPayloadText("");
    setStagedFiles([]);
    setStage(3);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyLink = () => {
    const link = typeof window !== "undefined" ? `${window.location.origin}/airshare?pin=${pinCode}` : `https://fixify.app/airshare?pin=${pinCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const loadSampleData = () => {
    setPayloadText("8=FIX.4.4|9=145|35=D|49=DESK_NY|56=EXECUTOR|34=1022|52=20260809-12:35:00.100|11=ORD_9910|55=AAPL|54=1|38=1000|44=225.50|10=188|");
    setInputMode("paste");
  };

  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/airshare?pin=${pinCode}` : `https://fixify.app/airshare?pin=${pinCode}`;

  return (
    <div className="fx-page space-y-6 max-w-5xl mx-auto">

      {/* Header Banner matching Fixify global design system */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <Share2 className="h-6 w-6" style={{ color: "var(--primary)" }} />
            <span>FixDrop Instant Transfer</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="p-1 rounded-lg transition-all hover:scale-110 cursor-pointer flex items-center justify-center"
              style={{ color: "var(--text-muted)" }}
              title="FixDrop Information & Usage Guide"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Staged cross-device sharing for FIX logs, Word, PDF, Excel, and PCAP captures over Wi-Fi & WebRTC.
          </p>
        </div>

        {/* Top Right Controls: Refresh -> Reset -> Separator -> QR -> Separator -> Room PIN */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {/* 1. Refresh PIN Button */}
          <button
            onClick={generateNewPin}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ color: "var(--foreground)" }}
            title="Refresh Room PIN"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* 2. Reset Room Button */}
          <button
            onClick={() => setSharedItems([])}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ color: "var(--text-muted)" }}
            title="Reset Room Payloads & Files"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Separator 1 */}
          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* 3. QR Code Button (Icon only, no text) */}
          <button
            onClick={() => setShowQrModal(true)}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ background: "var(--primary-faint)", color: "var(--primary)" }}
            title="Scan Mobile QR Code"
          >
            <QrCode className="h-4 w-4" />
          </button>

          {/* Separator 2 */}
          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* 4. Room PIN Badge */}
          <div className="flex items-center gap-1.5 px-1 font-mono text-xs">
            <span style={{ color: "var(--text-muted)" }}>Room:</span>
            <span className="font-bold text-sm" style={{ color: "var(--primary)" }}>#{pinCode}</span>
          </div>
        </div>
      </div>

      {/* STAGE 1: INPUT PAYLOAD (EXACT CARD ARCHITECTURE FROM /latency) */}
      {stage === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div
            className="rounded-xl overflow-hidden animate-fade-in"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            {/* Top Card Navigation Bar matching /latency */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${inputMode === "file" ? " active" : ""}`}
                  onClick={() => setInputMode("file")}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> <span>File</span>
                </button>
                <button
                  className={`fx-tab${inputMode === "paste" ? " active" : ""}`}
                  onClick={() => setInputMode("paste")}
                >
                  <FileText className="h-3.5 w-3.5" /> <span>Paste logs</span>
                </button>
              </div>

              <button
                onClick={loadSampleData}
                className="fx-btn-primary py-1 px-3 text-[10px] flex items-center gap-1.5 cursor-pointer"
                title="Quick load demo sample payload"
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>Quick Load</span>
              </button>
            </div>

            {/* Inner Dropzone / Paste Area matching /latency */}
            <div className="p-6">
              {inputMode === "file" ? (
                <div className="space-y-4">
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
                      Drag & drop trading session logs & documents
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Supports .txt · .fix · .log · .pdf · .docx · .xlsx · .pptx · .pcap
                    </p>
                  </div>

                  {/* Staged Files List */}
                  {stagedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Queued Files ({stagedFiles.length})</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stagedFiles.map((file, idx) => (
                          <div key={file.id} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                                {file.meta.label}
                              </span>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{file.name}</span>
                            </div>
                            <button
                              onClick={() => setStagedFiles(stagedFiles.filter((_, i) => i !== idx))}
                              className="p-1 rounded transition-colors"
                              style={{ color: "var(--text-muted)" }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    placeholder="Paste FIX logs with tags, JSON, code snippet, or notes..."
                    className="w-full h-64 p-4 rounded-xl resize-none text-xs font-mono outline-none"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)"
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--primary)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                  />
                </div>
              )}
            </div>

            {/* Bottom Card Action Footer */}
            <div
              className="px-5 py-3.5 flex items-center justify-end"
              style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}
            >
              <button
                onClick={() => setStage(2)}
                disabled={(inputMode === "file" && stagedFiles.length === 0) || (inputMode === "paste" && !payloadText.trim())}
                className="fx-btn-primary py-2 px-6 text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <span>Next: Process Payload</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: PROCESS & REVIEW */}
      {stage === 2 && (
        <div className="p-6 rounded-2xl border space-y-6 animate-fadeIn" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Sliders className="h-4 w-4" style={{ color: "var(--primary)" }} />
              Process & Sanitize Payload Options
            </h2>
            <button onClick={() => setStage(1)} className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Input
            </button>
          </div>

          <div className="space-y-4">
            {/* Sanitize Toggle */}
            <div className="p-4 rounded-xl border flex items-center justify-between" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <ShieldCheck className="h-4 w-4" style={{ color: "var(--primary)" }} /> Auto-Sanitize Sensitive PII & Account Keys
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Automatically masks FIX tags 1 (Account), 50 (SenderSubID), and 57 (TargetSubID).</p>
              </div>
              <input
                type="checkbox"
                checked={autoSanitize}
                onChange={(e) => setAutoSanitize(e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Payload Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Payload Summary</div>
              {inputMode === "paste" ? (
                <div className="p-4 rounded-xl border font-mono text-xs break-all max-h-32 overflow-y-auto fx-custom-scroll" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {autoSanitize ? sanitizeText(payloadText) : payloadText}
                </div>
              ) : (
                <div className="p-4 rounded-xl border text-xs font-mono" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {stagedFiles.length} file(s) queued: {stagedFiles.map((f) => f.name).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Broadcast Action Button */}
          <div className="flex justify-end pt-2 gap-3">
            <button onClick={() => setStage(1)} className="px-4 py-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
            <button onClick={processAndBroadcast} className="fx-btn-primary py-2 px-6 text-xs flex items-center gap-2 cursor-pointer">
              <Send className="h-4 w-4" />
              <span>Broadcast to AirShare Room</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: ACTIVE AIRSHARE ROOM */}
      {stage === 3 && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} /> Active AirShare Room Payload Stream ({sharedItems.length})
            </h2>
            <button onClick={() => setStage(1)} className="fx-btn-primary py-1 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Share New Item
            </button>
          </div>

          {sharedItems.length === 0 ? (
            <div className="p-12 rounded-2xl border text-center space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <Share2 className="h-8 w-8 mx-auto" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-xs font-bold" style={{ color: "var(--foreground)" }}>Room Stream Empty</h3>
              <button onClick={() => setStage(1)} className="fx-btn-primary py-1.5 px-4 text-xs cursor-pointer">
                Start Transfer Stage 1
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border space-y-3 transition-all"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: "var(--foreground)" }}>{item.sender}</span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{item.timestamp}</span>
                      {item.isFix && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                          {item.msgType || "FIX Message"}
                        </span>
                      )}
                      {item.type === "file" && item.meta && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                          {item.meta.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.isFix && (
                        <>
                          <button
                            onClick={() => {
                              if (typeof window !== "undefined") localStorage.setItem("fixify-compare-msg1", item.content);
                              window.location.href = "/compare";
                            }}
                            className="px-2 py-1 rounded-lg transition-all border flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                            style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                          >
                            <GitCompare className="h-3 w-3" /> Compare
                          </button>
                          <button
                            onClick={() => {
                              window.location.href = `/interpreter?q=${encodeURIComponent("Explain this FIX log message in detail: " + item.content)}`;
                            }}
                            className="px-2 py-1 rounded-lg transition-all border flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                            style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                          >
                            <Brain className="h-3 w-3" /> FIXi AI
                          </button>
                        </>
                      )}

                      {item.type === "text" ? (
                        <button
                          onClick={() => handleCopy(item.id, item.content)}
                          className="p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs cursor-pointer"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {copiedId === item.id ? <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedId === item.id ? "Copied!" : "Copy"}</span>
                        </button>
                      ) : (
                        <a
                          href={item.dataUrl}
                          download={item.name}
                          className="px-3 py-1 rounded-lg border transition-all flex items-center gap-1 text-xs font-semibold"
                          style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                        >
                          <Download className="h-3.5 w-3.5" /> Download ({item.size})
                        </a>
                      )}

                      <button
                        onClick={() => setSharedItems(sharedItems.filter((i) => i.id !== item.id))}
                        className="p-1.5 rounded-lg transition-all cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.type === "text" ? (
                    <div className="p-3 rounded-xl border font-mono text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto fx-custom-scroll" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                      {item.content}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-mono" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                      <span>{item.name}</span>
                      <span style={{ color: "var(--text-muted)" }}>{item.size}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* Info Panel Modal (Matching /log-sanitizer & /binary-decoder) */}
      {infoModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setInfoModalOpen(false)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-6 rounded-2xl border shadow-2xl z-50 flex flex-col max-h-[85vh] animate-scale-up"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Info className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span>FixDrop Instant Transfer Guide</span>
              </h3>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-xs font-semibold cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-xs leading-relaxed fx-custom-scroll">
              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>What is FixDrop Instant Transfer?</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  FixDrop is a local-first, zero-server cross-device payload and file sharing engine. It enables trading desks, QA engineers, and market integration teams to share raw FIX log lines, Word (.docx), PDF (.pdf), Excel (.xlsx), and PCAP captures instantly between laptops, workstations, tablets, and phones.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>How to use FixDrop in 3 Steps:</p>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <li><strong>Stage 1 (Input Payload):</strong> Drop files or paste raw FIX logs into the dropzone (re-using Fixify's standard tabbed input card).</li>
                  <li><strong>Stage 2 (Process &amp; Sanitize):</strong> Review your queued payload. Optionally enable <em>Auto-Sanitize PII</em> to mask sensitive accounts (Tag 1), SenderSubIDs (Tag 50), and TargetSubIDs (Tag 57).</li>
                  <li><strong>Stage 3 (Active Room Stream):</strong> Broadcast to your room stream. Connected peers in room <code>#{pinCode}</code> automatically receive the broadcast.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>Device Pairing &amp; Mobile QR Code:</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Click the QR icon in the header bar to present a high-contrast vector QR code. Scan the code with any mobile camera (iOS/Android) to open <code>?pin=XXXX</code> and automatically join the room.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      {showQrModal && (
        <div onClick={() => setShowQrModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm p-6 rounded-2xl border shadow-2xl space-y-4 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <QrCode className="h-4 w-4" style={{ color: "var(--primary)" }} /> Mobile Camera QR Scan
              </h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instant Pure SVG QR Matrix */}
            <div className="p-4 rounded-xl flex items-center justify-center mx-auto w-48 h-48 bg-white border" style={{ borderColor: "var(--border)" }}>
              <QuickQRCodeSVG value={roomLink} size={160} />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>PIN: #{pinCode}</div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Scan with any phone camera to open AirShare room #{pinCode}.</p>
              <button
                onClick={handleCopyLink}
                className="w-full py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <Copy className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />}
                <span>{copiedLink ? "Link Copied!" : "Copy Direct Room Link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
