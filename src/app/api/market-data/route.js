import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// Standard profile and price mapping for common tickers
const TICKER_PROFILES = {
  'AAPL': { name: 'Apple Inc.', basePrice: 185.50, change24h: 1.2 },
  'MSFT': { name: 'Microsoft Corporation', basePrice: 415.80, change24h: -0.45 },
  'TSLA': { name: 'Tesla, Inc.', basePrice: 178.20, change24h: 3.4 },
  'NVDA': { name: 'NVIDIA Corporation', basePrice: 125.10, change24h: 4.8 },
  'AMZN': { name: 'Amazon.com, Inc.', basePrice: 182.40, change24h: -1.1 },
  'GOOGL': { name: 'Alphabet Inc.', basePrice: 172.90, change24h: 0.8 },
  'NFLX': { name: 'Netflix, Inc.', basePrice: 620.50, change24h: -2.3 },
  'META': { name: 'Meta Platforms, Inc.', basePrice: 475.60, change24h: 1.95 },
  'BTC-USD': { name: 'Bitcoin USD', basePrice: 65420.00, change24h: 2.7 },
  'ETH-USD': { name: 'Ethereum USD', basePrice: 3450.00, change24h: -0.85 }
};

// Simple pseudo-random generator with a seed for stable mock charts
function seedRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function generateMockData(symbol, days) {
  const cleanSymbol = symbol.toUpperCase().trim();
  const profile = TICKER_PROFILES[cleanSymbol] || {
    name: `${cleanSymbol} Asset`,
    basePrice: 100.00 + (cleanSymbol.charCodeAt(0) * 1.5),
    change24h: 0.5
  };

  // Generate historical candles
  const history = [];
  let currentPrice = profile.basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    
    // Seeded random walk to make charts look realistic and stable
    const seed = cleanSymbol.charCodeAt(0) + i;
    const changePercent = (seedRandom(seed) - 0.48) * 0.04; // -1.92% to +2.08% bias
    const open = currentPrice;
    const close = currentPrice * (1 + changePercent);
    const high = Math.max(open, close) * (1 + seedRandom(seed + 1) * 0.01);
    const low = Math.min(open, close) * (1 - seedRandom(seed + 2) * 0.01);
    const volume = Math.floor(500000 + seedRandom(seed + 3) * 5000000);

    history.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume
    });

    currentPrice = close;
  }

  // Calculate quote info
  const latestPrice = history[history.length - 1].close;
  const yesterdayPrice = history[history.length - 2].close;
  const changeAmt = latestPrice - yesterdayPrice;
  const pctChange = (changeAmt / yesterdayPrice) * 100;

  return {
    symbol: cleanSymbol,
    name: profile.name,
    price: parseFloat(latestPrice.toFixed(2)),
    change: parseFloat(changeAmt.toFixed(2)),
    changePercent: parseFloat(pctChange.toFixed(2)),
    currency: 'USD',
    history: history,
    isMock: true
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (q) {
      try {
        const searchResult = await yahooFinance.search(q);
        const quotes = searchResult.quotes || [];
        const formatted = quotes.map(item => ({
          symbol: item.symbol,
          name: item.shortname || item.longname || item.name || `${item.symbol} Asset`,
          exchange: item.exchange || 'NMS',
          type: item.quoteType || item.typeDisp || 'EQUITY'
        })).slice(0, 8);
        return NextResponse.json({ success: true, data: formatted });
      } catch (err) {
        console.warn(`Yahoo Finance search failed for "${q}":`, err.message);
        // Fallback recommendations if offline
        const mocks = Object.keys(TICKER_PROFILES)
          .filter(sym => sym.includes(q.toUpperCase()) || TICKER_PROFILES[sym].name.toLowerCase().includes(q.toLowerCase()))
          .map(sym => ({
            symbol: sym,
            name: TICKER_PROFILES[sym].name,
            exchange: sym.endsWith('-USD') ? 'CCC' : 'NMS',
            type: sym.endsWith('-USD') ? 'CRYPTOCURRENCY' : 'EQUITY'
          }));
        return NextResponse.json({ success: true, data: mocks });
      }
    }

    const symbolsRaw = searchParams.get('symbols') || 'AAPL,MSFT,TSLA,NVDA,BTC-USD';
    const range = searchParams.get('range') || '1mo'; // 1mo, 3mo, 6mo, 1y

    const symbols = symbolsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const rangeDays = {
      '1mo': 30,
      '3mo': 90,
      '6mo': 180,
      '1y': 365
    };
    const daysCount = rangeDays[range] || 30;

    const results = {};

    for (const symbol of symbols) {
      try {
        // Calculate start date
        const period1 = new Date();
        period1.setDate(period1.getDate() - daysCount - 5); // Add a small buffer for weekend gaps
        
        // Fetch live quote and history concurrently
        const [quoteResult, historyResult] = await Promise.all([
          yahooFinance.quote(symbol).catch(() => null),
          yahooFinance.historical(symbol, {
            period1: period1.toISOString().split('T')[0],
            interval: '1d'
          }).catch(() => null)
        ]);

        if (quoteResult && historyResult && historyResult.length > 0) {
          // Format history data to ensure consistent date fields
          const formattedHistory = historyResult
            .map(candle => ({
              date: new Date(candle.date).toISOString().split('T')[0],
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          results[symbol] = {
            symbol: symbol,
            name: quoteResult.longName || quoteResult.shortName || TICKER_PROFILES[symbol]?.name || `${symbol} Inc.`,
            price: quoteResult.regularMarketPrice || formattedHistory[formattedHistory.length - 1].close,
            change: quoteResult.regularMarketChange || 0,
            changePercent: quoteResult.regularMarketChangePercent || 0,
            currency: quoteResult.currency || 'USD',
            history: formattedHistory,
            isMock: false
          };
        } else {
          // No live data returned or query failed, fallback to mock data
          results[symbol] = generateMockData(symbol, daysCount);
        }
      } catch (err) {
        console.warn(`Failed to fetch Yahoo Finance data for ${symbol}:`, err.message);
        results[symbol] = generateMockData(symbol, daysCount);
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Critical error in market-data API route:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
