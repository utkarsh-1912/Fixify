import { NextResponse } from "next/server";
import { MODEL, MODEL_MAP } from "@/lib/config";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";

function looksLikeFIX(input) {
  return /^8=FIX\./.test(input);
}

function parseFIX(message) {
  const rows = message.split("|").map((pair) => {
    const [tag, value] = pair.split("=");
    const tagName = FIX_TAGS[tag] || "";
    const mappedValue = FIX_VALUES[tag]?.[value] || value;
    return [tag, value, tagName, mappedValue];
  });

  // Meaningful interpretation
  let summary = [];
  let ordType = FIX_VALUES["40"]?.[rows.find(r => r[0]==="40")?.[1]] || "—";
  let side = FIX_VALUES["54"]?.[rows.find(r => r[0]==="54")?.[1]] || "—";
  let qty = rows.find(r => r[0]==="38")?.[1] || "—";
  let symbol = rows.find(r => r[0]==="55")?.[1] || "—";
  let msgType = FIX_VALUES["35"]?.[rows.find(r => r[0]==="35")?.[1]] || "—";

  summary.push(`${msgType} → ${side} ${qty} ${symbol} at ${ordType}`);

  return { rows, summary: summary.join(", ") };
}

// Ping HF model to check connection
async function checkHFConnection() {
  if (!process.env.HF_API_KEY) return false;
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL_MAP[MODEL]}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: "Hello", parameters: { max_new_tokens: 1 } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function queryHF(prompt) {
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL_MAP[MODEL]}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 300, temperature: 0.2 } }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      return { answer: "⚠️ HF returned non-JSON response", connected: false };
    }

    let output = "No response generated.";
    if (Array.isArray(data) && data[0]?.generated_text) output = data[0].generated_text.trim();
    else if (typeof data === "object" && data.generated_text) output = data.generated_text.trim();
    else if (data.error) output = `⚠️ Model error: ${data.error}`;

    return { answer: output, connected: true };
  } catch (err) {
    return { answer: `⚠️ HF request failed: ${err.message}`, connected: false };
  }
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    // --- FIX message path
    if (looksLikeFIX(query)) {
      const { rows, summary } = parseFIX(query);
      const hfConnected = await checkHFConnection(); // optional ping
      return NextResponse.json({ answer: summary, table: rows, hfConnected });
    }

    // --- Non-FIX → Hugging Face
    const hfRes = await queryHF(query);
    return NextResponse.json({ answer: hfRes.answer, table: null, hfConnected: hfRes.connected });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Unknown error", hfConnected: false }, { status: 500 });
  }
}
