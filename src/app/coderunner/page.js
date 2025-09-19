'use client'
import React, { useState } from 'react';

const templates = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){ ios::sync_with_stdio(false); cin.tie(NULL); cout << "Hello from C++\\n"; return 0; }`,
  java: `public class Main { public static void main(String[] args){ System.out.println("Hello from Java"); } }`,
  python: `print("Hello from Python")`,
};

export default function CodeRunnerPage() {
  const [lang, setLang] = useState('python');
  const [code, setCode] = useState(templates['python']);
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setOutput('');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, source: code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');
      setOutput(data);
    } catch (err) {
      setOutput({ status: 'ERROR', stderr: String(err) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CodeRunner</h2>
        <div className="flex space-x-2">
          <select value={lang} onChange={(e) => { setLang(e.target.value); setCode(templates[e.target.value]); }} className="border px-2 py-1 rounded">
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
          <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={run} disabled={running}>
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <textarea value={code} onChange={(e) => setCode(e.target.value)} className="w-full h-[40vh] p-3 border rounded" />
        <div>
          <label className="block text-sm text-gray-600">Stdin</label>
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} className="w-full h-28 p-2 border rounded" />
          <label className="block mt-2 text-sm text-gray-600">Output</label>
          <pre className="w-full h-40 p-3 bg-gray-50 border rounded overflow-auto">{JSON.stringify(output, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
