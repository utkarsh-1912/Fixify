import { describe, it, expect } from 'vitest';
import { calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands, analyzeTickerSignals, backtestStrategy } from '@/lib/indicators';
import {
  parseFixExecutionReport, mergeExecutions, calculatePortfolioPositions, generateFixNewOrderSingle,
  previewFixNewOrderSingle, runParameterSweep,
} from '@/lib/portfolioEngine';
import { validateFIXMessage } from '@/lib/fixParser';
import { buildFixMessage } from '@/lib/fixWire';
import { mulberry32 } from '@/lib/feedEngine';

const candles = (closes, spread = 0.5) =>
  closes.map((c, i) => ({ date: `d${i}`, close: c, high: c + spread, low: c - spread }));

// Deterministic random walk with drift changes so strategies actually trade.
const walk = (n, seed = 3) => {
  const r = mulberry32(seed);
  let p = 100;
  return candles(Array.from({ length: n }, (_, i) => (p += Math.sin(i / 9) * 1.2 + (r() - 0.5) * 2)));
};

describe('indicators', () => {
  it('SMA / EMA match hand-computed values', () => {
    const d = candles([1, 2, 3, 4, 5]);
    expect(calculateSMA(d, 3)).toEqual([null, null, 2, 3, 4]);
    // EMA(3): seed = SMA(1,2,3)=2; k=0.5 -> 3, 4
    expect(calculateEMA(d, 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('RSI saturates at 100 on a pure up-trend and 50 on a flat series (regression: was ~99)', () => {
    const up = calculateRSI(candles(Array.from({ length: 30 }, (_, i) => 100 + i)), 14);
    expect(up.at(-1)).toBe(100);
    const flat = calculateRSI(candles(Array(30).fill(10)), 14);
    expect(flat.at(-1)).toBe(50);
    const down = calculateRSI(candles(Array.from({ length: 30 }, (_, i) => 100 - i)), 14);
    expect(down.at(-1)).toBe(0);
  });

  it('Bollinger bands bracket the mean symmetrically', () => {
    const b = calculateBollingerBands(candles([1, 2, 3, 4, 5, 6]), 3, 2);
    const i = 5;
    expect(b.upper[i] - b.middle[i]).toBeCloseTo(b.middle[i] - b.lower[i], 3);
  });

  it('tied buy/sell votes are HOLD, not BUY (regression)', () => {
    // Flat series: RSI is neutral (50) so a low overbought threshold makes it vote SELL,
    // while collapsed Bollinger bands (price <= lower) vote BUY: one vote each.
    const flat = candles(Array(60).fill(100));
    const r = analyzeTickerSignals(flat, { rsiOverbought: 1, activeAlgos: { rsi: true, bb: true } });
    expect(r.signals.rsi.action).toBe('SELL');
    expect(r.signals.bb.action).toBe('BUY');
    expect(r.sentiment).toBe('HOLD');
    expect(r.confidence).toBe(50);
  });
});

describe('backtestStrategy', () => {
  it('is deterministic and produces internally consistent accounting', () => {
    const h = walk(220);
    const a = backtestStrategy(h);
    expect(backtestStrategy(h)).toEqual(a);
    expect(a.totalTrades).toBeGreaterThan(0);
    const sum = a.trades.reduce((s, t) => s + t.pnl, 0);
    expect(a.endCapital - a.startCapital).toBeCloseTo(sum, 1);
    expect(a.netProfit).toBeCloseTo(sum, 1);
    expect(a.maxDrawdownPct).toBeGreaterThanOrEqual(0);
    a.trades.forEach((t) => expect(t.exitTime).not.toBe(t.entryTime));
  });

  it('trading costs strictly reduce profit; zero-cost matches the frictionless run', () => {
    const h = walk(220);
    const free = backtestStrategy(h);
    const costly = backtestStrategy(h, { feeBps: 10, slippageBps: 5 });
    expect(costly.netProfit).toBeLessThan(free.netProfit);
    expect(backtestStrategy(h, { feeBps: 0, slippageBps: 0 })).toEqual(free);
  });

  it('honours a custom starting capital', () => {
    const r = backtestStrategy(walk(120), { initialCapital: 50000 });
    expect(r.startCapital).toBe(50000);
  });
});

describe('parameter sweep', () => {
  it('runs real backtests (tradeCount/pnl equal a direct backtest) and ranks by pnl', () => {
    const h = walk(200);
    const rows = runParameterSweep(h);
    expect(rows.length).toBeGreaterThan(4);
    expect(rows.map((r) => r.pnl)).toEqual([...rows.map((r) => r.pnl)].sort((a, b) => b - a));
    const row = rows.find((r) => r.smaShort === 10 && r.smaLong === 30);
    const direct = backtestStrategy(h, { smaShortPeriod: 10, smaLongPeriod: 30, activeAlgos: { sma: true, rsi: true, macd: true, bb: true } });
    expect(row.pnl).toBe(direct.netProfit);
    expect(row.tradeCount).toBe(direct.totalTrades);
    expect(runParameterSweep(walk(20))).toEqual([]);
  });
});

const er = (extra) =>
  buildFixMessage(Object.entries({ 35: '8', 49: 'BRK', 56: 'ME', 34: '5', 55: 'AAPL', 54: '1', 17: 'E1', ...extra }).map(([tag, val]) => ({ tag, val }))).message
    .split('\x01').join('|');

describe('execution reports', () => {
  it('parses fills but ignores acks / cancels / rejects (regression: acks became phantom fills)', () => {
    const fill = parseFixExecutionReport(er({ 150: 'F', 39: '2', 32: '100', 31: '10.5', 38: '100' }));
    expect(fill).toMatchObject({ symbol: 'AAPL', side: 'BUY', lastQty: 100, lastPx: 10.5, execId: 'E1' });
    expect(parseFixExecutionReport(er({ 150: '0', 39: '0', 38: '100', 44: '10' }))).toBeNull(); // New ack
    expect(parseFixExecutionReport(er({ 150: '4', 39: '4', 38: '100' }))).toBeNull(); // Canceled
    expect(parseFixExecutionReport(er({ 150: '8', 39: '8', 38: '100' }))).toBeNull(); // Rejected
    expect(parseFixExecutionReport(er({ 35: 'D', 150: 'F' }))).toBeNull();
    expect(parseFixExecutionReport(er({ 150: 'F', 54: '9', 32: '1', 31: '1' }))).toBeNull(); // unknown side
  });

  it('re-importing the same log is idempotent', () => {
    const f = parseFixExecutionReport(er({ 150: 'F', 39: '2', 32: '100', 31: '10', 38: '100' }));
    const first = mergeExecutions([], [f, f]);
    expect(first).toMatchObject({ added: 1, duplicates: 1 });
    expect(mergeExecutions(first.merged, [f])).toMatchObject({ added: 0, duplicates: 1 });
  });
});

describe('portfolio positions', () => {
  const fill = (side, qty, px, symbol = 'XYZ') => ({ symbol, side, lastQty: qty, lastPx: px });

  it('averages cost on adds and realizes PnL on partial closes', () => {
    const r = calculatePortfolioPositions([fill('BUY', 100, 10), fill('BUY', 100, 20), fill('SELL', 50, 30)], { XYZ: { currentPrice: 25 } });
    const p = r.positions[0];
    expect(p.netQty).toBe(150);
    expect(p.avgEntryPrice).toBe(15);
    expect(r.totalRealizedPnL).toBe(50 * (30 - 15));
    expect(p.unrealizedPnL).toBe(150 * (25 - 15));
    expect(p.totalCost).toBe(150 * 15);
    expect(r.totalPnL).toBe(r.totalRealizedPnL + r.totalUnrealizedPnL);
  });

  it('handles shorts, partial covers (regression: cost basis went stale) and flips through flat', () => {
    const short = calculatePortfolioPositions([fill('SELL', 100, 50), fill('BUY', 40, 45)], { XYZ: { currentPrice: 40 } });
    const p = short.positions[0];
    expect(p.netQty).toBe(-60);
    expect(p.avgEntryPrice).toBe(50);
    expect(p.totalCost).toBe(60 * 50);
    expect(short.totalRealizedPnL).toBe(40 * (50 - 45));
    expect(p.unrealizedPnL).toBe(60 * (50 - 40));
    expect(p.returnPct).toBeCloseTo((600 / 3000) * 100);

    const flip = calculatePortfolioPositions([fill('BUY', 100, 10), fill('SELL', 150, 12)]);
    const q = flip.positions[0];
    expect(q.netQty).toBe(-50);
    expect(q.avgEntryPrice).toBe(12);
    expect(flip.totalRealizedPnL).toBe(100 * 2);

    const flat = calculatePortfolioPositions([fill('BUY', 10, 5), fill('SELL', 10, 6)]);
    expect(flat.positions[0]).toMatchObject({ netQty: 0, avgEntryPrice: 0, totalCost: 0 });
  });

  it('keeps symbols separate', () => {
    const r = calculatePortfolioPositions([fill('BUY', 1, 1, 'A'), fill('SELL', 1, 1, 'B')]);
    expect(r.positions.map((p) => [p.symbol, p.netQty])).toEqual([['A', 1], ['B', -1]]);
  });
});

describe('generateFixNewOrderSingle', () => {
  it('builds a valid message with a spec-compliant UTCTimestamp', () => {
    const o = generateFixNewOrderSingle({ symbol: 'IBM', side: 'SELL', qty: 250, price: 99.5, clOrdId: 'C1' });
    const v = validateFIXMessage(o.pipeMessage);
    expect(v.errors).toEqual([]);
    expect(v.tags['52']).toMatch(/^\d{8}-\d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(v.tags).toMatchObject({ 35: 'D', 55: 'IBM', 54: '2', 38: '250', 44: '99.50' });
  });
  it('omits price for market orders and accepts numeric strings', () => {
    const o = generateFixNewOrderSingle({ ordType: '1', price: '', qty: '10' });
    expect(validateFIXMessage(o.pipeMessage).tags['44']).toBeUndefined();
    expect(generateFixNewOrderSingle({ price: '12.345' }).pipeMessage).toContain('44=12.35|');
  });
  it('rejects bad quantities and delimiter injection', () => {
    expect(() => generateFixNewOrderSingle({ qty: 0 })).toThrow(/Quantity/);
    expect(() => generateFixNewOrderSingle({ qty: 'abc' })).toThrow(/Quantity/);
    expect(() => generateFixNewOrderSingle({ symbol: 'AAPL|58=pwned' })).toThrow(/Invalid symbol/);
    expect(() => generateFixNewOrderSingle({ account: 'a=b' })).toThrow(/Invalid account/);
    expect(previewFixNewOrderSingle({ qty: 0 })).toMatchObject({ ok: false });
    expect(previewFixNewOrderSingle({})).toMatchObject({ ok: true });
  });
});
