# Fixify

Fixify is a high-performance, developer-first diagnostic suite and Next.js local workspace toolkit designed for trading integration engineers, support analysts, and FIX protocol developers.

## Advanced Platform Features

- **Logs Processor & Comparator**: Paste multi-message FIX session logs. Compare logs side-by-side using *Hide Administrative* and *Show Differences Only* checkboxes. Audits sequence gaps, Logon establishment order, and duplicates (tag 34) exactly once per duplicate sequence number.
- **FIXi Interpreter**: Interactive chat diagnostics utilising local offline **AURA** intelligence or Google Gemini 1.5 Flash. Features multi-line input textarea queries (Enter to send, Shift+Enter for newline), batch tag lookup cards, reject code parsing, and automatic checksum recalculations. Includes a styled model details modal.
- **Latency Hop Visualizer**: Measures absolute offset differences between `SendingTime` (tag 52) and `TransactTime` (tag 60) for network hops, and tracks RTT pairs. Offloads log calculations to a background **Web Worker thread** to prevent UI freezing, and exports spreadsheets via **Export CSV**.
- **XML Formatter**: Format XML schemas using DOM Parser or Regex engines. Jump to nodes using match counters/chevrons, and speed up work with global developer hotkeys (`Ctrl+F` focus, `Escape` clear, `F3`/`Shift+F3` navigations, `Ctrl+S` download, `Ctrl+Enter` format, `Ctrl+Shift+M` minify).
- **Kanban Tasks Board**: Local-first task manager featuring priority badges, subtask checklists, comments feed, and activity timeline. Styled with neon glassmorphic cockpit columns, blocker task dependency warnings, and a right slide-out panel drawer (full width on mobile screens).
- **Code Sandbox**: Switchable 3-pane/4-pane editor workspace to execute Python, C++, and Java FIX parser templates with inputs/outputs.
- **Interactive Flowcharts**: Auto-generate state flow diagrams from parsed FIX messages to inspect sequences and tags.
- **Secure Room Chat**: Decrypted local team chat fallback with Socket.IO room relays and WebRTC direct peer detection.

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
