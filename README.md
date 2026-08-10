# FIXify™ — Financial Protocol & Market Diagnostics Suite

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local--First-emerald.svg)]()
[![Telemetry](https://img.shields.io/badge/Telemetry-Zero-brightgreen.svg)]()
[![Build](https://img.shields.io/badge/Build-Passing-success.svg)]()

> **FIXify** is an enterprise-grade, local-first diagnostic suite and Next.js protocol workstation built for financial market integration engineers, FIX protocol developers, algorithmic traders, and support analysts.

---

## 🌟 Key Highlights

- **🔒 100% Client-Side Sandbox**: Zero cloud uploads. All raw logs, session keys, execution reports, and blotter CSVs are parsed locally inside volatile browser RAM.
- **🌍 Global Market Hours 3D Globe**: Real-time orthographic SVG 3D globe with solar terminator shading, Daylight Saving Time (DST) tracking, per-exchange holiday calendars, and countdown timers across 28 global exchanges.
- **⚡ Microsecond Latency Hop Tracking**: Hop-by-hop latency breakdown and transit duration calculation between `SendingTime` (Tag 52) and `TransactTime` (Tag 60) with p50/p95/p99 percentile SLA distributions.
- **🛡️ FIX Security & Compliance Auditor**: Automated vulnerability scanner for plaintext credential leaks (Tags 35=A, 554, 553), SOH delimiter injection, sequence reset replay attacks, and CompID hijacking.
- **📁 Multi-Hop Order Correlation Engine**: Correlate complex multi-leg order execution trees across Client Gateway ➔ OMS ➔ Exchange venue routes using `ClOrdID`, `OrigClOrdID`, `OrderID`, and `ExecID` chain links.

---

## 🧰 Integrated Toolsets

| Category | Tool / Feature | Description |
| :--- | :--- | :--- |
| **Market Intelligence** | **Global Market Hours** | 3D orthographic SVG globe & 24h timeline table for 28 exchanges with per-market holidays & DST calculations. |
| **Log Analysis** | **Log Comparator & Parser** | Side-by-side session log diffing with FQL query filtering, tag-by-tag inspection, and administrative message toggle. |
| **Diagnostics** | **Latency Hop Analyzer** | Microsecond timestamp offset tracking, p50/p95/p99 SLA percentile distributions, and SLA budget alerts. |
| **Reconciliation** | **Missing Fills Reconciliation** | Reconcile raw FIX Execution Reports against blotter CSV/Excel files with fuzzy matching and auto-delimiter detection. |
| **Tracking** | **Multi-Hop Order Correlation** | Trace orders across system hops (Gateway ➔ OMS ➔ Exchange) using ClOrdID, OrigClOrdID, OrderID, and ExecID links. |
| **Security** | **FIX Security Auditor** | Audit session logs for credential leaks, SOH injections, sequence replay threats, and sequence hijacking. |
| **Privacy** | **Log Sanitizer & Anonymizer** | Mask sensitive passwords, CompIDs, prices, and sizes while auto-recalculating BodyLength (Tag 9) & Checksum (Tag 10). |
| **Simulation** | **Interactive Payload Generator** | Compose valid wire payloads (Logon, New Order, Fill, Cancel) with real-time length calculation & checksum generation. |
| **Quantitative** | **Multi-Algo Technical Studio** | Backtest technical indicators (SMA, EMA, RSI, Bollinger, MACD) on historical market data and manage local trade ledgers. |
| **Dictionary** | **Custom Dialect Manager** | Upload QuickFIX XML dictionaries to inspect proprietary tags (5000-9999) integrated across all suite tools. |
| **Intelligence** | **FIXi AI Interpreter** | Interactive diagnostic agent powered by local offline AURA rules or Google Gemini 2.5 Flash for protocol error resolution. |
| **Developer** | **Code Sandbox Playground** | Execute C++, Python, and Java FIX parser code templates in a client-side Web Worker sandbox. |
| **Collaboration** | **Encrypted Desk Chat** | End-to-end encrypted team chat rooms with zero server logging and automatic FIX payload visualizer rendering. |
| **P2P Transfer** | **FixDrop Instant Transfer** | Staged cross-device P2P sharing for FIX logs, PDF, Word, Excel, Media (Video/Image), ZIP archives, and PCAPs over Wi-Fi & WebRTC with QR pairing, batch ZIP downloads, and dedicated Open/Save actions. |
| **Formatting** | **XML & Schemas Formatter** | Format, pretty-print, and sanitize XML dictionaries and FIXatdl files with instant SOH-to-pipe conversions. |
| **Monitoring** | **Live Session Stream Monitor** | Simulate live FIX session socket streaming with dynamic timelines, customizable latency spikes, and sequence gap alerts. |
| **Reference** | **FIX Tags Dictionary** | Interactive specification lookup across standard FIX versions (4.0, 4.1, 4.2, 4.3, 4.4, 5.0, FIXT 1.1) and custom dialects. |

---

## 🏛️ Architecture & Security Guarantees

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FIXify Client Environment                       │
│                                                                        │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────┐  │
│  │   UI Core Thread   │   │ Web Worker Parser  │   │ Local Storage  │  │
│  │  React 19 / Next   │◄──┤  Background Worker │◄──┤  Preferences   │  │
│  └─────────┬──────────┘   └────────────────────┘   └────────────────┘  │
│            │                                                           │
│            ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Volatile Browser Memory                      │  │
│  │  (Zero Server Uploads · Zero Tracking · Immediate Memory Wipe)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Zero Data Transmission**: All file uploads, log pastes, and CSV parsing happen 100% inside your local browser tab.
2. **Web Worker Concurrency**: Heavy log parsing and microsecond latency calculations run on isolated background Web Worker threads to keep the UI at 60 FPS.
3. **Themes & Preferences**: Support for 5 built-in themes (Dark Default, Light, Matrix, Midnight, Corporate) with persistent layout state.

---

## 📡 FixDrop Data Transfer Architecture

FixDrop is designed for zero-configuration, cross-device trading desk file and payload relay. It operates on concurrent communication channels to transfer raw logs, documents, media, and binary streams:

### Supported Data Streams & Encoding:
- **FIX Protocol Logs**: Strings parsed with `validateFIXMessage()` for Tag 35 identification and auto-masked for PII (Tags 1, 50, 57).
- **Documents & Spreadsheets**: PDFs (`.pdf`), Word (`.docx`), Excel (`.xlsx`), and CSV blottings with exact extension badges and 1-click **Save to Downloads**.
- **Media & Videos**: Video files (`.mp4`, `.mov`, `.webm`, `.mkv`) and images (`.png`, `.jpg`, `.svg`) with in-browser preview tab playback/viewing (`getFileMimeType`).
- **ZIP Archives & Batch Packaging**: ZIP/RAR/7Z archives + batch compilation of selected payloads (including WebRTC P2P Blobs) into `FixDrop_Batch_PIN.zip`.
- **Binary PCAP Captures**: Network packet captures (`.pcap`) and FAST/SBE binary logs encoded via Base64 or 64KB zero-copy P2P WebRTC data channels.

### Transfer Transport & Controls:
1. **Local Subnet & `BroadcastChannel` (Zero Latency)**: Connected tabs on the same subnet communicate instantly via native BroadcastChannel API events.
2. **Next.js API Relay (`/api/fixdrop`)**: Direct room-based synchronization relaying payloads in server memory keyed by 4-digit room PIN.
3. **Camera QR Pairing**: Encodes vector QR matrix to instantly pair mobile phone camera optics (`?pin=XXXX`).
4. **Room PIN & Stream Sync Controls**: Dedicated `generateNewPin()` action beside `Room: #XXXX` + state-preserving `refreshActiveStream()` to fetch new room files on demand.

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/utkarsh-1912/Fixify.git
   cd Fixify
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 💻 Available Scripts

- `npm run dev` — Starts local development server with Turbopack / HMR.
- `npm run build` — Compiles and builds production optimized package (verifies TypeScript & routes).
- `npm run start` — Starts static production server.
- `npm run lint` — Runs ESLint and checks code formatting rules.
- `node tests/run-all-tests.mjs` — Runs automated unit and integration tests.

---

## 🧪 Automated Testing & Continuous Integration (CI)

FIXify is equipped with a dual-stage automated validation harness designed for high-integrity protocol verification:

### 1. **Automated Test Runner (`tests/run-all-tests.mjs`)**
Run the full test suite locally by invoking:
```bash
node tests/run-all-tests.mjs
```
- **Unit Verification**: Tests core regex extraction, SOH/pipe delimiter detection, and payload segmentation.
- **Integration Validation**: Automatically launches a lightweight in-memory FixDrop test server if `localhost:3000` is offline to test endpoint diagnostics (GET polling, POST data transfer, WebRTC signaling, target routing, and DELETE cleanup) with 100% automated coverage.

### 2. **GitHub Actions CI Workflow Pipeline (`.github/workflows/ci.yml`)**
The integration pipeline automatically triggers on all pushes and pull requests to `main` and `master`:
- Boots up a Node 18 build environment.
- Installs cached dependencies (`npm ci`).
- Executes production-level Next.js route compilation (`npm run build`).
- Starts a background dev server instance and runs the entire automated test suite to ensure zero regressions before merging.

---

## 📁 Workspace Layout

```
Fixify/
├── src/
│   ├── app/                    # Next.js App Router Page Routes
│   │   ├── market-hours/       # Global Market Hours 3D Globe & Timeline Table
│   │   ├── interpreter/        # FIXi AI Protocol Interpreter & Chat
│   │   ├── latency/            # Microsecond Latency Hop Visualizer
│   │   ├── compare/            # Side-by-Side FIX Log Comparator
│   │   ├── missing-fills/      # ExecReport vs Blotter Reconciliation
│   │   ├── correlation/        # Multi-Hop Order Chain Tracking
│   │   ├── security-auditor/   # Credential & Sequence Security Scanner
│   │   ├── log-sanitizer/      # PII & Price Scrubbing Engine
│   │   ├── payload-generator/  # FIX Wire Payload Composer
│   │   ├── multi-algo/         # Technical Indicator Studio & Backtester
│   │   ├── custom-dialect/     # QuickFIX XML Dialect Manager
│   │   ├── fixtags/            # Specification Tag Reference
│   │   ├── binary-decoder/     # FAST & ITCH Binary Packet Decoder
│   │   ├── atdl/               # FIXatdl Algorithmic Schema Builder
│   │   ├── live-streaming/     # Socket Stream Simulation Sandbox
│   │   ├── coderunner/         # Client-Side Code Execution Sandbox
│   │   ├── flowchart/          # FIX Message State Diagram Generator
│   │   ├── xml/                # XML Formatter & Schema Validator
│   │   ├── chat/               # End-to-End Encrypted Team Desk Chat
│   │   ├── tasks/              # Kanban Milestone Management Board
│   │   ├── draw/               # Architecture Whiteboard Canvas
│   │   └── about/              # Platform Capabilities Overview
│   ├── components/             # Reusable UI Components (Navbar, Drawers, SoxVisualizer)
│   └── lib/                    # Core FIX Parsers, Calculators & Dialect Engines
├── public/                     # Static Assets & Icons
└── package.json                # Project Dependencies & Scripts
```

---

## 🤝 Contributing

Contributions are welcome! If you'd like to report a bug or request a feature:
1. Open an issue on [GitHub Issues](https://github.com/utkarsh-1912/Fixify/issues).
2. Fork the repository and create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to your branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **GPL-3.0 License**. See `LICENSE` for details.

Developed with ❤️ for the global engineering community.
