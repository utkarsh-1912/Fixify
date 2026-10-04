const fs = require('fs');
let s, f;
const rep = (x, y, all) => {
  if (!s.includes(x)) throw new Error('missing ' + x.slice(0, 70));
  s = all ? s.split(x).join(y) : s.replace(x, y);
};

// ---------- fixParser: light mode ----------
f = 'src/lib/fixParser.js';
s = fs.readFileSync(f, 'utf8');
rep('export const validateFIXMessage = (rawMessage, customDelimiter) => {', '/**\n * options.light: skip per-tag name / meaning lookups and do not return `tagList` (the heavy part).\n * Use it when parsing thousands of lines; call again without it for the one message being inspected.\n */\nexport const validateFIXMessage = (rawMessage, customDelimiter, options = {}) => {\n  const light = !!options.light;');
rep("tagList.push({ tag, val, name: getTagName(tag) || `CustomTag_${tag}`, meaning: getValueMeaning(tag, val) || val });", "tagList.push(light ? { tag, val } : { tag, val, name: getTagName(tag) || `CustomTag_${tag}`, meaning: getValueMeaning(tag, val) || val });");
rep("    tags: parsedTags,\n    tagList,\n    groups: parsedGroups,\n    separator: sep,\n    msgType,", "    tags: parsedTags,\n    tagList: light ? [] : tagList,\n    tagCount: tagList.length,\n    groups: parsedGroups,\n    separator: sep,\n    msgType,");
fs.writeFileSync(f, s);

// ---------- workspaceSession: cap payload ----------
f = 'src/lib/workspaceSession.js';
s = fs.readFileSync(f, 'utf8');
rep("    const payload = {\n      rawText: sessionData.rawText || '',", "    // localStorage holds ~5 MB; never try to mirror a huge log into it (QuotaExceededError).\n    const MAX = 1000000;\n    let raw = sessionData.rawText || '';\n    let truncated = false;\n    if (raw.length > MAX) {\n      const cut = raw.lastIndexOf('\\n', MAX);\n      raw = raw.slice(0, cut > 0 ? cut : MAX);\n      truncated = true;\n    }\n    const payload = {\n      rawText: raw,");
rep("      source: sessionData.source || 'user',\n      ...sessionData\n    };", "      source: sessionData.source || 'user',\n      ...sessionData,\n      rawText: raw,\n      truncated\n    };");
rep("localStorage.setItem('fixify-logs-pastedText', sessionData.rawText || '');", "localStorage.setItem('fixify-logs-pastedText', raw);");
fs.writeFileSync(f, s);

// ---------- compare page ----------
f = 'src/app/compare/page.js';
s = fs.readFileSync(f, 'utf8');
rep('export default function', "// localStorage is ~5 MB per origin: a write that throws (QuotaExceededError) inside an effect crashes the\n// whole page, so every persist goes through this guard and skips very large values.\nconst MAX_PERSIST_CHARS = 1000000;\nconst MAX_FILE_BYTES = 100 * 1024 * 1024;\nconst MODAL_PAGE = 200;\nconst safeSave = (key, value) => {\n  try {\n    const v = String(value);\n    if (v.length > MAX_PERSIST_CHARS) {\n      localStorage.removeItem(key);\n      return;\n    }\n    localStorage.setItem(key, v);\n  } catch (e) {\n    console.warn('Could not persist', key, e);\n  }\n};\n\nexport default function");
s = s.replace(/localStorage\.setItem\('fixify-compare-(?!pairs')([\w]+)',\s*([^;]+)\);/g, "safeSave('fixify-compare-$1', $2);");
rep("    const parsed = validateFIXMessage(rawMsg, delim);\n    return parsed ? parsed.tags : {};", "    const parsed = validateFIXMessage(rawMsg, delim, { light: true });\n    return parsed ? parsed.tags : {};");
// O(n^2) matching -> indexed
const a = s.indexOf("    const matches = [], unmatched1 = [], unmatched2 = [...parsed2];");
const b = s.indexOf("    setFileDiff({ matches, unmatched1, unmatched2 });");
s = s.slice(0, a) + "    // Index file 2 by transaction key once (O(n)) instead of scanning it for every line of file 1.\n    const keyOf = (m) => [m.tags[11], m.tags[17], m.tags[37]].filter(Boolean).join(\"|\");\n    const byKey = new Map();\n    parsed2.forEach((m2, i) => {\n      const k = keyOf(m2);\n      if (!k) return;\n      if (!byKey.has(k)) byKey.set(k, []);\n      byKey.get(k).push(i);\n    });\n    const used = new Set();\n    const matches = [], unmatched1 = [];\n    for (const m1 of parsed1) {\n      const queue = byKey.get(keyOf(m1));\n      if (queue && queue.length) {\n        const j = queue.shift();\n        used.add(j);\n        matches.push({ msg1: m1, msg2: parsed2[j] });\n      } else unmatched1.push(m1);\n    }\n    const unmatched2 = parsed2.filter((_, i) => !used.has(i));\n" + s.slice(b);
// file reading with size guard
rep("  const onDrop1 = (files) => { const r = new FileReader(); r.onload = () => setFile1Content(r.result); r.readAsText(files[0]); };\n  const onDrop2 = (files) => { const r = new FileReader(); r.onload = () => setFile2Content(r.result); r.readAsText(files[0]); };",
  "  const readLogFile = (file, setContent) => {\n    if (!file) return;\n    if (file.size > MAX_FILE_BYTES) {\n      alert(`\"${file.name}\" is ${(file.size / (1024 * 1024)).toFixed(0)} MB; the limit is ${MAX_FILE_BYTES / (1024 * 1024)} MB. Split the log first.`);\n      return;\n    }\n    const r = new FileReader();\n    r.onload = () => setContent(r.result);\n    r.onerror = () => alert(`Could not read \"${file.name}\".`);\n    r.readAsText(file);\n  };\n  const onDrop1 = (files) => readLogFile(files[0], setFile1Content);\n  const onDrop2 = (files) => readLogFile(files[0], setFile2Content);");
// modal pagination
rep("  const [fileDiff, setFileDiff] = useState(null);", "  const [fileDiff, setFileDiff] = useState(null);\n  const [modalLimit, setModalLimit] = useState(MODAL_PAGE);");
rep("{modalContent.data.map(({ msg1, msg2 }, idx) => (", "{modalContent.data.slice(0, modalLimit).map(({ msg1, msg2 }, idx) => (");
rep("{modalContent.data.map((msg, idx) => (\n                          <tr", "{modalContent.data.slice(0, modalLimit).map((msg, idx) => (\n                          <tr");
rep("              )}\n            </div>\n            <div className=\"px-6 py-4 text-right\"", "              )}\n              {modalContent?.data && modalContent.type !== 'tagDiff' && modalContent.data.length > modalLimit && (\n                <button onClick={() => setModalLimit((n) => n + MODAL_PAGE)} className=\"fx-btn-secondary\">\n                  Showing {modalLimit} of {modalContent.data.length} — show {MODAL_PAGE} more\n                </button>\n              )}\n            </div>\n            <div className=\"px-6 py-4 text-right\"");
rep("onClick={() => { setModalContent({ data: row.data, title: row.label, type: row.type }); setShowModal(true); }}", "onClick={() => { setModalLimit(MODAL_PAGE); setModalContent({ data: row.data, title: row.label, type: row.type }); setShowModal(true); }}");
fs.writeFileSync(f, s);

// ---------- main page ----------
f = 'src/app/page.js';
s = fs.readFileSync(f, 'utf8');
rep("  const displayedTags = (() => {\n    const allTags = selectedLineInfo?.validation?.tagList || [];", "  // Parsed lines are stored in light mode (no per-tag names); the full tag list is built only for the\n  // single message being inspected.\n  const selectedTagList = useMemo(\n    () => (selectedLineInfo ? validateFIXMessage(selectedLineInfo.content, delimiter)?.tagList || [] : []),\n    [selectedLineInfo, delimiter]\n  );\n  const displayedTags = (() => {\n    const allTags = selectedTagList;");
rep("selectedLineInfo.validation?.tagList?.length || 0", "selectedTagList.length");
rep("selectedLineInfo?.validation?.tagList?.find(t => t.tag === '8')?.val", "selectedTagList.find(t => t.tag === '8')?.val");
rep("selectedLineInfo?.validation?.tagList?.find(t => t.tag === activeTag)?.val", "selectedTagList.find(t => t.tag === activeTag)?.val");
rep("selectedLineInfo?.validation?.tagList?.find(t => t.tag === activeTag)?.meaning", "selectedTagList.find(t => t.tag === activeTag)?.meaning");
rep("        const validation = validateFIXMessage(line, delimiter);\n        results.push({\n          id: `${fileName}-${i}-${Date.now()}`,\n          content: line,\n          timestampObj: extractTimestamp(line, delimiter),\n          clOrdID: getTagValue(line, '11', delimiter),\n          msgType: getTagValue(line, '35', delimiter),\n          msgSeqNum: getTagValue(line, '34', delimiter),\n          validation\n        });", "        const validation = validateFIXMessage(line, delimiter, { light: true });\n        const t = validation?.tags;\n        results.push({\n          id: `${fileName}-${i}-${runId}`,\n          content: line,\n          timestampObj: extractTimestamp(line, delimiter),\n          clOrdID: t ? (t['11'] || '') : getTagValue(line, '11', delimiter),\n          msgType: t ? (t['35'] || '') : getTagValue(line, '35', delimiter),\n          msgSeqNum: t ? (t['34'] || '') : getTagValue(line, '34', delimiter),\n          validation\n        });");
rep("    const total = lines.length;\n    const chunkSize = 2500;", "    const total = lines.length;\n    const runId = Date.now();\n    const chunkSize = 2500;");
rep("        parsedLines: sortedLines, \n        parsedDelimiter: delimiter,\n        sortedContent: sortedLines.map((l) => l.content).join('\\n') \n      };", "        parsedLines: sortedLines, \n        parsedDelimiter: delimiter\n      };");
rep("      const isLarge = file.size > 1500000;", "      if (file.size > MAX_FILE_BYTES) {\n        alert(`\"${file.name}\" is ${(file.size / (1024 * 1024)).toFixed(0)} MB; the limit is ${MAX_FILE_BYTES / (1024 * 1024)} MB. Split the log first.`);\n        fileIndex++;\n        processNextFile();\n        return;\n      }\n      const isLarge = file.size > 1500000;");
rep("      reader.readAsText(file);\n    }\n\n    processNextFile();", "      reader.onerror = () => {\n        alert(`Could not read \"${file.name}\".`);\n        fileIndex++;\n        processNextFile();\n      };\n      reader.readAsText(file);\n    }\n\n    processNextFile();");
fs.writeFileSync(f, s);
