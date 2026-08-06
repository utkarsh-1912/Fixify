"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Globe2, Clock, Search, BarChart3, Activity, X, Pause, Play, Info, ChevronDown, MapPin, Star, ArrowRightLeft
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const REGIONS = ["All", "Americas", "Europe", "Asia-Pacific", "South Asia", "Middle East", "Africa"];
const SESSION_COLORS = { pre: "#f59e0b", regular: "#10b981", post: "#8b5cf6", closed: "#3f3f46" };
const SESSION_LABELS = { pre: "Pre-Market", regular: "In Session", post: "Post-Market", closed: "Closed" };

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "local", label: "Local Time" },
  { value: "America/New_York", label: "EST/EDT (New York)" },
  { value: "America/Chicago", label: "CST/CDT (Chicago)" },
  { value: "America/Los_Angeles", label: "PST/PDT (Los Angeles)" },
  { value: "America/Sao_Paulo", label: "BRT (São Paulo)" },
  { value: "Europe/London", label: "GMT/BST (London)" },
  { value: "Europe/Paris", label: "CET/CEST (Paris)" },
  { value: "Europe/Moscow", label: "MSK (Moscow)" },
  { value: "Asia/Dubai", label: "GST (Dubai)" },
  { value: "Asia/Kolkata", label: "IST (India)" },
  { value: "Asia/Singapore", label: "SGT (Singapore)" },
  { value: "Asia/Shanghai", label: "CST (Shanghai)" },
  { value: "Asia/Hong_Kong", label: "HKT (Hong Kong)" },
  { value: "Asia/Tokyo", label: "JST (Tokyo)" },
  { value: "Asia/Seoul", label: "KST (Seoul)" },
  { value: "Australia/Sydney", label: "AEST/AEDT (Sydney)" },
  { value: "Pacific/Auckland", label: "NZST/NZDT (Auckland)" },
];

// Simplified continent outlines [lat, lng] for globe rendering
const CONTINENTS = [
  { name: "NA", pts: [[60,-140],[65,-168],[72,-158],[71,-100],[58,-82],[48,-55],[43,-65],[25,-80],[25,-97],[20,-105],[30,-115],[33,-117],[48,-124],[54,-130],[60,-140]] },
  { name: "SA", pts: [[10,-72],[10,-62],[5,-52],[-3,-41],[-13,-38],[-23,-43],[-33,-52],[-42,-63],[-55,-68],[-53,-73],[-42,-73],[-22,-70],[-5,-77],[2,-80],[10,-72]] },
  { name: "EU", pts: [[36,-10],[36,0],[43,5],[45,13],[40,26],[42,29],[46,37],[55,28],[60,30],[70,28],[71,26],[65,14],[63,5],[58,-5],[50,-10],[43,-9],[36,-10]] },
  { name: "AF", pts: [[37,10],[33,32],[10,42],[5,45],[-2,42],[-12,40],[-25,35],[-35,20],[-35,18],[-28,16],[-12,14],[5,1],[5,-10],[15,-17],[35,-1],[37,10]] },
  { name: "AS", pts: [[42,30],[40,45],[25,57],[25,66],[10,78],[22,88],[10,99],[1,104],[-7,106],[5,119],[20,110],[23,120],[35,127],[40,130],[50,140],[60,148],[68,170],[75,100],[70,70],[55,60],[50,40],[42,30]] },
  { name: "AU", pts: [[-12,130],[-15,132],[-18,141],[-28,153],[-33,152],[-38,147],[-38,140],[-35,137],[-32,115],[-22,114],[-12,130]] },
];

const MARKETS = [
  // Americas
  { id:"nyse",name:"NYSE",fullName:"New York Stock Exchange",region:"Americas",flag:"\u{1F1FA}\u{1F1F8}",lat:40.71,lng:-74.01,timezone:"America/New_York",tier:"major",sessions:{preMarket:{start:4,end:9.5},regular:{start:9.5,end:16},postMarket:{start:16,end:20}}},
  { id:"nasdaq",name:"NASDAQ",fullName:"NASDAQ Stock Market",region:"Americas",flag:"\u{1F1FA}\u{1F1F8}",lat:40.72,lng:-73.99,timezone:"America/New_York",tier:"major",sessions:{preMarket:{start:4,end:9.5},regular:{start:9.5,end:16},postMarket:{start:16,end:20}}},
  { id:"tsx",name:"TSX",fullName:"Toronto Stock Exchange",region:"Americas",flag:"\u{1F1E8}\u{1F1E6}",lat:43.65,lng:-79.38,timezone:"America/Toronto",tier:"major",sessions:{preMarket:{start:7,end:9.5},regular:{start:9.5,end:16},postMarket:{start:16,end:17}}},
  { id:"bmv",name:"BMV",fullName:"Bolsa Mexicana de Valores",region:"Americas",flag:"\u{1F1F2}\u{1F1FD}",lat:19.43,lng:-99.13,timezone:"America/Mexico_City",tier:"minor",sessions:{regular:{start:8.5,end:15}}},
  { id:"b3",name:"B3",fullName:"B3 - Brasil Bolsa Balcão",region:"Americas",flag:"\u{1F1E7}\u{1F1F7}",lat:-23.55,lng:-46.63,timezone:"America/Sao_Paulo",tier:"minor",sessions:{regular:{start:10,end:17.5}}},
  { id:"bcba",name:"BCBA",fullName:"Buenos Aires Stock Exchange",region:"Americas",flag:"\u{1F1E6}\u{1F1F7}",lat:-34.60,lng:-58.38,timezone:"America/Argentina/Buenos_Aires",tier:"minor",sessions:{regular:{start:11,end:17}}},
  // Europe
  { id:"lse",name:"LSE",fullName:"London Stock Exchange",region:"Europe",flag:"\u{1F1EC}\u{1F1E7}",lat:51.51,lng:-0.13,timezone:"Europe/London",tier:"major",sessions:{preMarket:{start:7,end:8},regular:{start:8,end:16.5}}},
  { id:"euronext",name:"Euronext",fullName:"Euronext Paris",region:"Europe",flag:"\u{1F1EB}\u{1F1F7}",lat:48.86,lng:2.35,timezone:"Europe/Paris",tier:"major",sessions:{regular:{start:9,end:17.5}}},
  { id:"xetra",name:"XETRA",fullName:"Deutsche Börse XETRA",region:"Europe",flag:"\u{1F1E9}\u{1F1EA}",lat:50.11,lng:8.68,timezone:"Europe/Berlin",tier:"major",sessions:{regular:{start:9,end:17.5}}},
  { id:"six",name:"SIX",fullName:"SIX Swiss Exchange",region:"Europe",flag:"\u{1F1E8}\u{1F1ED}",lat:47.38,lng:8.54,timezone:"Europe/Zurich",tier:"minor",sessions:{regular:{start:9,end:17.5}}},
  { id:"bme",name:"BME",fullName:"Bolsas y Mercados Españoles",region:"Europe",flag:"\u{1F1EA}\u{1F1F8}",lat:40.42,lng:-3.70,timezone:"Europe/Madrid",tier:"minor",sessions:{regular:{start:9,end:17.5}}},
  { id:"borsa",name:"Borsa Italiana",fullName:"Borsa Italiana (Milan)",region:"Europe",flag:"\u{1F1EE}\u{1F1F9}",lat:45.46,lng:9.19,timezone:"Europe/Rome",tier:"minor",sessions:{regular:{start:9,end:17.42}}},
  { id:"omx",name:"OMX",fullName:"Nasdaq Stockholm",region:"Europe",flag:"\u{1F1F8}\u{1F1EA}",lat:59.33,lng:18.07,timezone:"Europe/Stockholm",tier:"minor",sessions:{regular:{start:9,end:17.5}}},
  { id:"moex",name:"MOEX",fullName:"Moscow Exchange",region:"Europe",flag:"\u{1F1F7}\u{1F1FA}",lat:55.76,lng:37.62,timezone:"Europe/Moscow",tier:"minor",sessions:{preMarket:{start:7,end:10},regular:{start:10,end:18.83}}},
  // Asia-Pacific
  { id:"tse",name:"TSE",fullName:"Tokyo Stock Exchange",region:"Asia-Pacific",flag:"\u{1F1EF}\u{1F1F5}",lat:35.68,lng:139.69,timezone:"Asia/Tokyo",tier:"major",sessions:{regular:{start:9,end:15.5}}},
  { id:"sse",name:"SSE",fullName:"Shanghai Stock Exchange",region:"Asia-Pacific",flag:"\u{1F1E8}\u{1F1F3}",lat:31.23,lng:121.47,timezone:"Asia/Shanghai",tier:"major",sessions:{regular:{start:9.5,end:15}}},
  { id:"szse",name:"SZSE",fullName:"Shenzhen Stock Exchange",region:"Asia-Pacific",flag:"\u{1F1E8}\u{1F1F3}",lat:22.54,lng:114.06,timezone:"Asia/Shanghai",tier:"minor",sessions:{regular:{start:9.5,end:15}}},
  { id:"hkex",name:"HKEX",fullName:"Hong Kong Exchanges",region:"Asia-Pacific",flag:"\u{1F1ED}\u{1F1F0}",lat:22.32,lng:114.17,timezone:"Asia/Hong_Kong",tier:"major",sessions:{preMarket:{start:9,end:9.5},regular:{start:9.5,end:16}}},
  { id:"sgx",name:"SGX",fullName:"Singapore Exchange",region:"Asia-Pacific",flag:"\u{1F1F8}\u{1F1EC}",lat:1.28,lng:103.85,timezone:"Asia/Singapore",tier:"minor",sessions:{regular:{start:9,end:17}}},
  { id:"asx",name:"ASX",fullName:"Australian Securities Exchange",region:"Asia-Pacific",flag:"\u{1F1E6}\u{1F1FA}",lat:-33.87,lng:151.21,timezone:"Australia/Sydney",tier:"major",sessions:{preMarket:{start:7,end:10},regular:{start:10,end:16}}},
  { id:"nzx",name:"NZX",fullName:"New Zealand Exchange",region:"Asia-Pacific",flag:"\u{1F1F3}\u{1F1FF}",lat:-41.29,lng:174.78,timezone:"Pacific/Auckland",tier:"minor",sessions:{regular:{start:10,end:16.75}}},
  { id:"krx",name:"KRX",fullName:"Korea Exchange",region:"Asia-Pacific",flag:"\u{1F1F0}\u{1F1F7}",lat:37.57,lng:126.98,timezone:"Asia/Seoul",tier:"major",sessions:{regular:{start:9,end:15.5}}},
  // South Asia
  { id:"nse",name:"NSE",fullName:"National Stock Exchange of India",region:"South Asia",flag:"\u{1F1EE}\u{1F1F3}",lat:19.08,lng:72.88,timezone:"Asia/Kolkata",tier:"major",sessions:{preMarket:{start:9,end:9.25},regular:{start:9.25,end:15.5}}},
  { id:"psx",name:"PSX",fullName:"Pakistan Stock Exchange",region:"South Asia",flag:"\u{1F1F5}\u{1F1F0}",lat:24.86,lng:67.01,timezone:"Asia/Karachi",tier:"minor",sessions:{regular:{start:9.5,end:15.5}}},
  // Middle East
  { id:"tadawul",name:"Tadawul",fullName:"Saudi Stock Exchange",region:"Middle East",flag:"\u{1F1F8}\u{1F1E6}",lat:24.71,lng:46.67,timezone:"Asia/Riyadh",tier:"minor",sessions:{regular:{start:10,end:15}}},
  { id:"dfm",name:"DFM",fullName:"Dubai Financial Market",region:"Middle East",flag:"\u{1F1E6}\u{1F1EA}",lat:25.20,lng:55.27,timezone:"Asia/Dubai",tier:"minor",sessions:{regular:{start:10,end:14}}},
  // Africa
  { id:"jse",name:"JSE",fullName:"Johannesburg Stock Exchange",region:"Africa",flag:"\u{1F1FF}\u{1F1E6}",lat:-26.20,lng:28.04,timezone:"Africa/Johannesburg",tier:"minor",sessions:{regular:{start:9,end:17}}},
  { id:"nse_ke",name:"NSE Kenya",fullName:"Nairobi Securities Exchange",region:"Africa",flag:"\u{1F1F0}\u{1F1EA}",lat:-1.29,lng:36.82,timezone:"Africa/Nairobi",tier:"minor",sessions:{regular:{start:9.5,end:15}}},
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = now.toLocaleString("en-US", { timeZone: timezone });
    return (new Date(tzStr) - new Date(utcStr)) / 3600000;
  } catch { return 0; }
}

function getUTCDecimalHours() {
  const now = new Date();
  return now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
}

function localToUTC(localHour, offset) {
  return ((localHour - offset) % 24 + 24) % 24;
}

function isInSession(utcNow, startUTC, endUTC) {
  if (startUTC <= endUTC) return utcNow >= startUTC && utcNow < endUTC;
  return utcNow >= startUTC || utcNow < endUTC; // wraps midnight
}

function getMarketStatus(market, utcNow) {
  const offset = getTimezoneOffset(market.timezone);
  const sessions = market.sessions;
  const result = { status: "closed", label: "Closed", color: SESSION_COLORS.closed, nextEventLabel: "", nextEventMin: Infinity };

  const checks = [
    { key: "regular", label: "In Session", color: SESSION_COLORS.regular },
    { key: "preMarket", label: "Pre-Market", color: SESSION_COLORS.pre },
    { key: "postMarket", label: "Post-Market", color: SESSION_COLORS.post },
  ];

  for (const c of checks) {
    const s = sessions[c.key];
    if (!s) continue;
    const startUTC = localToUTC(s.start, offset);
    const endUTC = localToUTC(s.end, offset);
    if (isInSession(utcNow, startUTC, endUTC)) {
      const minsLeft = ((endUTC - utcNow + 24) % 24) * 60;
      return { status: c.key === "regular" ? "regular" : c.key === "preMarket" ? "pre" : "post", label: c.label, color: c.color, nextEventLabel: "Closes in", nextEventMin: minsLeft };
    }
  }

  // Find next session to open
  let minMinutesToOpen = Infinity;
  let nextLabel = "";
  for (const c of checks) {
    const s = sessions[c.key];
    if (!s) continue;
    const startUTC = localToUTC(s.start, offset);
    const minsToOpen = ((startUTC - utcNow + 24) % 24) * 60;
    if (minsToOpen > 0 && minsToOpen < minMinutesToOpen) {
      minMinutesToOpen = minsToOpen;
      nextLabel = c.key === "regular" ? "Opens in" : c.key === "preMarket" ? "Pre-market in" : "Post-market in";
    }
  }
  result.nextEventLabel = nextLabel;
  result.nextEventMin = minMinutesToOpen;
  return result;
}

function formatCountdown(minutes) {
  if (!isFinite(minutes) || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatUTCTime(date) {
  return date.toISOString().slice(11, 19) + " UTC";
}

function formatLocalTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function decimalToTime(dec) {
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Orthographic projection
function projectPoint(lat, lng, centerLng, cx, cy, radius) {
  const latR = (lat * Math.PI) / 180;
  const dlng = ((lng - centerLng) * Math.PI) / 180;
  const cosC = Math.cos(latR) * Math.cos(dlng);
  const x = cx + radius * Math.cos(latR) * Math.sin(dlng);
  const y = cy - radius * Math.sin(latR);
  return { x, y, visible: cosC > 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function GlobalMarketHours() {
  const [viewMode, setViewMode] = useState("globe");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [globeRotation, setGlobeRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredMarket, setHoveredMarket] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pinnedMarkets, setPinnedMarkets] = useState(new Set());
  const [displayTimezone, setDisplayTimezone] = useState("UTC");

  // Toggle pin for a market
  const togglePin = useCallback((marketId) => {
    setPinnedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }, []);

  // Live clock — update every second
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Globe rotation animation
  useEffect(() => {
    if (isPaused || viewMode !== "globe") return;
    const id = setInterval(() => setGlobeRotation((r) => (r + 0.5) % 360), 100);
    return () => clearInterval(id);
  }, [isPaused, viewMode]);

  // Load preferences
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sv = localStorage.getItem("fixify-mh-viewMode");
      if (sv) setViewMode(sv);
      const sr = localStorage.getItem("fixify-mh-regionFilter");
      if (sr) setRegionFilter(sr);
      const ss = localStorage.getItem("fixify-mh-sessionFilter");
      if (ss) setSessionFilter(ss);
      const st = localStorage.getItem("fixify-mh-tierFilter");
      if (st) setTierFilter(st);
      const sp = localStorage.getItem("fixify-mh-pinnedMarkets");
      if (sp) setPinnedMarkets(new Set(JSON.parse(sp)));
      const sdtz = localStorage.getItem("fixify-mh-displayTimezone");
      if (sdtz) setDisplayTimezone(sdtz);
    } catch {}
    setIsLoaded(true);
  }, []);

  // Save preferences
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    try {
      localStorage.setItem("fixify-mh-viewMode", viewMode);
      localStorage.setItem("fixify-mh-regionFilter", regionFilter);
      localStorage.setItem("fixify-mh-sessionFilter", sessionFilter);
      localStorage.setItem("fixify-mh-tierFilter", tierFilter);
      localStorage.setItem("fixify-mh-pinnedMarkets", JSON.stringify([...pinnedMarkets]));
      localStorage.setItem("fixify-mh-displayTimezone", displayTimezone);
    } catch {}
  }, [viewMode, regionFilter, sessionFilter, tierFilter, pinnedMarkets, displayTimezone, isLoaded]);

  const utcNow = getUTCDecimalHours();

  // Compute display timezone offset
  const displayOffset = useMemo(() => {
    if (displayTimezone === "UTC") return 0;
    if (displayTimezone === "local") {
      return typeof window !== "undefined" ? -new Date().getTimezoneOffset() / 60 : 0;
    }
    return getTimezoneOffset(displayTimezone);
  }, [displayTimezone, currentTime]);

  const displayTZLabel = useMemo(() => {
    if (displayTimezone === "UTC") return "UTC";
    if (displayTimezone === "local") return Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop().replace("_", " ");
    const opt = TIMEZONE_OPTIONS.find((t) => t.value === displayTimezone);
    return opt ? opt.label.split(" ")[0] : displayTimezone;
  }, [displayTimezone]);

  // Compute market statuses
  const marketsWithStatus = useMemo(() => {
    return MARKETS.map((m) => ({ ...m, ...getMarketStatus(m, utcNow), isPinned: pinnedMarkets.has(m.id) }));
  }, [utcNow, pinnedMarkets]);

  // Filter and sort markets (pinned first)
  const filteredMarkets = useMemo(() => {
    const filtered = marketsWithStatus.filter((m) => {
      if (regionFilter !== "All" && m.region !== regionFilter) return false;
      if (tierFilter !== "all" && m.tier !== tierFilter) return false;
      if (sessionFilter !== "all" && m.status !== sessionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.fullName.toLowerCase().includes(q) && !m.region.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Sort: pinned markets float to top within each group
    return filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [marketsWithStatus, regionFilter, tierFilter, sessionFilter, searchQuery]);

  // Summary counts
  const counts = useMemo(() => {
    const c = { regular: 0, pre: 0, post: 0, closed: 0 };
    marketsWithStatus.forEach((m) => { c[m.status] = (c[m.status] || 0) + 1; });
    return c;
  }, [marketsWithStatus]);

  // Stars for the globe background
  const stars = useMemo(() => Array.from({ length: 250 }, (_, i) => ({
    cx: Math.random() * 800,
    cy: Math.random() * 800,
    r: Math.random() * 1.5 + 0.3,
    opacity: Math.random() * 0.4 + 0.1,
    delay: Math.random() * 4,
  })), []);

  // ─── Render helpers ──────────────────────────────────────────────────

  const renderSummaryBar = () => (
    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
      {[
        { label: "Open", count: counts.regular, color: SESSION_COLORS.regular },
        { label: "Pre-Market", count: counts.pre, color: SESSION_COLORS.pre },
        { label: "Post-Market", count: counts.post, color: SESSION_COLORS.post },
        { label: "Closed", count: counts.closed, color: SESSION_COLORS.closed },
      ].map((s) => (
        <div key={s.label} className="flex items-center gap-1.5 font-mono">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span style={{ color: "var(--foreground)" }} className="font-semibold">{s.count}</span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );

  const renderFilters = () => (
    <div className="flex flex-wrap items-center gap-3 py-3 px-1" style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Session filter chips */}
      <div className="flex items-center gap-1.5">
        {[
          { key: "all", label: "All", color: "var(--foreground)" },
          { key: "regular", label: "Open", color: SESSION_COLORS.regular },
          { key: "pre", label: "Pre", color: SESSION_COLORS.pre },
          { key: "post", label: "Post", color: SESSION_COLORS.post },
          { key: "closed", label: "Closed", color: SESSION_COLORS.closed },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setSessionFilter(f.key)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: sessionFilter === f.key ? f.color + "22" : "transparent",
              border: `1px solid ${sessionFilter === f.key ? f.color + "66" : "var(--border)"}`,
              color: sessionFilter === f.key ? f.color : "var(--text-muted)",
            }}
          >
            {f.key !== "all" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Region dropdown */}
      <select
        value={regionFilter}
        onChange={(e) => setRegionFilter(e.target.value)}
        className="fx-input py-1 text-[11px] px-2 rounded-lg"
        style={{ minWidth: 100 }}
      >
        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* Tier toggle */}
      <div className="flex items-center gap-1">
        {["all", "major", "minor"].map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className="p-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={{
              background: tierFilter === t ? "var(--primary-faint)" : "transparent",
              border: `1px solid ${tierFilter === t ? "var(--primary-border)" : "var(--border)"}`,
              color: tierFilter === t ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[140px] max-w-[220px]">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search market..."
          className="fx-input w-full py-1 pl-7 pr-2 text-[11px] rounded-lg"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <X className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {/* Timezone converter */}
      <div className="flex items-center gap-1.5">
        <ArrowRightLeft className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        <select
          value={displayTimezone}
          onChange={(e) => setDisplayTimezone(e.target.value)}
          className="fx-input py-1 text-[10px] px-1.5 rounded-lg"
          style={{ minWidth: 120 }}
          title="Display timezone for timeline axis and session times"
        >
          {TIMEZONE_OPTIONS.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </div>

      {/* Pinned count badge */}
      {pinnedMarkets.size > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono" style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15" }}>
          <Star className="h-3 w-3" style={{ fill: "#facc15" }} />
          {pinnedMarkets.size} pinned
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 ml-auto" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
        <button
          onClick={() => setViewMode("globe")}
          className="p-1.5 rounded-l-[7px] transition-all"
          style={{ background: viewMode === "globe" ? "var(--primary-faint)" : "transparent", color: viewMode === "globe" ? "var(--primary)" : "var(--text-muted)" }}
          title="Globe View"
        >
          <Globe2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("timeline")}
          className="p-1.5 rounded-r-[7px] transition-all"
          style={{ background: viewMode === "timeline" ? "var(--primary-faint)" : "transparent", color: viewMode === "timeline" ? "var(--primary)" : "var(--text-muted)" }}
          title="Timeline View"
        >
          <BarChart3 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ─── GLOBE VIEW ──────────────────────────────────────────────────────

  const renderGlobe = () => {
    const W = 800, H = 800, cx = 400, cy = 400, R = 280;
    const centerLng = globeRotation;

    // Project continent outlines
    const continentPaths = CONTINENTS.map((cont) => {
      const segments = [];
      let currentSeg = [];
      cont.pts.forEach((p) => {
        const proj = projectPoint(p[0], p[1], centerLng, cx, cy, R);
        if (proj.visible) {
          currentSeg.push(`${proj.x.toFixed(1)},${proj.y.toFixed(1)}`);
        } else {
          if (currentSeg.length > 1) segments.push(currentSeg);
          currentSeg = [];
        }
      });
      if (currentSeg.length > 1) segments.push(currentSeg);
      return segments;
    });

    // Project grid lines — latitude
    const latLines = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let dlng = -89; dlng <= 89; dlng += 3) {
        const lng = centerLng + dlng;
        const proj = projectPoint(lat, lng, centerLng, cx, cy, R);
        if (proj.visible) pts.push(`${proj.x.toFixed(1)},${proj.y.toFixed(1)}`);
      }
      if (pts.length > 1) latLines.push(pts);
    }

    // Longitude meridians
    const lngLines = [];
    for (let lng = 0; lng < 360; lng += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        const proj = projectPoint(lat, lng, centerLng, cx, cy, R);
        if (proj.visible) pts.push(`${proj.x.toFixed(1)},${proj.y.toFixed(1)}`);
        else {
          if (pts.length > 1) lngLines.push(pts);
          pts.length = 0;
        }
      }
      if (pts.length > 1) lngLines.push(pts);
    }

    // Project market dots
    const marketDots = filteredMarkets.map((m) => {
      const proj = projectPoint(m.lat, m.lng, centerLng, cx, cy, R);
      return { ...m, ...proj, dotSize: m.tier === "major" ? 6 : 4 };
    }).filter((m) => m.visible);

    return (
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Globe SVG */}
        <div className="relative flex-1 flex justify-center" style={{ minHeight: 500 }}>
          <svg viewBox="0 0 800 800" className="w-full max-w-[600px]" style={{ filter: "drop-shadow(0 0 60px rgba(56,189,248,0.08))" }}>
            <defs>
              <radialGradient id="globe-bg" cx="40%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#0f2847" />
                <stop offset="60%" stopColor="#091a33" />
                <stop offset="100%" stopColor="#050d1a" />
              </radialGradient>
              <radialGradient id="atmosphere" cx="50%" cy="50%" r="50%">
                <stop offset="88%" stopColor="transparent" />
                <stop offset="96%" stopColor="rgba(56,189,248,0.07)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0.15)" />
              </radialGradient>
              <radialGradient id="inner-glow" cx="35%" cy="30%" r="60%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.06)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <filter id="dot-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="pulse-glow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Stars */}
            {stars.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity}
                style={{ animation: `twinkle ${2 + s.delay}s ease-in-out infinite alternate`, animationDelay: `${s.delay}s` }} />
            ))}

            {/* Orbit rings (decorative) */}
            <ellipse cx={cx} cy={cy} rx={R + 50} ry={80} fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth="0.5"
              transform={`rotate(-20 ${cx} ${cy})`} />
            <ellipse cx={cx} cy={cy} rx={R + 70} ry={60} fill="none" stroke="rgba(139,92,246,0.05)" strokeWidth="0.5"
              transform={`rotate(15 ${cx} ${cy})`} />
            <ellipse cx={cx} cy={cy} rx={R + 40} ry={100} fill="none" stroke="rgba(245,158,11,0.04)" strokeWidth="0.5"
              transform={`rotate(-35 ${cx} ${cy})`} />

            {/* Globe circle */}
            <circle cx={cx} cy={cy} r={R} fill="url(#globe-bg)" stroke="rgba(56,189,248,0.15)" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={R} fill="url(#inner-glow)" />

            {/* Grid - Latitude */}
            {latLines.map((pts, i) => (
              <polyline key={`lat-${i}`} points={pts.join(" ")} fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.5" />
            ))}

            {/* Grid - Longitude */}
            {lngLines.map((pts, i) => (
              <polyline key={`lng-${i}`} points={pts.join(" ")} fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.5" />
            ))}

            {/* Continent outlines */}
            {continentPaths.map((segs, ci) =>
              segs.map((seg, si) => (
                <polyline key={`cont-${ci}-${si}`} points={seg.join(" ")} fill="none" stroke="rgba(148,226,213,0.18)" strokeWidth="1.2" strokeLinejoin="round" />
              ))
            )}

            {/* Market dots */}
            {marketDots.map((m) => (
              <g key={m.id} onMouseEnter={() => setHoveredMarket(m.id)} onMouseLeave={() => setHoveredMarket(null)} style={{ cursor: "pointer" }}>
                {/* Pulse ring for open markets */}
                {m.status === "regular" && (
                  <circle cx={m.x} cy={m.y} r={m.dotSize + 4} fill="none" stroke={m.color} strokeWidth="1.5" opacity="0.4"
                    style={{ animation: "pulse-ring 2s ease-out infinite" }} />
                )}
                {/* Glow halo */}
                <circle cx={m.x} cy={m.y} r={m.dotSize + 2} fill={m.color} opacity="0.2" filter="url(#dot-glow)" />
                {/* Main dot */}
                <circle cx={m.x} cy={m.y} r={m.dotSize} fill={m.color} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"
                  filter={m.status === "regular" ? "url(#pulse-glow)" : undefined} />
                {/* Label (on hover or for major) */}
                {(hoveredMarket === m.id || m.tier === "major") && (
                  <g>
                    <rect x={m.x + m.dotSize + 6} y={m.y - 10} width={m.name.length * 7 + 12} height={20} rx={4}
                      fill="rgba(0,0,0,0.85)" stroke={m.color} strokeWidth="0.5" />
                    <text x={m.x + m.dotSize + 12} y={m.y + 4} fill="white" fontSize="11" fontFamily="monospace" fontWeight="600">
                      {m.name}
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* Atmosphere overlay */}
            <circle cx={cx} cy={cy} r={R + 2} fill="url(#atmosphere)" />
          </svg>

          {/* Pause/Play button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--border)", color: "var(--text-muted)", backdropFilter: "blur(8px)" }}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? "Resume" : "Rotating"}
          </button>
        </div>

        {/* Market info panel */}
        <div className="w-full lg:w-80 space-y-1 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {REGIONS.filter((r) => r !== "All").map((region) => {
            const regionMarkets = filteredMarkets.filter((m) => m.region === region);
            if (regionMarkets.length === 0) return null;
            return (
              <div key={region}>
                <div className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 mt-2" style={{ color: "var(--text-muted)" }}>
                  {region}
                </div>
                {regionMarkets.map((m) => (
                  <div
                    key={m.id}
                    onMouseEnter={() => setHoveredMarket(m.id)}
                    onMouseLeave={() => setHoveredMarket(null)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-default"
                    style={{
                      background: hoveredMarket === m.id ? "var(--card-hover)" : m.isPinned ? "rgba(250,204,21,0.04)" : "transparent",
                      border: hoveredMarket === m.id ? "1px solid var(--border)" : m.isPinned ? "1px solid rgba(250,204,21,0.15)" : "1px solid transparent",
                    }}
                  >
                    {/* Pin button */}
                    <button onClick={() => togglePin(m.id)} className="flex-shrink-0 transition-all hover:scale-110" title={m.isPinned ? "Unpin" : "Pin market"}>
                      <Star className="h-3.5 w-3.5" style={{ color: m.isPinned ? "#facc15" : "var(--text-faint)", fill: m.isPinned ? "#facc15" : "none" }} />
                    </button>
                    <span className="text-base">{m.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{m.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                      </div>
                      <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{m.fullName}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] font-semibold" style={{ color: m.color }}>{m.label}</div>
                      {m.nextEventMin < Infinity && (
                        <div className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                          {m.nextEventLabel} {formatCountdown(m.nextEventMin)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── TIMELINE VIEW ───────────────────────────────────────────────────

  const renderTimeline = () => {
    const grouped = {};
    REGIONS.filter((r) => r !== "All").forEach((r) => { grouped[r] = filteredMarkets.filter((m) => m.region === r); });

    const rowH = 36;
    const leftCol = 220;
    const rightCol = 120;
    const timelineW = 960;
    const hourW = timelineW / 24;
    // Convert UTC "now" into display timezone position
    const displayNow = ((utcNow + displayOffset) % 24 + 24) % 24;
    const nowX = leftCol + (displayNow / 24) * timelineW;

    let yOffset = 0;
    const regionBlocks = [];

    for (const region of REGIONS.filter((r) => r !== "All")) {
      const markets = grouped[region];
      if (!markets || markets.length === 0) continue;
      regionBlocks.push({ type: "header", region, y: yOffset });
      yOffset += 28;
      markets.forEach((m) => {
        regionBlocks.push({ type: "market", market: m, y: yOffset });
        yOffset += rowH;
      });
      yOffset += 8; // gap between regions
    }

    const totalH = yOffset + 40;

    // For each market, compute session bars in display timezone
    const getSessionBars = (market) => {
      const offset = getTimezoneOffset(market.timezone);
      const bars = [];
      const sessionDefs = [
        { key: "preMarket", color: SESSION_COLORS.pre, opacity: 0.6 },
        { key: "regular", color: SESSION_COLORS.regular, opacity: 0.8 },
        { key: "postMarket", color: SESSION_COLORS.post, opacity: 0.6 },
      ];
      for (const sd of sessionDefs) {
        const s = market.sessions[sd.key];
        if (!s) continue;
        const startUTC = localToUTC(s.start, offset);
        const endUTC = localToUTC(s.end, offset);
        // Convert to display timezone
        const startDisp = ((startUTC + displayOffset) % 24 + 24) % 24;
        const endDisp = ((endUTC + displayOffset) % 24 + 24) % 24;
        if (startDisp <= endDisp) {
          bars.push({ x: (startDisp / 24) * timelineW, w: ((endDisp - startDisp) / 24) * timelineW, color: sd.color, opacity: sd.opacity });
        } else {
          // Wraps midnight in display tz: draw two bars
          bars.push({ x: (startDisp / 24) * timelineW, w: ((24 - startDisp) / 24) * timelineW, color: sd.color, opacity: sd.opacity });
          bars.push({ x: 0, w: (endDisp / 24) * timelineW, color: sd.color, opacity: sd.opacity });
        }
      }
      return bars;
    };

    return (
      <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ minWidth: leftCol + timelineW + rightCol + 20, position: "relative" }}>
          {/* Hour labels — in display timezone */}
          <div className="flex" style={{ marginLeft: leftCol, marginBottom: 4 }}>
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="text-[9px] font-mono" style={{ width: i < 24 ? hourW : 0, color: "var(--text-muted)", flexShrink: 0 }}>
                {String(i % 24).padStart(2, "0")}
              </div>
            ))}
            <span className="text-[8px] font-mono ml-1" style={{ color: "var(--text-faint)" }}>{displayTZLabel}</span>
          </div>

          {/* Rows */}
          <div style={{ position: "relative" }}>
            {regionBlocks.map((block, idx) => {
              if (block.type === "header") {
                return (
                  <div key={`hdr-${block.region}`} className="text-[10px] font-bold uppercase tracking-widest px-2 flex items-center gap-2"
                    style={{ height: 28, color: "var(--text-muted)" }}>
                    {block.region}
                  </div>
                );
              }

              const m = block.market;
              const bars = getSessionBars(m);

              return (
                <div key={m.id} className="flex items-center transition-colors" style={{
                    height: rowH, borderBottom: "1px solid var(--border)",
                    background: m.isPinned ? "rgba(250,204,21,0.03)" : "transparent",
                  }}
                  onMouseEnter={() => setHoveredMarket(m.id)} onMouseLeave={() => setHoveredMarket(null)}>
                  {/* Left column */}
                  <div className="flex items-center gap-1.5 px-2 flex-shrink-0" style={{ width: leftCol }}>
                    <button onClick={() => togglePin(m.id)} className="flex-shrink-0 hover:scale-110 transition-transform" title={m.isPinned ? "Unpin" : "Pin"}>
                      <Star className="h-3 w-3" style={{ color: m.isPinned ? "#facc15" : "var(--text-faint)", fill: m.isPinned ? "#facc15" : "none" }} />
                    </button>
                    <span className="text-sm">{m.flag}</span>
                    <span className="text-[11px] font-semibold truncate" style={{ color: "var(--foreground)" }}>{m.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.color }}>{m.label}</span>
                  </div>

                  {/* Timeline bars */}
                  <div className="relative flex-shrink-0" style={{ width: timelineW, height: rowH }}>
                    {/* Hour grid lines */}
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="absolute top-0 bottom-0" style={{ left: i * hourW, width: 1, background: "var(--border)", opacity: 0.3 }} />
                    ))}
                    {/* Session bars — positioned in display timezone */}
                    {bars.map((bar, bi) => (
                      <div key={bi} className="absolute rounded-sm" style={{
                        left: bar.x, width: Math.max(bar.w, 2), top: 6, height: rowH - 12,
                        background: bar.color, opacity: bar.opacity, transition: "opacity 0.2s",
                      }} />
                    ))}
                    {/* Current time needle — in display timezone */}
                    <div className="absolute top-0 bottom-0" style={{ left: (displayNow / 24) * timelineW, width: 2, background: "#ef4444", zIndex: 10, opacity: 0.9 }} />
                  </div>

                  {/* Right column — countdown */}
                  <div className="flex-shrink-0 text-right px-3" style={{ width: rightCol }}>
                    {m.nextEventMin < Infinity && (
                      <div>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.nextEventLabel} </span>
                        <span className="text-[10px] font-mono font-semibold" style={{ color: m.color }}>{formatCountdown(m.nextEventMin)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Current time indicator at top — in display timezone */}
            <div className="absolute top-0 flex flex-col items-center" style={{ left: nowX - 1, zIndex: 20 }}>
              <div className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#ef4444", color: "white", transform: "translateX(-50%)" }}>
                {decimalToTime(displayNow)} {displayTZLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────

  return (
    <div className="fx-page">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse-ring {
          0% { r: 8; opacity: 0.6; }
          100% { r: 20; opacity: 0; }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Page Header */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Globe2 className="h-6 w-6" style={{ color: "var(--primary)" }} />
            Global Market Hours
          </h1>
          <p className="fx-page-subtitle flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: SESSION_COLORS.regular, animation: "live-pulse 1.5s ease-in-out infinite" }} />
              <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: SESSION_COLORS.regular }}>LIVE</span>
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              <Clock className="inline h-3 w-3 mr-1" />
              {formatUTCTime(currentTime)}
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              Local: {formatLocalTime(currentTime)}
            </span>
          </p>
        </div>
        {renderSummaryBar()}
      </div>

      {/* Filters */}
      {renderFilters()}

      {/* Main Content */}
      <div className="mt-5">
        {viewMode === "globe" ? renderGlobe() : renderTimeline()}
      </div>
    </div>
  );
}
