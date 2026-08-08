"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Globe2, Clock, Search, BarChart3, X, Pause, Play, Star, ArrowRightLeft,
  RotateCcw, Info, Cpu, ShieldCheck, Database, Zap, BookOpen, Building2, Maximize2,
  MapPinIcon
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const REGIONS = ["All", "Americas", "Europe", "Asia-Pacific", "South Asia", "Middle East", "Africa"];

const SESSION_COLORS = {
  pre: "#f59e0b",     // Amber
  regular: "#10b981", // Emerald Green
  post: "#8b5cf6",    // Violet
  closed: "#475569",  // Slate Gray
  weekend: "#334155", // Dark Slate
  holiday: "#e11d48", // Rose Red
};

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Coordinated Universal)" },
  { value: "local", label: "Local Device Time" },
  { value: "America/New_York", label: "EST/EDT (New York - NYSE/NASDAQ)" },
  { value: "America/Chicago", label: "CST/CDT (Chicago - CME)" },
  { value: "America/Los_Angeles", label: "PST/PDT (Los Angeles)" },
  { value: "America/Toronto", label: "EST/EDT (Toronto - TSX)" },
  { value: "America/Sao_Paulo", label: "BRT (São Paulo - B3)" },
  { value: "Europe/London", label: "GMT/BST (London - LSE)" },
  { value: "Europe/Paris", label: "CET/CEST (Paris - Euronext)" },
  { value: "Europe/Frankfurt", label: "CET/CEST (Frankfurt - XETRA)" },
  { value: "Europe/Moscow", label: "MSK (Moscow - MOEX)" },
  { value: "Asia/Dubai", label: "GST (Dubai - DFM)" },
  { value: "Asia/Riyadh", label: "AST (Riyadh - Tadawul)" },
  { value: "Asia/Kolkata", label: "IST (India - NSE/BSE)" },
  { value: "Asia/Singapore", label: "SGT (Singapore - SGX)" },
  { value: "Asia/Shanghai", label: "CST (Shanghai - SSE)" },
  { value: "Asia/Hong_Kong", label: "HKT (Hong Kong - HKEX)" },
  { value: "Asia/Tokyo", label: "JST (Tokyo - TSE)" },
  { value: "Asia/Seoul", label: "KST (Seoul - KRX)" },
  { value: "Australia/Sydney", label: "AEST/AEDT (Sydney - ASX)" },
  { value: "Pacific/Auckland", label: "NZST/NZDT (Auckland - NZX)" },
];

const DEFAULT_HOLIDAYS = {
  "01-01": "New Year's Day",
  "04-03": "Good Friday",
  "12-25": "Christmas Day",
};

const EXCHANGE_HOLIDAYS = {
  nyse: { "01-01": "New Year's Day", "01-19": "MLK Jr. Day", "02-16": "Presidents' Day", "04-03": "Good Friday", "05-25": "Memorial Day", "06-19": "Juneteenth", "07-04": "Independence Day", "09-07": "Labor Day", "11-26": "Thanksgiving", "12-25": "Christmas Day" },
  nasdaq: { "01-01": "New Year's Day", "01-19": "MLK Jr. Day", "02-16": "Presidents' Day", "04-03": "Good Friday", "05-25": "Memorial Day", "06-19": "Juneteenth", "07-04": "Independence Day", "09-07": "Labor Day", "11-26": "Thanksgiving", "12-25": "Christmas Day" },
  tsx: { "01-01": "New Year's Day", "02-16": "Family Day", "04-03": "Good Friday", "05-18": "Victoria Day", "07-01": "Canada Day", "08-03": "Civic Holiday", "09-07": "Labour Day", "09-30": "Truth & Reconciliation Day", "10-12": "Thanksgiving", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  bmv: { "01-01": "New Year's Day", "02-02": "Constitution Day", "03-16": "Juarez Birthday", "04-03": "Good Friday", "05-01": "Labor Day", "09-16": "Independence Day", "11-16": "Revolution Day", "12-25": "Christmas Day" },
  b3: { "01-01": "New Year's Day", "03-03": "Carnival Tuesday", "04-03": "Good Friday", "04-21": "Tiradentes Day", "05-01": "Labor Day", "06-19": "Corpus Christi", "09-07": "Independence Day", "10-12": "Our Lady of Aparecida", "11-02": "All Souls Day", "11-15": "Proclamation of Republic", "11-20": "Black Consciousness Day", "12-25": "Christmas Day" },
  lse: { "01-01": "New Year's Day", "04-03": "Good Friday", "04-06": "Easter Monday", "05-04": "Early May Bank Holiday", "05-25": "Spring Bank Holiday", "08-31": "Summer Bank Holiday", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  euronext: { "01-01": "New Year's Day", "04-03": "Good Friday", "04-06": "Easter Monday", "05-01": "Labour Day", "05-08": "Victory Day", "05-14": "Ascension Day", "07-14": "Bastille Day", "11-11": "Armistice Day", "12-25": "Christmas Day" },
  xetra: { "01-01": "New Year's Day", "04-03": "Good Friday", "04-06": "Easter Monday", "05-01": "Labour Day", "05-14": "Ascension Day", "05-25": "Whit Monday", "10-03": "German Unity Day", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  six: { "01-01": "New Year's Day", "01-02": "Berchtoldstag", "04-03": "Good Friday", "04-06": "Easter Monday", "05-14": "Ascension Day", "05-25": "Whit Monday", "08-01": "Swiss National Day", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  tse: { "01-01": "New Year's Day", "01-12": "Coming of Age Day", "02-11": "National Foundation Day", "02-23": "Emperor's Birthday", "03-20": "Vernal Equinox", "04-29": "Showa Day", "05-03": "Constitution Memorial Day", "05-04": "Greenery Day", "05-05": "Children's Day", "07-20": "Marine Day", "09-21": "Respect for Aged Day", "09-22": "Autumnal Equinox", "10-12": "Sports Day", "11-03": "Culture Day", "11-23": "Labor Thanksgiving Day" },
  sse: { "01-01": "New Year's Day", "01-29": "Chinese New Year", "01-30": "Spring Festival", "04-04": "Qingming Festival", "05-01": "Labour Day", "05-31": "Dragon Boat Festival", "10-01": "National Day Golden Week", "10-06": "Mid-Autumn Festival" },
  szse: { "01-01": "New Year's Day", "01-29": "Chinese New Year", "01-30": "Spring Festival", "04-04": "Qingming Festival", "05-01": "Labour Day", "05-31": "Dragon Boat Festival", "10-01": "National Day Golden Week", "10-06": "Mid-Autumn Festival" },
  hkex: { "01-01": "New Year's Day", "01-29": "Lunar New Year Day 1", "01-30": "Lunar New Year Day 2", "04-03": "Good Friday", "04-04": "Ching Ming Festival", "04-06": "Easter Monday", "05-05": "Buddha's Birthday", "05-31": "Dragon Boat Festival", "07-01": "HKSAR Establishment Day", "10-01": "National Day", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  nse: { "01-26": "Republic Day", "02-26": "Mahashivratri", "03-14": "Holi", "04-03": "Good Friday", "04-14": "Dr. Ambedkar Jayanti", "05-01": "Maharashtra Day", "06-07": "Bakri Id / Eid-ul-Adha", "08-15": "Independence Day", "08-27": "Ganesh Chaturthi", "10-02": "Mahatma Gandhi Jayanti", "10-20": "Diwali Laxmi Pujan", "11-05": "Guru Nanak Jayanti", "12-25": "Christmas Day" },
  asx: { "01-01": "New Year's Day", "01-26": "Australia Day", "04-03": "Good Friday", "04-06": "Easter Monday", "04-25": "ANZAC Day", "06-08": "King's Birthday", "12-25": "Christmas Day", "12-26": "Boxing Day" },
  tadawul: { "02-22": "Saudi Founding Day", "03-20": "Eid al-Fitr Holiday", "06-05": "Arafat Day", "06-06": "Eid al-Adha Holiday", "09-23": "Saudi National Day" },
  dfm: { "01-01": "New Year's Day", "03-20": "Eid al-Fitr Holiday", "06-05": "Arafat Day", "06-06": "Eid al-Adha Holiday", "06-27": "Islamic New Year", "09-05": "Prophet's Birthday", "12-01": "Commemoration Day", "12-02": "UAE National Day" },
  jse: { "01-01": "New Year's Day", "03-21": "Human Rights Day", "04-03": "Good Friday", "04-06": "Family Day", "04-27": "Freedom Day", "05-01": "Workers' Day", "06-16": "Youth Day", "08-09": "National Women's Day", "09-24": "Heritage Day", "12-16": "Day of Reconciliation", "12-25": "Christmas Day", "12-26": "Day of Goodwill" },
};

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
  { id:"nyse", name:"NYSE", fullName:"New York Stock Exchange", region:"Americas", code:"US", lat:40.71, lng:-74.01, timezone:"America/New_York", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:4,end:9.5}, regular:{start:9.5,end:16}, postMarket:{start:16,end:20}} },
  { id:"nasdaq", name:"NASDAQ", fullName:"NASDAQ Stock Market", region:"Americas", code:"US", lat:40.72, lng:-73.99, timezone:"America/New_York", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:4,end:9.5}, regular:{start:9.5,end:16}, postMarket:{start:16,end:20}} },
  { id:"tsx", name:"TSX", fullName:"Toronto Stock Exchange", region:"Americas", code:"CA", lat:43.65, lng:-79.38, timezone:"America/Toronto", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:7,end:9.5}, regular:{start:9.5,end:16}, postMarket:{start:16,end:17}} },
  { id:"bmv", name:"BMV", fullName:"Bolsa Mexicana de Valores", region:"Americas", code:"MX", lat:19.43, lng:-99.13, timezone:"America/Mexico_City", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:8.5,end:15}} },
  { id:"b3", name:"B3", fullName:"B3 - Brasil Bolsa Balcão", region:"Americas", code:"BR", lat:-23.55, lng:-46.63, timezone:"America/Sao_Paulo", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:10,end:17.5}} },
  { id:"bcba", name:"BCBA", fullName:"Buenos Aires Stock Exchange", region:"Americas", code:"AR", lat:-34.60, lng:-58.38, timezone:"America/Argentina/Buenos_Aires", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:11,end:17}} },
  
  // Europe
  { id:"lse", name:"LSE", fullName:"London Stock Exchange", region:"Europe", code:"GB", lat:51.51, lng:-0.13, timezone:"Europe/London", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:7,end:8}, regular:{start:8,end:16.5}} },
  { id:"euronext", name:"Euronext", fullName:"Euronext Paris", region:"Europe", code:"FR", lat:48.86, lng:2.35, timezone:"Europe/Paris", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.5}} },
  { id:"xetra", name:"XETRA", fullName:"Deutsche Börse XETRA", region:"Europe", code:"DE", lat:50.11, lng:8.68, timezone:"Europe/Berlin", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.5}} },
  { id:"six", name:"SIX", fullName:"SIX Swiss Exchange", region:"Europe", code:"CH", lat:47.38, lng:8.54, timezone:"Europe/Zurich", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.5}} },
  { id:"bme", name:"BME", fullName:"Bolsas y Mercados Españoles", region:"Europe", code:"ES", lat:40.42, lng:-3.70, timezone:"Europe/Madrid", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.5}} },
  { id:"borsa", name:"Borsa Italiana", fullName:"Borsa Italiana (Milan)", region:"Europe", code:"IT", lat:45.46, lng:9.19, timezone:"Europe/Rome", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.42}} },
  { id:"omx", name:"OMX", fullName:"Nasdaq Stockholm", region:"Europe", code:"SE", lat:59.33, lng:18.07, timezone:"Europe/Stockholm", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17.5}} },
  { id:"moex", name:"MOEX", fullName:"Moscow Exchange", region:"Europe", code:"RU", lat:55.76, lng:37.62, timezone:"Europe/Moscow", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:7,end:10}, regular:{start:10,end:18.83}} },
  
  // Asia-Pacific
  { id:"tse", name:"TSE", fullName:"Tokyo Stock Exchange", region:"Asia-Pacific", code:"JP", lat:35.68, lng:139.69, timezone:"Asia/Tokyo", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:15.5}} },
  { id:"sse", name:"SSE", fullName:"Shanghai Stock Exchange", region:"Asia-Pacific", code:"CN", lat:31.23, lng:121.47, timezone:"Asia/Shanghai", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9.5,end:15}} },
  { id:"szse", name:"SZSE", fullName:"Shenzhen Stock Exchange", region:"Asia-Pacific", code:"CN", lat:22.54, lng:114.06, timezone:"Asia/Shanghai", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9.5,end:15}} },
  { id:"hkex", name:"HKEX", fullName:"Hong Kong Exchanges", region:"Asia-Pacific", code:"HK", lat:22.32, lng:114.17, timezone:"Asia/Hong_Kong", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:9,end:9.5}, regular:{start:9.5,end:16}} },
  { id:"sgx", name:"SGX", fullName:"Singapore Exchange", region:"Asia-Pacific", code:"SG", lat:1.28, lng:103.85, timezone:"Asia/Singapore", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17}} },
  { id:"asx", name:"ASX", fullName:"Australian Securities Exchange", region:"Asia-Pacific", code:"AU", lat:-33.87, lng:151.21, timezone:"Australia/Sydney", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:7,end:10}, regular:{start:10,end:16}} },
  { id:"nzx", name:"NZX", fullName:"New Zealand Exchange", region:"Asia-Pacific", code:"NZ", lat:-41.29, lng:174.78, timezone:"Pacific/Auckland", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:10,end:16.75}} },
  { id:"krx", name:"KRX", fullName:"Korea Exchange", region:"Asia-Pacific", code:"KR", lat:37.57, lng:126.98, timezone:"Asia/Seoul", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:15.5}} },
  
  // South Asia
  { id:"nse", name:"NSE", fullName:"National Stock Exchange of India", region:"South Asia", code:"IN", lat:19.08, lng:72.88, timezone:"Asia/Kolkata", tier:"major", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{preMarket:{start:9,end:9.25}, regular:{start:9.25,end:15.5}} },
  { id:"psx", name:"PSX", fullName:"Pakistan Stock Exchange", region:"South Asia", code:"PK", lat:24.86, lng:67.01, timezone:"Asia/Karachi", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9.5,end:15.5}} },
  
  // Middle East
  { id:"tadawul", name:"Tadawul", fullName:"Saudi Stock Exchange", region:"Middle East", code:"SA", lat:24.71, lng:46.67, timezone:"Asia/Riyadh", tier:"minor", weekendDays:[5,6], tradingDays:"Sun - Thu", sessions:{regular:{start:10,end:15}} },
  { id:"dfm", name:"DFM", fullName:"Dubai Financial Market", region:"Middle East", code:"AE", lat:25.20, lng:55.27, timezone:"Asia/Dubai", tier:"minor", weekendDays:[5,6], tradingDays:"Sun - Thu", sessions:{regular:{start:10,end:14}} },
  
  // Africa
  { id:"jse", name:"JSE", fullName:"Johannesburg Stock Exchange", region:"Africa", code:"ZA", lat:-26.20, lng:28.04, timezone:"Africa/Johannesburg", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9,end:17}} },
  { id:"nse_ke", name:"NSE Kenya", fullName:"Nairobi Securities Exchange", region:"Africa", code:"KE", lat:-1.29, lng:36.82, timezone:"Africa/Nairobi", tier:"minor", weekendDays:[0,6], tradingDays:"Mon - Fri", sessions:{regular:{start:9.5,end:15}} },
];

const EXCHANGE_KNOWLEDGEBASE = {
  nyse: { mic:"XNYS", city:"New York, USA", currency:"USD", index:"S&P 500 / DJIA", settlement:"T+1", fixVersion:"FIX 4.2 / FIX 4.4 / FIX 5.0", protocols:"NYSE Pillar / FAST", latency:"< 50 μs", notes:"World's largest exchange by market cap. Operates NYSE Pillar matching engine. Closing Auction takes place at 16:00 EST." },
  nasdaq: { mic:"XNAS", city:"New York, USA", currency:"USD", index:"NASDAQ 100", settlement:"T+1", fixVersion:"FIX 4.2 / FIX 5.0", protocols:"OUCH 5.0 / ITCH 5.0", latency:"< 30 μs", notes:"Pioneer in electronic trading. Features continuous matching with opening (09:30) and closing (16:00) cross auctions." },
  tsx: { mic:"XTSE", city:"Toronto, Canada", currency:"CAD", index:"S&P/TSX Composite", settlement:"T+1", fixVersion:"FIX 4.2", protocols:"TSX QuantumFeed", latency:"< 100 μs", notes:"Senior equities venue of Canada. Key exchange for global mining, energy, and financial service listings." },
  lse: { mic:"XLON", city:"London, UK", currency:"GBP / GBX", index:"FTSE 100", settlement:"T+2", fixVersion:"FIX 4.4 / FIX 5.0 SP2", protocols:"MillenniumIT / MITCH", latency:"< 40 μs", notes:"Premier European exchange. Runs Millennium Exchange engine with intraday uncrossing auction at 12:00 GMT." },
  euronext: { mic:"XPAR", city:"Paris, France", currency:"EUR", index:"CAC 40", settlement:"T+2", fixVersion:"FIX 5.0 SP2", protocols:"Optiq OEG", latency:"< 50 μs", notes:"Pan-European market across Paris, Amsterdam, Brussels, Lisbon, Dublin, Milan, and Oslo powered by Optiq." },
  xetra: { mic:"XETR", city:"Frankfurt, Germany", currency:"EUR", index:"DAX 40", settlement:"T+2", fixVersion:"FIX 5.0 (T7)", protocols:"T7 ETI / ETI FIX / MDI", latency:"< 25 μs", notes:"Operated by Deutsche Börse. T7 architecture delivers ultra-low-latency deterministic matching for European equities." },
  tse: { mic:"XJPX", city:"Tokyo, Japan", currency:"JPY", index:"NIKKEI 225 / TOPIX", settlement:"T+2", fixVersion:"FIX 4.2 / FIX 4.4", protocols:"Arrowhead 4.0", latency:"< 200 μs", notes:"Asia's flagship market. Operates Morning (09:00-11:30) and Afternoon (12:30-15:30) sessions." },
  sse: { mic:"XSHG", city:"Shanghai, China", currency:"CNY", index:"SSE Composite", settlement:"T+1", fixVersion:"FIX 4.4", protocols:"STEP Protocol", latency:"< 1 ms", notes:"Mainland China's primary exchange. Features Stock Connect link to HKEX. Pre-opening auction 09:15-09:25." },
  hkex: { mic:"XHKG", city:"Hong Kong", currency:"HKD", index:"Hang Seng Index", settlement:"T+2", fixVersion:"FIX 4.4", protocols:"HKEX Orion (OTP-C)", latency:"< 100 μs", notes:"International gateway for Chinese capital. Uses Orion Trading Platform with closing auction session (16:00-16:10)." },
  nse: { mic:"XNSE", city:"Mumbai, India", currency:"INR", index:"NIFTY 50", settlement:"T+1", fixVersion:"FIX 4.2 / FIX 4.4", protocols:"NEAT / TAP Binary Interface", latency:"< 50 μs", notes:"World's largest derivatives exchange by volume. Operates T+1 settlement cycle with pre-open session (09:00-09:15)." },
  asx: { mic:"XASX", city:"Sydney, Australia", currency:"AUD", index:"S&P/ASX 200", settlement:"T+2", fixVersion:"FIX 4.4 / FIX 5.0", protocols:"ASX Trade (Nasdaq NFF)", latency:"< 100 μs", notes:"Leading Asia-Pacific venue. Single price opening auction staggered by alphabetic code between 10:00-10:09 AEST." },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS & SOLAR MATH
// ═══════════════════════════════════════════════════════════════════════════

function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = now.toLocaleString("en-US", { timeZone: timezone });
    return (new Date(tzStr) - new Date(utcStr)) / 3600000;
  } catch {
    return 0;
  }
}

function isDSTActive(timezone) {
  try {
    const year = new Date().getFullYear();
    const jan = new Date(year, 0, 1);
    const jul = new Date(year, 6, 1);
    const getOff = (d) => {
      const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = d.toLocaleString("en-US", { timeZone: timezone });
      return (new Date(tzStr) - new Date(utcStr)) / 3600000;
    };
    const janOff = getOff(jan);
    const julOff = getOff(jul);
    const curOff = getOff(new Date());
    return curOff > Math.min(janOff, julOff);
  } catch {
    return false;
  }
}

function getUTCDecimalHours(date = new Date()) {
  return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
}

function localToUTC(localHour, offset) {
  return ((localHour - offset) % 24 + 24) % 24;
}

function isInSession(utcNow, startUTC, endUTC) {
  if (startUTC <= endUTC) return utcNow >= startUTC && utcNow < endUTC;
  return utcNow >= startUTC || utcNow < endUTC;
}

function getSolarSubpoint(date) {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLng = (12 - utcHours) * 15;
  const start = new Date(date.getUTCFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / 86400000);
  const sunLat = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  return { sunLat, sunLng };
}

function isPointInDaylight(lat, lng, sunLat, sunLng) {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const sLatR = (sunLat * Math.PI) / 180;
  const sLngR = (sunLng * Math.PI) / 180;
  return (Math.sin(latR) * Math.sin(sLatR) + Math.cos(latR) * Math.cos(sLatR) * Math.cos(lngR - sLngR)) > 0;
}

function getMarketHolidays(marketId) {
  return EXCHANGE_HOLIDAYS[marketId] || DEFAULT_HOLIDAYS;
}

function getMarketStatus(market, currentDate = new Date()) {
  const offset = getTimezoneOffset(market.timezone);
  const utcNow = getUTCDecimalHours(currentDate);

  const tzDateStr = currentDate.toLocaleString("en-US", { timeZone: market.timezone });
  const localDateObj = new Date(tzDateStr);
  const localDayOfWeek = localDateObj.getDay();
  const mmdd = String(localDateObj.getMonth() + 1).padStart(2, "0") + "-" + String(localDateObj.getDate()).padStart(2, "0");

  const holidays = getMarketHolidays(market.id);
  const isDst = isDSTActive(market.timezone);
  const isWeekend = (market.weekendDays || [0, 6]).includes(localDayOfWeek);
  const isHoliday = !!holidays[mmdd];

  if (isWeekend) {
    return { status: "weekend", label: "Weekend Closed", color: SESSION_COLORS.weekend, nextEventLabel: "Opens Next Session", nextEventMin: Infinity, isDst, holidayName: null };
  }

  if (isHoliday) {
    return { status: "holiday", label: "Holiday Closed", color: SESSION_COLORS.holiday, nextEventLabel: "Holiday", nextEventMin: Infinity, isDst, holidayName: holidays[mmdd] };
  }

  const sessions = market.sessions;

  if (sessions.regular) {
    const regStartUTC = localToUTC(sessions.regular.start, offset);
    const regEndUTC = localToUTC(sessions.regular.end, offset);
    if (isInSession(utcNow, regStartUTC, regEndUTC)) {
      const minsLeft = ((regEndUTC - utcNow + 24) % 24) * 60;
      return { status: "regular", label: "In Session", color: SESSION_COLORS.regular, nextEventLabel: "Closes in", nextEventMin: minsLeft, isDst, holidayName: null };
    }
  }

  if (sessions.preMarket) {
    const preStartUTC = localToUTC(sessions.preMarket.start, offset);
    const preEndUTC = localToUTC(sessions.preMarket.end, offset);
    if (isInSession(utcNow, preStartUTC, preEndUTC)) {
      const regStartUTC = sessions.regular ? localToUTC(sessions.regular.start, offset) : preEndUTC;
      const minsToRegOpen = ((regStartUTC - utcNow + 24) % 24) * 60;
      return { status: "pre", label: "Pre-Market", color: SESSION_COLORS.pre, nextEventLabel: "Opens in", nextEventMin: minsToRegOpen, isDst, holidayName: null };
    }
  }

  if (sessions.postMarket) {
    const postStartUTC = localToUTC(sessions.postMarket.start, offset);
    const postEndUTC = localToUTC(sessions.postMarket.end, offset);
    if (isInSession(utcNow, postStartUTC, postEndUTC)) {
      const minsLeft = ((postEndUTC - utcNow + 24) % 24) * 60;
      return { status: "post", label: "Post-Market", color: SESSION_COLORS.post, nextEventLabel: "Post-market ends in", nextEventMin: minsLeft, isDst, holidayName: null };
    }
  }

  let minMinutesToOpen = Infinity;
  let nextLabel = "Opens in";
  
  if (sessions.preMarket) {
    const preStartUTC = localToUTC(sessions.preMarket.start, offset);
    const minsToPre = ((preStartUTC - utcNow + 24) % 24) * 60;
    if (minsToPre > 0 && minsToPre < minMinutesToOpen) {
      minMinutesToOpen = minsToPre;
      nextLabel = "Pre-market in";
    }
  }

  if (sessions.regular) {
    const regStartUTC = localToUTC(sessions.regular.start, offset);
    const minsToReg = ((regStartUTC - utcNow + 24) % 24) * 60;
    if (minsToReg > 0 && minsToReg < minMinutesToOpen) {
      minMinutesToOpen = minsToReg;
      nextLabel = "Opens in";
    }
  }

  return { status: "closed", label: "Closed", color: SESSION_COLORS.closed, nextEventLabel: nextLabel, nextEventMin: minMinutesToOpen, isDst, holidayName: null };
}

function formatCountdown(minutes) {
  if (!isFinite(minutes) || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHourDecimal(dec) {
  if (dec === undefined || dec === null) return "";
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatUTCTime(date) {
  return date.toISOString().slice(11, 19) + " UTC";
}

function formatLocalTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function projectPoint(lat, lng, centerLng, cx, cy, radius) {
  const latR = (lat * Math.PI) / 180;
  const dlng = ((lng - centerLng) * Math.PI) / 180;
  const cosC = Math.cos(latR) * Math.cos(dlng);
  const x = cx + radius * Math.cos(latR) * Math.sin(dlng);
  const y = cy - radius * Math.sin(latR);
  return { x, y, visible: cosC > 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function GlobalMarketHours() {
  const [viewMode, setViewMode] = useState("globe"); // 'globe' | 'timeline'
  const [sessionFilter, setSessionFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [globeRotation, setGlobeRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDraggingGlobe, setIsDraggingGlobe] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hoveredMarket, setHoveredMarket] = useState(null);
  const [selectedMarketModal, setSelectedMarketModal] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pinnedMarkets, setPinnedMarkets] = useState(new Set());
  const [displayTimezone, setDisplayTimezone] = useState("UTC");

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isPaused || viewMode !== "globe") return;
    const id = setInterval(() => setGlobeRotation((r) => (r + 0.4) % 360), 100);
    return () => clearInterval(id);
  }, [isPaused, viewMode]);

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

  const togglePin = useCallback((marketId, e) => {
    if (e) e.stopPropagation();
    setPinnedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }, []);

  const resetAllFilters = () => {
    setSessionFilter("all");
    setRegionFilter("All");
    setTierFilter("all");
    setSearchQuery("");
  };

  const utcNow = getUTCDecimalHours(currentTime);
  const sunPos = useMemo(() => getSolarSubpoint(currentTime), [currentTime]);

  const displayOffset = useMemo(() => {
    if (displayTimezone === "UTC") return 0;
    if (displayTimezone === "local") {
      return typeof window !== "undefined" ? -new Date().getTimezoneOffset() / 60 : 0;
    }
    return getTimezoneOffset(displayTimezone);
  }, [displayTimezone, currentTime]);

  const displayTZLabel = useMemo(() => {
    if (displayTimezone === "UTC") return "UTC";
    if (displayTimezone === "local") return "Local Time";
    const opt = TIMEZONE_OPTIONS.find((t) => t.value === displayTimezone);
    return opt ? opt.label.split(" ")[0] : displayTimezone;
  }, [displayTimezone]);

  const marketsWithStatus = useMemo(() => {
    return MARKETS.map((m) => {
      const statusObj = getMarketStatus(m, currentTime);
      const isDay = isPointInDaylight(m.lat, m.lng, sunPos.sunLat, sunPos.sunLng);
      const kb = EXCHANGE_KNOWLEDGEBASE[m.id] || {
        mic: m.id.toUpperCase(), city: m.fullName, currency: "USD/Local", index: m.name, settlement: "T+2",
        fixVersion: "FIX 4.2 / FIX 4.4", protocols: "Exchange Native / FIX", latency: "< 500 μs", notes: `${m.fullName} operating session.`
      };
      return {
        ...m,
        ...statusObj,
        isDay,
        kb,
        isPinned: pinnedMarkets.has(m.id),
      };
    });
  }, [currentTime, sunPos, pinnedMarkets]);

  const filteredMarkets = useMemo(() => {
    return marketsWithStatus.filter((m) => {
      if (regionFilter !== "All" && m.region !== regionFilter) return false;
      if (tierFilter !== "all" && m.tier !== tierFilter) return false;
      if (sessionFilter !== "all") {
        if (sessionFilter === "regular" && m.status !== "regular") return false;
        if (sessionFilter === "pre" && m.status !== "pre") return false;
        if (sessionFilter === "post" && m.status !== "post") return false;
        if (sessionFilter === "closed" && m.status !== "closed" && m.status !== "weekend" && m.status !== "holiday") return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.fullName.toLowerCase().includes(q) && !m.region.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [marketsWithStatus, regionFilter, tierFilter, sessionFilter, searchQuery]);

  const counts = useMemo(() => {
    const c = { regular: 0, pre: 0, post: 0, closed: 0, weekend: 0, holiday: 0 };
    marketsWithStatus.forEach((m) => { c[m.status] = (c[m.status] || 0) + 1; });
    return c;
  }, [marketsWithStatus]);

  const stars = useMemo(() => Array.from({ length: 150 }, (_, i) => {
    const x = ((i * 137.5 + 43) * 9301 + 49297) % 233280;
    const y = ((i * 293.1 + 87) * 9301 + 49297) % 233280;
    const r = ((i * 17) % 10) / 10 * 1.1 + 0.4;
    const op = ((i * 23) % 10) / 10 * 0.35 + 0.15;
    return {
      cx: (x / 233280) * 800,
      cy: (y / 233280) * 800,
      r,
      opacity: op,
    };
  }), []);

  // Perfectly Aligned Streamlined Filter Bar
  const renderFilters = () => (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      
      {/* Left Filter Group */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Session Chips */}
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "All" },
            { key: "regular", label: "Open", color: SESSION_COLORS.regular },
            { key: "pre", label: "Pre", color: SESSION_COLORS.pre },
            { key: "post", label: "Post", color: SESSION_COLORS.post },
            { key: "closed", label: "Closed", color: SESSION_COLORS.closed },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setSessionFilter(f.key)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                background: sessionFilter === f.key ? (f.color ? f.color + "25" : "var(--primary-faint)") : "transparent",
                border: `1px solid ${sessionFilter === f.key ? (f.color ? f.color + "66" : "var(--primary-border)") : "transparent"}`,
                color: sessionFilter === f.key ? (f.color || "var(--primary)") : "var(--text-muted)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

        {/* Tier Toggle */}
        <div className="flex items-center gap-0.5">
          {["all", "major", "minor"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all"
              style={{
                background: tierFilter === t ? "var(--primary-faint)" : "transparent",
                color: tierFilter === t ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

        {/* Region Dropdown at the End */}
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="fx-input py-1 text-xs px-2 rounded-lg"
          style={{ minWidth: 100 }}
        >
          {REGIONS.map((r) => <option key={r} value={r}>{r === "All" ? "All Regions" : r}</option>)}
        </select>
      </div>

      {/* Right Controls Group */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative min-w-[130px] max-w-[180px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search market..."
            className="fx-input w-full py-1 pl-7 pr-6 text-xs rounded-lg"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Timezone Converter */}
        <div className="flex items-center gap-1">
          <ArrowRightLeft className="h-3 w-3 text-zinc-400 shrink-0" />
          <select
            value={displayTimezone}
            onChange={(e) => setDisplayTimezone(e.target.value)}
            className="fx-input py-1 text-xs px-2 rounded-lg"
            style={{ minWidth: 110 }}
            title="Display Timezone"
          >
            {TIMEZONE_OPTIONS.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-0.5 border border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("globe")}
            className="p-1 rounded transition-all"
            style={{
              background: viewMode === "globe" ? "var(--primary-faint)" : "transparent",
              color: viewMode === "globe" ? "var(--primary)" : "var(--text-muted)",
            }}
            title="Globe View"
          >
            <Globe2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className="p-1 rounded transition-all"
            style={{
              background: viewMode === "timeline" ? "var(--primary-faint)" : "transparent",
              color: viewMode === "timeline" ? "var(--primary)" : "var(--text-muted)",
            }}
            title="Timeline View"
          >
            <BarChart3 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl my-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="p-3.5 rounded-full mb-3" style={{ background: "var(--primary-faint)", border: "1px solid var(--primary-border)" }}>
        <Search className="h-7 w-7" style={{ color: "var(--primary)" }} />
      </div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>No Global Markets Match Your Criteria</h3>
      <p className="text-xs max-w-md my-2" style={{ color: "var(--text-muted)" }}>
        No exchanges found matching search: "{searchQuery || 'None'}", Region: "{regionFilter}".
      </p>
      <button onClick={resetAllFilters} className="fx-btn-primary mt-2 flex items-center gap-2 py-1.5 px-3 text-xs">
        <RotateCcw className="h-3.5 w-3.5" />
        Reset All Filters
      </button>
    </div>
  );

  // ─── GLOBE VIEW ──────────────────────────────────────────────────────

  const renderGlobe = () => {
    const cx = 400, cy = 400, R = 290;
    const centerLng = globeRotation;

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

    const handleGlobeMouseDown = (e) => {
      setIsDraggingGlobe(true);
      setDragStartX(e.clientX);
      setIsPaused(true);
    };

    const handleGlobeMouseMove = (e) => {
      if (!isDraggingGlobe) return;
      const dx = e.clientX - dragStartX;
      setGlobeRotation((r) => (r + dx * 0.45) % 360);
      setDragStartX(e.clientX);
    };

    const handleGlobeMouseUp = () => setIsDraggingGlobe(false);

    const handleGlobeTouchStart = (e) => {
      if (e.touches.length === 1) {
        setIsDraggingGlobe(true);
        setDragStartX(e.touches[0].clientX);
        setIsPaused(true);
      }
    };

    const handleGlobeTouchMove = (e) => {
      if (!isDraggingGlobe || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartX;
      setGlobeRotation((r) => (r + dx * 0.45) % 360);
      setDragStartX(e.touches[0].clientX);
    };

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

    const marketDots = filteredMarkets.map((m) => {
      const proj = projectPoint(m.lat, m.lng, centerLng, cx, cy, R);
      return { ...m, ...proj, dotSize: m.tier === "major" ? 6 : 4.5 };
    }).filter((m) => m.visible);

    const pinnedList = filteredMarkets.filter((m) => m.isPinned);

    return (
      <div className="flex flex-col lg:flex-row gap-5 items-stretch my-4">
        {/* Globe Visualization Container - 65% Width */}
        <div className="relative w-full lg:w-[65%] rounded-2xl flex items-center justify-center p-4 h-[600px]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          
          <svg viewBox="0 0 800 800" className="w-full max-w-[650px] h-full">
            <defs>
              <radialGradient id="globe-bg" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#27272a" />
                <stop offset="70%" stopColor="#18181b" />
                <stop offset="100%" stopColor="#09090b" />
              </radialGradient>
              <radialGradient id="atmosphere" cx="50%" cy="50%" r="50%">
                <stop offset="88%" stopColor="transparent" />
                <stop offset="97%" stopColor="rgba(16,185,129,0.06)" />
                <stop offset="100%" stopColor="rgba(16,185,129,0.18)" />
              </radialGradient>
              <filter id="dot-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Stars */}
            {stars.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity} />
            ))}

            {/* Orbit Rings */}
            <ellipse cx={cx} cy={cy} rx={R + 45} ry={75} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" transform={`rotate(-18 ${cx} ${cy})`} />
            <ellipse cx={cx} cy={cy} rx={R + 65} ry={55} fill="none" stroke="rgba(16,185,129,0.05)" strokeWidth="0.75" transform={`rotate(12 ${cx} ${cy})`} />

            {/* Main Globe Sphere */}
            <circle cx={cx} cy={cy} r={R} fill="url(#globe-bg)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

            {/* Grid Lines */}
            {latLines.map((pts, i) => (
              <polyline key={`lat-${i}`} points={pts.join(" ")} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            ))}
            {lngLines.map((pts, i) => (
              <polyline key={`lng-${i}`} points={pts.join(" ")} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            ))}

            {/* Continent Outlines */}
            {continentPaths.map((segs, ci) =>
              segs.map((seg, si) => (
                <polyline key={`cont-${ci}-${si}`} points={seg.join(" ")} fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1.4" strokeLinejoin="round" />
              ))
            )}

            {/* Market Dots */}
            {marketDots.map((m) => (
              <g key={m.id} onClick={() => setSelectedMarketModal(m)} onMouseEnter={() => setHoveredMarket(m.id)} onMouseLeave={() => setHoveredMarket(null)} style={{ cursor: "pointer" }}>
                {m.status === "regular" && (
                  <circle cx={m.x} cy={m.y} r={m.dotSize + 4} fill="none" stroke={m.color} strokeWidth="1.5" opacity="0.5"
                    style={{ animation: "pulse-ring 2s ease-out infinite" }} />
                )}
                <circle cx={m.x} cy={m.y} r={m.dotSize + 2} fill={m.color} opacity={m.isDay ? 0.35 : 0.15} filter="url(#dot-glow)" />
                <circle cx={m.x} cy={m.y} r={m.dotSize} fill={m.color} stroke={m.isPinned ? "#facc15" : "rgba(255,255,255,0.4)"} strokeWidth={m.isPinned ? 1.5 : 0.5} />

                {(hoveredMarket === m.id || m.tier === "major" || m.isPinned) && (
                  <g>
                    <rect x={m.x + m.dotSize + 6} y={m.y - 11} width={m.name.length * 7.5 + 16} height={22} rx={5}
                      fill="rgba(9,9,11,0.9)" stroke={m.isPinned ? "#facc15" : m.color} strokeWidth={m.isPinned ? 1 : 0.5} />
                    <text x={m.x + m.dotSize + 12} y={m.y + 4} fill="white" fontSize="11" fontFamily="monospace" fontWeight="600">
                      {m.isPinned ? "★ " : ""}{m.name}
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* Atmosphere Overlay */}
            <circle cx={cx} cy={cy} r={R + 1} fill="url(#atmosphere)" />
          </svg>

          {/* Rotation Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }}
            className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all pointer-events-auto"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {isPaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
            <span>{isPaused ? "Resume Rotation" : "Auto Rotating"}</span>
          </button>
        </div>

        {/* Right Region Markets Sidebar - 35% Width */}
        <div className="w-full lg:w-[35%] flex flex-col space-y-2 h-[600px] overflow-y-auto fx-custom-scroll pr-1">
          
          {filteredMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl h-full border border-zinc-800 bg-zinc-900/40">
              <Search className="h-6 w-6 text-zinc-500 mb-2" />
              <h4 className="text-xs font-semibold text-zinc-200">No Markets Match Filter</h4>
              <p className="text-[10px] text-zinc-400 my-1 max-w-[200px]">
                Search: "{searchQuery || 'None'}", Region: "{regionFilter}".
              </p>
              <button onClick={resetAllFilters} className="fx-btn-primary mt-2 text-[10px] py-1 px-2.5 flex items-center gap-1.5">
                <RotateCcw className="h-3 w-3" /> Reset Filters
              </button>
            </div>
          ) : (
            <>
              {/* Dedicated PINNED TO TOP Section */}
              {pinnedList.length > 0 && (
                <div className="space-y-1 p-2 rounded-xl border border-amber-500/30 bg-amber-500/5 mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest px-2 pt-1 flex items-center justify-between text-amber-400">
                    <span className="flex items-center gap-1.5"><Star className="h-3 w-3 fill-amber-400" /> PINNED TO TOP</span>
                    <span className="text-[9px] font-mono">{pinnedList.length} markets</span>
                  </div>
                  {pinnedList.map((m) => (
                    <div
                      key={`pin-${m.id}`}
                      onClick={() => setSelectedMarketModal(m)}
                      onMouseEnter={() => setHoveredMarket(m.id)}
                      onMouseLeave={() => setHoveredMarket(null)}
                      className="p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer border border-amber-500/20 bg-zinc-900/80 hover:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button onClick={(e) => togglePin(m.id, e)} className="hover:scale-110 transition-transform flex-shrink-0">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        </button>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                          {m.code}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate text-zinc-100">{m.name}</span>
                          </div>
                          <div className="text-[10px] truncate text-zinc-400">{m.fullName}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                          <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                        </div>
                        {m.nextEventMin < Infinity && (
                          <div className="text-[10px] font-mono text-zinc-400">
                            {m.nextEventLabel} <span className="font-semibold text-zinc-200">{formatCountdown(m.nextEventMin)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Region Grouped Markets */}
              {REGIONS.filter((r) => r !== "All").map((region) => {
                const regionMarkets = filteredMarkets.filter((m) => m.region === region && !m.isPinned);
                if (regionMarkets.length === 0) return null;
                return (
                  <div key={region} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest px-2 pt-2 flex items-center justify-between text-zinc-400">
                      <span>{region}</span>
                      <span className="text-[9px] font-mono">{regionMarkets.length} markets</span>
                    </div>
                    {regionMarkets.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMarketModal(m)}
                        onMouseEnter={() => setHoveredMarket(m.id)}
                        onMouseLeave={() => setHoveredMarket(null)}
                        className="p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer"
                        style={{
                          background: hoveredMarket === m.id ? "var(--card-hover)" : "var(--card)",
                          border: hoveredMarket === m.id ? "1px solid var(--primary-border)" : "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button onClick={(e) => togglePin(m.id, e)} className="hover:scale-110 transition-transform flex-shrink-0">
                            <Star className="h-3.5 w-3.5 text-zinc-600 hover:text-amber-400" />
                          </button>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                            {m.code}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate text-zinc-100">{m.name}</span>
                              {m.isDst && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">DST</span>
                              )}
                            </div>
                            <div className="text-[10px] truncate text-zinc-400">{m.fullName}</div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                            <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                          </div>
                          {m.nextEventMin < Infinity && (
                            <div className="text-[10px] font-mono text-zinc-400">
                              {m.nextEventLabel} <span className="font-semibold text-zinc-200">{formatCountdown(m.nextEventMin)}</span>
                            </div>
                          )}
                          {m.holidayName && (
                            <div className="text-[9px] font-mono text-rose-400 font-medium">{m.holidayName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  // ─── TIMELINE TABLE VIEW WITH PIN TO TOP ──────────────────────────────

  const renderTimeline = () => {
    if (filteredMarkets.length === 0) return renderEmptyState();

    const displayNow = ((utcNow + displayOffset) % 24 + 24) % 24;

    const getSessionBars = (market) => {
      const offset = getTimezoneOffset(market.timezone);
      const bars = [];
      if (market.status === "weekend" || market.status === "holiday") return bars;

      const sessionDefs = [
        { key: "preMarket", color: SESSION_COLORS.pre, opacity: 0.8 },
        { key: "regular", color: SESSION_COLORS.regular, opacity: 0.95 },
        { key: "postMarket", color: SESSION_COLORS.post, opacity: 0.8 },
      ];

      for (const sd of sessionDefs) {
        const s = market.sessions[sd.key];
        if (!s) continue;
        const startUTC = localToUTC(s.start, offset);
        const endUTC = localToUTC(s.end, offset);
        
        const startDisp = ((startUTC + displayOffset) % 24 + 24) % 24;
        const endDisp = ((endUTC + displayOffset) % 24 + 24) % 24;

        if (startDisp <= endDisp) {
          bars.push({ startPct: (startDisp / 24) * 100, widthPct: ((endDisp - startDisp) / 24) * 100, color: sd.color, opacity: sd.opacity });
        } else {
          bars.push({ startPct: (startDisp / 24) * 100, widthPct: ((24 - startDisp) / 24) * 100, color: sd.color, opacity: sd.opacity });
          bars.push({ startPct: 0, widthPct: (endDisp / 24) * 100, color: sd.color, opacity: sd.opacity });
        }
      }
      return bars;
    };

    const nowHourDec = ((utcNow + displayOffset) % 24 + 24) % 24;
    const nowHourInt = Math.floor(nowHourDec);
    const nowMinInt = Math.floor((nowHourDec - nowHourInt) * 60);
    const nowTimeStr = `${String(nowHourInt).padStart(2, "0")}:${String(nowMinInt).padStart(2, "0")} ${displayTZLabel}`;

    const pinnedList = filteredMarkets.filter((m) => m.isPinned);
    const groupedByRegion = {};
    REGIONS.filter((r) => r !== "All").forEach((r) => {
      const list = filteredMarkets.filter((m) => m.region === r && !m.isPinned);
      if (list.length > 0) groupedByRegion[r] = list;
    });

    const renderMarketRow = (m) => {
      const bars = getSessionBars(m);
      return (
        <div
          key={m.id}
          onClick={() => setSelectedMarketModal(m)}
          onMouseEnter={() => setHoveredMarket(m.id)}
          onMouseLeave={() => setHoveredMarket(null)}
          className="flex items-center h-9 px-2 rounded-lg transition-colors cursor-pointer"
          style={{
            background: hoveredMarket === m.id ? "var(--card-hover)" : m.isPinned ? "rgba(250,204,21,0.04)" : "transparent",
          }}
        >
          {/* Left Column */}
          <div className="w-[260px] flex-shrink-0 flex items-center gap-2 min-w-0 pr-2">
            <button onClick={(e) => togglePin(m.id, e)} className="hover:scale-110 transition-transform flex-shrink-0">
              <Star className="h-3.5 w-3.5" style={{ color: m.isPinned ? "#facc15" : "var(--text-faint)", fill: m.isPinned ? "#facc15" : "none" }} />
            </button>
            <span className="text-[10px] font-mono font-bold px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
              {m.code}
            </span>
            <span className="text-xs font-bold truncate text-zinc-100">{m.name}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
            <span className="text-[9px] font-mono font-bold uppercase truncate" style={{ color: m.color }}>
              {m.label}
            </span>
          </div>

          {/* Middle Column */}
          <div className="flex-1 relative h-6 flex items-center pr-4">
            {bars.map((bar, idx) => (
              <div
                key={idx}
                className="absolute h-5 rounded-md shadow-sm transition-all"
                style={{ left: `${bar.startPct}%`, width: `${Math.max(bar.widthPct, 0.8)}%`, background: bar.color, opacity: bar.opacity }}
                title={`${m.name} Session`}
              />
            ))}
            {(m.status === "weekend" || m.status === "holiday") && (
              <div className="w-full h-5 rounded-md flex items-center justify-center text-[9px] font-mono text-zinc-500 bg-zinc-800/30">
                {m.status === "weekend" ? "WEEKEND" : m.holidayName}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="w-[140px] flex-shrink-0 text-right text-[10px] font-mono text-zinc-400">
            {m.nextEventMin < Infinity && (
              <span>{m.nextEventLabel} <span className="text-zinc-200 font-semibold">{formatCountdown(m.nextEventMin)}</span></span>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="w-full my-4 rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto fx-custom-scroll">
          <div className="min-w-[960px] w-full p-4 relative">
            
            {/* Header */}
            <div className="flex items-center pb-3 border-b text-[10px] font-mono" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <div className="w-[260px] flex-shrink-0" />
              <div className="flex-1 relative flex justify-between pr-4">
                {Array.from({ length: 25 }, (_, i) => (
                  <span key={i} className="text-center w-5">{i === 24 ? "00" : String(i).padStart(2, "0")}</span>
                ))}
                <span className="text-[9px] font-sans font-semibold text-emerald-400 ml-1">
                  {displayTZLabel}
                </span>
              </div>
              <div className="w-[140px] flex-shrink-0 text-right" />
            </div>

            {/* Red Needle Line */}
            <div
              className="absolute top-10 bottom-4 w-0.5 bg-rose-500 z-20 pointer-events-none"
              style={{ left: `calc(276px + ${(displayNow / 24)} * (100% - 432px))` }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500 text-white shadow-md whitespace-nowrap">
                {nowTimeStr}
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              
              {/* Dedicated PINNED TO TOP Section */}
              {pinnedList.length > 0 && (
                <div className="py-2 space-y-1 bg-amber-500/5 rounded-lg my-1 border border-amber-500/20">
                  <div className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 text-amber-400 flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-amber-400" /> PINNED MARKETS
                  </div>
                  {pinnedList.map(renderMarketRow)}
                </div>
              )}

              {/* Region Grouped Sections */}
              {Object.entries(groupedByRegion).map(([region, regionMarkets]) => (
                <div key={region} className="py-2 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 text-zinc-400">
                    {region}
                  </div>
                  {regionMarkets.map(renderMarketRow)}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    );
  };

  // ─── MARKET KNOWLEDGEBASE MODAL ───────────────────────────────────────

  const renderMarketModal = () => {
    if (!selectedMarketModal) return null;
    const m = selectedMarketModal;
    const kb = m.kb;

    // Calculate exchange local time string
    let marketLocalTimeStr = "—";
    try {
      marketLocalTimeStr = currentTime.toLocaleTimeString("en-US", { timeZone: m.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    } catch {
      marketLocalTimeStr = formatLocalTime(currentTime);
    }

    // Calculate next upcoming holiday for this specific exchange
    const marketHolidays = getMarketHolidays(m.id);
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mmddNow = String(currentTime.getMonth() + 1).padStart(2, "0") + "-" + String(currentTime.getDate()).padStart(2, "0");
    const sortedHolidays = Object.keys(marketHolidays).sort();
    let nextHolidayKey = sortedHolidays.find((k) => k >= mmddNow) || sortedHolidays[0];
    const nextHolidayName = marketHolidays[nextHolidayKey];
    const [hMonth, hDay] = nextHolidayKey.split("-").map(Number);
    const holidayMonthName = MONTH_NAMES[hMonth - 1] || "";
    const formattedHolidayDate = `${holidayMonthName} ${hDay}`;

    const isModalPinned = pinnedMarkets.has(m.id);

    return (
      <div
        onClick={() => setSelectedMarketModal(null)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          
          {/* Fixed Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 p-5 flex-shrink-0 bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold px-2 py-1 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
                {m.code}
              </span>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"  style={{ color: "var(--primary)" }} >
                  {m.name} — {m.fullName}
                </h2>
                <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                  {kb.city} · MIC: <span className="font-mono text-emerald-400">{kb.mic}</span> · Region: {m.region}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => togglePin(m.id, e)}
                className="p-1.5 rounded-lg text-amber-400 hover:bg-zinc-800 transition-all border border-amber-500/20 bg-amber-500/10 flex items-center gap-1 text-xs font-semibold"
                title={isModalPinned ? "Unpin Market" : "Pin to Top"}
              >
                <Star className="h-4 w-4" style={{ fill: isModalPinned ? "#facc15" : "none" }} />
                <span>{isModalPinned ? "Pinned" : "Pin"}</span>
              </button>
              <button
                onClick={() => setSelectedMarketModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Middle Content Body */}
          <div className="flex-1 overflow-y-auto fx-custom-scroll p-5 space-y-4">
            
            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
              <div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Current Status</div>
                <div className="text-xs font-bold flex items-center gap-1.5 mt-1" style={{ color: m.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Primary Index</div>
                <div className="text-xs font-semibold text-zinc-200 mt-1">{kb.index}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Currency</div>
                <div className="text-xs font-semibold text-zinc-200 mt-1">{kb.currency}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Local Exchange Time</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-1">{marketLocalTimeStr}</div>
                {m.nextEventMin < Infinity && (
                  <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                    {m.nextEventLabel} <span className="font-semibold text-zinc-200">{formatCountdown(m.nextEventMin)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" /> FIX & Connectivity Architecture
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">FIX Protocol Version</div>
                  <div className="text-xs font-mono font-semibold text-zinc-200 mt-1">{kb.fixVersion}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">Data Protocol</div>
                  <div className="text-xs font-mono font-semibold text-zinc-200 mt-1">{kb.protocols}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">Next Holiday</div>
                  <div className="text-xs font-mono font-semibold text-rose-400 mt-1">
                    {nextHolidayName} ({formattedHolidayDate})
                  </div>
                </div>
              </div>
            </div>

            {/* Exchange Knowledgebase Notes */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-400" /> Exchange Knowledgebase
              </h3>
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
                {kb.notes}
              </div>
            </div>

            {/* Operating Session Schedule */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" /> Local Trading Hours
              </h3>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5 text-xs font-mono">
                {m.sessions.preMarket && (
                  <div className="flex justify-between text-amber-400">
                    <span>Pre-Market Session:</span>
                    <span>{formatHourDecimal(m.sessions.preMarket.start)} - {formatHourDecimal(m.sessions.preMarket.end)}</span>
                  </div>
                )}
                {m.sessions.regular && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Regular Session:</span>
                    <span>{formatHourDecimal(m.sessions.regular.start)} - {formatHourDecimal(m.sessions.regular.end)}</span>
                  </div>
                )}
                {m.sessions.postMarket && (
                  <div className="flex justify-between text-purple-400">
                    <span>Post-Market Session:</span>
                    <span>{formatHourDecimal(m.sessions.postMarket.start)} - {formatHourDecimal(m.sessions.postMarket.end)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-400 pt-1.5 border-t border-zinc-800 text-[10px]">
                  <span>Trading Schedule Days: <strong className="text-emerald-400 font-mono">{m.tradingDays || (m.weekendDays?.includes(5) ? "Sun - Thu" : "Mon - Fri")}</strong></span>
                  <span>Timezone Location: {m.timezone}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[10px]">
                  <span>Active Weekend Days: {m.weekendDays?.includes(5) ? "Friday & Saturday" : "Saturday & Sunday"}</span>
                  <span>DST Active: {m.isDst ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-between p-4 border-t border-zinc-800 flex-shrink-0 bg-zinc-950">
            <button
              onClick={(e) => togglePin(m.id, e)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border"
              style={{
                background: isModalPinned ? "rgba(250,204,21,0.1)" : "var(--card)",
                borderColor: isModalPinned ? "rgba(250,204,21,0.4)" : "var(--border)",
                color: isModalPinned ? "#facc15" : "var(--foreground)",
              }}
            >
              <Star className="h-3.5 w-3.5" style={{ fill: isModalPinned ? "#facc15" : "none" }} />
              {isModalPinned ? "Pinned to Top" : "Pin Exchange to Top"}
            </button>
            <button
              onClick={() => setSelectedMarketModal(null)}
              className="fx-btn-primary py-1 px-4 text-xs"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fx-page space-y-4">
      <style>{`
        @keyframes pulse-ring {
          0% { r: 8; opacity: 0.6; }
          100% { r: 22; opacity: 0; }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out forwards;
        }
      `}</style>

      {/* Header Banner */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="fx-page-title flex items-center gap-2.5 text-2xl font-bold">
            <Globe2 className="h-6 w-6" style={{ color: "var(--primary)" }} />
            Global Market Hours
          </h1>
          <p className="fx-page-subtitle flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: SESSION_COLORS.regular, animation: "live-pulse 1.5s ease-in-out infinite" }} />
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">LIVE</span>
            </span>
            <span className="font-mono text-xs text-zinc-400" suppressHydrationWarning>
              <Clock className="inline h-3 w-3 mr-1" />
              {mounted ? formatUTCTime(currentTime) : "00:00:00 UTC"}
            </span>
            <span className="font-mono text-xs text-zinc-400" suppressHydrationWarning>
              <MapPinIcon className="inline h-3 w-3 mr-1" />
              Local: {mounted ? formatLocalTime(currentTime) : "00:00:00 AM"}
            </span>
          </p>
        </div>

        {/* Clean Header Summary */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono px-3.5 py-2 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-bold text-emerald-400">{counts.regular}</span>
            <span className="text-zinc-400">Open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-bold text-amber-400">{counts.pre}</span>
            <span className="text-zinc-400">Pre-Market</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="font-bold text-purple-400">{counts.post}</span>
            <span className="text-zinc-400">Post-Market</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="font-bold text-zinc-200">{counts.closed + counts.weekend + counts.holiday}</span>
            <span className="text-zinc-400">Closed</span>
          </div>
        </div>
      </div>

      {/* Streamlined Filter Bar */}
      {renderFilters()}

      {/* View Content */}
      {viewMode === "globe" ? renderGlobe() : renderTimeline()}

      {/* Market Knowledgebase Modal */}
      {renderMarketModal()}
    </div>
  );
}
