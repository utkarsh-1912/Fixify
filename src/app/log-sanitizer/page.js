'use client';

import React, { useState, useEffect } from 'react';
import {
  ScanEyeIcon,
  Clipboard,
  Check,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Upload,
  Layers,
  Settings,
  Lock,
  Download,
  Trash2,
  Info,
  Sparkles
} from 'lucide-react';
import { sanitizeLog } from '@/lib/sanitizer';
import { getWorkspaceSession, setWorkspaceSession, isWorkspaceSharingEnabled } from '@/lib/workspaceSession';

// Browsers choke on rendering / copying giant strings in the DOM, so large results are previewed
// and only the download / copy actions touch the full text.
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const PREVIEW_CHARS = 200000;

export default function LogSanitizerPage() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [useHashing, setUseHashing] = useState(false);
  const [saltVal, setSaltVal] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'paste'
  const [fileName, setFileName] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Masking configuration
  const [maskCredentials, setMaskCredentials] = useState(true);
  const [maskCompIds, setMaskCompIds] = useState(true);
  const [maskAccounts, setMaskAccounts] = useState(true);
  const [maskIpAddress, setMaskIpAddress] = useState(true);
  const [maskFinancialPii, setMaskFinancialPii] = useState(true);
  const [maskPrices, setMaskPrices] = useState(false);
  const [maskSizes, setMaskSizes] = useState(false);
  const [customTagsStr, setCustomTagsStr] = useState('');
  const [tagRemapsStr, setTagRemapsStr] = useState('');
  const [replacementStr, setReplacementStr] = useState('[MASKED]');

  // Stats
  const [stats, setStats] = useState({
    messageCount: 0,
    fieldsMasked: 0,
    byteReduction: 0
  });

  const handleReset = () => {
    setInputText('');
    setOutputText('');
    setMaskCredentials(true);
    setMaskCompIds(true);
    setMaskPrices(false);
    setMaskSizes(false);
    setCustomTagsStr('');
    setReplacementStr('[MASKED]');
    setUseHashing(false);
    setSaltVal('');
    setStats({ messageCount: 0, fieldsMasked: 0, byteReduction: 0 });
    setCopied(false);
    setShowSetup(true);
    setFileName('');
    setErrorMsg('');
  };

  const handleLoadDemo = () => {
    const demoLogs = `8=FIX.4.4|9=122|35=A|49=SENDER_A|56=TARGET_B|34=1|52=20260716-12:00:00|554=MySecretPassword99|10=188|
8=FIX.4.4|9=154|35=D|49=SENDER_A|56=TARGET_B|34=2|52=20260716-12:00:05|11=CLORD_7788|55=MSFT|54=1|38=500|44=182.25|60=20260716-12:00:05|10=210|`;
    setInputText(demoLogs);
    setInputMode('paste');
    setFileName('');
  };

  const handleQuickLoad = () => {
    let workspaceLogs = "";
    if (typeof window !== "undefined") {
      const pasted = localStorage.getItem("fixify-logs-pastedText");
      if (pasted && pasted.trim()) {
        workspaceLogs = pasted;
      } else {
        const filesJson = localStorage.getItem("fixify-logs-files");
        if (filesJson) {
          try {
            const files = JSON.parse(filesJson);
            if (Array.isArray(files) && files.length > 0) {
              workspaceLogs = files.map(f => f.content || "").join("\n");
            }
          } catch (e) {}
        }
      }
    }
    if (workspaceLogs && workspaceLogs.trim()) {
      setInputText(workspaceLogs);
      setInputMode('paste');
      setFileName('');
    } else {
      handleLoadDemo();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_INPUT_BYTES) {
      setErrorMsg(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(0)} MB; the limit is ${MAX_INPUT_BYTES / (1024 * 1024)} MB. Split the log first.`);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const textContent = event.target.result;
      setInputText(textContent);
      performSanitize(textContent);
    };
    reader.readAsText(file);
  };

  const handleSanitize = () => {
    performSanitize(inputText);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isWorkspaceSharingEnabled()) {
      const session = getWorkspaceSession();
      if (session && session.rawText) {
        setInputText(session.rawText);
        setInputMode('paste');
      }
    }
  }, []);

  const performSanitize = async (text) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMsg('');
    setProgress(0);

    if (isWorkspaceSharingEnabled()) {
      setWorkspaceSession({ rawText: text, source: 'sanitizer' });
    }

    try {
      const { output, stats: result, warnings } = await sanitizeLog(text, {
        groups: {
          credentials: maskCredentials,
          compIds: maskCompIds,
          accounts: maskAccounts,
          ips: maskIpAddress,
          pii: maskFinancialPii,
          prices: maskPrices,
          sizes: maskSizes,
        },
        customTags: customTagsStr,
        remaps: tagRemapsStr,
        replacement: replacementStr,
        useHashing,
        salt: saltVal,
        onProgress: setProgress,
      });
      setOutputText(output);
      setStats({
        messageCount: result.messageCount,
        fieldsMasked: result.fieldsMasked,
        byteReduction: result.byteReduction,
      });
      const notes = [...warnings];
      if (result.skippedLines > 0) {
        notes.push(`${result.skippedLines} line(s) were not FIX messages and were passed through unchanged.`);
      }
      setErrorMsg(notes.join(' '));
      setShowSetup(false);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sanitized_fix_logs.log';
    link.click();
    URL.revokeObjectURL(url);
  };

  const isProcessed = !!outputText;

  const renderSetupPanel = () => (
    <div
      className="p-5 rounded-2xl border space-y-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          1. Ingest Raw Logs
        </h2>
        <div className="flex items-center gap-3">
          <div className="fx-tab-group">
            <button
              className={`fx-tab${inputMode === 'file' ? ' active' : ''}`}
              onClick={() => setInputMode('file')}
            >
              <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">File</span>
            </button>
            <button
              className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
              onClick={() => setInputMode('paste')}
            >
              <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste</span>
            </button>
          </div>
          {!inputText.trim() && (
            <button
              onClick={handleQuickLoad}
              className="fx-btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1.5 cursor-pointer"
              title="Quick load active session logs or demo logs"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>Quick Load</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">

        {inputMode === 'file' ? (
          fileName ? (
            <div className="p-6 rounded-lg border flex items-center justify-between" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--primary-faint)] border border-[var(--primary-border)] shrink-0">
                  <FileText className="h-4 w-4 text-[var(--primary)]" />
                </div>
                <div className="truncate text-left">
                  <p className="text-xs font-mono font-bold truncate text-[var(--foreground)]" title={fileName}>
                    {fileName}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">File loaded successfully</p>
                </div>
              </div>
              <button
                onClick={() => { setFileName(''); setInputText(''); }}
                className="h-7 w-7 rounded-lg border flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
                title="Remove file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg cursor-pointer hover:bg-zinc-800/10 dark:hover:bg-zinc-855/20 transition-all text-center"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <Upload className="h-6 w-6 text-[var(--text-muted)] mb-2" />
              <span className="text-xs font-semibold text-[var(--primary)]">Choose Log File</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Supports .txt · .fix · .log</p>
              <input
                type="file"
                accept=".txt,.log,.fix"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )
        ) : (
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste raw FIX logs here..."
            rows={8}
            className="w-full fx-input resize-y"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        )}
      </div>

      <div className="space-y-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          2. Privacy Masking Policies
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer hover:bg-zinc-850/10 dark:hover:bg-zinc-850/20 transition-colors" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <div>
                <p className="font-bold text-[var(--foreground)]">Mask Credentials &amp; Key Material</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Password (554), RawData (96), Signature (89)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={maskCredentials}
              onChange={(e) => setMaskCredentials(e.target.checked)}
              className="accent-[var(--primary)] h-4 w-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer hover:bg-zinc-850/10 dark:hover:bg-zinc-850/20 transition-colors" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--primary)]" />
              <div>
                <p className="font-bold text-[var(--foreground)]">Mask Session CompIDs</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Sender (49), Target (56), OnBehalfOf (115)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={maskCompIds}
              onChange={(e) => setMaskCompIds(e.target.checked)}
              className="accent-[var(--primary)] h-4 w-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer hover:bg-zinc-850/10 dark:hover:bg-zinc-850/20 transition-colors" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="font-bold text-[var(--foreground)]">Mask Prices &amp; Execution Yields</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Price (44), StopPx (99), LastPx (31), AvgPx (6)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={maskPrices}
              onChange={(e) => setMaskPrices(e.target.checked)}
              className="accent-[var(--primary)] h-4 w-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer hover:bg-zinc-850/10 dark:hover:bg-zinc-850/20 transition-colors" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <div>
                <p className="font-bold text-[var(--foreground)]">Mask Quantities &amp; Order Sizes</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">OrderQty (38), LastQty (32), CumQty (14)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={maskSizes}
              onChange={(e) => setMaskSizes(e.target.checked)}
              className="accent-[var(--primary)] h-4 w-4 cursor-pointer"
            />
          </label>
        </div>

        <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Custom Tags to Mask (Comma separated)
            </label>
            <input
              type="text"
              value={customTagsStr}
              onChange={(e) => setCustomTagsStr(e.target.value)}
              placeholder="e.g. 11, 37, 58"
              className="w-full fx-input"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <label className="flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer hover:bg-zinc-850/10 dark:hover:bg-zinc-850/20 transition-colors" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-500" />
              <div className="text-left">
                <p className="font-bold text-[var(--foreground)]">Enable Cryptographic Hashing</p>
                <p className="text-[9px] text-[var(--text-muted)] mt-0.5">Use salted SHA-256 (cyrb128) tokenization instead of static replacement text.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useHashing}
              onChange={(e) => setUseHashing(e.target.checked)}
              className="accent-[var(--primary)] h-4 w-4 cursor-pointer"
            />
          </label>

          {useHashing ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Cryptographic Salt Key
              </label>
              <input
                type="text"
                value={saltVal}
                onChange={(e) => setSaltVal(e.target.value)}
                placeholder="secret salt (required)"
                className="w-full fx-input font-mono"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Mask Replacement Text
              </label>
              <input
                type="text"
                value={replacementStr}
                onChange={(e) => setReplacementStr(e.target.value)}
                placeholder="[MASKED]"
                className="w-full fx-input"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSanitize}
          disabled={isProcessing || !inputText.trim()}
          className="w-full fx-btn-primary justify-center font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer mt-4"
        >
          <ScanEyeIcon className="h-4 w-4" />
          <span>{isProcessing ? `Processing... ${Math.round(progress * 100)}%` : 'Sanitize Raw Logs'}</span>
        </button>
        {errorMsg && (
          <p role="status" className="text-[11px] font-mono mt-3 text-amber-500">{errorMsg}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isProcessed ? 'max-w-2xl mx-auto' : ''}`}>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <ScanEyeIcon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Log Sanitizer &amp; Anonymizer</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
              title="View help & usage guide"
            >
              <Info className="h-4 w-4" />
            </button>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Mask credentials, client identifiers, prices, and sizes in raw logs. Auto-recalculates checksums and lengths.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isProcessed && (
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="fx-btn-secondary py-2 px-4 text-xs font-semibold"
              title="Toggle configuration sidebar"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{showSetup ? 'Hide Settings' : 'Show Settings'}</span>
            </button>
          )}
          {(inputText || isProcessed) && (
            <button onClick={handleReset} className="fx-btn-secondary py-2 px-4 text-xs font-semibold">
              <RotateCcw className="h-3.5 w-3.5" /> <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {!isProcessed ? (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
          {renderSetupPanel()}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
          {showSetup && (
            <div className="lg:col-span-4 space-y-6">
              {renderSetupPanel()}
            </div>
          )}
          <div className={showSetup ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
            {/* Card 3: Anonymization stats */}
            <div className="grid grid-cols-3 gap-4">
              <div
                className="p-4 rounded-2xl border text-center space-y-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Messages Sanitized</p>
                <p className="text-xl font-mono font-extrabold text-[var(--foreground)]">{stats.messageCount}</p>
              </div>

              <div
                className="p-4 rounded-2xl border text-center space-y-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Fields Masked</p>
                <p className="text-xl font-mono font-extrabold text-amber-500">{stats.fieldsMasked}</p>
              </div>

              <div
                className="p-4 rounded-2xl border text-center space-y-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Size Change</p>
                <p className="text-xl font-mono font-extrabold text-green-400">
                  {stats.byteReduction > 0 ? `-${stats.byteReduction} B` : `${Math.abs(stats.byteReduction)} B`}
                </p>
              </div>
            </div>

            {/* Card 4: Output Container */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Toolbar */}
              <div
                className="px-5 py-3.5 flex items-center justify-between border-b"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-xs font-bold font-mono text-[var(--foreground)]">Sanitized Log Stream</span>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={handleDownload} className="fx-btn-secondary py-1.5 px-3 text-xs font-semibold" title="Download log file">
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                  <button onClick={handleCopy} className="fx-btn-primary py-1.5 px-3 text-xs font-semibold">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Content Textarea */}
              <div className="p-5">
                <pre
                  className="w-full min-h-[300px] max-h-[500px] overflow-y-auto p-4 rounded-xl border font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap select-all"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {outputText.length > PREVIEW_CHARS ? outputText.slice(0, PREVIEW_CHARS) : outputText}
                </pre>
                {outputText.length > PREVIEW_CHARS && (
                  <p className="text-[10px] font-mono mt-2 text-amber-500">
                    Preview shows the first {PREVIEW_CHARS.toLocaleString()} of {outputText.length.toLocaleString()} characters. Download or Copy gives the full result.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {infoModalOpen && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setInfoModalOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-6 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Usage & Help Guide</h3>
              </div>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors text-xs font-semibold font-mono cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed scrollbar-thin">
              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">What is the Log Sanitizer &amp; Anonymizer?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  Raw FIX logs often contain sensitive client identifiers, passwords, transaction prices, or sizes. The Sanitizer masks these fields using customizable substitution tokens while automatically recalculating the standard MsgLength (9) and CheckSum (10) headers to ensure the parsed logs remain compatible with external test systems or debuggers.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">How to use:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Upload / Paste Logs:</strong> Choose a file or select Paste tab to insert your raw FIX log stream.</li>
                  <li><strong>Select Masking Rules:</strong> Toggle rules to mask Credentials (e.g. tag 554), CompIDs (e.g. tag 49), Prices (e.g. tag 44), and Sizes (e.g. tag 38).</li>
                  <li><strong>Custom Tags:</strong> Enter additional custom tag numbers separated by commas (e.g., <code>115,120</code>) to mask counterparty-specific tags.</li>
                  <li><strong>Mask replacement:</strong> Specify your replacement string (defaults to <code>[MASKED]</code>).</li>
                  <li><strong>Download & Copy:</strong> Retrieve the sanitized logs, review stats detailing byte reductions, and copy or download the anonymized stream.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

