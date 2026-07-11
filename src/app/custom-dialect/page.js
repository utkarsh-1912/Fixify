'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Upload,
  RotateCcw,
  Settings,
  Check,
  Clipboard,
  Search,
  FileText,
  Trash2,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { parseQuickFixXml, clearCustomDialectCache, getCustomDialect } from '@/lib/dialect';

export default function CustomDialectPage() {
  const [customDialect, setCustomDialect] = useState(null);
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'paste'
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    const custom = getCustomDialect();
    if (custom) {
      setCustomDialect(custom);
    }
  }, []);

  const handleDialectUpload = (e) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = parseQuickFixXml(event.target.result);
        if (parsed) {
          localStorage.setItem('fixify-custom-dialect', JSON.stringify(parsed));
          clearCustomDialectCache();
          setCustomDialect(parsed);
          setSuccessMsg(`Successfully loaded dialect "${parsed.version}" with ${parsed.fields?.length || 0} custom tags!`);
          setInputText('');
        }
      } catch (err) {
        setErrorMsg("Failed to parse QuickFIX XML Dialect: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDialectPaste = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!inputText.trim()) return;

    try {
      const parsed = parseQuickFixXml(inputText);
      if (parsed) {
        localStorage.setItem('fixify-custom-dialect', JSON.stringify(parsed));
        clearCustomDialectCache();
        setCustomDialect(parsed);
        setSuccessMsg(`Successfully loaded dialect "${parsed.version}" with ${parsed.fields?.length || 0} custom tags!`);
        setInputText('');
      }
    } catch (err) {
      setErrorMsg("Failed to parse QuickFIX XML Dialect: " + err.message);
    }
  };

  const removeDialect = () => {
    localStorage.removeItem('fixify-custom-dialect');
    clearCustomDialectCache();
    setCustomDialect(null);
    setSuccessMsg('Custom XML dialect removed. System will revert to standard FIX definitions.');
    setErrorMsg('');
  };

  // Filter custom fields
  const filteredFields = customDialect?.fields?.filter(f => {
    const query = searchTerm.toLowerCase();
    return f.tag.toString().includes(query) || f.name.toLowerCase().includes(query) || f.type.toLowerCase().includes(query);
  }) || [];

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <BookOpen className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Custom XML Dialect Schema</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
              title="View help & usage guide"
            >
              <Info className="h-4 w-4" />
            </button>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Upload custom QuickFIX XML dictionaries to dynamically translate counterparty-specific tags (e.g. range 5000–9999) inside parsed log views.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Management & Ingestion */}
        <div className="lg:col-span-4 space-y-6">
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Load XML Schema
              </h2>
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
            </div>

            {/* Success and Error messages */}
            {successMsg && (
              <div className="p-3 text-xs bg-emerald-950/30 text-emerald-400 border border-emerald-900/20 rounded-lg">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 text-xs bg-red-950/30 text-red-400 border border-red-900/20 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              {inputMode === 'file' ? (
                <label
                  className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg cursor-pointer hover:bg-zinc-800/10 dark:hover:bg-zinc-855/20 transition-all text-center"
                  style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                >
                  <Upload className="h-6 w-6 text-[var(--text-muted)] mb-2" />
                  <span className="text-xs font-semibold text-[var(--primary)]">Choose Schema File</span>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Supports QuickFIX XML schemas</p>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleDialectUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your raw QuickFIX XML schema text here..."
                    rows={10}
                    className="w-full fx-input resize-y"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={handleDialectPaste}
                    disabled={!inputText.trim()}
                    className="w-full fx-btn-primary justify-center font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Load XML Dialect</span>
                  </button>
                </div>
              )}
            </div>

            {customDialect && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between p-3 rounded-lg text-xs" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings className="h-4 w-4 text-[var(--primary)] shrink-0" />
                    <div className="truncate">
                      <p className="font-mono font-bold text-[var(--foreground)]">{customDialect.version}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{customDialect.fields?.length || 0} fields parsed.</p>
                    </div>
                  </div>
                  <button
                    onClick={removeDialect}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:underline px-2.5 py-1 border border-red-500/20 hover:border-red-500/30 bg-red-950/10 rounded-lg transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Custom Fields Explorer */}
        <div className="lg:col-span-8 space-y-6">
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                  Custom Tags Dictionary
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {customDialect ? `${filteredFields.length} of ${customDialect.fields?.length || 0} fields match search` : 'No custom dialect loaded.'}
                </p>
              </div>

              {customDialect && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search by tag number or name..."
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
              )}
            </div>

            {!customDialect ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>
                <Info className="h-8 w-8 text-[var(--text-muted)] mb-3" />
                <p className="text-sm font-bold text-[var(--foreground)]">No custom XML dialect loaded</p>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
                  Upload a standard QuickFIX XML file to parse proprietary counterparty tags and display them in parsed logs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead
                    className="text-[10px] uppercase tracking-wider"
                    style={{ background: "var(--background)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
                  >
                    <tr>
                      <th className="py-2.5 px-3">Tag</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Enum Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: 'var(--border-subtle)' }}>
                    {filteredFields.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[var(--text-muted)] italic">
                          No fields match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredFields.map(f => (
                        <tr key={f.tag} className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/25 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[var(--primary)]">#{f.tag}</td>
                          <td className="py-2.5 px-3 font-semibold text-[var(--foreground)]">{f.name}</td>
                          <td className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>{f.type}</td>
                          <td className="py-2.5 px-3">
                            {f.values && f.values.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[300px]">
                                {f.values.map((v, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
                                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                    title={`${v.enum}: ${v.description}`}
                                  >
                                    {v.enum}={v.description}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] italic">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

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
                <p className="font-bold text-[var(--foreground)]">What is the Custom XML Dialect Manager?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  FIX counterparties frequently use proprietary tags in the range of 5000–9999 for customized execution reporting. This page allows you to upload a standard QuickFIX XML dialect schema to dynamically translate those custom tags in all log, session reconstruction, and comparator views.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">How to use:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Upload File:</strong> Click "Choose Schema File" to import a standard <code>.xml</code> QuickFIX dictionary file containing field definitions and enum values.</li>
                  <li><strong>Paste Schema:</strong> Switch to the "Paste" tab to directly paste raw XML dictionary text and click "Load XML Dialect".</li>
                  <li><strong>Active Indicator:</strong> A successful load will display the parsed dialect version and count of fields. The dialect becomes active globally.</li>
                  <li><strong>Tag Dictionary Explorer:</strong> Browse, filter, and inspect the parsed custom tags, types, and enum descriptions in the table.</li>
                  <li><strong>Revert:</strong> Click "Remove" inside the active card to erase custom configurations and fall back to standard FIX protocol tags.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
