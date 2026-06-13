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

const FIX_GUIDES = {
  "logon": `**FIX Logon Session Flow (MsgType 35=A)**\n\nThe Logon message is transmitted by both the initiator (client) and acceptor (server) to establish a FIX session.\n- **Tag 98 (EncryptMethod)**: Encryption method (typically 0 = None / Plaintext).\n- **Tag 108 (HeartBtInt)**: Heartbeat interval in seconds (e.g., 30).\n- **Tag 141 (ResetSeqNumFlag)**: Reset sequence numbers to 1 if set to 'Y'.\n\n*Establish Session sequence:* \nInitiator ──(35=A, Seq 1)──> Acceptor\nInitiator <──(35=A, Seq 1)── Acceptor (Session Established)`,
  
  "heartbeat": `**FIX Heartbeat (MsgType 35=0)**\n\nHeartbeat messages are transmitted at the HeartBtInt interval during periods of inactivity to verify link connectivity.\n- If responding to a **Test Request (35=1)**, the Heartbeat must include the matching **TestReqID (Tag 112)** to verify sequence integrity.`,
  
  "sequence": `**FIX Sequence Reset / Sequence Gap Recovery (MsgType 35=4)**\n\nUsed to recover from missed message sequence gaps or skip past administrative messages.\n- **Tag 36 (NewSeqNo)**: The next expected MsgSeqNum.\n- **Tag 123 (GapFillFlag)**: \n  - \`Y\` (Gap Fill): Skip sequence numbers for administrative messages.\n  - \`N\` or absent (Reset): Hard sequence reset (forces sequence numbers to NewSeqNo).`,
  
  "checksum": `**FIX Checksum Calculation (Tag 10)**\n\nEvery standard FIX message must terminate with Tag 10 containing a 3-character checksum.\n- It is calculated by summing the binary ASCII values of all characters in the raw message up to (but excluding) the checksum field itself.\n- The sum is then modulo 256 and formatted as a 3-digit padded string (e.g., \`10=084\`).\n- Standard SOH delimiters (\\x01) are included in the checksum sum.`,
  
  "body": `**FIX BodyLength Calculation (Tag 9)**\n\nTag 9 represents the total length of the message body in bytes.\n- It is calculated by counting the number of characters starting immediately *after* the SOH delimiter of Tag 9 and ending immediately *before* the start of Tag 10 (Checksum).`,
  
  "resend": `**FIX Resend Request (MsgType 35=2)**\n\nSent when a sequence number gap is detected (e.g., incoming MsgSeqNum is higher than expected).\n- **Tag 7 (BeginSeqNo)**: The first sequence number requested.\n- **Tag 16 (EndSeqNo)**: The last sequence number requested (use 0 for infinity / all subsequent).`
};

function generateLocalBreakdown(tagList) {
  let breakdown = "\n\n**Field Explanations**:\n";
  tagList.forEach(t => {
    breakdown += `- **Tag ${t.tag} (${t.name})**: ${t.val}`;
    if (t.meaning && String(t.meaning) !== String(t.val)) {
      breakdown += ` *(meaning: ${t.meaning})*`;
    }
    breakdown += "\n";
  });
  return breakdown;
}

// Local offline tag dictionary lookups
function tryLocalLookup(query, customDialect) {
  const q = query.trim();
  
  const getCustomField = (tagOrName) => {
    if (customDialect && Array.isArray(customDialect.fields)) {
      const isTag = /^\d+$/.test(tagOrName);
      return customDialect.fields.find(f => 
        isTag ? String(f.tag) === String(tagOrName) : f.name.toLowerCase() === tagOrName.toLowerCase()
      );
    }
    return null;
  };
  
  // 1. Tag-Value pair: e.g. "35=D" or "Side=1"
  const tagValMatch = q.match(/^([a-zA-Z0-9_]+)\s*=\s*([^=|]+)$/);
  if (tagValMatch) {
    let tagOrName = tagValMatch[1].trim();
    const val = tagValMatch[2].trim();
    
    // Check custom dialect first
    const customField = getCustomField(tagOrName);
    if (customField) {
      const tagName = customField.name;
      const enumVal = customField.values?.find(v => String(v.enum) === String(val));
      const meaning = enumVal ? enumVal.description : null;
      const src = `custom XML dialect (${customDialect.version})`;
      if (meaning) {
        return `Tag ${customField.tag} (${tagName}) = ${val} (${meaning})\n\nThis definition comes from your uploaded ${src}.`;
      } else {
        return `Tag ${customField.tag} (${tagName}) = ${val}\n\nThis tag is defined in your uploaded ${src}, but no enum description was found for value "${val}".`;
      }
    }
    
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
    const customField = getCustomField(q);
    if (customField) {
      let response = `Tag ${q} represents "${customField.name}" in your custom XML dialect.\n- Type: ${customField.type}`;
      if (customField.values && customField.values.length > 0) {
        response += `\n\nAllowed enum values:\n` + 
          customField.values.map(v => `- ${v.enum}: ${v.description}`).join('\n');
      }
      return response;
    }
    
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

  // 3. Exact Field Name search: e.g. "Side"
  const customField = getCustomField(q);
  if (customField) {
    let response = `Field "${customField.name}" is Tag ${customField.tag} in your custom XML dialect.\n- Type: ${customField.type}`;
    if (customField.values && customField.values.length > 0) {
      response += `\n\nAllowed enum values:\n` + 
        customField.values.map(v => `- ${v.enum}: ${v.description}`).join('\n');
    }
    return response;
  }
  
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
function tryPartialLookup(query, customDialect) {
  const matchedTags = new Set();
  const customMatches = [];
  
  // Extract number strings
  const numbers = query.match(/\b\d+\b/g) || [];
  for (const num of numbers) {
    if (customDialect && Array.isArray(customDialect.fields)) {
      const found = customDialect.fields.find(f => String(f.tag) === String(num));
      if (found) {
        customMatches.push(found);
        continue;
      }
    }
    if (FIX_TAGS[num]) {
      matchedTags.add(num);
    }
  }

  // Extract whole word matching field names
  const words = query.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const word of words) {
    if (!word) continue;
    
    if (customDialect && Array.isArray(customDialect.fields)) {
      customDialect.fields.forEach(f => {
        if (f.name.toLowerCase().includes(word) && !customMatches.some(m => m.tag === f.tag)) {
          customMatches.push(f);
        }
      });
    }
    
    for (const [tag, name] of Object.entries(FIX_TAGS)) {
      if (name.toLowerCase().includes(word)) {
        matchedTags.add(tag);
      }
    }
  }

  let result = "";
  if (customMatches.length > 0) {
    result += `\n\n*Custom Dialect matches (${customDialect.version}):*`;
    customMatches.forEach(f => {
      result += `\n- **Tag ${f.tag} (${f.name})**: Type ${f.type}`;
      if (f.values && f.values.length > 0) {
        result += ` (Enums: ${f.values.slice(0, 3).map(v => `${v.enum}=${v.description}`).join(', ')}${f.values.length > 3 ? '...' : ''})`;
      }
    });
  }

  if (matchedTags.size > 0) {
    result += "\n\n*Standard FIX matches:*";
    Array.from(matchedTags).slice(0, 6).forEach(tag => {
      const name = FIX_TAGS[tag];
      const enums = FIX_VALUES[tag];
      result += `\n- **Tag ${tag} (${name})**: Standard field.`;
      if (enums) {
        result += ` (Common values: ${Object.entries(enums).slice(0, 4).map(([v, n]) => `${v}=${n}`).join(', ')}${Object.keys(enums).length > 4 ? '...' : ''})`;
      }
    });
  }
  
  return result;
}

export async function POST(req) {
  try {
    const { query, customDialect } = await req.json();
    
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
        const parsed = validateFIXMessage(query);
        if (parsed) {
          table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
          
          const symbol = parsed.tags['55'];
          let marketInfo = "";
          if (symbol) {
            marketInfo = await getMarketData(symbol);
          }

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
        const geminiRes = await queryGemini(query, apiKey, systemInstruction);
        answer = geminiRes.answer;
        hfConnected = geminiRes.connected;
      }
    } else {
      // Offline fallback: Highly detailed local lookups
      if (looksLikeFIX(query)) {
        const parsed = validateFIXMessage(query);
        if (parsed) {
          table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
          const version = parsed.tags['8'] || 'Unknown';
          const msgType = parsed.tags['35'] || 'Unknown';
          const msgTypeName = parsed.msgTypeName || 'Unknown';
          const validationStatus = parsed.isValid ? 'Passed' : 'Failed';
          const validationDetails = parsed.isValid ? 'Checksum and BodyLength are correct.' : parsed.errors.join('; ');
          
          answer = `### Parsed FIX Message Details\n` +
            `- **Protocol Version**: ${version}\n` +
            `- **Message Type**: \`${msgType}\` (${msgTypeName})\n` +
            `- **Integrity Check**: **${validationStatus}** (${validationDetails})\n\n` +
            `⚠️ *Note: Gemini API key is not configured. Running in offline fallback dictionary mode.*`;
        } else {
          answer = `⚠️ Failed to parse FIX message structure.\n\n` +
            `⚠️ *Note: Gemini API key is not configured.*`;
        }
      } else {
        // Check standard quick-guides first
        const lowercaseQuery = query.toLowerCase();
        let guideMatch = null;
        for (const [topic, text] of Object.entries(FIX_GUIDES)) {
          if (lowercaseQuery.includes(topic)) {
            guideMatch = text;
            break;
          }
        }

        if (guideMatch) {
          answer = `${guideMatch}\n\n⚠️ *Note: Gemini API key is not configured. Displaying local quick-guide.*`;
        } else {
          const localResult = tryLocalLookup(query, customDialect);
          if (localResult) {
            answer = `${localResult}\n\n⚠️ *Note: Gemini API key is not configured.*`;
          } else {
            const partials = tryPartialLookup(query, customDialect);
            answer = `⚠️ *Gemini API key not found.*\n\n${partials}\n\n*Try searching for general terms like logon, sequence, checksum, body, or resend for quick reference.*`;
          }
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
