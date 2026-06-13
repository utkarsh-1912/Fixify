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
      answer: "⚠️ Gemini API key not found.",
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

// Local offline tag dictionary lookups
function tryLocalLookup(query) {
  const q = query.trim();
  
  // 1. Tag-Value pair: e.g. "35=D" or "Side=1" or "35 = D"
  const tagValMatch = q.match(/^([a-zA-Z0-9_]+)\s*=\s*([^=|]+)$/);
  if (tagValMatch) {
    let tagOrName = tagValMatch[1].trim();
    const val = tagValMatch[2].trim();
    let tag = /^\d+$/.test(tagOrName) ? tagOrName : null;
    if (!tag) {
      const entry = Object.entries(FIX_TAGS).find(([t, name]) => name.toLowerCase() === tagOrName.toLowerCase());
      if (entry) {
        tag = entry[0];
      }
    }
    if (tag) {
      const tagName = FIX_TAGS[tag];
      const enums = FIX_VALUES[tag];
      const meaning = enums ? (enums[val] || enums[Number(val)]) : null;
      if (meaning) {
        return `Tag ${tag} (${tagName}) = ${val} (${meaning})\n\nThis is a standard FIX tag-value definition.`;
      } else {
        return `Tag ${tag} (${tagName}) = ${val}\n\nThis is a standard FIX tag, but no specific local enum mapping was found for value "${val}".`;
      }
    }
  }

  // 2. Exact Tag Number: e.g. "35" or "10"
  if (/^\d+$/.test(q)) {
    const tagName = FIX_TAGS[q];
    if (tagName) {
      let response = `Tag ${q} represents the field "${tagName}".`;
      const enums = FIX_VALUES[q];
      if (enums) {
        response += `\n\nAllowed enum values:\n` + 
          Object.entries(enums).map(([val, name]) => `- ${val}: ${name}`).join('\n');
      }
      return response;
    }
  }

  // 3. Exact Field Name search: e.g. "Side" or "MsgType"
  const foundTag = Object.entries(FIX_TAGS).find(([tag, name]) => name.toLowerCase() === q.toLowerCase());
  if (foundTag) {
    const [tag, name] = foundTag;
    let response = `Field "${name}" is represented by Tag ${tag}.`;
    const enums = FIX_VALUES[tag];
    if (enums) {
      response += `\n\nAllowed enum values:\n` + 
        Object.entries(enums).map(([val, valName]) => `- ${val}: ${valName}`).join('\n');
    }
    return response;
  }

  return null;
}

// Partial word/number extractor for general offline queries
function tryPartialLookup(query) {
  const matchedTags = new Set();
  
  // Extract number strings
  const numbers = query.match(/\b\d+\b/g) || [];
  for (const num of numbers) {
    if (FIX_TAGS[num]) {
      matchedTags.add(num);
    }
  }

  // Extract whole word matching field names
  const words = query.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const [tag, name] of Object.entries(FIX_TAGS)) {
    if (words.includes(name.toLowerCase())) {
      matchedTags.add(tag);
    }
  }

  if (matchedTags.size > 0) {
    let result = "\n\n*Local dictionary match(es) for your query:*";
    for (const tag of matchedTags) {
      const name = FIX_TAGS[tag];
      const enums = FIX_VALUES[tag];
      result += `\n- **Tag ${tag} (${name})**: Standard field definition.`;
      if (enums) {
        result += ` (Common values: ${Object.entries(enums).slice(0, 4).map(([v, n]) => `${v}=${n}`).join(', ')}${Object.keys(enums).length > 4 ? '...' : ''})`;
      }
    }
    return result;
  }
  return "";
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
    let hfConnected = false;

    const hasApiKey = !!apiKey.trim();

    if (hasApiKey) {
      // Direct path: Use Gemini AI to answer queries
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
    } else {
      // Offline fallback: Use local tag lookups
      if (looksLikeFIX(query)) {
        const parsed = validateFIXMessage(query);
        if (parsed) {
          table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
          const version = parsed.tags['8'] || 'Unknown';
          const msgType = parsed.tags['35'] || 'Unknown';
          const msgTypeName = parsed.msgTypeName || 'Unknown';
          const validationStatus = parsed.isValid ? 'Passed' : 'Failed';
          const validationDetails = parsed.isValid ? 'Checksum and BodyLength are correct.' : parsed.errors.join('; ');
          
          answer = `Parsed FIX Message Details:\n` +
            `- **Protocol Version**: ${version}\n` +
            `- **Message Type**: ${msgType} (${msgTypeName})\n` +
            `- **Integrity Check**: ${validationStatus} (${validationDetails})\n\n` +
            `⚠️ Gemini API key not found.`;
        } else {
          answer = `⚠️ Failed to parse FIX message structure.\n\n` +
            `⚠️ Gemini API key not found.`;
        }
      } else {
        const localResult = tryLocalLookup(query);
        if (localResult) {
          answer = `${localResult}\n\n⚠️ Gemini API key not found.`;
        } else {
          const partials = tryPartialLookup(query);
          answer = `⚠️ Gemini API key not found. ${partials}`;
        }
      }
      hfConnected = false;
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
