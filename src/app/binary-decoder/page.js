'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Layers,
  Upload,
  UploadCloud,
  Cpu,
  RefreshCcw,
  Sparkles,
  Clipboard,
  FileCode,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle,
  Hash,
  Database,
  ArrowRight,
  Eye,
  Sliders,
  Maximize2,
  FileDown,
  Play,
  RotateCcw,
  FileText
} from 'lucide-react';
import SohVisualizer from '@/components/SohVisualizer';
import { getTagName, getValueMeaning, validateFIXMessage } from '@/lib/fixParser';
import { hexToBytes, bytesToHex, decodeSBE, decodeFAST, decodeAsciiFix, encodeSBE, encodeFAST, encodeAsciiFix } from '@/lib/binaryCodec';
import { PRESETS } from '@/lib/binaryPresets';
import { buildFixMessage, SOH } from '@/lib/fixWire';

// A decoder handles one framed message; anything bigger is truncated so the browser never has to
// hold millions of bytes in React state / DOM. The hex dump is paged for the same reason.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const HEX_PAGE_BYTES = 4096;

// Form-editor key: ASCII FIX can repeat a tag (repeating groups), so it is keyed by position.
const builderKey = (enc, f, idx) => (enc === 'ascii_hex' ? `${f.tag}#${idx}` : f.name);

// ==========================================
// PRESETS & SCHEMAS
// ==========================================

// ==========================================
// COMPONENT MAIN
// ==========================================

export default function BinaryDecoderPage() {
  const [encoding, setEncoding] = useState('sbe'); // 'sbe' | 'fast' | 'ascii_hex'
  const [xmlTemplate, setXmlTemplate] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [parsedFields, setParsedFields] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [hoveredFieldOffset, setHoveredFieldOffset] = useState(null);
  const [hoveredFieldSize, setHoveredFieldSize] = useState(null);
  const [activePreset, setActivePreset] = useState('');
  const [editingByteIdx, setEditingByteIdx] = useState(null);
  const [byteEditValue, setByteEditValue] = useState('');
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' | 'form' | 'pmap'
  const [pmapDetails, setPmapDetails] = useState([]);
  const [headerFields, setHeaderFields] = useState([]);
  const [builderValues, setBuilderValues] = useState({});
  const [historyCount, setHistoryCount] = useState(1);
  const [hexPage, setHexPage] = useState(0);
  const [isDecoded, setIsDecoded] = useState(false);
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'file'
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  const fileInputRef = useRef(null);
  const schemaFileInputRef1 = useRef(null);
  const schemaFileInputRef2 = useRef(null);
  const schemaFileInputRef3 = useRef(null);
  const [schemaFileName, setSchemaFileName] = useState('');

  const handleSchemaFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSchemaFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlTemplate(event.target.result);
      setSuccessMsg(`Loaded Schema: ${file.name}`);
    };
    reader.readAsText(file);
  };

  // Load preset data
  const handlePresetSelect = (key) => {
    const preset = PRESETS[key];
    setActivePreset(key);
    setEncoding(preset.encoding);
    setXmlTemplate(preset.schema);
    setHexInput(preset.payload);
    resetResults();
    try {
      decodeBytes(hexToBytes(preset.payload), { enc: preset.encoding, xml: preset.schema });
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
  };

  const resetResults = () => {
    setParseErrors([]);
    setParsedFields([]);
    setPmapDetails([]);
    setHeaderFields([]);
    setSuccessMsg('');
    setIsDecoded(false);
  };

  // Convert Hex input string into byte array (empty when invalid)
  const getBytes = () => {
    try {
      return hexToBytes(hexInput);
    } catch {
      return [];
    }
  };

  // Single decode path shared by presets, the Decode button, byte edits and the form compiler
  const decodeBytes = (bytes, { enc = encoding, xml = xmlTemplate, history = historyCount } = {}) => {
    let result;
    if (enc === 'sbe') {
      result = decodeSBE(bytes, xml);
    } else if (enc === 'fast') {
      result = decodeFAST(bytes, xml, { seed: { MsgSeqNum: BigInt(history), Symbol: 'AAPL' } });
    } else {
      result = decodeAsciiFix(bytes, validateFIXMessage, { name: getTagName, meaning: getValueMeaning });
    }
    setHeaderFields(result.header);
    setParsedFields(result.fields);
    setPmapDetails(result.pmap);
    setBuilderValues(Object.fromEntries(result.fields.map((f, i) => [builderKey(enc, f, i), f.raw])));
    setParseErrors(result.warnings.map((w) => `Warning: ${w}`));
    setSuccessMsg(`Decoded ${enc.toUpperCase()} message "${result.messageName}". Read ${result.fields.length} fields.`);
    setIsDecoded(true);
    return result;
  };

  // Decode handler
  const handleDecode = (historyOverride) => {
    resetResults();
    if (!hexInput.trim()) {
      setParseErrors(['Hex payload is empty.']);
      return;
    }
    try {
      const bytes = hexToBytes(hexInput);
      if (bytes.length > MAX_PAYLOAD_BYTES) {
        throw new Error(`Payload is ${bytes.length} bytes; the decoder handles one message up to ${MAX_PAYLOAD_BYTES} bytes.`);
      }
      decodeBytes(bytes, { history: historyOverride ?? historyCount });
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
  };

  const handleReset = () => {
    setActivePreset('');
    setEncoding('sbe');
    setXmlTemplate('');
    setHexInput('');
    setHoveredFieldOffset(null);
    setHoveredFieldSize(null);
    setEditingByteIdx(null);
    setByteEditValue('');
    setActiveTab('fields');
    setBuilderValues({});
    resetResults();
  };

  // Load Demo Data helper (just like loadSampleData in latency)
  const handleLoadDemo = () => {
    handlePresetSelect('sbe_cme');
  };

  // Re-encode builder values back to a hex payload (SBE / FAST / FIX form compiler)
  const handleCompile = () => {
    try {
      let bytes;
      if (encoding === 'sbe') {
        bytes = encodeSBE(xmlTemplate, builderValues);
      } else if (encoding === 'fast') {
        bytes = encodeFAST(xmlTemplate, builderValues);
      } else {
        bytes = encodeAsciiFix(
          parsedFields.map((f, i) => ({ tag: f.tag, val: builderValues[builderKey(encoding, f, i)] ?? f.raw }))
        );
      }
      setHexInput(bytesToHex(bytes));
      setParseErrors([]);
      decodeBytes(bytes);
      setSuccessMsg('Form values successfully compiled back to a hex payload.');
    } catch (err) {
      setParseErrors([`Compile Error: ${err.message}`]);
    }
  };


  // Reconstructed FIX SOH string (BodyLength and CheckSum are computed, never hard-coded)
  const buildFixString = () => {
    if (encoding === 'ascii_hex') {
      return parsedFields.map((f) => `${f.tag}=${f.raw}`).join(SOH);
    }
    const fields = parsedFields
      .filter((f) => f.status !== 'error' && /^\d+$/.test(String(f.tag)) && f.tag !== '0')
      .map((f) => ({ tag: f.tag, val: f.raw }));
    return fields.length ? buildFixMessage(fields).message : '';
  };

  // Drag and drop binary files
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target?.files[0];
    if (!file) return;

    const truncated = file.size > MAX_PAYLOAD_BYTES;
    const reader = new FileReader();
    reader.onerror = () => setParseErrors([`Could not read "${file.name}".`]);
    reader.onload = (event) => {
      const buffer = event.target.result;
      setHexInput(bytesToHex(new Uint8Array(buffer)));
      setHexPage(0);
      
      // Auto-switch to Paste Hex tab so the inputs are completely visible and editable
      setInputMode('paste');
      
      setParseErrors(truncated ? [`Warning: "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB; only the first ${MAX_PAYLOAD_BYTES / (1024 * 1024)} MiB was loaded. Split the capture into single messages for full decoding.`] : []);
      setSuccessMsg(`Loaded binary file "${file.name}" (${buffer.byteLength} bytes). Ready to decode.`);
    };
    reader.readAsArrayBuffer(file.slice(0, MAX_PAYLOAD_BYTES));
  };

  // Hex Cell Edit Handler
  const startByteEdit = (idx, currentVal) => {
    setEditingByteIdx(idx);
    setByteEditValue(currentVal.toString(16).toUpperCase().padStart(2, '0'));
  };

  const saveByteEdit = () => {
    if (editingByteIdx === null) return;
    const bytes = getBytes();
    const parsedByte = parseInt(byteEditValue, 16);
    if (isNaN(parsedByte) || parsedByte < 0 || parsedByte > 255) {
      setEditingByteIdx(null);
      return;
    }
    bytes[editingByteIdx] = parsedByte;
    setHexInput(bytesToHex(bytes));
    setEditingByteIdx(null);
    
    // Auto re-decode
    try {
      decodeBytes(bytes);
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
  };

  // Quick Hex input formatter
  const formatHexInput = () => {
    const clean = hexInput.replace(/[^0-9a-fA-F]/g, '');
    const formatted = [];
    for (let i = 0; i < clean.length; i += 2) {
      formatted.push(clean.substring(i, i + 2).toUpperCase());
    }
    setHexInput(formatted.join(' '));
  };

  const payloadBytes = useMemo(() => {
    try {
      return hexToBytes(hexInput);
    } catch {
      return [];
    }
  }, [hexInput]);
  const hexPageStart = Math.min(hexPage * HEX_PAGE_BYTES, Math.max(0, payloadBytes.length - 1) - (Math.max(0, payloadBytes.length - 1) % HEX_PAGE_BYTES));
  const hexPageEnd = Math.min(payloadBytes.length, hexPageStart + HEX_PAGE_BYTES);
  const hexPageCount = Math.max(1, Math.ceil(payloadBytes.length / HEX_PAGE_BYTES));

  // Metrics Dashboard (similar to home/latency page stats)
  const metricCards = [
    {
      label: 'Payload Size',
      value: `${payloadBytes.length} Bytes`,
      icon: Database,
      color: 'var(--foreground)',
      bg: 'var(--card-hover)'
    },
    {
      label: 'Fields Decoded',
      value: `${parsedFields.length} Fields`,
      icon: Layers,
      color: 'var(--primary)',
      bg: 'var(--primary-faint)'
    },
    {
      label: 'Encoding Scheme',
      value: encoding.toUpperCase(),
      icon: Cpu,
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.08)'
    },
    {
      label: 'Decoder Status',
      value: parseErrors.length > 0 ? 'Warnings' : 'Conformant',
      icon: parseErrors.length > 0 ? AlertTriangle : CheckCircle,
      color: parseErrors.length > 0 ? '#f87171' : 'var(--primary)',
      bg: parseErrors.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--primary-faint)'
    }
  ];

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-200 text-zinc-100 select-none pb-8">
      
      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isDecoded ? 'max-w-2xl mx-auto' : ''}`}>
        <div className={`space-y-1.5 select-text ${!isDecoded ? 'text-center md:text-left w-full' : ''}`}>
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Cpu className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Binary Decoder</span>
            <Info
              onClick={() => setInfoModalOpen(true)}
              className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer ml-1.5"
              title="View help & usage guide"
            />
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Professional high-frequency trading diagnostic sandbox. Decode, modify, and re-compile binary market data frames dynamically.
          </p>
        </div>

        {/* Coupled stats and preset selectors in header - no separate stats dashboard or success sections */}
        {isDecoded && (
          <div className="flex flex-wrap items-center gap-3.5 shrink-0 self-start md:self-center">
            
            {/* Coupled Stats & Diagnostic Status Badge (Kept clean without long success messages) */}
            <div 
              className="flex items-center gap-3 p-2 px-3 rounded-xl border text-[11px]"
              style={{
                borderColor: 'var(--primary-border)',
                backgroundColor: 'var(--primary-faint)',
                color: 'var(--primary)'
              }}
            >
              <div className="flex items-center gap-1 font-medium text-zinc-200">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                <span>Payload Decoded</span>
              </div>
              <div className="h-3.5 w-px bg-zinc-800" style={{ backgroundColor: 'var(--primary-border)' }} />
              
              {/* Clicking this button triggers the detailed modal containing all success info and metrics */}
              <button
                onClick={() => setStatsModalOpen(true)}
                className="p-1 hover:bg-zinc-800/80 rounded transition-all text-zinc-400 hover:text-[var(--primary)] cursor-pointer"
                title="View detailed payload metrics"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Presets Select Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={activePreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="bg-zinc-955 border border-zinc-855 rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-700 min-w-36 cursor-pointer"
              >
                <option value="" disabled>-- Select Preset --</option>
                {Object.keys(PRESETS).map(key => (
                  <option key={key} value={key}>
                    {PRESETS[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="fx-btn-secondary py-1.5 px-3.5 text-xs font-semibold"
                title="Reset workspace"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Conditional Layout Toggling (Similar to home/latency page) */}
      {!isDecoded ? (
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Controls Input Card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
          >
            {/* Card Toolbar Tabs */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
                  onClick={() => setInputMode('paste')}
                >
                  <FileText className="h-3.5 w-3.5" /> <span>Paste Hex</span>
                </button>
                <button
                  className={`fx-tab${inputMode === 'file' ? ' active' : ''}`}
                  onClick={() => setInputMode('file')}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> <span>Upload File</span>
                </button>
              </div>
              <button
                onClick={handleLoadDemo}
                className="fx-btn-primary py-1 px-3 text-[10px]"
              >
                Load Demo
              </button>
            </div>

            <div className="p-6 space-y-4 select-text">
              {inputMode === 'file' ? (
                <div className="space-y-4">
                  {/* File upload configuration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>

                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 transition-all rounded-xl p-10 text-center cursor-pointer bg-zinc-955/40 hover:bg-zinc-900/20"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileDrop}
                      className="hidden"
                    />
                    <UploadCloud className="h-10 w-10 mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm font-semibold text-zinc-300 font-sans">Drag & Drop Binary File (.bin, .dat, .hex)</p>
                    <p className="text-xs text-zinc-500 font-sans mt-0.5">or click to browse local files</p>
                  </div>

                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); schemaFileInputRef1.current?.click(); }}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                          >
                            <UploadCloud className="h-3 w-3" />
                            {schemaFileName ? `Replace (${schemaFileName.slice(0, 15)})` : 'Upload Schema File'}
                          </button>
                          <input
                            type="file"
                            ref={schemaFileInputRef1}
                            onChange={handleSchemaFileUpload}
                            accept=".xml,.txt"
                            className="hidden"
                          />
                        </div>
                      </div>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={6}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hex paste configuration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Hex Payload Stream</label>
                    <div className="relative">
                      <textarea
                        value={hexInput}
                        onChange={(e) => setHexInput(e.target.value)}
                        placeholder="Paste hex data stream here (e.g. 2400650001000300... or ASCII Hex)"
                        rows={5}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                      <button
                        onClick={formatHexInput}
                        className="absolute bottom-3.5 right-3.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        Format Bytes
                      </button>
                    </div>
                  </div>

                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); schemaFileInputRef2.current?.click(); }}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                          >
                            <UploadCloud className="h-3 w-3" />
                            {schemaFileName ? `Replace (${schemaFileName.slice(0, 15)})` : 'Upload Schema File'}
                          </button>
                          <input
                            type="file"
                            ref={schemaFileInputRef2}
                            onChange={handleSchemaFileUpload}
                            accept=".xml,.txt"
                            className="hidden"
                          />
                        </div>
                      </div>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={6}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-350 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Decode Action Button */}
              <button
                onClick={handleDecode}
                className="fx-btn-primary w-full py-3.5 rounded-xl text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-100 transition-all cursor-pointer shadow-lg"
              >
                <Play className="h-4 w-4 fill-zinc-950" />
                <span>Decode Binary Payload</span>
              </button>
            </div>
          </div>

          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5 shadow-md animate-in slide-in-from-top-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-1">
                <p className="font-bold font-sans">Diagnostic Warnings / Errors:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono text-[11px]">{e}</p>)}
              </div>
            </div>
          )}

          {successMsg && (
            <div 
              className="p-4 rounded-2xl border text-xs flex items-center gap-2.5 shadow-md animate-in slide-in-from-top-1 font-sans"
              style={{
                borderColor: 'var(--primary-border)',
                backgroundColor: 'var(--primary-faint)',
                color: 'var(--primary)'
              }}
            >
              <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
              <p className="font-medium">{successMsg}</p>
            </div>
          )}
          
        </div>
      ) : (
        <>
          {/* Diagnostic warnings show at body level when decoded */}
          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5 shadow-md animate-in slide-in-from-top-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-1">
                <p className="font-bold font-sans">Diagnostic Warnings / Errors:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono text-[11px]">{e}</p>)}
              </div>
            </div>
          )}

          {/* Diagnostics Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-text animate-in fade-in duration-300">
            
            {/* LEFT COLUMN: Input Form */}
            <div className="lg:col-span-5 space-y-6 flex flex-col">
              
              {/* Encoder Configuration Card */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  1. Decoder Configuration
                </span>
                
                <div className="space-y-4">
                  {/* Encoding Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>
                                 {/* XML Schema Editor (Conditional) */}
                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); schemaFileInputRef3.current?.click(); }}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                          >
                            <UploadCloud className="h-3 w-3" />
                            {schemaFileName ? `Replace (${schemaFileName.slice(0, 10)})` : 'Upload Schema File'}
                          </button>
                          <input
                            type="file"
                            ref={schemaFileInputRef3}
                            onChange={handleSchemaFileUpload}
                            accept=".xml,.txt"
                            className="hidden"
                          />
                          <span className="text-[9px] font-mono text-zinc-655 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">XML</span>
                        </div>
                      </div>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={12}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Hex Stream Card */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  2. Hex Payload Stream
                </span>

                <div className="space-y-3.5">
                  <div className="relative">
                    <textarea
                      value={hexInput}
                      onChange={(e) => setHexInput(e.target.value)}
                      placeholder="Paste hex data stream here (e.g. 383D464958... or SBE bytes)"
                      rows={5}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                    />
                    <button
                      onClick={formatHexInput}
                      className="absolute bottom-3.5 right-3.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Format Bytes
                    </button>
                  </div>

                  {/* Drag & Drop File Loader */}
                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-850 hover:border-zinc-750 transition-all rounded-xl p-4 text-center cursor-pointer bg-zinc-955/40 hover:bg-zinc-900/20"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileDrop}
                      className="hidden"
                    />
                    <Upload className="h-5 w-5 mx-auto text-zinc-500 mb-1.5" />
                    <p className="text-[10px] font-bold text-zinc-400 font-sans">Drag & Drop Binary File (.bin, .dat)</p>
                    <p className="text-[9px] text-zinc-650 font-sans mt-0.5">or click to browse local files</p>
                  </div>
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                onClick={handleDecode}
                className="fx-btn-primary w-full py-3.5 rounded-xl text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-100 transition-all cursor-pointer shadow-lg"
              >
                <Play className="h-4 w-4 fill-zinc-950" />
                <span>Decode Binary Payload</span>
              </button>

            </div>

            {/* RIGHT COLUMN: Output Diagnostics */}
            <div className="lg:col-span-7 space-y-6">

              <div className="space-y-6">
                
                {/* Interactive Hex Dump Inspector */}
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                      Hex Dump Inspector
                    </span>
                    <span className="text-[9px] font-mono text-zinc-555 uppercase tracking-widest bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800 font-semibold">
                      Size: {payloadBytes.length} Bytes
                    </span>
                  </div>
                  {hexPageCount > 1 && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>Bytes {hexPageStart}–{hexPageEnd - 1} of {payloadBytes.length}</span>
                      <span className="flex items-center gap-1.5">
                        <button disabled={hexPage === 0} onClick={() => setHexPage((p) => Math.max(0, p - 1))} className="px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 disabled:opacity-40">Prev</button>
                        <span>{Math.min(hexPage, hexPageCount - 1) + 1} / {hexPageCount}</span>
                        <button disabled={hexPage >= hexPageCount - 1} onClick={() => setHexPage((p) => Math.min(hexPageCount - 1, p + 1))} className="px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 disabled:opacity-40">Next</button>
                      </span>
                    </div>
                  )}

                  <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-955/20 font-mono text-[11px]">
                    <div className="grid grid-cols-18 gap-1 p-3 bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 text-[10px] font-bold text-center">
                      <div className="col-span-2 text-left">OFFSET</div>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i}>{i.toString(16).toUpperCase()}</div>
                      ))}
                    </div>

                    <div className="p-3 divide-y divide-zinc-900 max-h-[280px] overflow-y-auto custom-scrollbar space-y-1">
                      {payloadBytes.length === 0 ? (
                        <div className="text-center py-10 text-zinc-655 font-sans text-xs">No payload bytes loaded.</div>
                      ) : (
                        Array.from({ length: Math.ceil((hexPageEnd - hexPageStart) / 16) }).map((_, rowIndex) => {
                          const rowOffset = hexPageStart + rowIndex * 16;
                          return (
                            <div key={rowOffset} className="grid grid-cols-18 gap-1 py-1.5 hover:bg-zinc-900/10 transition-colors">
                              <div className="col-span-2 text-zinc-600 font-bold">
                                {rowOffset.toString(16).toUpperCase().padStart(4, '0')}
                              </div>
                              {Array.from({ length: 16 }).map((_, colIndex) => {
                                const byteIndex = rowOffset + colIndex;
                                const byte = payloadBytes[byteIndex];
                                const isBytePresent = byte !== undefined;
                                
                                const isHovered = hoveredFieldOffset !== null && 
                                                  byteIndex >= hoveredFieldOffset && 
                                                  byteIndex < (hoveredFieldOffset + hoveredFieldSize);

                                return (
                                  <div
                                    key={colIndex}
                                    onMouseEnter={() => {
                                      const match = parsedFields.find(f => byteIndex >= f.offset && byteIndex < (f.offset + f.size));
                                      if (match) {
                                        setHoveredFieldOffset(match.offset);
                                        setHoveredFieldSize(match.size);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredFieldOffset(null);
                                      setHoveredFieldSize(null);
                                    }}
                                    onDoubleClick={() => isBytePresent && startByteEdit(byteIndex, byte)}
                                    style={isHovered ? {
                                      backgroundColor: 'var(--primary-faint)',
                                      color: 'var(--primary)',
                                      borderColor: 'var(--primary-border)',
                                      borderWidth: '1px'
                                    } : {}}
                                    className={`text-center rounded cursor-pointer transition-all duration-100 font-semibold ${
                                      isHovered 
                                        ? 'font-extrabold scale-110 shadow-sm' 
                                        : isBytePresent 
                                          ? 'text-zinc-300 hover:bg-zinc-800' 
                                          : 'text-zinc-800 select-none'
                                    }`}
                                  >
                                    {editingByteIdx === byteIndex ? (
                                      <input
                                        value={byteEditValue}
                                        onChange={e => setByteEditValue(e.target.value.substring(0,2))}
                                        onBlur={saveByteEdit}
                                        onKeyDown={e => e.key === 'Enter' && saveByteEdit()}
                                        style={{
                                          background: 'var(--background)',
                                          color: 'var(--primary)',
                                          borderColor: 'var(--primary-border)'
                                        }}
                                        className="w-full font-mono text-[10px] text-center border rounded focus:outline-none"
                                        autoFocus
                                      />
                                    ) : isBytePresent ? (
                                      byte.toString(16).toUpperCase().padStart(2, '0')
                                    ) : (
                                      '··'
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-zinc-555 font-sans">
                    <span>* Double-click any byte cell to inline edit</span>
                    <span>* Hover cells to inspect field offset boundary ranges</span>
                  </div>
                </div>

                {/* Dynamic Tabs Block */}
                <div className="border border-zinc-800 rounded-2xl bg-zinc-955/60 overflow-hidden shadow-xl">
                  
                  {/* Tabs selection */}
                  <div className="grid grid-cols-3 border-b border-zinc-850 bg-zinc-900/30 text-center text-xs">
                    <button
                      onClick={() => setActiveTab('fields')}
                      style={activeTab === 'fields' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all border-r border-zinc-855 ${activeTab === 'fields' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Decoded Fields
                    </button>
                    <button
                      onClick={() => setActiveTab('form')}
                      style={activeTab === 'form' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all border-r border-zinc-855 ${activeTab === 'form' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Payload Compiler
                    </button>
                    <button
                      onClick={() => setActiveTab('pmap')}
                      style={activeTab === 'pmap' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all ${activeTab === 'pmap' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      FAST PMap / Context
                    </button>
                  </div>

                  <div className="p-5">
                    {/* Tab 1: Decoded fields matrix */}
                    {activeTab === 'fields' && (
                      <div className="space-y-4">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-900 bg-zinc-955/30 text-zinc-500 text-[10px] uppercase font-bold tracking-wider font-mono">
                                <th className="px-4 py-3 font-sans">Tag</th>
                                <th className="px-4 py-3 font-sans">Field</th>
                                <th className="px-3 py-3 font-sans">Hex</th>
                                <th className="px-4 py-3 text-right font-sans">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                              {encoding === 'sbe' && headerFields.map((h, idx) => (
                                <tr key={`header-${idx}`} className="bg-zinc-900/20 text-zinc-500 border-b border-zinc-900">
                                  <td className="px-4 py-2.5 font-bold">H</td>
                                  <td className="px-4 py-2.5 font-sans font-medium">{h.name.replace('Header: ', '')}</td>
                                  <td className="px-3 py-2.5 text-[9px] tracking-tight">{h.rawHex}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-zinc-400">{h.value}</td>
                                </tr>
                              ))}

                              {parsedFields.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-650 font-sans">
                                    No fields decoded.
                                  </td>
                                </tr>
                              ) : (
                                parsedFields.map((field, idx) => {
                                  const isHovered = hoveredFieldOffset === field.offset && hoveredFieldSize === field.size;
                                  return (
                                    <tr
                                      key={idx}
                                      onMouseEnter={() => {
                                        if (field.size > 0) {
                                          setHoveredFieldOffset(field.offset);
                                          setHoveredFieldSize(field.size);
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        setHoveredFieldOffset(null);
                                        setHoveredFieldSize(null);
                                      }}
                                      style={isHovered ? {
                                        backgroundColor: 'var(--primary-faint)',
                                        color: 'var(--primary)'
                                      } : {}}
                                      className={`transition-colors duration-100 ${isHovered ? '' : 'hover:bg-zinc-900/20 text-zinc-300'} ${field.status === 'error' ? 'bg-red-500/5 text-red-400' : ''}`}
                                    >
                                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--primary)' }}>{field.tag}</td>
                                      <td className="px-4 py-3 font-sans font-medium text-zinc-200">{field.name}</td>
                                      <td className="px-3 py-3 text-[10px] text-zinc-550 tracking-tighter">{field.rawHex}</td>
                                      <td className="px-4 py-3 text-right font-bold text-zinc-100">{field.value}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Payload Form Compiler */}
                    {activeTab === 'form' && (
                      <div className="space-y-4 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
                          <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">Form Editor Sandbox</span>
                          <button
                            onClick={handleCompile}
                            className="fx-btn-secondary px-3.5 py-1.5 text-[10px] font-bold flex items-center gap-1.5 rounded-lg cursor-pointer"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Compile to HEX
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                          {parsedFields.length === 0 ? (
                            <div className="text-center py-10 text-zinc-655 text-xs font-sans">No active fields mapped.</div>
                          ) : (
                            parsedFields.map((f, idx) => {
                              if (f.tag === 'Header') return null;
                              const bKey = builderKey(encoding, f, idx);

                              return (
                                <div key={idx} className="space-y-1 bg-zinc-900/10 p-2.5 rounded-xl border border-zinc-900 hover:border-zinc-850 transition-colors flex items-center justify-between gap-4">
                                  <div className="space-y-0.5">
                                    <label className="text-[11px] font-bold text-zinc-350 block font-sans">{f.name}</label>
                                    <span className="text-[9px] font-mono text-zinc-550 block">Tag {f.tag} • {f.type}</span>
                                  </div>
                                  <input
                                    value={builderValues[bKey] ?? ''}
                                    onChange={e => setBuilderValues({ ...builderValues, [bKey]: e.target.value })}
                                    className="bg-zinc-955 border border-zinc-855 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 w-44 text-right"
                                  />
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: FAST PMap / state */}
                    {activeTab === 'pmap' && (
                      <div className="space-y-4">
                        {encoding !== 'fast' ? (
                          <div className="text-center py-10 text-zinc-600 text-xs font-sans">
                            Presence Map (PMap) breakdown is only available for FAST-encoded streams.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {pmapDetails.length === 0 ? (
                              <div className="text-center py-10 text-zinc-650 text-xs font-sans">No PMap bits extracted.</div>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {pmapDetails.map((detail) => (
                                  <div 
                                    key={detail.bitIndex} 
                                    style={detail.isPresent ? {
                                      backgroundColor: 'var(--primary-faint)',
                                      borderColor: 'var(--primary-border)',
                                      color: 'var(--primary)'
                                    } : {}}
                                    className={`p-2.5 rounded-xl border text-center font-mono space-y-0.5 ${detail.isPresent ? 'text-emerald-300 font-bold' : 'bg-zinc-900 border-zinc-855 text-zinc-500'}`}
                                  >
                                    <div className="text-[8px] text-zinc-555">Bit {detail.bitIndex}</div>
                                    <div className="text-[12px] font-extrabold">{detail.isPresent ? '1' : '0'}</div>
                                    <div className="text-[8px] truncate uppercase">{detail.field}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="space-y-3.5 border-t border-zinc-900 pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">FAST Operators History Context</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const count = Math.max(1, historyCount - 1);
                                      setHistoryCount(count);
                                      handleDecode(count);
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px] cursor-pointer"
                                  >
                                    Prev
                                  </button>
                                  <span className="text-[10px] font-mono text-zinc-300 font-bold px-1.5">{historyCount}</span>
                                  <button
                                    onClick={() => {
                                      const count = historyCount + 1;
                                      setHistoryCount(count);
                                      handleDecode(count);
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px] cursor-pointer"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-zinc-555 leading-relaxed font-sans">
                                FAST uses contextual states to resolve incremental (<code className="font-mono" style={{ color: 'var(--primary)' }}>&lt;increment/&gt;</code>) or copy (<code className="font-mono" style={{ color: 'var(--primary)' }}>&lt;copy/&gt;</code>) operator bounds. Adjust sequence indexes to see values adapt.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Reconstructed SOH Tag-Value Message */}
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-3.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono block">Reconstructed Tag=Value Message (SOH):</span>
                  <div className="p-3 bg-zinc-955/80 border border-zinc-900 rounded-xl overflow-x-auto">
                    <SohVisualizer content={buildFixString()} delimiter="\x01" />
                  </div>
                </div>

              </div>

            </div>

          </div>
        </>
      )}

      {/* Usage & Help Modal overlay */}
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
                <p className="font-bold text-[var(--foreground)]">What is Simple Binary Encoding (SBE)?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  Simple Binary Encoding (SBE) is a low-latency, binary message format optimized for high-frequency trading (HFT) feeds, such as CME MDP 3.0 or B3. It encodes fields at fixed byte offsets using little-endian or big-endian orders, allowing hardware and software to parse packets with zero copy operations.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">What is FIX Adapted for Streaming (FAST)?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  FAST is a data compression protocol designed to minimize bandwidth utilization. It utilizes a **Presence Map (PMap)** bit vector where each bit determines if a field is present in the stream or if it should be resolved using state operators (e.g. <code>copy</code>, <code>default</code>, or <code>increment</code>).
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">Usage Guidelines:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Select Preset:</strong> Choose a preset (e.g., CME SBE or OPRA FAST) to automatically load demo schemas and payloads.</li>
                  <li><strong>Custom Payloads:</strong> Paste any raw Hex bytes in the &quot;Paste Hex&quot; input field, choose the protocol type, edit your XML schema, and click <strong>Decode Binary Payload</strong>.</li>
                  <li><strong>Hex Dump Inspector:</strong> Hover over fields in the decoded table to view their byte boundaries highlighted in the grid. Double-click any byte cell to edit it directly.</li>
                  <li><strong>Payload Compiler:</strong> Edit values in the &quot;Payload Compiler&quot; tab and click &quot;Compile to HEX&quot; to re-encode standard tag-value segments or binary frames.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detailed Payload Statistics Modal overlay */}
      {statsModalOpen && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setStatsModalOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-6 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Payload Statistics Dashboard</h3>
              </div>
              <button
                onClick={() => setStatsModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors text-xs font-semibold font-mono cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content - Detailed Success Banner & Metric Cards Grid */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed scrollbar-thin">
              <div 
                className="p-3.5 rounded-xl border text-xs flex items-center gap-2.5 font-sans"
                style={{
                  borderColor: 'var(--primary-faint)',
                  backgroundColor: 'var(--primary-faint)',
                  color: 'var(--primary)'
                }}
              >
                <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                <p className="font-semibold">{successMsg}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 select-text">
                {metricCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3.5 p-4 rounded-xl border border-zinc-805 bg-zinc-950/40"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: card.bg }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.color }} />
                    </div>
                    <div className="min-w-0 flex-1 font-sans">
                      <div className="text-base font-extrabold font-mono" style={{ color: card.color }}>
                        {card.value}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">
                        {card.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
