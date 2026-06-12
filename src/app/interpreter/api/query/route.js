import { NextResponse } from "next/server";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";
import { validateFIXMessage } from "@/lib/fixParser";
import yahooFinance from 'yahoo-finance2';

// Check if message is a FIX message
function looksLikeFIX(input) {
  return /^8=FIX\./.test(input.trim());
}

// Fetch market data via yfinance for context
async function getMarketData(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    return quote?.regularMarketPrice 
      ? `Market Quote: Current Price of ${symbol} is ${quote.regularMarketPrice} ${quote.currency || 'USD'}.`
      : "";
  } catch {
    return "";
  }
}

// Direct REST API call to Google Gemini 1.5 Flash
async function queryGemini(prompt, apiKey, systemInstruction = "") {
  if (!apiKey) {
    return {
      answer: "⚠️ Gemini API key not found. Please open the System Settings Modal (gear icon in the top-right) and paste your Google Gemini API Key to enable AI interpretations.",
      connected: false
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        answer: `⚠️ Gemini API request failed: ${errorData.error?.message || res.statusText}`,
        connected: false
      };
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return {
      answer: candidateText || "⚠️ Model returned empty response.",
      connected: true
    };
  } catch (err) {
    return {
      answer: `⚠️ Failed to reach Gemini servers: ${err.message}`,
      connected: false
    };
  }
}

export async function POST(req) {
  try {
    const { query } = await req.json();
    
    // Extract Gemini API key from client request header, fallback to server process env
    const clientKey = req.headers.get("x-gemini-key");
    const apiKey = clientKey || process.env.GEMINI_API_KEY || "";

    const systemInstruction = 
      "You are FIXi, a helpful AI consultant specialized in the FIX (Financial Information eXchange) protocol. " +
      "You help developers, traders, and QA engineers analyze FIX messages, troubleshoot trading session logs, " +
      "explain tag numbers, data types, and enum values, and audit conformance flows. " +
      "Keep explanations clear, professional, and code-focused. If a FIX message table is provided, " +
      "explain the transaction flow and highlight any fields that might indicate errors or mismatches.";

    let table = null;
    let answer = "";
    let hfConnected = false; // Relabeling status indicator to represent model connection

    if (looksLikeFIX(query)) {
      // 1. Process local validation and parse message into tags list
      const parsed = validateFIXMessage(query);
      if (parsed) {
        table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
        
        // 2. Fetch market price if symbol (tag 55) is available
        const symbol = parsed.tags['55'];
        let marketInfo = "";
        if (symbol) {
          marketInfo = await getMarketData(symbol);
        }

        // 3. Construct a detailed prompt for Gemini to provide expert analysis
        const prompt = 
          `Please provide a professional, concise summary of this parsed FIX message.\n\n` +
          `Raw Message: ${query}\n` +
          `Parsed Tag Table:\n` +
          `${table.map(([t, val, name, meaning]) => `Tag ${t} (${name}) = ${val} (${meaning})`).join("\n")}\n\n` +
          (marketInfo ? `${marketInfo}\n\n` : "") +
          `Check if the message contains any validation errors or warnings: ` +
          `${parsed.isValid ? "None (Checksum and BodyLength are correct)" : parsed.errors.join("; ")}.`;

        const geminiRes = await queryGemini(prompt, apiKey, systemInstruction);
        answer = geminiRes.answer;
        hfConnected = geminiRes.connected;
      } else {
        answer = "⚠️ Failed to parse FIX message structure.";
      }
    } else {
      // General question query, send directly to Gemini
      const geminiRes = await queryGemini(query, apiKey, systemInstruction);
      answer = geminiRes.answer;
      hfConnected = geminiRes.connected;
    }

    return NextResponse.json({ answer, table, hfConnected });
  } catch (err) {
    return NextResponse.json({ 
      answer: err.message || "Unknown routing error occurred.", 
      table: null, 
      hfConnected: false 
    }, { status: 500 });
  }
}
