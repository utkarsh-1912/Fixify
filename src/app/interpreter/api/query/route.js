import { NextResponse } from "next/server";
import { MODEL, MODEL_MAP } from "@/lib/config";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";
import yahooFinance from 'yahoo-finance2';

// Detect FIX messages
function looksLikeFIX(input) {
  return /^8=FIX\./.test(input);
}

// Parse FIX message into table
function parseFIX(message) {
  return message.split("|").map((pair) => {
    const [tag, value] = pair.split("=");
    const tagName = FIX_TAGS[tag] || "";
    const mappedValue = FIX_VALUES[tag]?.[value] || value;
    return [tag, value, tagName, mappedValue];
  });
}

// Generate human-readable summary for multiple FIX types
function interpretFIX(rows) {
  const msgTypeTag = rows.find((r) => r[0] === "35");
  const msgType = msgTypeTag ? msgTypeTag[3] || msgTypeTag[1] : "Unknown";
  let summary = msgType;

  switch (msgTypeTag?.[1]) {
    case "D": // New Order Single
      const sideD = rows.find((r) => r[0] === "54")?.[3] || "—";
      const qtyD = rows.find((r) => r[0] === "38")?.[1] || "—";
      const symbolD = rows.find((r) => r[0] === "55")?.[1] || "—";
      const ordType = rows.find((r) => r[0] === "40")?.[3] || "—";
      summary += ` → ${sideD} ${qtyD} ${symbolD} at ${ordType}`;
      break;
    case "P": // Allocation
      const allocRef = rows.find((r) => r[0] === "70")?.[1] || "—";
      const allocDate = rows.find((r) => r[0] === "75")?.[1] || "—";
      const allocQty = rows.find((r) => r[0] === "87")?.[1] || "—";
      summary += ` → AllocationRef: ${allocRef}, Date: ${allocDate}, Qty: ${allocQty}`;
      break;
    case "F": // Order Cancel Request
    case "G": // Order Cancel/Replace Request
    case "J": // Allocation Instruction
    case "AK": // Allocation Report Ack
    case "AU": // Allocation Report
      summary += " → Fields not mapped, see table for details";
      break;
    default:
      summary += " → Unknown FIX type, see table for details";
  }

  return summary;
}

// Fetch market data via yfinance
async function getMarketData(symbol) {
  try {
    const quote = await yahooFinance.quote({ symbol });
    return quote?.price ? `Current Price of ${symbol}: ${quote.price}` : `Market data not found for ${symbol}`;
  } catch {
    return `Market data not found for ${symbol}`;
  }
}

// Hugging Face query
async function queryHF(prompt) {
  if (!process.env.HF_API_KEY) return { answer: "HF not configured", connected: false };

  const modelId = MODEL_MAP[MODEL];
  if (!modelId) return { answer: `⚠️ Unknown model: ${MODEL}`, connected: false };

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 300, temperature: 0.2 },
      }),
    });

    const data = await res.json().catch(() => null);
    console.log("HF response:", data);

    // Defensive parsing
    let output = "⚠️ No response generated.";
    if (Array.isArray(data) && data.length > 0) {
      if (data[0]?.generated_text) output = data[0].generated_text.trim();
      else if (typeof data[0] === "string") output = data[0];
    } else if (typeof data === "object" && data) {
      if (data.generated_text) output = data.generated_text.trim();
      else if (data.error) output = `⚠️ Model error: ${data.error}`;
    }

    return { answer: output, connected: true };
  } catch (err) {
    return { answer: `⚠️ HF request failed: ${err.message}`, connected: false };
  }
}


// Optional HF connectivity check
async function checkHFConnection() {
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL_MAP[MODEL]}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: "Hello", parameters: { max_new_tokens: 1 } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Main POST handler
export async function POST(req) {
  try {
    const { query } = await req.json();
    let table = null;
    let answer = "";
    let hfConnected = false;

    if (looksLikeFIX(query)) {
      table = parseFIX(query);
      answer = interpretFIX(table);

      // Get market price if symbol exists
      const symbol = table.find((r) => r[0] === "55")?.[1];
      if (symbol) {
        const marketInfo = await getMarketData(symbol);
        answer += ` | ${marketInfo}`;
      }

      hfConnected = await checkHFConnection();
    } else {
      // Non-FIX query → HF fallback
      const hfRes = await queryHF(query);
      answer = hfRes.answer;
      hfConnected = hfRes.connected;
    }

    return NextResponse.json({ answer, table, hfConnected });
  } catch (err) {
    return NextResponse.json({ answer: err.message || "Unknown error", table: null, hfConnected: false }, { status: 500 });
  }
}
