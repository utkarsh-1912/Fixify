'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Info,
  Plus,
  Trash,
  Check,
  AlertTriangle,
  Settings,
  DollarSign,
  LineChart,
  Percent,
  Briefcase,
  Play,
  X,
  Search,
  BookOpen
} from 'lucide-react';
import { analyzeTickerSignals, backtestStrategy } from '@/lib/indicators';

// Default list of symbols to scanner
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'BTC-USD'];

export default function MultiAlgoStudio() {
  // Page states
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [range, setRange] = useState('3mo'); // 3mo is better for backtests
  const [marketData, setMarketData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [chartMode, setChartViewMode] = useState('price'); // price, rsi, macd, backtest
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const searchContainerRef = useRef(null);

  // Paper portfolio states
  const [paperTrades, setPaperTrades] = useState([]);
  const [simTradeAmount, setSimTradeAmount] = useState('1000');
  const [tradeActionMessage, setTradeActionMessage] = useState(null);

  // Strategy Configurations
  const [config, setConfig] = useState({
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    smaShortPeriod: 10,
    smaLongPeriod: 30,
    bBandsPeriod: 20,
    bBandsStdDev: 2,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    activeAlgos: {
      sma: true,
      rsi: true,
      macd: true,
      bb: true
    }
  });

  // Fetch market data from server proxy
  const fetchMarketData = async (symbolList = symbols, currentRange = range) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-data?symbols=${symbolList.join(',')}&range=${currentRange}`);
      const json = await response.json();
      if (json.success && json.data) {
        setMarketData(json.data);
        // Default selected symbol if current one is not in the list
        if (!symbolList.includes(selectedSymbol)) {
          setSelectedSymbol(symbolList[0] || '');
        }
      }
    } catch (e) {
      console.error("Failed to load market data", e);
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete debounce logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setRecommendations([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/market-data?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setRecommendations(json.data);
        }
      } catch (err) {
        console.warn("Search autocomplete fetch failed", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Handle click outside to close recommendations dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowRecommendations(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load configuration & paper portfolio on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedConfig = localStorage.getItem('fixify-algo-config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
      const savedSymbols = localStorage.getItem('fixify-algo-symbols');
      if (savedSymbols) {
        setSymbols(JSON.parse(savedSymbols));
      }
      const savedTrades = localStorage.getItem('fixify-algo-trades');
      if (savedTrades) {
        setPaperTrades(JSON.parse(savedTrades));
      }
    } catch (e) {
      console.warn("Failed to restore state from local storage", e);
    }
  }, []);

  // Sync state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('fixify-algo-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('fixify-algo-symbols', JSON.stringify(symbols));
  }, [symbols]);

  // Initial trigger fetch
  useEffect(() => {
    fetchMarketData(symbols, range);
  }, [range]);

  // Select recommendation from autocomplete dropdown
  const handleSelectRecommendation = (item) => {
    const symbol = item.symbol.toUpperCase();
    setShowRecommendations(false);
    setSearchQuery('');
    setRecommendations([]);

    if (symbols.includes(symbol)) {
      setSelectedSymbol(symbol);
      return;
    }

    const updated = [...symbols, symbol];
    setSymbols(updated);
    setSelectedSymbol(symbol);
    fetchMarketData(updated, range);
  };

  // Remove symbol from list
  const handleRemoveSymbol = (symbolToRemove) => {
    const updated = symbols.filter(s => s !== symbolToRemove);
    setSymbols(updated);
    if (selectedSymbol === symbolToRemove) {
      setSelectedSymbol(updated[0] || '');
    }
    fetchMarketData(updated, range);
  };

  // Calculate indicator details for all symbols dynamically
  const analyzedResults = useMemo(() => {
    const results = {};
    Object.keys(marketData).forEach(symbol => {
      const symbolInfo = marketData[symbol];
      if (symbolInfo && symbolInfo.history && symbolInfo.history.length > 0) {
        results[symbol] = {
          ...symbolInfo,
          signals: analyzeTickerSignals(symbolInfo.history, config),
          backtest: backtestStrategy(symbolInfo.history, config)
        };
      }
    });
    return results;
  }, [marketData, config]);

  // Fetch quote summaries
  const signalsSummary = useMemo(() => {
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    Object.keys(analyzedResults).forEach(symbol => {
      const sentiment = analyzedResults[symbol]?.signals?.sentiment || 'HOLD';
      if (sentiment.includes('BUY')) buyCount++;
      else if (sentiment.includes('SELL')) sellCount++;
      else holdCount++;
    });

    return { buyCount, sellCount, holdCount };
  }, [analyzedResults]);

  // Handle Paper Trade Execution
  const handleExecutePaperTrade = (symbol, action, currentPrice) => {
    const amountNum = parseFloat(simTradeAmount) || 1000;
    const quantity = amountNum / currentPrice;

    const newTrade = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      action,
      entryPrice: currentPrice,
      entryTime: new Date().toLocaleTimeString(),
      quantity: parseFloat(quantity.toFixed(4)),
      capital: amountNum,
      status: 'OPEN'
    };

    const updated = [newTrade, ...paperTrades];
    setPaperTrades(updated);
    localStorage.setItem('fixify-algo-trades', JSON.stringify(updated));

    setTradeActionMessage({
      type: 'success',
      text: `Executed paper order: ${action} ${quantity.toFixed(4)} shares of ${symbol} at $${currentPrice.toFixed(2)}`
    });
    setTimeout(() => setTradeActionMessage(null), 4000);
  };

  // Close Paper Trade
  const handleClosePaperTrade = (tradeId, exitPrice) => {
    const updated = paperTrades.map(trade => {
      if (trade.id === tradeId) {
        const entryValue = trade.quantity * trade.entryPrice;
        const exitValue = trade.quantity * exitPrice;
        const pnl = trade.action === 'BUY' ? (exitValue - entryValue) : (entryValue - exitValue);
        return {
          ...trade,
          status: 'CLOSED',
          exitPrice,
          exitTime: new Date().toLocaleTimeString(),
          pnl: parseFloat(pnl.toFixed(2))
        };
      }
      return trade;
    });
    setPaperTrades(updated);
    localStorage.setItem('fixify-algo-trades', JSON.stringify(updated));
  };

  // Clear Portfolio Ledger
  const handleClearPortfolio = () => {
    setPaperTrades([]);
    localStorage.removeItem('fixify-algo-trades');
  };

  // Selected Ticker Details
  const selectedDetails = analyzedResults[selectedSymbol];

  // SVG Chart Plotting Helper
  const chartProps = useMemo(() => {
    if (!selectedDetails || !selectedDetails.history || selectedDetails.history.length === 0) return null;

    const history = selectedDetails.history;
    const len = history.length;

    // Dimensions
    const width = 800;
    const height = 300;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    // Extents
    const closePrices = history.map(h => h.close);
    let allPrices = [...closePrices];

    // Overlay plan targets (SL / TP / Entry Range) in extents to prevent clipping
    if (selectedDetails.signals?.recommendation) {
      const rec = selectedDetails.signals.recommendation;
      allPrices.push(rec.sl, rec.tp, rec.entryMin, rec.entryMax);
    }

    // BB boundaries
    if (config.activeAlgos.bb && selectedDetails.signals?.historyArrays?.bb) {
      const { upper, lower } = selectedDetails.signals.historyArrays.bb;
      allPrices = allPrices.concat(upper.filter(x => x !== null), lower.filter(x => x !== null));
    }
    // SMA boundaries
    if (config.activeAlgos.sma && selectedDetails.signals?.historyArrays?.smaShort) {
      const { smaShort, smaLong } = selectedDetails.signals.historyArrays;
      allPrices = allPrices.concat(smaShort.filter(x => x !== null), smaLong.filter(x => x !== null));
    }

    const minPrice = Math.min(...allPrices) * 0.995;
    const maxPrice = Math.max(...allPrices) * 1.005;

    // Coordinate Mappers
    const getX = (index) => paddingLeft + (index / (len - 1)) * plotWidth;
    const getY = (price) => height - paddingBottom - ((price - minPrice) / (maxPrice - minPrice)) * plotHeight;

    // Price path points
    const points = history.map((h, i) => `${getX(i)},${getY(h.close)}`).join(' ');

    // SMA paths
    let smaShortPoints = '';
    let smaLongPoints = '';
    if (config.activeAlgos.sma && selectedDetails.signals?.historyArrays?.smaShort) {
      const { smaShort, smaLong } = selectedDetails.signals.historyArrays;
      smaShortPoints = smaShort
        .map((val, i) => val !== null ? `${getX(i)},${getY(val)}` : '')
        .filter(Boolean)
        .join(' ');
      smaLongPoints = smaLong
        .map((val, i) => val !== null ? `${getX(i)},${getY(val)}` : '')
        .filter(Boolean)
        .join(' ');
    }

    // Bollinger Bands Shaded Area & lines
    let bbArea = '';
    let bbUpperPoints = '';
    let bbLowerPoints = '';
    let bbMiddlePoints = '';
    if (config.activeAlgos.bb && selectedDetails.signals?.historyArrays?.bb) {
      const { upper, lower, middle } = selectedDetails.signals.historyArrays.bb;
      const upperCoords = upper.map((val, i) => val !== null ? [getX(i), getY(val)] : null).filter(Boolean);
      const lowerCoords = lower.map((val, i) => val !== null ? [getX(i), getY(val)] : null).filter(Boolean);
      bbMiddlePoints = middle.map((val, i) => val !== null ? `${getX(i)},${getY(val)}` : '').filter(Boolean).join(' ');
      
      bbUpperPoints = upperCoords.map(c => `${c[0]},${c[1]}`).join(' ');
      bbLowerPoints = lowerCoords.map(c => `${c[0]},${c[1]}`).join(' ');

      if (upperCoords.length > 0 && lowerCoords.length > 0) {
        const areaPoints = [
          ...upperCoords.map(c => `${c[0]},${c[1]}`),
          ...lowerCoords.reverse().map(c => `${c[0]},${c[1]}`)
        ].join(' ');
        bbArea = areaPoints;
      }
    }

    // RSI sub-chart coordinate mapper (RSI ranges 0 to 100)
    const getRsiY = (rsiVal) => height - paddingBottom - (rsiVal / 100) * plotHeight;
    let rsiPoints = '';
    if (selectedDetails.signals?.historyArrays?.rsi) {
      rsiPoints = selectedDetails.signals.historyArrays.rsi
        .map((val, i) => val !== null ? `${getX(i)},${getRsiY(val)}` : '')
        .filter(Boolean)
        .join(' ');
    }

    // MACD sub-chart mapper
    let macdPoints = '';
    let signalPoints = '';
    let macdHistBars = [];
    if (selectedDetails.signals?.historyArrays?.macd) {
      const { macdLine, signalLine, histogram } = selectedDetails.signals.historyArrays.macd;
      const validMacds = macdLine.filter(x => x !== null);
      const validSignals = signalLine.filter(x => x !== null);
      const maxMacdVal = Math.max(...validMacds, ...validSignals, 0.01) * 1.1;
      const minMacdVal = Math.min(...validMacds, ...validSignals, -0.01) * 1.1;
      
      const getMacdY = (val) => height - paddingBottom - ((val - minMacdVal) / (maxMacdVal - minMacdVal)) * plotHeight;

      macdPoints = macdLine
        .map((val, i) => val !== null ? `${getX(i)},${getMacdY(val)}` : '')
        .filter(Boolean)
        .join(' ');
      signalPoints = signalLine
        .map((val, i) => val !== null ? `${getX(i)},${getMacdY(val)}` : '')
        .filter(Boolean)
        .join(' ');

      histogram.forEach((val, i) => {
        if (val !== null) {
          const yZero = getMacdY(0);
          const yVal = getMacdY(val);
          macdHistBars.push({
            x: getX(i) - 2,
            y: Math.min(yZero, yVal),
            w: 4,
            h: Math.abs(yZero - yVal),
            positive: val >= 0
          });
        }
      });
    }

    // Signal Annotation markers: Buy/Sell entry points
    const signalMarkers = [];
    if (selectedDetails.signals?.historyArrays) {
      const { smaShort, smaLong, rsi } = selectedDetails.signals.historyArrays;
      for (let i = 1; i < len; i++) {
        // RSI crossovers
        if (rsi[i] !== null && rsi[i-1] !== null) {
          if (rsi[i-1] > config.rsiOversold && rsi[i] <= config.rsiOversold) {
            signalMarkers.push({ index: i, type: 'BUY', label: 'RSI Oversold' });
          } else if (rsi[i-1] < config.rsiOverbought && rsi[i] >= config.rsiOverbought) {
            signalMarkers.push({ index: i, type: 'SELL', label: 'RSI Overbought' });
          }
        }
        // SMA crossovers
        if (smaShort[i] !== null && smaLong[i] !== null && smaShort[i-1] !== null && smaLong[i-1] !== null) {
          if (smaShort[i-1] <= smaLong[i-1] && smaShort[i] > smaLong[i]) {
            signalMarkers.push({ index: i, type: 'BUY', label: 'SMA Golden Cross' });
          } else if (smaShort[i-1] >= smaLong[i-1] && smaShort[i] < smaLong[i]) {
            signalMarkers.push({ index: i, type: 'SELL', label: 'SMA Death Cross' });
          }
        }
      }
    }

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      plotWidth,
      plotHeight,
      minPrice,
      maxPrice,
      getX,
      getY,
      getRsiY,
      points,
      smaShortPoints,
      smaLongPoints,
      bbArea,
      bbUpperPoints,
      bbLowerPoints,
      bbMiddlePoints,
      rsiPoints,
      macdPoints,
      signalPoints,
      macdHistBars,
      signalMarkers,
      history
    };
  }, [selectedDetails, config]);

  // Handle chart hover interactions
  const handleMouseMove = (e) => {
    if (!chartProps) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    
    const relativeX = clientX - chartProps.paddingLeft;
    if (relativeX < 0 || relativeX > chartProps.plotWidth) {
      setHoverIndex(null);
      return;
    }

    const pct = relativeX / chartProps.plotWidth;
    const index = Math.round(pct * (chartProps.history.length - 1));
    if (index >= 0 && index < chartProps.history.length) {
      setHoverIndex(index);
      setHoverPos({
        x: chartProps.getX(index),
        y: e.clientY - rect.top - 15
      });
    }
  };

  // Config adjustments handlers
  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleToggleAlgo = (algoKey) => {
    setConfig(prev => ({
      ...prev,
      activeAlgos: {
        ...prev.activeAlgos,
        [algoKey]: !prev.activeAlgos[algoKey]
      }
    }));
  };

  // Calculate stats for paper trading open items
  const openPortfolioStats = useMemo(() => {
    let totalValue = 0;
    let initialCapital = 0;
    let totalPnl = 0;

    paperTrades.forEach(trade => {
      if (trade.status === 'OPEN') {
        const symbolPrice = analyzedResults[trade.symbol]?.price || trade.entryPrice;
        const currentVal = trade.quantity * symbolPrice;
        const entryVal = trade.quantity * trade.entryPrice;
        const pnl = trade.action === 'BUY' ? (currentVal - entryVal) : (entryVal - currentVal);
        
        totalValue += currentVal;
        initialCapital += trade.capital;
        totalPnl += pnl;
      } else {
        totalPnl += trade.pnl || 0;
      }
    });

    return {
      currentValue: parseFloat(totalValue.toFixed(2)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      pnlPercent: initialCapital > 0 ? parseFloat(((totalPnl / initialCapital) * 100).toFixed(2)) : 0
    };
  }, [paperTrades, analyzedResults]);

  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <LineChart className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Multi-Algo Trade Studio</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
              title="View help & usage guide"
            >
              <Info className="h-4 w-4" />
            </button>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Scan markets with SMA cross, RSI, MACD, and Bollinger strategies concurrently. Execute simulated trades and track performance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-1.5 border rounded-xl text-xs font-semibold cursor-pointer outline-none transition-colors focus:border-[var(--primary)]"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="1mo">1 Month History</option>
            <option value="3mo">3 Months History</option>
            <option value="6mo">6 Months History</option>
            <option value="1y">1 Year History</option>
          </select>
          <button
            onClick={() => fetchMarketData(symbols, range)}
            className="fx-btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Scan Updates</span>
          </button>
        </div>
      </div>

      {tradeActionMessage && (
        <div
          className="p-3.5 rounded-xl border flex items-center gap-2.5 text-xs animate-in slide-in-from-top-4 duration-300"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderColor: 'rgba(16,185,129,0.3)',
            color: '#10b981'
          }}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{tradeActionMessage.text}</span>
        </div>
      )}

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>
              {signalsSummary.buyCount}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Buy Signals Active</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-400 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>
              {signalsSummary.sellCount}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sell Signals Active</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-zinc-500/10 text-zinc-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>
              {signalsSummary.holdCount}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Neutral Hold Assets</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 shrink-0">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-xl font-bold font-mono ${openPortfolioStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {openPortfolioStats.totalPnl >= 0 ? '+' : ''}${openPortfolioStats.totalPnl.toLocaleString()}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Simulated P&amp;L ({openPortfolioStats.pnlPercent}%)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Symbols Search & Autocomplete */}
          <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
              Symbol Scanner List
            </h2>
            
            {/* Search Input Box */}
            <div ref={searchContainerRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search & Add Ticker..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowRecommendations(true);
                  }}
                  onFocus={() => setShowRecommendations(true)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs font-mono rounded-xl outline-none border focus:border-[var(--primary)]"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* Recommendations Dropdown */}
              {showRecommendations && (searchQuery.trim() !== '') && (
                <div
                  className="absolute left-0 right-0 mt-1.5 rounded-xl border shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-zinc-800/40"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  {searchLoading ? (
                    <div className="p-3 text-[10px] font-mono text-[var(--text-muted)] text-center flex items-center justify-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin text-[var(--primary)]" />
                      <span>Fetching ticker matches...</span>
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="p-3 text-[10px] font-mono text-[var(--text-muted)] text-center">
                      No matching tickers found
                    </div>
                  ) : (
                    recommendations.map((item) => (
                      <div
                        key={item.symbol}
                        onClick={() => handleSelectRecommendation(item)}
                        className="p-2.5 text-left hover:bg-[var(--primary-faint)]/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs" style={{ color: 'var(--foreground)' }}>{item.symbol}</span>
                          <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-zinc-800 text-zinc-500 uppercase">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">{item.name}</div>
                        <div className="text-[8px] text-zinc-500 font-mono mt-0.5">{item.exchange} Exchange</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Configured Tickers list */}
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {symbols.map(sym => (
                <div
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono cursor-pointer transition-colors border ${selectedSymbol === sym ? 'bg-[var(--primary-faint)] border-[var(--primary-border)]' : 'hover:bg-[var(--background)] border-transparent'}`}
                  style={{ color: 'var(--foreground)' }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold">{sym}</span>
                    {analyzedResults[sym] && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        analyzedResults[sym].signals?.sentiment.includes('BUY') ? 'bg-emerald-950/40 text-emerald-400' :
                        analyzedResults[sym].signals?.sentiment.includes('SELL') ? 'bg-red-950/40 text-red-400' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {analyzedResults[sym].signals?.sentiment}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSymbol(sym);
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Strategies Checkbox Config */}
          <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
              Active Algorithms
            </h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>SMA Crossover</span>
                <input
                  type="checkbox"
                  checked={config.activeAlgos.sma}
                  onChange={() => handleToggleAlgo('sma')}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>RSI Technicals</span>
                <input
                  type="checkbox"
                  checked={config.activeAlgos.rsi}
                  onChange={() => handleToggleAlgo('rsi')}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>MACD Oscillator</span>
                <input
                  type="checkbox"
                  checked={config.activeAlgos.macd}
                  onChange={() => handleToggleAlgo('macd')}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Bollinger Bands</span>
                <input
                  type="checkbox"
                  checked={config.activeAlgos.bb}
                  onChange={() => handleToggleAlgo('bb')}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Strategy parameters adjustment */}
          <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
              Parameter Adjustments
            </h2>
            <div className="space-y-4">
              
              {/* RSI Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                  <span>RSI Limit (Oversold)</span>
                  <span className="font-mono text-[var(--foreground)]">{config.rsiOversold}</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="45"
                  value={config.rsiOversold}
                  onChange={(e) => handleConfigChange('rsiOversold', parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                  <span>RSI Limit (Overbought)</span>
                  <span className="font-mono text-[var(--foreground)]">{config.rsiOverbought}</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="85"
                  value={config.rsiOverbought}
                  onChange={(e) => handleConfigChange('rsiOverbought', parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>

              {/* SMA lengths */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">SMA Short</label>
                  <input
                    type="number"
                    min="5"
                    max="20"
                    value={config.smaShortPeriod}
                    onChange={(e) => handleConfigChange('smaShortPeriod', parseInt(e.target.value) || 10)}
                    className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono outline-none focus:border-[var(--primary)]"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">SMA Long</label>
                  <input
                    type="number"
                    min="25"
                    max="60"
                    value={config.smaLongPeriod}
                    onChange={(e) => handleConfigChange('smaLongPeriod', parseInt(e.target.value) || 30)}
                    className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono outline-none focus:border-[var(--primary)]"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              {/* BB stdDev */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                  <span>BB Standard Deviation</span>
                  <span className="font-mono text-[var(--foreground)]">{config.bBandsStdDev}σ</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="3.0"
                  step="0.1"
                  value={config.bBandsStdDev}
                  onChange={(e) => handleConfigChange('bBandsStdDev', parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Trading Cockpit & Charts */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Main Tickers matrix table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--background)' }}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Market Signals Matrix
              </h2>
              <span className="text-[10px] font-mono text-zinc-500">
                Click any symbol row below to load detailed technical chart overlays
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono bg-zinc-950/20" style={{ borderColor: 'var(--border-subtle)' }}>
                    <th className="p-3">Symbol</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">24H Change</th>
                    <th className="p-3 text-center">Sentiment Signal</th>
                    <th className="p-3 text-center">Algo Votes (SMA / RSI / MACD / BB)</th>
                    <th className="p-3 text-right">Entry Range</th>
                    <th className="p-3 text-right">Target (SL / TP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40" style={{ color: 'var(--foreground)' }}>
                  {symbols.map(sym => {
                    const data = analyzedResults[sym];
                    if (!data) {
                      return (
                        <tr key={sym} className="text-xs">
                          <td className="p-3 font-mono font-bold">{sym}</td>
                          <td colSpan="6" className="p-3 text-[var(--text-muted)] text-center">Loading market data...</td>
                        </tr>
                      );
                    }

                    const sig = data.signals;
                    const changeColor = data.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400';

                    // Form vote bullets color dots
                    const getVoteDot = (algoKey) => {
                      if (!config.activeAlgos[algoKey]) return <span className="h-2 w-2 rounded-full bg-zinc-700/80" title={`${algoKey} disabled`} />;
                      const vote = sig.signals[algoKey];
                      if (!vote || vote.action === 'HOLD') return <span className="h-2 w-2 rounded-full bg-zinc-500" title={`${algoKey}: Hold`} />;
                      return vote.action === 'BUY' 
                        ? <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title={`${algoKey}: ${vote.detail}`} />
                        : <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" title={`${algoKey}: ${vote.detail}`} />;
                    };

                    return (
                      <tr
                        key={sym}
                        onClick={() => setSelectedSymbol(sym)}
                        className={`text-xs cursor-pointer hover:bg-zinc-800/10 transition-colors ${selectedSymbol === sym ? 'bg-[var(--primary-faint)]/50 font-semibold' : ''}`}
                      >
                        <td className="p-3">
                          <div className="font-mono font-bold">{sym}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[130px]">{data.name}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right font-mono ${changeColor}`}>
                          {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                            sig.sentiment === 'STRONG BUY' ? 'bg-emerald-600 text-white' :
                            sig.sentiment === 'BUY' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                            sig.sentiment === 'STRONG SELL' ? 'bg-red-600 text-white' :
                            sig.sentiment === 'SELL' ? 'bg-red-950/40 text-red-400 border border-red-900/30' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {sig.sentiment} ({sig.confidence}%)
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-3">
                            {getVoteDot('sma')}
                            {getVoteDot('rsi')}
                            {getVoteDot('macd')}
                            {getVoteDot('bb')}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-[var(--text-muted)]">
                          ${sig.recommendation.entryMin} - ${sig.recommendation.entryMax}
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span className="text-red-400 font-semibold">${sig.recommendation.sl}</span>
                          <span className="text-zinc-600 mx-1">/</span>
                          <span className="text-emerald-400 font-semibold">${sig.recommendation.tp}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive SVG Chart or Backtest Panel */}
          {selectedDetails && chartProps ? (
            <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-base font-bold text-[var(--foreground)]">{selectedSymbol}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{selectedDetails.name}</div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {selectedDetails.isMock ? 'Simulated Feed' : 'Live Yahoo Feed'}
                  </span>
                </div>

                {/* Subchart View Modes */}
                <div className="fx-tab-group">
                  <button
                    onClick={() => setChartViewMode('price')}
                    className={`fx-tab text-[10px] font-bold uppercase tracking-wider${chartMode === 'price' ? ' active' : ''}`}
                  >
                    Overlay Price
                  </button>
                  <button
                    onClick={() => setChartViewMode('rsi')}
                    className={`fx-tab text-[10px] font-bold uppercase tracking-wider${chartMode === 'rsi' ? ' active' : ''}`}
                  >
                    RSI Wave
                  </button>
                  <button
                    onClick={() => setChartViewMode('macd')}
                    className={`fx-tab text-[10px] font-bold uppercase tracking-wider${chartMode === 'macd' ? ' active' : ''}`}
                  >
                    MACD Bars
                  </button>
                  <button
                    onClick={() => setChartViewMode('backtest')}
                    className={`fx-tab text-[10px] font-bold uppercase tracking-wider${chartMode === 'backtest' ? ' active' : ''}`}
                  >
                    Backtest Report
                  </button>
                </div>
              </div>

              {/* Conditionally render chart vs backtesting report details */}
              {chartMode === 'backtest' ? (
                /* BACKTEST REPORT VIEW */
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 text-center">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Simulated Trades</div>
                      <div className="text-lg font-mono font-bold" style={{ color: 'var(--foreground)' }}>
                        {selectedDetails.backtest?.totalTrades || 0}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 text-center">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Win Rate</div>
                      <div className="text-lg font-mono font-bold text-emerald-400">
                        {selectedDetails.backtest?.winRate || 0}%
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 text-center">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Profit Factor</div>
                      <div className="text-lg font-mono font-bold text-blue-400">
                        {selectedDetails.backtest?.profitFactor || 0}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 text-center">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Net Profit / Loss</div>
                      <div className={`text-lg font-mono font-bold ${(selectedDetails.backtest?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(selectedDetails.backtest?.netProfit || 0) >= 0 ? '+' : ''}${selectedDetails.backtest?.netProfit?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>

                  {/* Backtest trades list */}
                  <div className="border border-zinc-850 rounded-xl overflow-hidden">
                    <div className="p-3 bg-zinc-950/40 border-b border-zinc-850 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                      Simulated Trades Chronology (Starting Capital: $10,000)
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {selectedDetails.backtest?.trades.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                          No trades triggered under the active parameter settings.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-[11px] font-mono">
                          <thead>
                            <tr className="border-b border-zinc-850/50 bg-zinc-900/30 text-zinc-500">
                              <th className="p-2">Type</th>
                              <th className="p-2">Entry Date</th>
                              <th className="p-2 text-right">Entry Price</th>
                              <th className="p-2">Exit Date</th>
                              <th className="p-2 text-right">Exit Price</th>
                              <th className="p-2 text-right">P&amp;L</th>
                              <th className="p-2">Trigger Outcome</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/40 text-[var(--text-muted)]">
                            {selectedDetails.backtest?.trades.map((t, idx) => (
                              <tr key={idx} className="hover:bg-zinc-850/20">
                                <td className="p-2">
                                  <span className={`px-1 py-0.2 rounded font-bold ${t.action === 'BUY' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                                    {t.action}
                                  </span>
                                </td>
                                <td className="p-2">{t.entryTime}</td>
                                <td className="p-2 text-right">${t.entryPrice.toFixed(2)}</td>
                                <td className="p-2">{t.exitTime}</td>
                                <td className="p-2 text-right">${t.exitPrice.toFixed(2)}</td>
                                <td className={`p-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                                </td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    t.reason === 'Take Profit' ? 'bg-emerald-900/20 text-emerald-400' :
                                    t.reason === 'Stop Loss' ? 'bg-red-900/20 text-red-400' :
                                    'bg-zinc-800 text-zinc-400'
                                  }`}>
                                    {t.reason}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* TECHNICAL CHART VIEW WITH OVERLAYS */
                <div className="relative w-full overflow-hidden select-none">
                  <svg
                    viewBox={`0 0 ${chartProps.width} ${chartProps.height}`}
                    className="w-full overflow-visible"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="bbShadedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>

                    {/* Draw grid lines and labels */}
                    {chartMode === 'price' && (
                      <>
                        {/* Price Grid Y Axis ticks */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                          const priceVal = chartProps.minPrice + ratio * (chartProps.maxPrice - chartProps.minPrice);
                          const yCoord = chartProps.getY(priceVal);
                          return (
                            <g key={ratio} className="opacity-40">
                              <line
                                x1={chartProps.paddingLeft}
                                y1={yCoord}
                                x2={chartProps.width - chartProps.paddingRight}
                                y2={yCoord}
                                stroke="var(--border-subtle)"
                                strokeDasharray="4,4"
                              />
                              <text
                                x={chartProps.paddingLeft - 8}
                                y={yCoord + 3}
                                className="text-[9px] font-mono text-right"
                                textAnchor="end"
                                fill="var(--text-muted)"
                              >
                                ${priceVal.toFixed(2)}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    )}

                    {chartMode === 'rsi' && (
                      <>
                        {/* RSI limits guidelines 30 and 70 */}
                        {[30, 50, 70].map((rsiThreshold) => {
                          const yCoord = chartProps.getRsiY(rsiThreshold);
                          const isBoundary = rsiThreshold === 30 || rsiThreshold === 70;
                          return (
                            <g key={rsiThreshold} className={isBoundary ? 'opacity-70' : 'opacity-30'}>
                              <line
                                x1={chartProps.paddingLeft}
                                y1={yCoord}
                                x2={chartProps.width - chartProps.paddingRight}
                                y2={yCoord}
                                stroke={isBoundary ? (rsiThreshold === 70 ? '#f87171' : '#34d399') : 'var(--border-subtle)'}
                                strokeDasharray={isBoundary ? 'none' : '3,3'}
                              />
                              <text
                                x={chartProps.paddingLeft - 8}
                                y={yCoord + 3}
                                className="text-[9px] font-mono font-bold"
                                textAnchor="end"
                                fill={isBoundary ? (rsiThreshold === 70 ? '#f87171' : '#34d399') : 'var(--text-muted)'}
                              >
                                {rsiThreshold}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    )}

                    {chartMode === 'macd' && (
                      <line
                        x1={chartProps.paddingLeft}
                        y1={chartProps.height - chartProps.paddingBottom - (chartProps.plotHeight / 2)}
                        x2={chartProps.width - chartProps.paddingRight}
                        y2={chartProps.height - chartProps.paddingBottom - (chartProps.plotHeight / 2)}
                        stroke="var(--border-subtle)"
                        className="opacity-50"
                      />
                    )}

                    {/* Render Main price chart */}
                    {chartMode === 'price' && (
                      <>
                        {/* Bollinger band envelope path */}
                        {config.activeAlgos.bb && chartProps.bbArea && (
                          <>
                            <polygon points={chartProps.bbArea} fill="url(#bbShadedGradient)" />
                            <polyline points={chartProps.bbUpperPoints} fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1" strokeDasharray="3,3" />
                            <polyline points={chartProps.bbLowerPoints} fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1" strokeDasharray="3,3" />
                          </>
                        )}

                        {/* SMAs */}
                        {config.activeAlgos.sma && chartProps.smaShortPoints && (
                          <polyline points={chartProps.smaShortPoints} fill="none" stroke="#fbbf24" strokeWidth="1.2" className="opacity-80" />
                        )}
                        {config.activeAlgos.sma && chartProps.smaLongPoints && (
                          <polyline points={chartProps.smaLongPoints} fill="none" stroke="#60a5fa" strokeWidth="1.2" className="opacity-80" />
                        )}

                        {/* Suggested plan targets overlays */}
                        {selectedDetails.signals?.recommendation && (
                          <g>
                            {/* Entry Zone rectangle */}
                            <rect
                              x={chartProps.paddingLeft}
                              y={Math.min(chartProps.getY(selectedDetails.signals.recommendation.entryMin), chartProps.getY(selectedDetails.signals.recommendation.entryMax))}
                              width={chartProps.plotWidth}
                              height={Math.abs(chartProps.getY(selectedDetails.signals.recommendation.entryMin) - chartProps.getY(selectedDetails.signals.recommendation.entryMax))}
                              fill="rgba(96,165,250,0.06)"
                              stroke="rgba(96,165,250,0.3)"
                              strokeWidth="0.8"
                              strokeDasharray="3,3"
                            />
                            
                            {/* Take Profit target line */}
                            <line
                              x1={chartProps.paddingLeft}
                              y1={chartProps.getY(selectedDetails.signals.recommendation.tp)}
                              x2={chartProps.width - chartProps.paddingRight}
                              y2={chartProps.getY(selectedDetails.signals.recommendation.tp)}
                              stroke="#10b981"
                              strokeWidth="1.5"
                              strokeDasharray="4,4"
                            />
                            <text
                              x={chartProps.width - chartProps.paddingRight - 6}
                              y={chartProps.getY(selectedDetails.signals.recommendation.tp) - 4}
                              className="text-[8px] font-mono font-bold"
                              textAnchor="end"
                              fill="#10b981"
                            >
                              TARGET TP: ${selectedDetails.signals.recommendation.tp}
                            </text>

                            {/* Stop Loss risk line */}
                            <line
                              x1={chartProps.paddingLeft}
                              y1={chartProps.getY(selectedDetails.signals.recommendation.sl)}
                              x2={chartProps.width - chartProps.paddingRight}
                              y2={chartProps.getY(selectedDetails.signals.recommendation.sl)}
                              stroke="#ef4444"
                              strokeWidth="1.5"
                              strokeDasharray="4,4"
                            />
                            <text
                              x={chartProps.width - chartProps.paddingRight - 6}
                              y={chartProps.getY(selectedDetails.signals.recommendation.sl) - 4}
                              className="text-[8px] font-mono font-bold"
                              textAnchor="end"
                              fill="#ef4444"
                            >
                              STOP LOSS: ${selectedDetails.signals.recommendation.sl}
                            </text>
                          </g>
                        )}

                        {/* Price Line */}
                        <polyline points={chartProps.points} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
                        
                        {/* Fill area under price line */}
                        <path
                          d={`M ${chartProps.paddingLeft} ${chartProps.height - chartProps.paddingBottom} L ${chartProps.points} L ${chartProps.width - chartProps.paddingRight} ${chartProps.height - chartProps.paddingBottom} Z`}
                          fill="url(#chartGradient)"
                        />

                        {/* Buy / Sell crossover signals */}
                        {chartProps.signalMarkers.map((marker, i) => {
                          const x = chartProps.getX(marker.index);
                          const price = chartProps.history[marker.index].close;
                          const y = chartProps.getY(price);
                          
                          return (
                            <g key={i} className="cursor-help">
                              <title>{marker.label}</title>
                              {marker.type === 'BUY' ? (
                                <polygon
                                  points={`${x},${y-8} ${x-6},${y+2} ${x+6},${y+2}`}
                                  fill="#34d399"
                                  stroke="#10b981"
                                  strokeWidth="1"
                                />
                              ) : (
                                <polygon
                                  points={`${x},${y+8} ${x-6},${y-2} ${x+6},${y-2}`}
                                  fill="#f87171"
                                  stroke="#ef4444"
                                  strokeWidth="1"
                                />
                              )}
                            </g>
                          );
                        })}
                      </>
                    )}

                    {/* Render RSI chart */}
                    {chartMode === 'rsi' && chartProps.rsiPoints && (
                      <polyline points={chartProps.rsiPoints} fill="none" stroke="var(--primary)" strokeWidth="2" />
                    )}

                    {/* Render MACD chart */}
                    {chartMode === 'macd' && (
                      <>
                        {/* Histogram bars */}
                        {chartProps.macdHistBars.map((bar, idx) => (
                          <rect
                            key={idx}
                            x={bar.x}
                            y={bar.y}
                            width={bar.w}
                            height={bar.h}
                            fill={bar.positive ? 'rgba(52,211,153,0.45)' : 'rgba(248,113,113,0.45)'}
                            stroke={bar.positive ? '#10b981' : '#ef4444'}
                            strokeWidth="0.5"
                          />
                        ))}
                        {/* MACD and Signal lines */}
                        {chartProps.macdPoints && (
                          <polyline points={chartProps.macdPoints} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
                        )}
                        {chartProps.signalPoints && (
                          <polyline points={chartProps.signalPoints} fill="none" stroke="#fbbf24" strokeWidth="1.5" />
                        )}
                      </>
                    )}

                    {/* Vertical Hover Guides */}
                    {hoverIndex !== null && (
                      <g>
                        <line
                          x1={chartProps.getX(hoverIndex)}
                          y1={chartProps.paddingTop}
                          x2={chartProps.getX(hoverIndex)}
                          y2={chartProps.height - chartProps.paddingBottom}
                          stroke="var(--border-subtle)"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={chartProps.getX(hoverIndex)}
                          cy={chartProps.getY(chartProps.history[hoverIndex].close)}
                          r="5"
                          fill="var(--primary)"
                          stroke="var(--card)"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </svg>

                  {/* Floating tooltip */}
                  {hoverIndex !== null && chartProps.history[hoverIndex] && (
                    <div
                      className="absolute z-20 p-3 rounded-xl border pointer-events-none shadow-lg text-[10px] space-y-1 font-mono font-semibold"
                      style={{
                        left: `${hoverPos.x + 10}px`,
                        top: `${hoverPos.y}px`,
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)'
                      }}
                    >
                      <div className="text-zinc-500 border-b border-zinc-800 pb-1 mb-1">
                        {chartProps.history[hoverIndex].date}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Close:</span>
                        <span className="font-bold text-zinc-300">
                          ${chartProps.history[hoverIndex].close.toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Mode specific tooltip additions */}
                      {chartMode === 'price' && (
                        <>
                          {config.activeAlgos.sma && selectedDetails.signals?.historyArrays?.smaShort && (
                            <div className="flex justify-between gap-4 text-[#fbbf24]">
                              <span>SMA({config.smaShortPeriod}):</span>
                              <span>
                                {selectedDetails.signals.historyArrays.smaShort[hoverIndex] 
                                  ? `$${selectedDetails.signals.historyArrays.smaShort[hoverIndex].toFixed(2)}` 
                                  : 'N/A'}
                              </span>
                            </div>
                          )}
                          {config.activeAlgos.bb && selectedDetails.signals?.historyArrays?.bb && (
                            <div className="flex justify-between gap-4 text-blue-400">
                              <span>BB bands (L/U):</span>
                              <span>
                                {selectedDetails.signals.historyArrays.bb.lower[hoverIndex]
                                  ? `$${selectedDetails.signals.historyArrays.bb.lower[hoverIndex].toFixed(1)} / $${selectedDetails.signals.historyArrays.bb.upper[hoverIndex].toFixed(1)}`
                                  : 'N/A'}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {chartMode === 'rsi' && selectedDetails.signals?.historyArrays?.rsi && (
                        <div className="flex justify-between gap-4 text-[var(--primary)]">
                          <span>RSI:</span>
                          <span>
                            {selectedDetails.signals.historyArrays.rsi[hoverIndex]
                              ? selectedDetails.signals.historyArrays.rsi[hoverIndex].toFixed(1)
                              : 'N/A'}
                          </span>
                        </div>
                      )}

                      {chartMode === 'macd' && selectedDetails.signals?.historyArrays?.macd && (
                        <>
                          <div className="flex justify-between gap-4 text-blue-400">
                            <span>MACD:</span>
                            <span>
                              {selectedDetails.signals.historyArrays.macd.macdLine[hoverIndex]
                                ? selectedDetails.signals.historyArrays.macd.macdLine[hoverIndex].toFixed(3)
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 text-[#fbbf24]">
                            <span>Signal:</span>
                            <span>
                              {selectedDetails.signals.historyArrays.macd.signalLine[hoverIndex]
                                ? selectedDetails.signals.historyArrays.macd.signalLine[hoverIndex].toFixed(3)
                                : 'N/A'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Suggestions Execution Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="md:col-span-2 p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Suggested execution parameters</span>
                    <span className="text-[10px] font-mono text-zinc-500">Consensus Strategy</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3.5 rounded-lg bg-[var(--background)]">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Recommended Entry</div>
                      <div className="text-xs font-mono font-bold text-[var(--foreground)]">
                        ${selectedDetails.signals.recommendation.entryMin} - ${selectedDetails.signals.recommendation.entryMax}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[var(--background)]">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Stop Loss</div>
                      <div className="text-xs font-mono font-bold text-red-400">
                        ${selectedDetails.signals.recommendation.sl}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[var(--background)]">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Take Profit Target</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        ${selectedDetails.signals.recommendation.tp}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulation execute box */}
                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/40 flex flex-col justify-between gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Simulated Capital Allocations ($)</label>
                    <input
                      type="number"
                      value={simTradeAmount}
                      onChange={(e) => setSimTradeAmount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono border rounded-lg outline-none bg-[var(--background)] text-[var(--foreground)] border-zinc-850"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecutePaperTrade(selectedSymbol, 'BUY', selectedDetails.price)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-[var(--background)] font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      <span>Simulate Buy</span>
                    </button>
                    <button
                      onClick={() => handleExecutePaperTrade(selectedSymbol, 'SELL', selectedDetails.price)}
                      className="flex-1 bg-red-650 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="h-3 w-3 transform rotate-180" />
                      <span>Simulate Sell</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : null}

          {/* Paper Trading Ledger Portfolio */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--background)' }}>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[var(--primary)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                  Paper Trading Portfolio Ledger
                </h2>
              </div>
              {paperTrades.length > 0 && (
                <button
                  onClick={handleClearPortfolio}
                  className="text-[10px] font-mono font-bold hover:underline cursor-pointer"
                  style={{ color: 'var(--primary)' }}
                >
                  Reset Ledger
                </button>
              )}
            </div>
            
            {paperTrades.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs space-y-1.5">
                <p className="font-semibold text-zinc-400">No active paper positions in database</p>
                <p className="text-[10px]">Use the "Simulate" tools in the cockpit details to open simulated long/short trades.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono bg-zinc-950/20" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="p-3">Asset</th>
                      <th className="p-3">Action</th>
                      <th className="p-3 text-right">Entry Price</th>
                      <th className="p-3 text-right font-mono">Quantity</th>
                      <th className="p-3 text-right">Position Value</th>
                      <th className="p-3 text-right">Real-Time P&amp;L</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-xs" style={{ color: 'var(--foreground)' }}>
                    {paperTrades.map(trade => {
                      const latestPrice = analyzedResults[trade.symbol]?.price || trade.entryPrice;
                      const entryVal = trade.quantity * trade.entryPrice;
                      const currentVal = trade.quantity * latestPrice;
                      
                      let pnl = 0;
                      if (trade.status === 'OPEN') {
                        pnl = trade.action === 'BUY' ? (currentVal - entryVal) : (entryVal - currentVal);
                      } else {
                        pnl = trade.pnl || 0;
                      }

                      const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                      
                      return (
                        <tr key={trade.id} className="hover:bg-zinc-800/5">
                          <td className="p-3 font-mono font-bold">{trade.symbol}</td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold ${trade.action === 'BUY' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                              {trade.action}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">${trade.entryPrice.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-[var(--text-muted)]">{trade.quantity}</td>
                          <td className="p-3 text-right font-mono">
                            ${(trade.status === 'OPEN' ? currentVal : entryVal).toFixed(2)}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${pnlColor}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {trade.status === 'OPEN' ? (
                              <button
                                onClick={() => handleClosePaperTrade(trade.id, latestPrice)}
                                className="px-2.5 py-0.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 rounded text-[10px] font-mono cursor-pointer transition-colors"
                              >
                                Close Trade
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                Closed @ ${trade.exitPrice?.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Info Help Modal Guide */}
      {infoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-xl flex flex-col max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <Info className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Multi-Algo Studio Guide</h3>
              </div>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs space-y-4 font-normal leading-relaxed text-[var(--foreground)]">
              <p>
                The **Multi-Algo Trade Studio** scans multiple assets in real-time, fetching quotes and historical close prices via Yahoo Finance (leveraging client proxies).
              </p>

              <div className="space-y-2">
                <p className="font-bold border-b border-zinc-800 pb-1 uppercase tracking-wider font-mono text-zinc-400">Supported Indicators</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-bold text-[var(--primary)]">SMA Cross Crossover</span>: Golden Cross (when short SMA crosses above long SMA) triggers buy; Death Cross (short crosses below long) triggers sell.
                  </li>
                  <li>
                    <span className="font-bold text-[var(--primary)]">RSI (Relative Strength Index)</span>: Measures price velocity. RSI &lt;= 30 indicates oversold conditions (Buy), while RSI &gt;= 70 indicates overbought conditions (Sell).
                  </li>
                  <li>
                    <span className="font-bold text-[var(--primary)]">MACD (Moving Average Convergence Divergence)</span>: Tracks trend momentum. Bullish crossovers (MACD Line crossing above Signal Line) flag buys; bearish crossovers flag sells.
                  </li>
                  <li>
                    <span className="font-bold text-[var(--primary)]">Bollinger Bands</span>: Standard deviation volatility channels. Touching or breaking below the Lower Band indicates oversold conditions (Buy); touching the Upper Band indicates overbought conditions (Sell).
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold border-b border-zinc-800 pb-1 uppercase tracking-wider font-mono text-zinc-400">Trade Target Calculations</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    **Suggested Entry**: Clamped within a 0.2% variance of the current market price.
                  </li>
                  <li>
                    **Stop Loss**: Positioned just outside the Bollinger Band boundaries or standard 2% thresholds.
                  </li>
                  <li>
                    **Take Profit**: Calibrated to ensure a minimum 1:2.2 Risk-to-Reward ratio relative to the entry price and SL.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold border-b border-zinc-800 pb-1 uppercase tracking-wider font-mono text-zinc-400">Consensus &amp; Paper Portfolios</p>
                <p>
                  The aggregate **Sentiment** requires agreement among active indicators. If a symbol yields a signal, you can enter a simulated trade into the portfolio ledger to track unrealized gains and closed trade metrics.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="fx-btn-primary px-4 py-2"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
