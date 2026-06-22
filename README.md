# Fixify

Fixify is a high-performance, developer-first diagnostic suite and Next.js local workspace toolkit designed for trading integration engineers, support analysts, and FIX protocol developers.

## Advanced Platform Features

- **Logs Processor & Comparator**: Paste multi-message FIX session logs. Compare logs side-by-side using *Hide Administrative* and *Show Differences Only* checkboxes. Audits sequence gaps, Logon establishment order, and duplicates (tag 34). Features an interactive side-drawer inspector with a visual SOH character detector.
- **Missing Fills Analyzer**: Compare raw FIX execution reports against blotter databases (CSV/TSV/Excel) to instantly isolate missing fills. Supports substring ExecID matching, fuzzy timestamp matching, customizable fill criteria, bidirectional session filters, and dynamic CSV downloads.
- **FIX Security & Compliance Auditor**: Audit logs for plaintext credentials leakage (passwords/signatures), sequence number replay threats, delimiters/SOH injection attacks, and sequence hijacking. Features an interactive compliance score gauge, grading details tooltip, and remediation config builder.
- **Log Sanitizer & Anonymizer**: Scrub credentials, CompIDs, prices, and sizes from raw FIX logs before transmission. Automatically recalculates BodyLength (Tag 9) and Checksum (Tag 10) dynamically to maintain valid log structures.
- **Interactive Payload Generator**: Construct valid FIX messages via form schemas supporting Logon, Heartbeat, Execution Reports, and Cancel/Rejects. Performs real-time checksum/length audits and outputs in SOH Visual, Pipe (|), Hex, or JSON.
- **Multi-Algo Technical Trade Studio**: Search symbols using yahoo-finance data proxying, select technical indicator signals (SMA, EMA, RSI, Bollinger Bands, MACD), backtest strategies on historical P&L, overlay Entry/SL/TP levels on SVG timelines, and track open trades in a local ledger.
- **QuickFIX XML Dialect Manager**: Upload custom dialect schemas to parse and explore custom fields and tag dictionaries. Plugs directly into the timeline, generator, and AI chat.
- **SOH Character Detector & Previews**: Integrates `SohVisualizer` globally (Drawers, Modals, Chat history) to separate tags and highlight headers. Renders real-time visual previews under all paste textareas across the suite, supporting caret-A (`^A`) notation.
- **FIXi Interpreter**: Interactive chat diagnostics utilizing local offline **AURA** intelligence or Google Gemini 2.5 Flash. Features animated gradient text effects on keyword mentions, multi-line submissions, batch tag lookup cards, and styled details drawers.
- **Latency Hop Visualizer**: Measures offset differences between `SendingTime` (tag 52) and `TransactTime` (tag 60). Features percentile outlier filters (99th/95th/90th bounds), background worker parsing, and responsive viewport tooltip clamping.
- **XML Formatter**: Format schemas using DOM Parser or Regex engines. Jump to nodes using match chevrons, and speed up work with global developer hotkeys (`Ctrl+F`, `Escape`, `F3`, `Ctrl+S`, `Ctrl+Enter`).
- **Kanban Tasks Board**: Local-first Kanban board featuring priorities, subtasks, blockers, comments, timelines, and slide-out side drawers.
- **Code Sandbox**: Execute Python, C++, and Java FIX parser templates with custom inputs/outputs.
- **Interactive Flowcharts**: Auto-generate state flow diagrams from parsed FIX messages to inspect sequences and tags.
- **Secure Room Chat**: End-to-end encrypted local chat using AES browser encryption, Socket.IO rooms, and WebRTC peer signaling. Pinned and chat messages containing FIX payloads are automatically visualised.
- **FIX Tags Dictionary**: Search and browse complete tag references across standard FIX versions (4.0, 4.2, 4.4, 5.0, FIXT 1.1) and custom uploaded dialects with pagination support.
- **Interactive Whiteboard**: Sketch topologies, workflows, and session sequences on an in-browser whiteboard featuring undo/redo, text tools, and custom color presets.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Core**: React 19, Vanilla CSS Custom Variables, and Lucide icons
- **State & Layout**: Drag-and-drop via `@dnd-kit`, React Flow, Dagre
- **Editor & Formatting**: Monaco Editor, DOM parsers, custom regex walkthroughs
- **Signaling & P2P**: Socket.IO, WebRTC peer channels

## Getting Started

Install packages:

```bash
npm install
```

Run the development server locally:

```bash
npm run dev
```

Open `http://localhost:3000` in your web browser.

## Available Scripts

- `npm run dev` / `npm.cmd run dev` (PowerShell fallback) - Run dev server
- `npm run build` - Compile production package
- `npm run start` - Run static compiled server
- `npm run lint` - Validate styling and code rules
