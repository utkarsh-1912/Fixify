// Engine behind the Live Session Stream Monitor: deterministic simulated
// feed, FIX sequence tracking, latency statistics and alert rules.

import { buildFixMessage, fixTimestamp, parseFixTimestamp, SOH } from './fixWire';

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PROFILES = {
  'order-gateway': { sender: 'LIVE_CLIENT', target: 'TEST_GATEWAY', latency: [5, 12] },
  'market-data': { sender: 'MD_FEED', target: 'LIVE_CLIENT', latency: [1, 4] },
  'drop-copy': { sender: 'DROP_COPY', target: 'LIVE_CLIENT', latency: [20, 39] },
};

const DEFAULT_GAP_EVERY = 12;

/**
 * Creates a generator of valid FIX messages (correct BodyLength + CheckSum).
 * `next()` returns { raw, msgType, msgName, latency, state, gapInjected }.
 * Two generators with the same seed and clock produce identical output.
 */
export function createFeedGenerator({ profile = 'order-gateway', seed = 1, now = () => Date.now(), gapEvery = DEFAULT_GAP_EVERY } = {}) {
  const cfg = PROFILES[profile];
  if (!cfg) throw new Error(`Unknown feed profile "${profile}".`);
  const rand = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const px = (base, spread) => (base + rand() * spread).toFixed(2);
  let step = 0;
  const seqs = {}; // MsgSeqNum counter per sending CompID
  const take = (who) => { seqs[who] = (seqs[who] || 0) + 1; return seqs[who]; };
  let n = 0;

  const make = (fields, seqNum, from = cfg.sender, to = cfg.target) =>
    buildFixMessage([
      { tag: '35', val: fields[0] },
      { tag: '49', val: from },
      { tag: '56', val: to },
      { tag: '34', val: seqNum },
      { tag: '52', val: fixTimestamp(new Date(now())) },
      ...fields.slice(1).map(([tag, val]) => ({ tag, val })),
    ]).message.split(SOH).join('|');

  return {
    next() {
      step += 1;
      n += 1;
      const [lo, hi] = cfg.latency;
      let latency = int(lo, hi);

      if (step === 1) {
        const raw = make(['A', ['98', '0'], ['108', '30']], take(cfg.sender));
        return { raw, msgType: 'A', msgName: 'Logon Initiated', latency, state: 'LOGON_SENT', gapInjected: false };
      }
      if (step === 2) {
        // Acceptor's reply is its own sequence stream, starting at 1.
        const raw = make(['A', ['98', '0'], ['108', '30']], take(cfg.target), cfg.target, cfg.sender);
        return { raw, msgType: 'A', msgName: 'Logon Established (Acceptor Reply)', latency, state: 'ESTABLISHED', gapInjected: false };
      }

      const roll = rand();
      let fields;
      let msgType;
      let msgName;
      if (profile === 'market-data') {
        if (roll < 0.25) {
          [msgType, msgName, fields] = ['0', 'Heartbeat', ['0']];
        } else {
          const bid = px(180, 10);
          [msgType, msgName] = ['X', 'Market Data Incremental Refresh'];
          fields = ['X', ['262', 'MD_REQ_1'], ['268', '2'], ['269', '0'], ['270', bid], ['271', '100'], ['269', '1'], ['270', (parseFloat(bid) + 0.05).toFixed(2)], ['271', '150']];
        }
      } else if (profile === 'drop-copy') {
        if (roll < 0.2) {
          [msgType, msgName, fields] = ['0', 'Heartbeat', ['0']];
        } else {
          latency += int(0, 15);
          [msgType, msgName] = ['8', 'Execution Report (Drop Copy Allocation)'];
          fields = ['8', ['37', `DC_${n}`], ['17', `E_${n}`], ['150', 'F'], ['39', '2'], ['55', 'MSFT'], ['38', '200'], ['32', '200'], ['31', px(120, 15)]];
        }
      } else if (roll < 0.35) {
        [msgType, msgName, fields] = ['0', 'Heartbeat', ['0']];
      } else if (roll < 0.7) {
        [msgType, msgName] = ['D', 'New Order Single'];
        fields = ['D', ['11', `CL_${n}`], ['55', 'AAPL'], ['54', '1'], ['38', pick([100, 200, 500, 1000])], ['44', px(150, 30)], ['40', '2']];
      } else {
        latency += int(5, 14);
        [msgType, msgName] = ['8', 'Execution Report (Trade Fill)'];
        fields = ['8', ['37', `O_${n}`], ['17', `E_${n}`], ['150', 'F'], ['39', '2'], ['55', 'AAPL'], ['38', '100'], ['32', '100'], ['31', px(150, 30)]];
      }
      // Execution reports come from the gateway (acceptor); everything else from the profile's sender.
      const from = profile === 'order-gateway' && msgType === '8' ? cfg.target : cfg.sender;
      const to = from === cfg.sender ? cfg.target : cfg.sender;
      let gapInjected = false;
      if (gapEvery > 0 && step > 4 && step % gapEvery === 0) {
        seqs[from] = (seqs[from] || 0) + 3; // simulate three dropped messages
        gapInjected = true;
      }
      const raw = make(fields, take(from), from, to);
      return { raw, msgType, msgName, latency, state: 'ESTABLISHED', gapInjected };
    },
  };
}

/**
 * Tracks MsgSeqNum per sending CompID (each direction of a FIX session has its
 * own sequence). `observe` returns { status, expected, missing }, where status is one of
 * 'ok' | 'gap' | 'duplicate' | 'too_low' | 'reset'.
 */
export class SequenceTracker {
  constructor() {
    this.expected = new Map();
  }

  reset() {
    this.expected.clear();
  }

  observe(sender, tags) {
    const seq = parseInt(tags['34'], 10);
    const key = sender || '?';
    const msgType = tags['35'];
    if (!Number.isFinite(seq)) return { status: 'ok', expected: this.expected.get(key) ?? null, missing: 0 };

    // Logon with ResetSeqNumFlag=Y restarts the stream.
    if (msgType === 'A' && tags['141'] === 'Y') {
      this.expected.set(key, seq + 1);
      return { status: 'reset', expected: seq, missing: 0 };
    }
    // SequenceReset: NewSeqNo (36) tells us where the stream resumes (GapFill or Reset).
    if (msgType === '4') {
      const next = parseInt(tags['36'], 10);
      if (Number.isFinite(next)) this.expected.set(key, next);
      return { status: 'reset', expected: seq, missing: 0 };
    }

    const exp = this.expected.get(key);
    const possDup = tags['43'] === 'Y';
    if (exp === undefined) {
      this.expected.set(key, seq + 1);
      return { status: 'ok', expected: seq, missing: 0 };
    }
    if (seq === exp) {
      this.expected.set(key, seq + 1);
      return { status: 'ok', expected: exp, missing: 0 };
    }
    if (seq > exp) {
      this.expected.set(key, seq + 1);
      return { status: 'gap', expected: exp, missing: seq - exp };
    }
    // seq < exp: a legitimate replay when PossDupFlag=Y, otherwise a protocol error.
    return { status: possDup ? 'duplicate' : 'too_low', expected: exp, missing: 0 };
  }
}

/** Latency of a message in ms from its SendingTime, or null if unusable (negative beyond skew tolerance, absurdly old). */
export function computeLatencyMs(sendingTime, nowMs, { skewToleranceMs = 0, maxMs = 3_600_000 } = {}) {
  const sent = parseFixTimestamp(sendingTime);
  if (sent === null) return null;
  const diff = nowMs - sent;
  if (diff < -skewToleranceMs || diff > maxMs) return null;
  return Math.max(0, diff);
}

/** Incremental latency statistics over a bounded window (default last 1000 samples). */
export class LatencyStats {
  constructor(window = 1000) {
    this.window = window;
    this.samples = [];
    this.count = 0;
    this.sum = 0;
    this.max = 0;
  }

  add(ms) {
    this.count += 1;
    this.sum += ms;
    this.max = Math.max(this.max, ms);
    this.samples.push(ms);
    if (this.samples.length > this.window) this.samples.shift();
  }

  percentile(p) {
    if (!this.samples.length) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  }

  snapshot() {
    return {
      count: this.count,
      avg: this.count ? parseFloat((this.sum / this.count).toFixed(2)) : 0,
      max: this.max,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
    };
  }
}

export const MAX_ALERT_PATTERN = 200;

/** Compiles the user's alert regex; never throws. */
export function compileAlertPattern(pattern) {
  if (!pattern || !pattern.trim()) return { rx: null, error: null };
  if (pattern.length > MAX_ALERT_PATTERN) return { rx: null, error: `Pattern is longer than ${MAX_ALERT_PATTERN} characters.` };
  try {
    return { rx: new RegExp(pattern, 'i'), error: null };
  } catch (e) {
    return { rx: null, error: `Invalid regex: ${e.message}` };
  }
}

/** Evaluates alert rules for one message; returns a list of human readable reasons. */
export function evaluateAlerts({ raw, latency, seqStatus }, { latencyThresholdMs = null, rx = null } = {}) {
  const reasons = [];
  if (latencyThresholdMs !== null && Number.isFinite(latencyThresholdMs) && latency > latencyThresholdMs) {
    reasons.push(`Latency ${latency}ms exceeded threshold of ${latencyThresholdMs}ms`);
  }
  if (rx && rx.test(raw)) reasons.push(`Message matched regex "${rx.source}"`);
  if (seqStatus?.status === 'gap') reasons.push(`Sequence gap: expected ${seqStatus.expected}, ${seqStatus.missing} message(s) missing`);
  if (seqStatus?.status === 'too_low') reasons.push(`MsgSeqNum too low (expected ${seqStatus.expected}) without PossDupFlag`);
  return reasons;
}

/** Splits a WebSocket payload that may carry several FIX messages (newline separated or back-to-back). */
export function splitFixMessages(data) {
  const text = typeof data === 'string' ? data : String(data ?? '');
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[\x01|]10=\d{3}[\x01|])(?=8=FIX)/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validates the WebSocket URL typed by the user; returns { url } or { error }. */
export function parseWsUrl(input, { pageProtocol = 'http:' } = {}) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return { error: 'Enter a valid ws:// or wss:// URL.' };
  }
  if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return { error: 'Only ws:// and wss:// URLs are supported.' };
  if (pageProtocol === 'https:' && u.protocol === 'ws:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) {
    return { error: 'This page is served over HTTPS; browsers block insecure ws:// to remote hosts. Use wss://.' };
  }
  return { url: u.toString() };
}
