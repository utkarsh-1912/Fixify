'use client';

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  GitCompare,
  Upload,
  AlertCircle,
  CheckCircle,
  Layers,
  Columns,
  RefreshCw,
  FileText,
  ArrowRight,
  Search,
  Eye
} from "lucide-react";
import { validateFIXMessage, getTagValue } from "@/lib/fixParser";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";

export default function FIXComparePage() {
  const [compareMode, setCompareMode] = useState("message");
  const [compareType, setCompareType] = useState("values");
  const [delimiter, setDelimiter] = useState("|");

  const [msg1, setMsg1] = useState("");
  const [msg2, setMsg2] = useState("");
  const [comparedPairs, setComparedPairs] = useState([]);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);

  const [file1Content, setFile1Content] = useState("");
  const [file2Content, setFile2Content] = useState("");
  const [fileDiff, setFileDiff] = useState(null);

  const [inputType1, setInputType1] = useState("file");
  const [inputType2, setInputType2] = useState("file");

  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [diffSearch, setDiffSearch] = useState("");

  const parseMessageTags = (rawMsg, delim) => {
    const parsed = validateFIXMessage(rawMsg, delim);
    return parsed ? parsed.tags : {};
  };

  const handleCompareMessages = () => {
    if (!msg1.trim() || !msg2.trim()) return;
    const lines1 = msg1.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const lines2 = msg2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const maxLines = Math.max(lines1.length, lines2.length);
    const pairs = [];

    for (let i = 0; i < maxLines; i++) {
      const l1 = lines1[i] || "";
      const l2 = lines2[i] || "";
      const val1 = l1 ? validateFIXMessage(l1, delimiter) : null;
      const val2 = l2 ? validateFIXMessage(l2, delimiter) : null;

      const tagList1 = val1 ? val1.tagList : [];
      const tagList2 = val2 ? val2.tagList : [];

      const occurrences1 = {};
      const map1 = {};
      tagList1.forEach(({ tag, val }) => {
        occurrences1[tag] = (occurrences1[tag] ?? 0) + 1;
        map1[`${tag}#${occurrences1[tag] - 1}`] = val;
      });

      const occurrences2 = {};
      const map2 = {};
      tagList2.forEach(({ tag, val }) => {
        occurrences2[tag] = (occurrences2[tag] ?? 0) + 1;
        map2[`${tag}#${occurrences2[tag] - 1}`] = val;
      });

      const allKeys = new Set([...Object.keys(map1), ...Object.keys(map2)]);
      const sortedKeys = Array.from(allKeys).sort((a, b) => {
        const [tagA, occA] = a.split('#').map(Number);
        const [tagB, occB] = b.split('#').map(Number);
        if (tagA !== tagB) return tagA - tagB;
        return occA - occB;
      });

      const diff = sortedKeys.map(key => {
        const [tag, occ] = key.split('#');
        const v1 = map1[key];
        const v2 = map2[key];
        const tagName = FIX_TAGS[tag] || `CustomTag_${tag}`;
        const nameWithOcc = Number(occ) > 0 ? `${tagName} (Group #${Number(occ) + 1})` : tagName;
        const mappedVal1 = FIX_VALUES[tag]?.[v1] || v1;
        const mappedVal2 = FIX_VALUES[tag]?.[v2] || v2;

        let status = "match";
        if (v1 === undefined) status = "missingIn1";
        else if (v2 === undefined) status = "missingIn2";
        else if (v1 !== v2) status = compareType === "tags" ? "match" : "mismatch";

        return { tag, key, tagName: nameWithOcc, val1: v1 ?? null, val2: v2 ?? null, mappedVal1: mappedVal1 ?? null, mappedVal2: mappedVal2 ?? null, status };
      });

      pairs.push({
        lineIndex: i + 1,
        line1: l1,
        line2: l2,
        msgType1: val1?.msgTypeName || (l1 ? "Unknown" : "Empty"),
        msgType2: val2?.msgTypeName || (l2 ? "Unknown" : "Empty"),
        isValid1: val1?.isValid ?? false,
        isValid2: val2?.isValid ?? false,
        tagDiff: {
          missingIn1: diff.filter(d => d.status === "missingIn1").map(d => d.tag),
          missingIn2: diff.filter(d => d.status === "missingIn2").map(d => d.tag),
          mismatch: diff.filter(d => d.status === "mismatch"),
          full: diff,
          checksumValid1: val1?.isValid,
          checksumValid2: val2?.isValid
        }
      });
    }

    setComparedPairs(pairs);
    setSelectedPairIndex(0);
    setDiffSearch("");
  };

  const handleFileCompare = () => {
    if (!file1Content.trim() || !file2Content.trim()) return;
    const lines1 = file1Content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const lines2 = file2Content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed1 = lines1.map((line, idx) => ({ line, tags: parseMessageTags(line, delimiter), lineNumber: idx + 1 }));
    const parsed2 = lines2.map((line, idx) => ({ line, tags: parseMessageTags(line, delimiter), lineNumber: idx + 1 }));

    const matches = [], unmatched1 = [], unmatched2 = [...parsed2];
    for (const m1 of parsed1) {
      const key1 = [m1.tags[11], m1.tags[17], m1.tags[37]].filter(Boolean).join("|");
      let matchIndex = -1;
      if (key1) matchIndex = unmatched2.findIndex(m2 => [m2.tags[11], m2.tags[17], m2.tags[37]].filter(Boolean).join("|") === key1);
      if (matchIndex !== -1) { matches.push({ msg1: m1, msg2: unmatched2[matchIndex] }); unmatched2.splice(matchIndex, 1); }
      else unmatched1.push(m1);
    }
    setFileDiff({ matches, unmatched1, unmatched2 });
  };

  const onDrop1 = (files) => { const r = new FileReader(); r.onload = () => setFile1Content(r.result); r.readAsText(files[0]); };
  const onDrop2 = (files) => { const r = new FileReader(); r.onload = () => setFile2Content(r.result); r.readAsText(files[0]); };
  const { getRootProps: rp1, getInputProps: ip1 } = useDropzone({ onDrop: onDrop1, accept: { "text/plain": [".txt", ".fix", ".log"] }, multiple: false });
  const { getRootProps: rp2, getInputProps: ip2 } = useDropzone({ onDrop: onDrop2, accept: { "text/plain": [".txt", ".fix", ".log"] }, multiple: false });

  const resetAll = () => { setMsg1(""); setMsg2(""); setComparedPairs([]); setSelectedPairIndex(0); setFile1Content(""); setFile2Content(""); setFileDiff(null); setDiffSearch(""); };

  const activePair = comparedPairs[selectedPairIndex];

  const summarizeValues = (values, maxItems = 8) => {
    if (!values.length) return "—";
    const visible = values.slice(0, maxItems).join(", ");
    return values.length > maxItems ? `${visible}, +${values.length - maxItems} more` : visible;
  };

  const buildGroupedDiffRows = (rows = []) => {
    const grouped = new Map();
    rows.forEach(({ tag, tagName, val1, val2, mappedVal1, mappedVal2, status }) => {
      if (!grouped.has(tag)) {
        grouped.set(tag, {
          tag,
          tagName: tagName.replace(/\s+\(Group #\d+\)$/, ""),
          values1: [],
          values2: [],
          mappedValues1: [],
          mappedValues2: [],
          status: "match",
          occurrences: 0,
        });
      }

      const row = grouped.get(tag);
      row.occurrences++;
      if (val1 !== null) row.values1.push(val1);
      if (val2 !== null) row.values2.push(val2);
      if (mappedVal1 !== null) row.mappedValues1.push(mappedVal1);
      if (mappedVal2 !== null) row.mappedValues2.push(mappedVal2);

      if (status === "mismatch") row.status = "mismatch";
      else if (status === "missingIn1" && row.status === "match") row.status = "missingIn1";
      else if (status === "missingIn2" && row.status === "match") row.status = "missingIn2";
    });

    return Array.from(grouped.values())
      .map((row) => {
        const val1 = summarizeValues(row.values1);
        const val2 = summarizeValues(row.values2);
        return { ...row, val1, val2, mappedVal1: val1, mappedVal2: val2 };
      })
      .sort((a, b) => Number(a.tag) - Number(b.tag));
  };

  const groupedDiffRows = buildGroupedDiffRows(activePair?.tagDiff.full || []);
  const diffQuery = diffSearch.trim().toLowerCase();
  const filteredDiffRows = groupedDiffRows.filter((row) => {
    if (!diffQuery) return true;
    return [
      row.tag,
      row.tagName,
      ...row.values1,
      ...row.values2,
      ...row.mappedValues1,
      ...row.mappedValues2,
    ].some((value) => String(value).toLowerCase().includes(diffQuery));
  });
  const previewDiffRows = filteredDiffRows.slice(0, 10);

  const inputStyle = {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    outline: 'none',
  };

  const dropzoneStyle = (loaded) => ({
    border: `2px dashed ${loaded ? 'var(--primary)' : 'var(--border)'}`,
    background: loaded ? 'var(--primary-faint)' : 'var(--background)',
    borderRadius: '0.75rem',
    padding: '2.5rem 1rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: '11rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  });

  return (
    <div className="space-y-8 max-w-screen-xl mx-auto">

      {/* Page Header */}
      <div className="fx-page-header flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Message Comparator
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Compare FIX tag values (including repeating groups) or correlate sequence flows across log files.
          </p>
        </div>
        <button onClick={resetAll} className="fx-btn-secondary shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Mode / Action Toolbar */}
      <div className="fx-toolbar">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode toggle */}
          <div className="fx-tab-group">
            <button className={`fx-tab${compareMode === 'message' ? ' active' : ''}`} onClick={() => setCompareMode('message')}>
              <Layers className="h-3.5 w-3.5" /> Messages
            </button>
            <button className={`fx-tab${compareMode === 'file' ? ' active' : ''}`} onClick={() => setCompareMode('file')}>
              <Columns className="h-3.5 w-3.5" /> Log Files
            </button>
          </div>

          {/* Filter (message mode only) */}
          {compareMode === 'message' && (
            <div className="flex items-center gap-2">
              <span className="fx-section-label">Filter:</span>
              <select
                value={compareType}
                onChange={(e) => setCompareType(e.target.value)}
                className="fx-input py-1.5 text-[11px]"
              >
                <option value="values">Tag &amp; Value</option>
                <option value="tags">Tag Presence Only</option>
              </select>
            </div>
          )}

          {/* Delimiter input */}
          <div className="flex items-center gap-2">
            <span className="fx-section-label">Delim:</span>
            <input
              type="text"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className="fx-input py-1 text-center w-12"
              title="Enter custom delimiter (e.g. |, SOH, or leave empty for Auto)"
              placeholder="Auto"
              maxLength={10}
            />
          </div>
        </div>

        {/* Action button */}
        {compareMode === 'message' ? (
          <button
            onClick={handleCompareMessages}
            disabled={!msg1.trim() || !msg2.trim()}
            className="fx-btn-primary"
          >
            <GitCompare className="h-3.5 w-3.5" /> Run Comparison
          </button>
        ) : (
          <button
            onClick={handleFileCompare}
            disabled={!file1Content.trim() || !file2Content.trim()}
            className="fx-btn-primary"
          >
            <GitCompare className="h-3.5 w-3.5" /> Correlate Files
          </button>
        )}
      </div>

      {/* Message Compare Mode */}
      {compareMode === 'message' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: 'FIX Payload 1 (multi-line supported)', value: msg1, set: setMsg1, ph: '8=FIX.4.2|9=65|35=D|11=ORDER_001|…' },
              { label: 'FIX Payload 2 (multi-line supported)', value: msg2, set: setMsg2, ph: '8=FIX.4.2|9=68|35=D|11=ORDER_001|…' },
            ].map((field, i) => (
              <div key={i} className="space-y-2">
                <label className="fx-section-label">{field.label}</label>
                <textarea
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.ph}
                  className="w-full h-52 p-4 rounded-xl resize-none text-xs font-mono"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}
          </div>

          {/* Multi-line pair selector */}
          {comparedPairs.length > 1 && (
            <div className="space-y-2">
              <p className="fx-section-label">Message Sequence Pairs</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {comparedPairs.map((pair, idx) => {
                  const hasDiff = pair.tagDiff.mismatch.length > 0 || pair.tagDiff.missingIn1.length > 0 || pair.tagDiff.missingIn2.length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPairIndex(idx)}
                      className="px-3 py-2.5 rounded-xl text-xs font-mono text-left flex flex-col gap-1 min-w-[160px] shrink-0 transition-all"
                      style={{
                        border: selectedPairIndex === idx ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                        background: selectedPairIndex === idx ? 'var(--primary-faint)' : 'var(--card)',
                        color: selectedPairIndex === idx ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >
                      <span className="font-bold">Pair #{idx + 1}</span>
                      <span className="text-[10px] truncate max-w-full" style={{ color: 'var(--text-muted)' }}>
                        {pair.msgType1} → {pair.msgType2}
                      </span>
                      <span className="text-[9px] font-semibold" style={{ color: hasDiff ? '#f87171' : 'var(--primary)' }}>
                        {hasDiff ? 'Has differences' : 'Identical'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diff results */}
          {activePair && (
            <div
              className="rounded-xl overflow-hidden space-y-0"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div
                className="flex justify-between items-center px-6 py-4"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
                  Diagnostics Report {comparedPairs.length > 1 ? `— Pair #${selectedPairIndex + 1}` : ''}
                </h3>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {activePair.msgType1} vs {activePair.msgType2}
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Checksum status cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Payload 1', valid: activePair.tagDiff.checksumValid1 },
                    { label: 'Payload 2', valid: activePair.tagDiff.checksumValid2 },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3.5 rounded-xl text-xs font-mono"
                      style={{
                        background: p.valid ? 'var(--primary-faint)' : 'rgba(239,68,68,0.06)',
                        border: `1px solid ${p.valid ? 'var(--primary-border)' : 'rgba(239,68,68,0.2)'}`,
                        color: p.valid ? 'var(--primary)' : '#f87171',
                      }}
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>{p.label}: {p.valid ? 'Valid Checksum' : 'Checksum Error'}</span>
                    </div>
                  ))}
                </div>

                {/* Quick summary */}
                <div
                  className="p-4 rounded-xl space-y-2.5 text-xs font-mono"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    Missing in Payload 1:
                    <strong style={{ color: '#f87171' }}>{activePair.tagDiff.missingIn1.join(', ') || 'None'}</strong>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    Missing in Payload 2:
                    <strong style={{ color: '#fb923c' }}>{activePair.tagDiff.missingIn2.join(', ') || 'None'}</strong>
                  </div>
                  {activePair.tagDiff.mismatch?.length > 0 && (
                    <div className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                      Value Mismatches:
                      <strong style={{ color: '#facc15' }}>{activePair.tagDiff.mismatch.map(t => t.tag).join(', ')}</strong>
                    </div>
                  )}
                </div>

                {/* Compact grouped diff table */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="fx-section-label">Grouped Tag Comparison</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Repeating-group occurrences are compressed into comma-separated values.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          value={diffSearch}
                          onChange={(e) => setDiffSearch(e.target.value)}
                          placeholder="Search tag, name, or value..."
                          className="w-full pl-8 pr-3 py-2 rounded-lg text-xs font-mono"
                          style={inputStyle}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalContent({ data: filteredDiffRows, title: `Full Tag Comparison (${filteredDiffRows.length} tags)`, type: 'tagDiff' });
                          setShowModal(true);
                        }}
                        className="fx-btn-secondary shrink-0"
                        disabled={filteredDiffRows.length === 0}
                      >
                        <Eye className="h-3.5 w-3.5" /> View All
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {['Tag', 'Field Name', 'Payload 1', 'Payload 2', 'Count', 'Status'].map(h => (
                          <th key={h} className="py-2.5 px-4 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewDiffRows.map(({ tag, tagName, values1, values2, val1, val2, mappedVal1, mappedVal2, occurrences, status }) => {
                        let rowBg = 'transparent';
                        let badge = <span className="badge-success">Match</span>;
                        if (status === 'mismatch') { rowBg = 'rgba(234,179,8,0.04)'; badge = <span className="badge-warn">Diff</span>; }
                        else if (status === 'missingIn1') { rowBg = 'rgba(239,68,68,0.04)'; badge = <span className="badge-danger">Missing 1</span>; }
                        else if (status === 'missingIn2') { rowBg = 'rgba(251,146,60,0.04)'; badge = <span className="badge-danger" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>Missing 2</span>; }
                        return (
                          <tr key={tag} style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--foreground)' }}>{tag}</td>
                            <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{tagName}</td>
                            <td className="py-2.5 px-4 max-w-[220px] truncate" style={{ color: 'var(--foreground)' }} title={values1.join(', ')}>
                              {mappedVal1 !== val1 ? <span className="underline decoration-dotted" title={mappedVal1}>{val1}</span> : (val1 ?? '—')}
                            </td>
                            <td className="py-2.5 px-4 max-w-[220px] truncate" style={{ color: 'var(--foreground)' }} title={values2.join(', ')}>
                              {mappedVal2 !== val2 ? <span className="underline decoration-dotted" title={mappedVal2}>{val2}</span> : (val2 ?? '—')}
                            </td>
                            <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{occurrences}</td>
                            <td className="py-2.5 px-4">{badge}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                  {filteredDiffRows.length > 10 && (
                    <div className="flex items-center justify-between gap-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      <span>Showing 10 of {filteredDiffRows.length} matching tags.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setModalContent({ data: filteredDiffRows, title: `Full Tag Comparison (${filteredDiffRows.length} tags)`, type: 'tagDiff' });
                          setShowModal(true);
                        }}
                        className="fx-btn-secondary py-1.5"
                      >
                        Expand full comparison
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Compare Mode */}
      {compareMode === 'file' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: 'Log File 1', inputType: inputType1, setInputType: setInputType1, content: file1Content, setContent: setFile1Content, rp: rp1, ip: ip1 },
              { label: 'Log File 2', inputType: inputType2, setInputType: setInputType2, content: file2Content, setContent: setFile2Content, rp: rp2, ip: ip2 },
            ].map((panel, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span className="fx-section-label">{panel.label}</span>
                  <div className="fx-tab-group">
                    <button className={`fx-tab${panel.inputType === 'file' ? ' active' : ''}`} onClick={() => panel.setInputType('file')}>File</button>
                    <button className={`fx-tab${panel.inputType === 'paste' ? ' active' : ''}`} onClick={() => panel.setInputType('paste')}>Paste</button>
                  </div>
                </div>
                <div className="p-4">
                  {panel.inputType === 'file' ? (
                    <div {...panel.rp()} style={dropzoneStyle(!!panel.content)}>
                      <input {...panel.ip()} />
                      <Upload className="h-8 w-8" style={{ color: panel.content ? 'var(--primary)' : 'var(--text-muted)' }} />
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        {panel.content ? 'File loaded — drop to replace' : 'Drop log or click to select'}
                      </p>
                      {panel.content && (
                        <p className="text-[10px] font-mono" style={{ color: 'var(--primary)' }}>
                          {panel.content.split('\n')[0].slice(0, 50)}…
                        </p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={panel.content}
                      onChange={(e) => panel.setContent(e.target.value)}
                      placeholder="Paste log content here…"
                      className="w-full h-44 p-3.5 rounded-xl resize-none text-xs font-mono"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* File diff results */}
          {fileDiff && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div
                className="px-6 py-4"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
                  File Alignment Report
                </h3>
              </div>
              <div className="p-6">
                <div
                  className="rounded-xl p-5 space-y-4 text-xs font-mono"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  {[
                    { icon: CheckCircle, color: 'var(--primary)', label: `Matched transactions: ${fileDiff.matches.length} pairs`, type: 'matched', data: fileDiff.matches },
                    { icon: AlertCircle, color: '#f87171', label: `Unmatched in Log 1: ${fileDiff.unmatched1.length} entries`, type: 'unmatched', data: fileDiff.unmatched1 },
                    { icon: AlertCircle, color: '#fb923c', label: `Unmatched in Log 2: ${fileDiff.unmatched2.length} entries`, type: 'unmatched', data: fileDiff.unmatched2 },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 cursor-pointer hover:underline"
                      style={{ color: row.color }}
                      onClick={() => { setModalContent({ data: row.data, title: row.label, type: row.type }); setShowModal(true); }}
                    >
                      <row.icon className="h-4 w-4 shrink-0" />
                      <span>{row.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '85vh' }}
          >
            <div
              className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                <Layers className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                {modalContent?.title}
              </div>
              <button
                onClick={() => { setShowModal(false); setModalContent(null); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 font-mono text-xs">
              {modalContent?.data && (
                modalContent.type === 'tagDiff' ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          {['Tag', 'Field Name', 'Payload 1 Values', 'Payload 2 Values', 'Count', 'Status'].map(h => (
                            <th key={h} className="py-2.5 px-4 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modalContent.data.map((row) => {
                          let badge = <span className="badge-success">Match</span>;
                          if (row.status === 'mismatch') badge = <span className="badge-warn">Diff</span>;
                          else if (row.status === 'missingIn1') badge = <span className="badge-danger">Missing 1</span>;
                          else if (row.status === 'missingIn2') badge = <span className="badge-danger" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>Missing 2</span>;

                          return (
                            <tr key={row.tag} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--foreground)' }}>{row.tag}</td>
                              <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{row.tagName}</td>
                              <td className="py-2.5 px-4 break-words max-w-sm" style={{ color: 'var(--foreground)' }}>{row.val1}</td>
                              <td className="py-2.5 px-4 break-words max-w-sm" style={{ color: 'var(--foreground)' }}>{row.val2}</td>
                              <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{row.occurrences}</td>
                              <td className="py-2.5 px-4">{badge}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : modalContent.type === 'matched' ? (
                  <div className="space-y-3">
                    {modalContent.data.map(({ msg1, msg2 }, idx) => (
                      <div key={idx} className="p-4 rounded-xl space-y-2" style={{ border: '1px solid var(--border)', background: 'var(--background)' }}>
                        <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                          <span className="font-bold uppercase text-[10px]">Pair #{idx + 1}</span>
                          <span>L1-{msg1.lineNumber} ↔ L2-{msg2.lineNumber}</span>
                        </div>
                        <div className="p-2.5 rounded-lg break-all" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>
                          <span className="text-[9px] font-bold block mb-0.5 opacity-60">FILE 1:</span>
                          {msg1.line}
                        </div>
                        <div className="p-2.5 rounded-lg break-all" style={{ background: 'var(--card-hover)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                          <span className="text-[9px] font-bold block mb-0.5" style={{ color: 'var(--text-muted)' }}>FILE 2:</span>
                          {msg2.line}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th className="py-2.5 px-4 w-16 text-center font-semibold">Line</th>
                          <th className="py-2.5 px-4 text-left font-semibold">Payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalContent.data.map((msg, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="py-2.5 px-4 text-center font-bold" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>{msg.lineNumber}</td>
                            <td className="py-2.5 px-4 break-all" style={{ color: 'var(--foreground)' }}>{msg.line}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
            <div className="px-6 py-4 text-right" style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
              <button onClick={() => { setShowModal(false); setModalContent(null); }} className="fx-btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
