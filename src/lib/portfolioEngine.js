'use client';

import { validateFIXMessage } from './fixParser';
import { backtestStrategy } from './indicators';
import { buildFixMessage, fixTimestamp, SOH } from './fixWire';

const FILL_EXEC_TYPES = new Set(['F', '1', '2']); // Trade (4.3+), Partial fill / Fill (4.2)
const SIDE_MAP = { '1': 'BUY', '2': 'SELL', '5': 'SELL_SHORT', '6': 'SELL_SHORT' };

/**
 * Parses a raw FIX Execution Report (35=8) into structured fill data.
 * Returns null for anything that is not an actual fill (acks, cancels, rejects,
 * pending states) so they can never create phantom positions.
 */
export function parseFixExecutionReport(rawFixText, delimiter = '|') {
  if (!rawFixText) return null;
  const cleanMsg = rawFixText.includes('8=FIX')
    ? rawFixText.substring(rawFixText.indexOf('8=FIX'))
    : rawFixText;

  const parsed = validateFIXMessage(cleanMsg, delimiter);
  if (!parsed || !parsed.tags) return null;
  const t = parsed.tags;
  if (t['35'] !== '8') return null; // Must be Execution Report

  const execType = t['150'];
  const ordStatus = t['39'];
  const isFill = execType ? FILL_EXEC_TYPES.has(execType) : ordStatus === '1' || ordStatus === '2';
  if (!isFill) return null;

  const lastPx = parseFloat(t['31'] || t['44'] || '0');
  const lastQty = parseFloat(t['32'] || t['38'] || '0');
  if (!(lastQty > 0) || !(lastPx >= 0) || !SIDE_MAP[t['54']]) return null;

  const execId = t['17'] || `EXEC_${Date.now()}`;
  return {
    id: execId,
    execId,
    orderId: t['37'] || '',
    clOrdId: t['11'] || '',
    symbol: t['55'] || 'UNKNOWN',
    side: SIDE_MAP[t['54']],
    lastPx,
    lastQty,
    avgPx: parseFloat(t['6'] || lastPx || '0'),
    cumQty: parseFloat(t['14'] || lastQty || '0'),
    execType,
    ordStatus,
    timestamp: t['60'] || t['52'] || new Date().toISOString(),
    rawText: cleanMsg,
  };
}

/** Merges new fills into an existing ledger, skipping ExecIDs already present (re-importing a log must be idempotent). */
export function mergeExecutions(existing = [], incoming = []) {
  const seen = new Set(existing.map((e) => e.execId));
  const fresh = [];
  incoming.forEach((e) => {
    if (!seen.has(e.execId)) {
      seen.add(e.execId);
      fresh.push(e);
    }
  });
  return { merged: [...fresh, ...existing], added: fresh.length, duplicates: incoming.length - fresh.length };
}

/**
 * Computes positions, average cost, realized PnL and mark-to-market unrealized PnL
 * from fills processed in order. A fill that crosses through flat closes the old
 * position at the fill price and opens the remainder in the other direction.
 */
export function calculatePortfolioPositions(executionsList = [], marketQuotes = {}) {
  const positionsMap = {};
  let totalRealizedPnL = 0;

  executionsList.forEach((exec) => {
    const symbol = exec.symbol;
    const pos = (positionsMap[symbol] ||= {
      symbol, netQty: 0, buyQty: 0, sellQty: 0, totalCost: 0, avgEntryPrice: 0, realizedPnL: 0, executionsCount: 0, tradesHistory: [],
    });
    pos.executionsCount += 1;
    pos.tradesHistory.push(exec);

    const qty = exec.lastQty || 0;
    const price = exec.lastPx || exec.avgPx || 0;
    const isBuy = exec.side === 'BUY';
    if (!isBuy && exec.side !== 'SELL' && exec.side !== 'SELL_SHORT') return;
    const signed = isBuy ? qty : -qty;

    let remaining = qty;
    const opposing = pos.netQty !== 0 && Math.sign(pos.netQty) !== Math.sign(signed);
    if (opposing) {
      const closed = Math.min(qty, Math.abs(pos.netQty));
      const pnl = pos.netQty > 0 ? closed * (price - pos.avgEntryPrice) : closed * (pos.avgEntryPrice - price);
      pos.realizedPnL += pnl;
      totalRealizedPnL += pnl;
      pos.netQty += Math.sign(signed) * closed;
      remaining -= closed;
      pos.totalCost = Math.abs(pos.netQty) * pos.avgEntryPrice;
      if (pos.netQty === 0) pos.avgEntryPrice = 0;
    }
    if (remaining > 0) {
      // Opening, adding to, or flipping into a position at this fill's price.
      pos.totalCost += remaining * price;
      pos.netQty += Math.sign(signed) * remaining;
      pos.avgEntryPrice = pos.totalCost / Math.abs(pos.netQty);
    }
    if (isBuy) pos.buyQty += qty; else pos.sellQty += qty;
  });

  let totalUnrealizedPnL = 0;
  let totalPortfolioValue = 0;
  const positionsList = Object.values(positionsMap).map((pos) => {
    const currentPrice = marketQuotes[pos.symbol]?.currentPrice || pos.avgEntryPrice || 0;
    const unrealizedPnL = pos.netQty > 0
      ? pos.netQty * (currentPrice - pos.avgEntryPrice)
      : pos.netQty < 0 ? Math.abs(pos.netQty) * (pos.avgEntryPrice - currentPrice) : 0;
    const marketValue = Math.abs(pos.netQty) * currentPrice;
    totalUnrealizedPnL += unrealizedPnL;
    totalPortfolioValue += marketValue;
    return {
      ...pos,
      currentPrice,
      unrealizedPnL,
      marketValue,
      returnPct: pos.totalCost > 0 ? (unrealizedPnL / pos.totalCost) * 100 : 0,
    };
  });

  return {
    positions: positionsList,
    totalRealizedPnL,
    totalUnrealizedPnL,
    totalPnL: totalRealizedPnL + totalUnrealizedPnL,
    totalPortfolioValue,
  };
}

const FIELD_SAFE = /^[^\x01|=\r\n]+$/;

/**
 * Generates a valid FIX 4.4 35=D (New Order Single). Inputs are validated so a
 * stray delimiter in a symbol / account can never inject extra tags.
 */
export function generateFixNewOrderSingle(params = {}) {
  const {
    symbol = 'AAPL',
    side = 'BUY',
    qty = 100,
    price = 150.0,
    ordType = '2', // 1=Market, 2=Limit, 3=Stop
    clOrdId = `CL_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    senderCompId = 'TRADER_CLIENT',
    targetCompId = 'EXEC_BROKER',
    account = 'ACCT_QUANT_01',
    handlInst = '1',
    exDestination = 'NASDAQ',
    timeInForce = '0', // 0=Day, 1=GTC, 3=IOC
    msgSeqNum = 101,
    sendingTime = fixTimestamp(),
  } = params;

  const quantity = Number(qty);
  const limit = Number(price);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be a positive number.');
  if (ordType !== '1' && !(Number.isFinite(limit) && limit > 0)) throw new Error('Price must be a positive number for non-market orders.');
  Object.entries({ symbol, clOrdId, senderCompId, targetCompId, account, exDestination }).forEach(([k, v]) => {
    if (!FIELD_SAFE.test(String(v))) throw new Error(`Invalid ${k}: must be non-empty and contain no delimiters or "=".`);
  });

  const sideTag = side === 'BUY' ? '1' : side === 'SELL' ? '2' : '5';
  const { message, bodyLength, checksum } = buildFixMessage([
    { tag: '35', val: 'D' },
    { tag: '49', val: senderCompId },
    { tag: '56', val: targetCompId },
    { tag: '34', val: msgSeqNum },
    { tag: '52', val: sendingTime },
    { tag: '11', val: clOrdId },
    { tag: '1', val: account },
    { tag: '21', val: handlInst },
    { tag: '55', val: symbol },
    { tag: '54', val: sideTag },
    { tag: '60', val: sendingTime },
    { tag: '38', val: quantity },
    { tag: '40', val: ordType },
    ...(ordType !== '1' ? [{ tag: '44', val: limit.toFixed(2) }] : []),
    { tag: '59', val: timeInForce },
    { tag: '100', val: exDestination },
  ]);

  return {
    clOrdId,
    sohMessage: message,
    pipeMessage: message.split(SOH).join('|'),
    bodyLength,
    checksum,
  };
}

/**
 * Real parameter sweep: runs the full backtest engine for every valid SMA
 * short/long pair and ranks by net profit.
 */
export function runParameterSweep(history = [], baseConfig = {}) {
  if (!history || history.length < 60) return [];

  const results = [];
  [5, 10, 15, 20].forEach((smaShort) => {
    [20, 30, 50].forEach((smaLong) => {
      if (smaShort >= smaLong) return;
      const bt = backtestStrategy(history, {
        ...baseConfig,
        smaShortPeriod: smaShort,
        smaLongPeriod: smaLong,
        activeAlgos: { ...(baseConfig.activeAlgos || { sma: true, rsi: true, macd: true, bb: true }), sma: true },
      });
      results.push({
        smaShort,
        smaLong,
        tradeCount: bt.totalTrades,
        pnl: bt.netProfit,
        winRatePct: bt.winRate,
        profitFactor: bt.profitFactor,
        maxDrawdownPct: bt.maxDrawdownPct,
      });
    });
  });
  return results.sort((a, b) => b.pnl - a.pnl);
}

/** Non-throwing variant for live previews while the user is still typing. */
export function previewFixNewOrderSingle(params) {
  try {
    return { ok: true, ...generateFixNewOrderSingle(params) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
