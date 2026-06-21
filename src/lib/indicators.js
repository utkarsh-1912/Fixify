// Technical Indicator Calculations Library for FIXify Multi-Algo Trade Studio

export function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      sma.push(parseFloat((sum / period).toFixed(4)));
    }
  }
  return sma;
}

export function calculateEMA(data, period) {
  const ema = [];
  if (data.length === 0) return ema;
  const multiplier = 2 / (period + 1);
  
  // First value is SMA
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i].close;
  }
  const initialSMA = sum / Math.min(period, data.length);
  
  let currentEMA = initialSMA;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      ema.push(parseFloat(initialSMA.toFixed(4)));
    } else {
      currentEMA = (data[i].close - currentEMA) * multiplier + currentEMA;
      ema.push(parseFloat(currentEMA.toFixed(4)));
    }
  }
  return ema;
}

export function calculateRSI(data, period = 14) {
  const rsi = [];
  if (data.length <= period) {
    return new Array(data.length).fill(null);
  }
  
  let gains = 0;
  let losses = 0;
  
  // First gains and losses
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(parseFloat((100 - (100 / (1 + rs))).toFixed(2)));
    } else {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(parseFloat((100 - (100 / (1 + rs))).toFixed(2)));
    }
  }
  return rsi;
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(parseFloat((fastEMA[i] - slowEMA[i]).toFixed(4)));
    }
  }
  
  // Calculate Signal Line (EMA of MACD Line)
  const firstValidIdx = macdLine.findIndex(x => x !== null);
  const signalLine = new Array(data.length).fill(null);
  const histogram = new Array(data.length).fill(null);
  
  if (firstValidIdx !== -1 && data.length - firstValidIdx >= signalPeriod) {
    const macdSub = macdLine.slice(firstValidIdx).map(x => ({ close: x }));
    const signalSub = calculateEMA(macdSub, signalPeriod);
    
    for (let i = 0; i < signalSub.length; i++) {
      const targetIdx = firstValidIdx + i;
      signalLine[targetIdx] = signalSub[i];
      if (macdLine[targetIdx] !== null && signalLine[targetIdx] !== null) {
        histogram[targetIdx] = parseFloat((macdLine[targetIdx] - signalLine[targetIdx]).toFixed(4));
      }
    }
  }
  
  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const middle = calculateSMA(data, period);
  const upper = [];
  const lower = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSqDiff = 0;
      const mid = middle[i];
      for (let j = 0; j < period; j++) {
        sumSqDiff += Math.pow(data[i - j].close - mid, 2);
      }
      const stdDev = Math.sqrt(sumSqDiff / period);
      upper.push(parseFloat((mid + (multiplier * stdDev)).toFixed(4)));
      lower.push(parseFloat((mid - (multiplier * stdDev)).toFixed(4)));
    }
  }
  return { middle, upper, lower };
}

export function analyzeTickerSignals(history, config = {}) {
  const rsiPeriod = config.rsiPeriod || 14;
  const rsiOverbought = config.rsiOverbought || 70;
  const rsiOversold = config.rsiOversold || 30;
  
  const smaShortPeriod = config.smaShortPeriod || 10;
  const smaLongPeriod = config.smaLongPeriod || 30;
  
  const bBandsPeriod = config.bBandsPeriod || 20;
  const bBandsStdDev = config.bBandsStdDev || 2;
  
  const macdFast = config.macdFast || 12;
  const macdSlow = config.macdSlow || 26;
  const macdSignal = config.macdSignal || 9;

  const activeAlgos = config.activeAlgos || {
    sma: true,
    rsi: true,
    macd: true,
    bb: true
  };

  const len = history.length;
  if (len < 35) { // Need enough history
    return {
      sentiment: 'HOLD',
      confidence: 50,
      signals: {},
      indicators: {},
      recommendation: { entryMin: 0, entryMax: 0, sl: 0, tp: 0 }
    };
  }

  const smaShort = calculateSMA(history, smaShortPeriod);
  const smaLong = calculateSMA(history, smaLongPeriod);
  const rsi = calculateRSI(history, rsiPeriod);
  const macd = calculateMACD(history, macdFast, macdSlow, macdSignal);
  const bb = calculateBollingerBands(history, bBandsPeriod, bBandsStdDev);

  const signals = {};
  let totalVotes = 0;
  let buyVotes = 0;
  let sellVotes = 0;

  const currentPrice = history[len - 1].close;

  // SMA cross vote
  if (activeAlgos.sma) {
    const prevShort = smaShort[len - 2];
    const currShort = smaShort[len - 1];
    const prevLong = smaLong[len - 2];
    const currLong = smaLong[len - 1];

    if (currShort && currLong && prevShort && prevLong) {
      totalVotes++;
      if (prevShort <= prevLong && currShort > currLong) {
        signals.sma = { action: 'BUY', detail: 'Golden Cross (Short crossed above Long)' };
        buyVotes++;
      } else if (prevShort >= prevLong && currShort < currLong) {
        signals.sma = { action: 'SELL', detail: 'Death Cross (Short crossed below Long)' };
        sellVotes++;
      } else {
        signals.sma = { action: 'HOLD', detail: currShort > currLong ? 'Short above Long' : 'Short below Long' };
      }
    }
  }

  // RSI vote
  if (activeAlgos.rsi) {
    const currRSI = rsi[len - 1];
    if (currRSI !== null) {
      totalVotes++;
      if (currRSI <= rsiOversold) {
        signals.rsi = { action: 'BUY', detail: `Oversold RSI (${currRSI.toFixed(1)} <= ${rsiOversold})` };
        buyVotes++;
      } else if (currRSI >= rsiOverbought) {
        signals.rsi = { action: 'SELL', detail: `Overbought RSI (${currRSI.toFixed(1)} >= ${rsiOverbought})` };
        sellVotes++;
      } else {
        signals.rsi = { action: 'HOLD', detail: `Neutral RSI (${currRSI.toFixed(1)})` };
      }
    }
  }

  // MACD vote
  if (activeAlgos.macd) {
    const currMacd = macd.macdLine[len - 1];
    const currSignal = macd.signalLine[len - 1];
    const prevMacd = macd.macdLine[len - 2];
    const prevSignal = macd.signalLine[len - 2];

    if (currMacd !== null && currSignal !== null && prevMacd !== null && prevSignal !== null) {
      totalVotes++;
      if (prevMacd <= prevSignal && currMacd > currSignal) {
        signals.macd = { action: 'BUY', detail: 'MACD Bullish Cross' };
        buyVotes++;
      } else if (prevMacd >= prevSignal && currMacd < currSignal) {
        signals.macd = { action: 'SELL', detail: 'MACD Bearish Cross' };
        sellVotes++;
      } else {
        signals.macd = { action: 'HOLD', detail: currMacd > currSignal ? 'MACD above Signal' : 'MACD below Signal' };
      }
    }
  }

  // Bollinger Bands vote
  if (activeAlgos.bb) {
    const currUpper = bb.upper[len - 1];
    const currLower = bb.lower[len - 1];
    if (currUpper !== null && currLower !== null) {
      totalVotes++;
      if (currentPrice <= currLower) {
        signals.bb = { action: 'BUY', detail: `Price below Lower BB (${currentPrice} <= ${currLower.toFixed(2)})` };
        buyVotes++;
      } else if (currentPrice >= currUpper) {
        signals.bb = { action: 'SELL', detail: `Price above Upper BB (${currentPrice} >= ${currUpper.toFixed(2)})` };
        sellVotes++;
      } else {
        signals.bb = { action: 'HOLD', detail: 'Price inside BB envelope' };
      }
    }
  }

  let sentiment = 'HOLD';
  let confidence = 50;

  if (totalVotes > 0) {
    const buyRatio = buyVotes / totalVotes;
    const sellRatio = sellVotes / totalVotes;

    if (buyRatio >= 0.75) {
      sentiment = 'STRONG BUY';
      confidence = Math.round(buyRatio * 100);
    } else if (buyRatio >= 0.5) {
      sentiment = 'BUY';
      confidence = Math.round(buyRatio * 100);
    } else if (sellRatio >= 0.75) {
      sentiment = 'STRONG SELL';
      confidence = Math.round(sellRatio * 100);
    } else if (sellRatio >= 0.5) {
      sentiment = 'SELL';
      confidence = Math.round(sellRatio * 100);
    } else {
      sentiment = 'HOLD';
      confidence = 50;
    }
  }

  const entryMin = currentPrice * 0.998;
  const entryMax = currentPrice * 1.002;
  
  const currLowerBand = bb.lower[len - 1] || currentPrice * 0.97;
  const currUpperBand = bb.upper[len - 1] || currentPrice * 1.03;

  let sl = 0;
  let tp = 0;

  if (sentiment.includes('BUY')) {
    sl = Math.min(currLowerBand * 0.995, currentPrice * 0.98);
    const risk = currentPrice - sl;
    tp = currentPrice + (risk * 2.2);
  } else if (sentiment.includes('SELL')) {
    sl = Math.max(currUpperBand * 1.005, currentPrice * 1.02);
    const risk = sl - currentPrice;
    tp = currentPrice - (risk * 2.2);
  } else {
    sl = currentPrice * 0.97;
    tp = currentPrice * 1.045;
  }

  return {
    sentiment,
    confidence,
    signals,
    indicators: {
      smaShort: smaShort[len - 1],
      smaLong: smaLong[len - 1],
      rsi: rsi[len - 1],
      macdLine: macd.macdLine[len - 1],
      macdSignal: macd.signalLine[len - 1],
      macdHist: macd.histogram[len - 1],
      bbUpper: bb.upper[len - 1],
      bbLower: bb.lower[len - 1],
      bbMiddle: bb.middle[len - 1]
    },
    historyArrays: {
      smaShort,
      smaLong,
      rsi,
      macd,
      bb
    },
    recommendation: {
      entryMin: parseFloat(entryMin.toFixed(2)),
      entryMax: parseFloat(entryMax.toFixed(2)),
      sl: parseFloat(sl.toFixed(2)),
      tp: parseFloat(tp.toFixed(2))
    }
  };
}

export function backtestStrategy(history, config = {}) {
  const len = history.length;
  const trades = [];
  let openTrade = null;
  let capital = 10000; // Virtual starting balance
  
  // Warmup is 30 candles
  for (let i = 30; i < len; i++) {
    const subHistory = history.slice(0, i + 1);
    const analysis = analyzeTickerSignals(subHistory, config);
    const currentPrice = history[i].close;
    const currentDate = history[i].date;
    
    // Check if stopped out or take profit hit
    if (openTrade) {
      const candle = history[i];
      const high = candle.high || currentPrice;
      const low = candle.low || currentPrice;
      
      let closed = false;
      let exitPrice = currentPrice;
      let reason = 'Market Close';
      
      if (openTrade.action === 'BUY') {
        if (low <= openTrade.sl) {
          closed = true;
          exitPrice = openTrade.sl;
          reason = 'Stop Loss';
        } else if (high >= openTrade.tp) {
          closed = true;
          exitPrice = openTrade.tp;
          reason = 'Take Profit';
        }
      } else { // SELL
        if (high >= openTrade.sl) {
          closed = true;
          exitPrice = openTrade.sl;
          reason = 'Stop Loss';
        } else if (low <= openTrade.tp) {
          closed = true;
          exitPrice = openTrade.tp;
          reason = 'Take Profit';
        }
      }
      
      if (closed) {
        const entryVal = openTrade.quantity * openTrade.entryPrice;
        const exitVal = openTrade.quantity * exitPrice;
        const pnl = openTrade.action === 'BUY' ? (exitVal - entryVal) : (entryVal - exitVal);
        
        capital += pnl;
        
        trades.push({
          ...openTrade,
          exitPrice,
          exitTime: currentDate,
          pnl: parseFloat(pnl.toFixed(2)),
          capitalAfter: parseFloat(capital.toFixed(2)),
          reason
        });
        
        openTrade = null;
      }
    }
    
    // Check for new entry signals
    if (!openTrade) {
      if (analysis.sentiment === 'STRONG BUY' || analysis.sentiment === 'BUY') {
        const entryMin = analysis.recommendation.entryMin;
        const entryMax = analysis.recommendation.entryMax;
        const entryPrice = parseFloat(((entryMin + entryMax) / 2).toFixed(2));
        const sl = analysis.recommendation.sl;
        const tp = analysis.recommendation.tp;
        const quantity = parseFloat((capital / entryPrice).toFixed(4));
        
        openTrade = {
          action: 'BUY',
          entryPrice,
          entryTime: currentDate,
          quantity,
          sl,
          tp,
          capitalAtEntry: parseFloat(capital.toFixed(2))
        };
      } else if (analysis.sentiment === 'STRONG SELL' || analysis.sentiment === 'SELL') {
        const entryMin = analysis.recommendation.entryMin;
        const entryMax = analysis.recommendation.entryMax;
        const entryPrice = parseFloat(((entryMin + entryMax) / 2).toFixed(2));
        const sl = analysis.recommendation.sl;
        const tp = analysis.recommendation.tp;
        const quantity = parseFloat((capital / entryPrice).toFixed(4));
        
        openTrade = {
          action: 'SELL',
          entryPrice,
          entryTime: currentDate,
          quantity,
          sl,
          tp,
          capitalAtEntry: parseFloat(capital.toFixed(2))
        };
      }
    }
  }
  
  if (openTrade) {
    const finalPrice = history[len - 1].close;
    const finalDate = history[len - 1].date;
    const entryVal = openTrade.quantity * openTrade.entryPrice;
    const exitVal = openTrade.quantity * finalPrice;
    const pnl = openTrade.action === 'BUY' ? (exitVal - entryVal) : (entryVal - exitVal);
    
    capital += pnl;
    trades.push({
      ...openTrade,
      exitPrice: finalPrice,
      exitTime: finalDate,
      pnl: parseFloat(pnl.toFixed(2)),
      capitalAfter: parseFloat(capital.toFixed(2)),
      reason: 'Hold'
    });
  }
  
  const totalTrades = trades.length;
  const profitableTrades = trades.filter(t => t.pnl > 0).length;
  const winRate = totalTrades > 0 ? parseFloat(((profitableTrades / totalTrades) * 100).toFixed(1)) : 0;
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;
  const netProfit = parseFloat((capital - 10000).toFixed(2));
  
  return {
    trades,
    totalTrades,
    profitableTrades,
    winRate,
    profitFactor,
    netProfit,
    startCapital: 10000,
    endCapital: parseFloat(capital.toFixed(2))
  };
}
