"use client";
import { useState } from "react";
import Editor from "@monaco-editor/react";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

const templates = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main(){ 
  ios::sync_with_stdio(false); 
  cin.tie(NULL); 
  cout << "Hello from C++\\n"; 
  return 0; 
}`,
  java: `public class Main { 
  public static void main(String[] args){ 
    System.out.println("Hello from Java"); 
  } 
}`,
  python: `print("Hello from Python")`,
};

export default function CodeRunnerPage() {
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(templates["python"]);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);

  const run = async () => {
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("coderunner/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, source: code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");
      if (!res.ok) throw new Error(data.error || "Execution failed");
      const outputText = [
        data.stdout ? data.stdout : "",
        data.stderr ? `Error:\n${data.stderr}` : "",
        data.compile_output ? `${data.compile_output}` : "",
      ]
      .filter(Boolean)
      .join("\n\n");

    setOutput(outputText || "");
    setStatusInfo({
      status: data.status?.description || "Unknown",
      time: data.time || "-",
      memory: data.memory || "-",
    });

    } catch (err) {
      setOutput(String(err));
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

  return (
    <main className="p-4 md:pt-6">

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Language:</label>
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              setCode(templates[e.target.value]);
              setOutput("");
            }}
            className="border px-2 py-1 rounded"
          >
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={running}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1 rounded shadow"
          >
            {running ? "Running..." : "Run"}
          </button>
          <button
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded shadow"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Code Editor */}
        <div className="flex flex-col relative">
          <label className="font-semibold mb-2 px-1">💻 Code Editor</label>
          <Editor
            height="70vh"
            language={lang === "cpp" ? "cpp" : lang}
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-system"
            options={{ fontSize: 14, minimap: { enabled: false } }}
          />
        </div>

        {/* Output Section */}
        <div className="flex flex-col relative">
          <label className="font-semibold mb-2 px-1">🧾 Program Output</label>
          {/* Output Section */}
  <div className="relative border border-gray-200 rounded bg-gray-50 shadow-inner text-sm font-mono p-3 h-[40vh] overflow-auto whitespace-pre-wrap">
    {output ? output : <span className="text-gray-400">No output</span>}
  </div>

  {/* Status/Time/Memory Row */}
  {statusInfo && (
    <div className="flex justify-between items-center mt-2 text-sm p-1 bg-gray-50 p-2 rounded border border-gray-200">
      <div  className={`font-medium ${statusInfo.status?.toLowerCase().includes("accepted")? "text-green-600": statusInfo.status?.toLowerCase().includes("error") ||  statusInfo.status?.toLowerCase().includes("failed")? "text-red-600": "text-gray-700" }`}>
         {statusInfo.status}
      </div>

      {statusInfo.status==="Accepted" && statusInfo.time && statusInfo.memory && (
        <div className="text-gray-500 text-xs flex gap-4">
          <span>Time: {statusInfo.time}s</span>
          <span>Memory: {statusInfo.memory} KB</span>
        </div>
      )}
    </div>
  )}

          <label className="font-semibold mb-2 mt-2 px-1">📥 Stdin</label>
          <textarea
            className="w-full h-28 p-3 border border-gray-200 rounded shadow-sm text-sm font-mono"
            placeholder="Optional input for the program"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
          />
          {output && (
            <button
              onClick={handleCopy}
              className="absolute top-[-30] right-0 mt-8 mr-2 bg-white border rounded p-1 hover:bg-gray-100"
              title="Copy to clipboard"
            >
              {copied ? (
                <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
