# Fixify

Fixify is a Next.js toolkit for working with FIX messages, logs, interview-style coding tasks, diagrams, XML, and encrypted team notes in one local workspace.

## Features

- Logs Processor: upload or paste FIX logs, parse messages, validate checksums/body length, filter results, and export processed output.
- Comparator: compare two FIX messages or two log files, including matched and unmatched transaction views.
- FIXi Interpreter: ask questions about FIX messages and get parser-aware responses.
- Flowchart: visualize FIX/order flows and inspect message/tag details.
- Tasks: manage work in a kanban-style board with task details, checklists, comments, and activity.
- Code Sandbox: run Python, C++, and Java FIX parsing templates with stdin/output panes and switchable 3-pane or 4-pane layouts.
- XML Formatter: format XML input into readable output.
- Team Chat: encrypted room chat with Socket.IO relay fallback and WebRTC direct peer detection.
- Whiteboard, About, Privacy, and Contact pages are also included.

## Tech Stack

- Next.js 15 with the App Router
- React 19
- Tailwind CSS 4
- Monaco Editor
- Socket.IO and WebRTC for team chat signaling/direct links
- React Flow, Dagre, JSZip, FileSaver, Dropzone, and Lucide icons

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

On Windows PowerShell, if `npm run ...` is blocked by script execution policy, use:

```bash
npm.cmd run dev
npm.cmd run lint
```

## App Routes

- `/` - Logs Processor
- `/compare` - FIX Comparator
- `/interpreter` - FIXi Interpreter
- `/flowchart` - Flowchart
- `/tasks` - Kanban Tasks
- `/coderunner` - Code Sandbox
- `/xml` - XML Formatter
- `/chat` - Team Chat
- `/draw` - Whiteboard
- `/about`, `/privacy`, `/contact` - informational pages

## Team Chat Note

The chat page starts a Socket.IO signaling/relay server through `/api/socket` on port `3001`. Multiple devices should join the same room ID and use the same secret key to decrypt shared messages. If WebRTC direct channels are not available, chat can still work through relay mode.

## Development Notes

- The project is local-first and browser-heavy; many tools process pasted/uploaded content directly in the UI.
- The Code Sandbox layout supports both 4-pane mode with question details and 3-pane mode for a wider editor. Collapsing the question/details panel switches to 3-pane mode to avoid an empty collapsed grid.
- Keep generated build output such as `.next/` and installed dependencies such as `node_modules/` out of commits.
