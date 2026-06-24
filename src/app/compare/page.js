'use client';

import { useState, useEffect, Fragment } from "react";
import { useDropzone } from "react-dropzone";
import {
  GitCompare,
  Upload,
  AlertCircle,
  CheckCircle,
  Layers,
  Columns,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { validateFIXMessage, getTagValue } from "@/lib/fixParser";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";
import TagDetailsModal from "@/components/TagDetailsModal";
import { getCustomDialect } from "@/lib/dialect";
import SohVisualizer from "@/components/SohVisualizer";

// Import FIX version dictionaries
import fix40 from "@/data/FIX/FIX40.json";
import fix42 from "@/data/FIX/FIX42.json";
import fix44 from "@/data/FIX/FIX44.json";
import fix50 from "@/data/FIX/FIX50.json";
import fixt11 from "@/data/FIX/FIXT11.json";

const FIX_DICTS = {
  "FIX.4.0": fix40,
  "FIX.4.1": fix40,
  "FIX.4.2": fix42,
  "FIX.4.3": fix44,
  "FIX.4.4": fix44,
  "FIX.5.0": fix50,
  "FIXT.1.1": fixt11
};

// Parse dictionaries into lookup maps for fast access
const versionMaps = {};
Object.entries(FIX_DICTS).forEach(([version, data]) => {
  const fieldsMap = {};
  if (data && Array.isArray(data.fields)) {
    data.fields.forEach(f => {
      const valMap = {};
      if (Array.isArray(f.values)) {
        f.values.forEach(v => {
          valMap[v.enum] = v.description;
        });
      }
      fieldsMap[f.tag] = {
        name: f.name,
        type: f.type,
        values: valMap
      };
    });
  }
  versionMaps[version] = fieldsMap;
});

function getVersionTagName(tag, version) {
  const custom = getCustomDialect();
  if (custom && Array.isArray(custom.fields)) {
    const field = custom.fields.find(f => String(f.tag) === String(tag));
    if (field) return field.name;
  }
  const map = versionMaps[version];
  if (map && map[tag]) {
    return map[tag].name;
  }
  return FIX_TAGS[tag] || `CustomTag_${tag}`;
}

function getVersionValueMeaning(tag, val, version) {
  if (val === undefined || val === null) return val;
  const custom = getCustomDialect();
  if (custom && Array.isArray(custom.fields)) {
    const field = custom.fields.find(f => String(f.tag) === String(tag));
    if (field && Array.isArray(field.values)) {
      const match = field.values.find(v => String(v.enum) === String(val));
      if (match) return match.description;
    }
  }
  const map = versionMaps[version];
  if (map && map[tag] && map[tag].values && map[tag].values[val] !== undefined) {
    return map[tag].values[val];
  }
  return FIX_VALUES[tag]?.[val] || val;
}

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
  const [hideAdmin, setHideAdmin] = useState(false);
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  const [showPayload1, setShowPayload1] = useState(false);
  const [showPayload2, setShowPayload2] = useState(false);
  const [showDetailPayload, setShowDetailPayload] = useState(false);
  const [diffPage, setDiffPage] = useState(1);
  const [diffPageSize, setDiffPageSize] = useState(10);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedMsg1 = localStorage.getItem('fixify-compare-msg1');
    if (savedMsg1) setMsg1(savedMsg1);
    const savedMsg2 = localStorage.getItem('fixify-compare-msg2');
    if (savedMsg2) setMsg2(savedMsg2);
    const savedMode = localStorage.getItem('fixify-compare-mode');
    if (savedMode) setCompareMode(savedMode || 'message');
    const savedType = localStorage.getItem('fixify-compare-type');
    if (savedType) setCompareType(savedType || 'values');
    const savedDelim = localStorage.getItem('fixify-compare-delim');
    if (savedDelim) setDelimiter(savedDelim || '|');
    const savedF1 = localStorage.getItem('fixify-compare-f1');
    if (savedF1) setFile1Content(savedF1);
    const savedF2 = localStorage.getItem('fixify-compare-f2');
    if (savedF2) setFile2Content(savedF2);
    const savedInput1 = localStorage.getItem('fixify-compare-inputType1');
    if (savedInput1) setInputType1(savedInput1 || 'file');
    const savedInput2 = localStorage.getItem('fixify-compare-inputType2');
    if (savedInput2) setInputType2(savedInput2 || 'file');

    try {
      const savedPairs = localStorage.getItem('fixify-compare-pairs');
      if (savedPairs) setComparedPairs(JSON.parse(savedPairs));
      const savedPairIdx = localStorage.getItem('fixify-compare-pairIndex');
      if (savedPairIdx) setSelectedPairIndex(Number(savedPairIdx) || 0);
    } catch (e) {
      console.error("Failed to parse compare page state", e);
    }
    setIsLoaded(true);
  }, []);

  // Save states on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-msg1', msg1);
  }, [msg1, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-msg2', msg2);
  }, [msg2, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-mode', compareMode);
  }, [compareMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-type', compareType);
  }, [compareType, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-delim', delimiter);
  }, [delimiter, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-f1', file1Content);
  }, [file1Content, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-f2', file2Content);
  }, [file2Content, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-inputType1', inputType1);
  }, [inputType1, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-inputType2', inputType2);
  }, [inputType2, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-compare-pairs', JSON.stringify(comparedPairs));
    } catch (e) {
      console.warn("Could not save compared pairs", e);
    }
  }, [comparedPairs, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-compare-pairIndex', String(selectedPairIndex));
  }, [selectedPairIndex, isLoaded]);

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

      // Find BeginString (Tag 8) values to determine version
      const beginString1 = tagList1.find(({ tag }) => tag === "8")?.val || "FIX.4.4";
      const beginString2 = tagList2.find(({ tag }) => tag === "8")?.val || "FIX.4.4";

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
        
        // Lookup version-specific tag name (prefer Message 1's version, fallback to 2's)
        const tagVersion = (v1 !== undefined) ? beginString1 : beginString2;
        const tagName = getVersionTagName(tag, tagVersion);
        
        const nameWithOcc = Number(occ) > 0 ? `${tagName} (Group #${Number(occ) + 1})` : tagName;
        
        const mappedVal1 = getVersionValueMeaning(tag, v1, beginString1);
        const mappedVal2 = getVersionValueMeaning(tag, v2, beginString2);

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
        tagCount1: tagList1.length,
        tagCount2: tagList2.length,
        version1: beginString1,
        version2: beginString2,
        errors1: val1?.errors || [],
        errors2: val2?.errors || [],
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
        const mval1 = summarizeValues(row.mappedValues1);
        const mval2 = summarizeValues(row.mappedValues2);
        return { ...row, val1, val2, mappedVal1: mval1, mappedVal2: mval2 };
      })
      .sort((a, b) => Number(a.tag) - Number(b.tag));
  };

  const ADMIN_TAGS = new Set(["8", "9", "10", "34", "35", "49", "56", "52", "115", "128", "43", "97", "122"]);

  const groupedDiffRows = buildGroupedDiffRows(activePair?.tagDiff.full || []);
  const diffQuery = diffSearch.trim().toLowerCase();
  const filteredDiffRows = groupedDiffRows.filter((row) => {
    if (hideAdmin && ADMIN_TAGS.has(row.tag)) return false;
    if (showDiffsOnly && row.status === 'match') return false;
    
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
  // Reset diff pagination when filters change
  useEffect(() => {
    setDiffPage(1);
  }, [diffSearch, hideAdmin, showDiffsOnly, selectedPairIndex, diffPageSize]);

  const diffTotalPages = Math.ceil(filteredDiffRows.length / diffPageSize) || 1;
  const diffCurrentPage = Math.max(1, Math.min(diffPage, diffTotalPages));
  const previewDiffRows = filteredDiffRows.slice((diffCurrentPage - 1) * diffPageSize, diffCurrentPage * diffPageSize);

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
    <div className="space-y-6 max-w-screen-xl mx-auto">

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
        <button onClick={resetAll} className="fx-btn-secondary shrink-0" title="Reset">
          <RefreshCw className="h-3.5 w-3.5" /> <span className="inline">Reset</span>
        </button>
      </div>

      {/* Mode / Action Toolbar */}
      <div className="fx-toolbar">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode toggle */}
          <div className="fx-tab-group">
            <button className={`fx-tab${compareMode === 'message' ? ' active' : ''}`} onClick={() => setCompareMode('message')}>
              <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Messages</span>
            </button>
            <button className={`fx-tab${compareMode === 'file' ? ' active' : ''}`} onClick={() => setCompareMode('file')}>
              <Columns className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Log Files</span>
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
            title="Run Comparison"
          >
            <GitCompare className="h-3.5 w-3.5" /> <span className="inline">Compare</span>
          </button>
        ) : (
          <button
            onClick={handleFileCompare}
            disabled={!file1Content.trim() || !file2Content.trim()}
            className="fx-btn-primary"
            title="Correlate Files"
          >
            <GitCompare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Correlate Files</span>
          </button>
        )}
      </div>

      {/* Message Compare Mode */}
      {compareMode === 'message' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: 'FIX Message 1', value: msg1, set: setMsg1, ph: '8=FIX.4.2|9=65|35=D|11=ORDER_001|…' },
              { label: 'FIX Message 2', value: msg2, set: setMsg2, ph: '8=FIX.4.2|9=68|35=D|11=ORDER_001|…' },
            ].map((field, i) => (
              <div key={i} className="space-y-2 flex flex-col">
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
                {field.value.trim() && (
                  <div className="rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
                    <button
                      className="flex items-center gap-1.5 w-full text-left px-3.5 py-2.5"
                      onClick={() => field.label === 'Message 1' ? setShowPayload1(p => !p) : setShowPayload2(p => !p)}
                    >
                      {(field.label === 'Message 1' ? showPayload1 : showPayload2)
                        ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                        : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      }
                      <span className="text-[9px] font-bold opacity-70">Payload Preview (First line)</span>
                    </button>
                    {(field.label === 'Message 1' ? showPayload1 : showPayload2) && (
                      <div className="px-3.5 pb-3 select-all">
                        <SohVisualizer content={field.value.split('\n')[0]} delimiter={delimiter} />
                      </div>
                    )}
                  </div>
                )}
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
                      className="px-3 py-2.5 rounded-xl text-xs font-mono text-left flex flex-col gap-1 min-w-[165px] shrink-0 transition-all"
                      style={{
                        border: selectedPairIndex === idx ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                        background: selectedPairIndex === idx ? 'var(--primary-faint)' : 'var(--card)',
                        color: selectedPairIndex === idx ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >
                      <span className="font-bold">Pair #{idx + 1}</span>
                      <span className="text-[10px] truncate max-w-full" style={{ color: 'var(--text-muted)' }}>
                        {pair.msgType1} ({pair.tagCount1}) → {pair.msgType2} ({pair.tagCount2})
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
                {/* Message validation status cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Message 1', valid: activePair.isValid1, count: activePair.tagCount1, errors: activePair.errors1, raw: activePair.line1 },
                    { label: 'Message 2', valid: activePair.isValid2, count: activePair.tagCount2, errors: activePair.errors2, raw: activePair.line2 },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-1.5 p-3.5 rounded-xl text-xs font-mono"
                      style={{
                        background: p.valid ? 'var(--primary-faint)' : 'rgba(239,68,68,0.06)',
                        border: `1px solid ${p.valid ? 'var(--primary-border)' : 'rgba(239,68,68,0.2)'}`,
                        color: p.valid ? 'var(--primary)' : '#f87171',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-semibold">{p.label}: {p.valid ? 'Valid Message' : 'Validation Error'}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                          {p.count} tags
                        </span>
                      </div>
                      {!p.valid && p.errors && p.errors.length > 0 && (
                        <ul className="pl-7 list-disc text-[10px] space-y-0.5 font-sans mb-1.5" style={{ color: '#ef4444' }}>
                          {p.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      )}
                      {p.raw && (
                        <div className="pt-2 border-t border-dashed" style={{ borderColor: 'var(--border-subtle)' }}>
                          <button
                            className="flex items-center gap-1.5 w-full text-left"
                            onClick={() => setShowDetailPayload(s => !s)}
                          >
                            {showDetailPayload
                              ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                              : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            }
                            <span className="text-[9px] font-bold opacity-70">Raw Message Payload</span>
                          </button>
                          {showDetailPayload && (
                            <div className="mt-1.5 p-2.5 rounded bg-zinc-950/40 max-h-24 overflow-y-auto select-all">
                              <SohVisualizer content={p.raw} delimiter={delimiter} />
                            </div>
                          )}
                        </div>
                      )}
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
                    Missing in Message 1:
                    <strong style={{ color: '#f87171' }}>{activePair.tagDiff.missingIn1.join(', ') || 'None'}</strong>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    Missing in Message 2:
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
                    <div className="flex flex-wrap items-center gap-2.5">
                                            
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-mono text-zinc-400 hover:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={hideAdmin}
                            onChange={(e) => setHideAdmin(e.target.checked)}
                            className="rounded border-zinc-800 bg-zinc-950/40 text-[var(--primary)] focus:ring-[var(--primary)] h-3.5 w-3.5"
                          />
                          <span>Hide Admin</span>
                        </label>
                        
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-mono text-zinc-400 hover:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={showDiffsOnly}
                            onChange={(e) => setShowDiffsOnly(e.target.checked)}
                            className="rounded border-zinc-800 bg-zinc-950/40 text-[var(--primary)] focus:ring-[var(--primary)] h-3.5 w-3.5"
                          />
                          <span>Diffs Only</span>
                        </label>
                      </div>

                      <div className="relative w-full sm:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          value={diffSearch}
                          onChange={(e) => setDiffSearch(e.target.value)}
                          placeholder="Search tag..."
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
                        className="fx-btn-secondary shrink-0 py-1.5 px-3 text-[10px] flex items-center gap-1"
                        disabled={filteredDiffRows.length === 0}
                        title="View All"
                      >
                        <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View All</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs font-mono min-w-[700px]">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          {['Tag', 'Field Name', 'Message 1', 'Message 2', 'Count', 'Status'].map(h => (
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
                          const ver1 = activePair?.version1 || "FIX.4.4";
                          const ver2 = activePair?.version2 || "FIX.4.4";
                          const rowVer = status === 'missingIn1' ? ver2 : ver1;
                          return (
                          <tr 
                            key={tag} 
                            onClick={() => setActiveTag({ tag, version: rowVer, val1, val2, mappedVal1, mappedVal2 })}
                            style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                            className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
                          >
                              <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--foreground)' }}>{tag}</td>
                              <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{tagName}</td>
                              <td 
                                className="py-2.5 px-4 max-w-[220px] truncate hover:text-[var(--primary)] transition-colors" 
                                style={{ color: 'var(--foreground)' }} 
                                title={values1.join(', ')}
                                onClick={(e) => {
                                  if (val1 !== null && val1 !== '—') {
                                    e.stopPropagation();
                                    setActiveTag({ tag, version: ver1, val1, val2, mappedVal1, mappedVal2 });
                                  }
                                }}
                              >
                                {mappedVal1 !== val1 ? <span className="underline decoration-dotted" title={mappedVal1}>{val1}</span> : (val1 ?? '—')}
                              </td>
                              <td 
                                className="py-2.5 px-4 max-w-[220px] truncate hover:text-[var(--primary)] transition-colors" 
                                style={{ color: 'var(--foreground)' }} 
                                title={values2.join(', ')}
                                onClick={(e) => {
                                  if (val2 !== null && val2 !== '—') {
                                    e.stopPropagation();
                                    setActiveTag({ tag, version: ver2, val1, val2, mappedVal1, mappedVal2 });
                                  }
                                }}
                              >
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

                  {/* Pagination Controls */}
                  {filteredDiffRows.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-3">
                        <span>
                          Page {diffCurrentPage} of {diffTotalPages} ({filteredDiffRows.length} tags)
                        </span>
                        <select
                          value={diffPageSize}
                          onChange={(e) => setDiffPageSize(Number(e.target.value))}
                          className="px-2 py-1.5 rounded-lg text-xs font-mono cursor-pointer"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none' }}
                        >
                          {[10, 20, 50, 100].map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>
                      {diffTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDiffPage(1)}
                            disabled={diffCurrentPage === 1}
                            className="hidden sm:inline-flex items-center justify-center p-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            title="First Page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDiffPage(prev => Math.max(1, prev - 1))}
                            disabled={diffCurrentPage === 1}
                            className="p-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors flex items-center justify-center"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            title="Previous Page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>

                          {/* Page number indicators */}
                          <div className="hidden sm:flex items-center gap-1 max-w-[200px] overflow-x-auto">
                            {Array.from({ length: diffTotalPages }, (_, i) => i + 1)
                              .filter(page => Math.abs(page - diffCurrentPage) <= 2 || page === 1 || page === diffTotalPages)
                              .map((page, idx, arr) => {
                                const isGap = idx > 0 && page - arr[idx - 1] > 1;
                                return (
                                  <Fragment key={page}>
                                    {isGap && <span className="px-1" style={{ color: 'var(--text-muted)' }}>...</span>}
                                    <button
                                      onClick={() => setDiffPage(page)}
                                      className={`px-2.5 py-1 rounded-md text-xs transition-all ${diffCurrentPage === page ? 'bg-[var(--primary)] text-black font-extrabold' : 'hover:bg-zinc-800 text-zinc-400'}`}
                                    >
                                      {page}
                                    </button>
                                  </Fragment>
                                );
                              })}
                          </div>

                          <button
                            onClick={() => setDiffPage(prev => Math.min(diffTotalPages, prev + 1))}
                            disabled={diffCurrentPage === diffTotalPages}
                            className="p-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors flex items-center justify-center"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            title="Next Page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDiffPage(diffTotalPages)}
                            disabled={diffCurrentPage === diffTotalPages}
                            className="hidden sm:inline-flex items-center justify-center p-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            title="Last Page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
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
                    <div className="space-y-3">
                      <textarea
                        value={panel.content}
                        onChange={(e) => panel.setContent(e.target.value)}
                        placeholder="Paste log content here…"
                        className="w-full h-44 p-3.5 rounded-xl resize-none text-xs font-mono"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      {panel.content.trim() && (
                        <div className="rounded-xl border" style={{ background: 'var(--background)', borderColor: 'var(--border-subtle)' }}>
                          <button
                            className="flex items-center gap-1.5 w-full text-left px-3 py-2"
                            onClick={() => panel.idx === 0 ? setShowPayload1(p => !p) : setShowPayload2(p => !p)}
                          >
                            {(panel.idx === 0 ? showPayload1 : showPayload2)
                              ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--primary)' }} />
                              : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            }
                            <span className="text-[9px] font-bold opacity-70">Payload Preview (First line)</span>
                          </button>
                          {(panel.idx === 0 ? showPayload1 : showPayload2) && (
                            <div className="px-3 pb-2.5 select-all">
                              <SohVisualizer content={panel.content.split('\n')[0]} delimiter={delimiter} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setShowModal(false); setModalContent(null); }}
        >
          <div
            className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
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
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs font-mono min-w-[700px]">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          {['Tag', 'Field Name', 'Message 1 Values', 'Message 2 Values', 'Count', 'Status'].map(h => (
                            <th key={h} className="py-2.5 px-4 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modalContent.data.map((row) => {
                          let badge = <span className="badge-success">Match</span>;
                          let rowBg = 'transparent';
                          if (row.status === 'mismatch') { rowBg = 'rgba(234,179,8,0.04)'; badge = <span className="badge-warn">Diff</span>; }
                          else if (row.status === 'missingIn1') { rowBg = 'rgba(239,68,68,0.04)'; badge = <span className="badge-danger">Missing 1</span>; }
                          else if (row.status === 'missingIn2') { rowBg = 'rgba(251,146,60,0.04)'; badge = <span className="badge-danger" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>Missing 2</span>; }

                          const ver1 = activePair?.version1 || "FIX.4.4";
                          const ver2 = activePair?.version2 || "FIX.4.4";
                          const rowVer = row.status === 'missingIn1' ? ver2 : ver1;
                          return (
                            <tr 
                              key={row.tag} 
                              onClick={() => setActiveTag({ tag: row.tag, version: rowVer, val1: row.val1, val2: row.val2, mappedVal1: row.mappedVal1, mappedVal2: row.mappedVal2 })}
                              style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                              className="hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
                            >
                              <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--foreground)' }}>{row.tag}</td>
                              <td className="py-2.5 px-4" style={{ color: 'var(--text-muted)' }}>{row.tagName}</td>
                              <td 
                                className="py-2.5 px-4 break-words max-w-sm hover:text-[var(--primary)] transition-colors" 
                                style={{ color: 'var(--foreground)' }}
                                onClick={(e) => {
                                  if (row.val1 !== null && row.val1 !== '—') {
                                    e.stopPropagation();
                                    setActiveTag({ tag: row.tag, version: ver1, val1: row.val1, val2: row.val2, mappedVal1: row.mappedVal1, mappedVal2: row.mappedVal2 });
                                  }
                                }}
                              >
                                {row.mappedVal1 !== row.val1 ? <span className="underline decoration-dotted" title={row.mappedVal1}>{row.val1}</span> : (row.val1 ?? '—')}
                              </td>
                              <td 
                                className="py-2.5 px-4 break-words max-w-sm hover:text-[var(--primary)] transition-colors" 
                                style={{ color: 'var(--foreground)' }}
                                onClick={(e) => {
                                  if (row.val2 !== null && row.val2 !== '—') {
                                    e.stopPropagation();
                                    setActiveTag({ tag: row.tag, version: ver2, val1: row.val1, val2: row.val2, mappedVal1: row.mappedVal1, mappedVal2: row.mappedVal2 });
                                  }
                                }}
                              >
                                {row.mappedVal2 !== row.val2 ? <span className="underline decoration-dotted" title={row.mappedVal2}>{row.val2}</span> : (row.val2 ?? '—')}
                              </td>
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
                          <SohVisualizer content={msg1.line} delimiter={delimiter} />
                        </div>
                        <div className="p-2.5 rounded-lg break-all" style={{ background: 'var(--card-hover)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                          <span className="text-[9px] font-bold block mb-0.5" style={{ color: 'var(--text-muted)' }}>FILE 2:</span>
                          <SohVisualizer content={msg2.line} delimiter={delimiter} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs font-mono min-w-[600px]">
                      <thead>
                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th className="py-2.5 px-4 w-16 text-center font-semibold">Line</th>
                          <th className="py-2.5 px-4 text-left font-semibold">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalContent.data.map((msg, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="py-2.5 px-4 text-center font-bold" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>{msg.lineNumber}</td>
                            <td className="py-2.5 px-4 break-all" style={{ color: 'var(--foreground)' }}>
                              <SohVisualizer content={msg.line} delimiter={delimiter} />
                            </td>
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
      {/* Shared Tag Details Modal */}
      {activeTag && (
        <TagDetailsModal
          tag={typeof activeTag === 'object' ? activeTag.tag : activeTag}
          version={typeof activeTag === 'object' ? activeTag.version : (comparedPairs[selectedPairIndex]?.version1 || "FIX.4.4")}
          val1={typeof activeTag === 'object' ? activeTag.val1 : undefined}
          val2={typeof activeTag === 'object' ? activeTag.val2 : undefined}
          mappedVal1={typeof activeTag === 'object' ? activeTag.mappedVal1 : undefined}
          mappedVal2={typeof activeTag === 'object' ? activeTag.mappedVal2 : undefined}
          isOpen={!!activeTag}
          onClose={() => setActiveTag(null)}
          onTagSelect={(t) => {
            if (typeof activeTag === 'object') {
              setActiveTag({ ...activeTag, tag: t });
            } else {
              setActiveTag(t);
            }
          }}
        />
      )}
    </div>
  );
}
