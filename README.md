# Fixify

Fixify is a high-performance, developer-first diagnostic suite and Next.js local workspace toolkit designed for trading integration engineers, support analysts, and FIX protocol developers.

## Advanced Platform Features

- **Logs Processor**: Upload or paste multi-line FIX sessions logs. Automatically parses fields, validates checksum integrity (tag 10) and body length (tag 9), highlights mismatches, filters by custom sequence tags, and filters order states with inline Order ID (tag 37) dropdown selector filters.
- **FIXi Interpreter**: Interactive chat assistant utilizing Web LLMs. Features automatic italic Markdown formatting (safely ignoring snake_case field highlights like `ORD_99`) and uses a custom theme-synchronized bot avatar styling that adapts to your primary dark/light accent colors.
- **Latency Hop Visualizer**: Measures absolute offset differences between `SendingTime` (tag 52) and `TransactTime` (tag 60) for network hops, and tracks RTT pairs. Features intelligent automatic logarithmic scaling to compress extreme peak spikes and keep baseline performance statistics perfectly readable.
- **XML Formatter**: Format and walk XML schemas. Relocates formatting engines (DOM Parser vs. Regex Walk) inside a modern responsive header pill toggle switcher.
- **Kanban Tasks Board**: Local-first task manager featuring priority badges, interactive subtask checklists, and custom task cards. Built with a full drag-and-drop overlay to resolve card clipping and features a sleek sliding right drawer editor on mobile viewports.
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
