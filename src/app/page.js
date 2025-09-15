'use client';

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ArrowDownTrayIcon, ArrowRightIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import FileModal from "@/components/FileModal";

export default function Home() {
  const [rawFiles, setRawFiles] = useState([]);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [disallowedTags, setDisallowedTags] = useState([]);
  const [newDisallowedTag, setNewDisallowedTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [sortLogic, setSortLogic] = useState("Mixed");
  const [useTag90052, setUseTag90052] = useState(true);

  const onDrop = (acceptedFiles) => {
    const temp = [];
    let completed = 0;
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        temp.push({ name: file.name, content: reader.result });
        completed++;
        if (completed === acceptedFiles.length) {
          setRawFiles((prev) => [...prev, ...temp]);
        }
      };
      reader.readAsText(file);
    });
  };

  const parseFIX = (line) => {
    const parts = line.split("|");
    const obj = {};
    for (const part of parts) {
      const [tag, value] = part.split("=");
      obj[tag] = value;
    }
    return { raw: line, tags: obj };
  };

  const processFixContent = (content) => {
    const lines = content.includes('|') ? content.split("\n") : content.replace(/\x01/g, "|").split("\n");
    const parsed = lines.filter(Boolean).map(parseFIX);

    let output;

    if (sortLogic === "Proper") {
      output = parsed.reverse();
    } else {
      const clusters = [];
      let currentCluster = [];
      const requestTypes = ["D", "G", "F", "J", "AK", "AU"];

      for (let i = 0; i < parsed.length; i++) {
        const msg = parsed[i];
        const type = msg.tags["35"];
        if (requestTypes.includes(type)) {
          if (currentCluster.length) clusters.push(currentCluster);
          currentCluster = [msg];
        } else {
          currentCluster.push(msg);
        }
      }
      if (currentCluster.length) clusters.push(currentCluster);

      if (useTag90052) {
        clusters.sort((a, b) => {
          const t1 = a[0].tags["90052"] || "";
          const t2 = b[0].tags["90052"] || "";
          return t1.localeCompare(t2);
        });
      } else {
        clusters.sort((a, b) => {
          const t1 = a[0].tags["52"] || "";
          const t2 = b[0].tags["52"] || "";
          return t1.localeCompare(t2);
        });
      }

      output = clusters.flatMap(cluster => cluster);
    }

    return output.map(({ raw }) => {
      const segments = raw.split("|").filter(s => {
        const tag = s.split("=")[0];
        return !disallowedTags.includes(tag);
      });
      return segments.join("|");
    }).join("\n");
  };

  const handleProcess = () => {
    setLoading(true);
    const output = rawFiles.map((file) => ({
      name: file.name,
      content: processFixContent(file.content),
    }));
    setProcessedFiles(output);
    setLoading(false);
  };

  const downloadAll = async () => {
    if (processedFiles.length === 1) {
      const blob = new Blob([processedFiles[0].content], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `processed_${processedFiles[0].name}`);
    } else {
      const zip = new JSZip();
      processedFiles.forEach((file) => {
        zip.file(`processed_${file.name}`, file.content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "processed_FIX_files.zip");
    }
  };

  const addDisallowedTag = () => {
    const trimmed = newDisallowedTag.trim();
    if (trimmed && !disallowedTags.includes(trimmed)) {
      setDisallowedTags([...disallowedTags, trimmed]);
    }
    setNewDisallowedTag("");
  };

  const removeDisallowedTag = (tagToRemove) => {
    setDisallowedTags(disallowedTags.filter(tag => tag !== tagToRemove));
  };

  const removeFile = (name) => {
    setRawFiles(rawFiles.filter(file => file.name !== name));
  };

  const resetAll = () => {
    setDisallowedTags([]);
    setProcessedFiles([]);
    setRawFiles([]);
    setNewDisallowedTag("");
    setSortLogic("Mixed");
    setUseTag90052(true);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".txt", ".fix"] },
    multiple: true,
  });

  return (
    <main className="app-container">
      <h1 className="text-3xl font-bold mb-6">Fixify - FIX Logs Processor 📄</h1>

      <div className="w-full max-w-md mb-4">
        <div className="mb-4">
          <label className="block font-semibold mb-1">Sort Logic:</label>
          <select
            value={sortLogic}
            onChange={(e) => setSortLogic(e.target.value)}
            className="w-full p-2 border rounded bg-white"
          >
            <option value="Mixed">Mixed</option>
            <option value="Proper">Proper (reverse order)</option>
          </select>
          <label className="inline-flex items-center mt-2">
            <input
              type="checkbox"
              checked={useTag90052}
              onChange={() => setUseTag90052(!useTag90052)}
              className="mr-2"
            />
            Use tag 90052 for sorting
          </label>
        </div>

        <div className="flex mb-2">
          <input
            type="text"
            placeholder="Exclude tag (e.g. 10)"
            value={newDisallowedTag}
            onChange={(e) => setNewDisallowedTag(e.target.value)}
            className="w-full p-2 border rounded mr-2 bg-white"
          />
          <button
            onClick={addDisallowedTag}
            className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 shadow-inner"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {disallowedTags.map((tag, index) => (
            <span key={index} className="bg-red-100 px-2 py-1 rounded flex items-center">
              {tag}
              <button
                onClick={() => removeDisallowedTag(tag)}
                className="ml-1 text-red-600 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <button
          onClick={resetAll}
          className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 mb-4"
        >
          Reset All
        </button>

        <div
          {...getRootProps()}
          className="border-dashed border-2 p-6 w-full rounded cursor-pointer bg-white text-center mb-4"
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the files here ...</p>
          ) : (
            <p>Drag and drop FIX .txt files here, or click to select</p>
          )}
        </div>

        {rawFiles.length > 0 && (
          <div className="mb-4">
            <h2 className="font-medium mb-2">Files Added:</h2>
            <ul>
              {rawFiles.map((file, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center border px-1.5 py-1 bg-white rounded mb-2 cursor-pointer hover:bg-gray-100"
                >
                  <span
                    className="flex-1 text-gray-600 hover:underline"
                    onClick={() => setPreviewFile(file)}
                  >
                    {file.name}
                  </span>
                  <button
                    className="text-white bg-red-500 text-sm p-1 rounded"
                    onClick={() => removeFile(file.name)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rawFiles.length > 0 && processedFiles.length === 0 && (
          <button
            onClick={handleProcess}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 flex rounded items-center gap-1 mb-4 shadow-inner"
          >
            Process
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        )}

        {processedFiles.length > 0 && (
          <button
            onClick={downloadAll}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 mb-4 shadow-inner"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Download
          </button>
        )}

        {loading && <p className="text-yellow-600">Processing files...</p>}
      </div>

      {previewFile && <FileModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </main>
  );
}