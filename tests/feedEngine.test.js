import { describe, it, expect } from 'vitest';
import {
  createFeedGenerator, SequenceTracker, computeLatencyMs, LatencyStats, compileAlertPattern, evaluateAlerts,
  splitFixMessages, parseWsUrl, mulberry32, PROFILES,
} from '@/lib/feedEngine';
import { validateFIXMessage } from '@/lib/fixParser';

const CLOCK = () => Date.UTC(2026, 6, 16, 12, 0, 0, 123);

describe('createFeedGenerator', () => {
  it.each(Object.keys(PROFILES))('%s: every message is valid FIX and runs are reproducible', (profile) => {
    const run = () => {
      const g = createFeedGenerator({ profile, seed: 42, now: CLOCK });
      return Array.from({ length: 60 }, () => g.next());
    };
    const a = run();
    expect(a.map((m) => m.raw)).toEqual(run().map((m) => m.raw));
    a.forEach((m) => expect(validateFIXMessage(m.raw).errors, m.raw).toEqual([]));
  });

  it('different seeds give different feeds; unknown profile throws', () => {
    const raws = (seed) => { const g = createFeedGenerator({ seed, now: CLOCK }); return Array.from({ length: 20 }, () => g.next().raw).join(); };
    expect(raws(1)).not.toBe(raws(2));
    expect(() => createFeedGenerator({ profile: 'nope' })).toThrow(/Unknown/);
  });

  it('the tracker flags exactly the gaps the generator injected, with no false positives', () => {
    const g = createFeedGenerator({ profile: 'order-gateway', seed: 7, now: CLOCK, gapEvery: 12 });
    const tracker = new SequenceTracker();
    let injected = 0;
    let detected = 0;
    for (let i = 0; i < 120; i++) {
      const m = g.next();
      const { tags } = validateFIXMessage(m.raw);
      const r = tracker.observe(tags['49'], tags);
      if (m.gapInjected) { injected++; expect(r.status).toBe('gap'); expect(r.missing).toBe(3); }
      else expect(r.status).toBe('ok');
      if (r.status === 'gap') detected++;
    }
    expect(injected).toBeGreaterThan(5);
    expect(detected).toBe(injected);
  });
});

describe('SequenceTracker', () => {
  const t = (seq, extra = {}) => ({ 34: String(seq), 35: 'D', ...extra });
  it('tracks senders independently', () => {
    const s = new SequenceTracker();
    expect(s.observe('A', t(5)).status).toBe('ok');
    expect(s.observe('B', t(1)).status).toBe('ok');
    expect(s.observe('A', t(6)).status).toBe('ok');
  });
  it('distinguishes duplicates (PossDup) from protocol errors, and gaps from resets', () => {
    const s = new SequenceTracker();
    s.observe('A', t(1)); s.observe('A', t(2));
    expect(s.observe('A', t(2, { 43: 'Y' })).status).toBe('duplicate');
    expect(s.observe('A', t(1))).toMatchObject({ status: 'too_low', expected: 3 });
    expect(s.observe('A', t(10))).toMatchObject({ status: 'gap', missing: 7 });
    expect(s.observe('A', { 34: '11', 35: 'A', 141: 'Y' }).status).toBe('reset');
    expect(s.observe('A', t(12)).status).toBe('ok');
    expect(s.observe('A', { 34: '12', 35: '4', 36: '20', 123: 'Y' }).status).toBe('reset');
    expect(s.observe('A', t(20)).status).toBe('ok');
  });
  it('ignores messages without a sequence number', () => {
    expect(new SequenceTracker().observe('A', { 35: '0' }).status).toBe('ok');
  });
});

describe('latency', () => {
  it('computes against the full SendingTime date (no midnight wrap) and rejects bad values', () => {
    const now = Date.UTC(2026, 6, 16, 0, 0, 0, 100);
    expect(computeLatencyMs('20260715-23:59:59.950', now)).toBe(150);
    expect(computeLatencyMs('20260716-00:00:00.200', now)).toBeNull();
    expect(computeLatencyMs('20260716-00:00:00.200', now, { skewToleranceMs: 500 })).toBe(0);
    expect(computeLatencyMs('garbage', now)).toBeNull();
    expect(computeLatencyMs('20250101-00:00:00', now)).toBeNull();
  });
  it('reports percentiles over a bounded window', () => {
    const s = new LatencyStats(100);
    for (let i = 1; i <= 100; i++) s.add(i);
    expect(s.snapshot()).toMatchObject({ count: 100, avg: 50.5, max: 100, p50: 50, p95: 95, p99: 99 });
    for (let i = 0; i < 100; i++) s.add(1000);
    expect(s.snapshot().p50).toBe(1000);
    expect(new LatencyStats().snapshot()).toMatchObject({ count: 0, avg: 0, p99: 0 });
  });
});

describe('alert rules', () => {
  it('compiles patterns safely', () => {
    expect(compileAlertPattern('35=8|35=3').rx.test('x|35=3|')).toBe(true);
    expect(compileAlertPattern('(').error).toMatch(/Invalid regex/);
    expect(compileAlertPattern('a'.repeat(201)).error).toMatch(/longer/);
    expect(compileAlertPattern('  ')).toEqual({ rx: null, error: null });
  });
  it('combines latency, regex and sequence reasons', () => {
    const { rx } = compileAlertPattern('35=8');
    const reasons = evaluateAlerts({ raw: '35=8', latency: 50, seqStatus: { status: 'gap', expected: 4, missing: 2 } }, { latencyThresholdMs: 20, rx });
    expect(reasons).toHaveLength(3);
    expect(evaluateAlerts({ raw: 'x', latency: 5 }, { latencyThresholdMs: 20 })).toEqual([]);
    expect(evaluateAlerts({ raw: 'x', latency: 500 }, { latencyThresholdMs: NaN })).toEqual([]);
  });
});

describe('transport helpers', () => {
  it('splits multi-message websocket frames', () => {
    const a = '8=FIX.4.4|9=5|35=0|10=100|';
    const b = '8=FIX.4.4|9=5|35=0|10=101|';
    expect(splitFixMessages(`${a}\n${b}`)).toEqual([a, b]);
    expect(splitFixMessages(a + b)).toEqual([a, b]);
    expect(splitFixMessages('')).toEqual([]);
  });
  it('validates websocket URLs', () => {
    expect(parseWsUrl('ws://localhost:8080').url).toBe('ws://localhost:8080/');
    expect(parseWsUrl('http://x').error).toMatch(/ws:\/\//);
    expect(parseWsUrl('nonsense').error).toBeTruthy();
    expect(parseWsUrl('ws://example.com', { pageProtocol: 'https:' }).error).toMatch(/wss/);
    expect(parseWsUrl('wss://example.com', { pageProtocol: 'https:' }).url).toBeTruthy();
  });
  it('prng is uniform enough and seedable', () => {
    const r = mulberry32(5);
    const xs = Array.from({ length: 1000 }, r);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(xs.reduce((a, b) => a + b, 0) / 1000).toBeGreaterThan(0.45);
  });
});
