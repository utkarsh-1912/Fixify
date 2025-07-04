"use client";
import { useState } from "react";
import { useDropzone } from "react-dropzone";

const normalizeFIX = (raw) => {
  return raw.replace(/\x01|\^A|\u0001/g, "|").trim();
};

const parseFIX = (msg) => {
  const tags = {};
  normalizeFIX(msg).split("|").forEach(pair => {
    const [key, value] = pair.split("=");
    if (key) tags[key] = value ?? "";
  });
  return tags;
};

export default function FIXComparePage() {
  const [msg1, setMsg1] = useState("");
  const [msg2, setMsg2] = useState("");
  const [tagDiff, setTagDiff] = useState(null);
  const [compareType, setCompareType] = useState("tags");
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  const [file1Content, setFile1Content] = useState("");
  const [file2Content, setFile2Content] = useState("");
  const [fileDiff, setFileDiff] = useState(null);
  const [showUnmatchedFile, setShowUnmatchedFile] = useState(null);
  const [compareMode, setCompareMode] = useState("message");

  const handleCompareMessages = () => {
    const tags1 = parseFIX(msg1);
    const tags2 = parseFIX(msg2);

    const allKeys = new Set([...Object.keys(tags1), ...Object.keys(tags2)]);
    const diff = Array.from(allKeys).map(tag => {
      const val1 = tags1[tag];
      const val2 = tags2[tag];
      return {
        tag,
        val1,
        val2,
        status: compareType === "tags"
          ? (!val1 ? "missingIn1" : (!val2 ? "missingIn2" : "present"))
          : val1 === val2 ? "match" : (!val1 ? "missingIn1" : (!val2 ? "missingIn2" : "mismatch")),
      };
    });

    const missingIn1 = diff.filter(d => d.status === "missingIn1").map(d => d.tag);
    const missingIn2 = diff.filter(d => d.status === "missingIn2").map(d => d.tag);
    const mismatch = diff.filter(d => d.status === "mismatch");

    setTagDiff({ missingIn1, missingIn2, mismatch, full: diff });
    setShowModal(false);
  };

  const handleFileCompare = () => {
    const lines1 = normalizeFIX(file1Content).split("\n").map(l => l.trim()).filter(Boolean);
    const lines2 = normalizeFIX(file2Content).split("\n").map(l => l.trim()).filter(Boolean);

    const parsed1 = lines1.map((line, idx) => ({ line, tags: parseFIX(line), lineNumber: idx + 1 }));
    const parsed2 = lines2.map((line, idx) => ({ line, tags: parseFIX(line), lineNumber: idx + 1 }));

    const matches = [];
    const unmatched1 = [];
    const unmatched2 = [...parsed2];

    for (const msg1 of parsed1) {
      const key1 = [msg1.tags[11], msg1.tags[17], msg1.tags[37]].filter(Boolean).join("|");
      const matchIndex = unmatched2.findIndex(msg2 => [msg2.tags[11], msg2.tags[17], msg2.tags[37]].filter(Boolean).join("|") === key1);

      if (matchIndex !== -1) {
        matches.push({ msg1, msg2: unmatched2[matchIndex] });
        unmatched2.splice(matchIndex, 1);
      } else {
        unmatched1.push(msg1);
      }
    }

    setFileDiff({ matches, unmatched1, unmatched2 });
  };

  const onDrop1 = (acceptedFiles) => {
    const reader = new FileReader();
    reader.onload = () => setFile1Content(reader.result);
    reader.readAsText(acceptedFiles[0]);
  };
  const onDrop2 = (acceptedFiles) => {
    const reader = new FileReader();
    reader.onload = () => setFile2Content(reader.result);
    reader.readAsText(acceptedFiles[0]);
  };

  const { getRootProps: getRootProps1, getInputProps: getInputProps1 } = useDropzone({ onDrop: onDrop1, accept: { "text/plain": [".txt", ".fix"] }, });
  const { getRootProps: getRootProps2, getInputProps: getInputProps2 } = useDropzone({ onDrop: onDrop2, accept: { "text/plain": [".txt", ".fix"] }, });

  return (
    <main className="p-4 min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-6 text-center">🧪 FIX Message Comparator</h1>

      <div className="mb-6 flex flex-col md:flex-row md:items-end md:gap-4">
        <div className="w-full md:w-72">
          <label className="block text-sm font-medium text-gray-700 mb-1">Compare Mode</label>
          <select
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm shadow-sm"
          >
            <option value="message">Compare Messages</option>
            <option value="file">Compare Files</option>
          </select>
        </div>

        {compareMode === "message" && (
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <select
              value={compareType}
              onChange={(e) => setCompareType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded bg-white text-sm shadow-sm"
            >
              <option value="tags">Compare Tags</option>
              <option value="values">Compare Tag + Value</option>
            </select>
            <button onClick={handleCompareMessages} className="btn-gray">Compare</button>
          </div>
        )}

        {compareMode === "file" && (
          <button onClick={handleFileCompare} className="btn-gray mt-4 md:mt-0">Compare Files</button>
        )}
      </div>

      {compareMode === "message" && (
        <div className="mb-8">
          <h2 className="font-semibold mb-2">Enter FIX Messages</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <textarea
              className="p-2 border rounded w-full h-32 font-mono"
              placeholder="Enter FIX Message 1"
              value={msg1}
              onChange={(e) => setMsg1(e.target.value)}
            />
            <textarea
              className="p-2 border rounded w-full h-32 font-mono"
              placeholder="Enter FIX Message 2"
              value={msg2}
              onChange={(e) => setMsg2(e.target.value)}
            />
          </div>

          {tagDiff && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium">Missing Tag in Message 1: <span className="text-red-600">{tagDiff.missingIn1.join(", ") || "None"}</span></p>
              <p className="text-sm font-medium">Missing Tag in Message 2: <span className="text-red-600">{tagDiff.missingIn2.join(", ") || "None"}</span></p>
              {tagDiff.mismatch?.length > 0 && (
                <p className="text-sm font-medium">Mismatched Tags: <span className="text-yellow-700">{tagDiff.mismatch.map(t => t.tag).join(", ")}</span></p>
              )}
              <button onClick={() => setShowModal(true)} className="underline text-gray-600 text-sm mt-1">View Full Comparison</button>
            </div>
          )}
        </div>
      )}

      {compareMode === "file" && (
        <div className="mb-8">
          <h2 className="font-semibold mb-2">Drop or Paste FIX Files</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div {...getRootProps1()} className="border-dashed border-2 p-4 rounded bg-white text-center cursor-pointer">
                <input {...getInputProps1()} />
                <p className="text-gray-800">Drop or select File 1</p>
              </div>
              <textarea
                  className="p-2 border mt-2 rounded w-full h-40 font-mono"
                  placeholder="Paste File 1 Content"
                  value={file1Content}
                  onChange={(e) => setFile1Content(e.target.value)}
              />
            </div>
            <div>
              <div {...getRootProps2()} className="border-dashed border-2 p-4 rounded bg-white text-center cursor-pointer">
                <input {...getInputProps2()} />
                <p className="text-gray-800">Drop or select File 2</p>
              </div>
              <textarea
                  className="p-2 border mt-2 rounded w-full h-40 font-mono"
                  placeholder="Paste File 2 Content"
                  value={file2Content}
                  onChange={(e) => setFile2Content(e.target.value)}
              />
            </div>
          </div>

          {fileDiff && (
            <div className="mt-4 space-y-2">
              {fileDiff.matches.length > 0 ? (<p className="font-semibold text-green-700 cursor-pointer underline" onClick={() => { setModalContent({ data: fileDiff.matches, title: 'Common Messages - File 1 & File 2', type:'matched' }); setShowModal(true); console.log(fileDiff.matches)}}>✅ Matches Found: {fileDiff.matches.length}</p>):(<p className="font-semibold text-green-700">✅ Matches Found: {fileDiff.matches.length}</p>)}
              {fileDiff.unmatched1.length > 0 && (<p className="font-semibold text-red-600 cursor-pointer underline" onClick={() => { setModalContent({ data: fileDiff.unmatched1, title: 'Unmatched Messages - File 1' }); setShowModal(true); }}>❌ File 1 unmatched: {fileDiff.unmatched1.length}</p>)}
              {fileDiff.unmatched2.length > 0 && (<p className="font-semibold text-red-600 cursor-pointer underline" onClick={() => { setModalContent({ data: fileDiff.unmatched2, title: 'Unmatched Messages - File 2' }); setShowModal(true); }}>❌ File 2 unmatched: {fileDiff.unmatched2.length}</p>)}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white max-w-4xl w-full rounded shadow-lg p-4">
            <div className="text-lg font-semibold mb-2">{modalContent?.title || "Comparison Result"}</div>
            <div className="overflow-auto max-h-[70vh]">
              {modalContent?.data ?(
                <pre className="text-xs whitespace-pre-wrap font-mono">
                {modalContent?.type==='matched' ? (modalContent.data.map(({msg1,msg2}, idx) => (
                  <div key={idx} className="border border-gray-300 rounded p-2 bg-gray-50 space-y-2 text-xs mb-1">
                    <div className="text-gray-500 font-semibold">Message {msg1.lineNumber || idx + 1}</div>
                    <div className="bg-green-50 text-green-800 p-2 rounded break-words">{msg1.line || Object.entries(msg1.tags).map(([k, v]) => `${k}=${v}`).join("|")}</div>
                    <div className="bg-gray-50 text-gray-800 p-2 rounded break-words">{msg2.line || Object.entries(msg2.tags).map(([k, v]) => `${k}=${v}`).join("|")}</div>
                  </div>
                ))):(modalContent.data.map((msg, idx) => (
                  <div key={idx} className="grid grid-cols-[1rem_1fr] border-b border-dashed border-gray-300 py-1 gap-2">
                    <div className="text-right text-gray-500 leading-snug">{msg.lineNumber || idx + 1}</div>
                    <div className="text-red-700 break-words whitespace-pre-wrap leading-snug">{msg.line || Object.entries(msg.tags).map(([k, v]) => `${k}=${v}`).join("|")}</div>
                  </div>
                )))}
              </pre>              
              ) : (
                <table className="w-full text-sm font-mono border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Tag</th>
                      <th className="border px-2 py-1">Message 1</th>
                      <th className="border px-2 py-1">Message 2</th>
                      <th className="border px-2 py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagDiff.full.map(({ tag, val1, val2, status }) => (
                      <tr key={tag} className={status === "mismatch" ? "bg-yellow-100" : status.includes("missing") ? "bg-red-100" : ""}>
                        <td className="border px-2 py-1 font-bold">{tag}</td>
                        <td className="border px-2 py-1">{val1 ?? "-"}</td>
                        <td className="border px-2 py-1">{val2 ?? "-"}</td>
                        <td className="border px-2 py-1 capitalize">{status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="text-right mt-4">
              <button
                onClick={() => { setShowModal(false); setModalContent(null); }}
                className="btn-gray"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
