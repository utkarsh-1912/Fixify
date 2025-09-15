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

  const summary = [];
  for (const [tag, value, tagName, mappedValue] of rows) {
    if (tag === "35") summary.push(`Type: ${mappedValue}`);
    if (tag === "54") summary.push(`Side: ${mappedValue}`);
    if (tag === "55") summary.push(`Symbol: ${value}`);
    if (tag === "38") summary.push(`Qty: ${value}`);
  }

  return { rows, summary: summary.join(", ") };
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    // Handle FIX messages
    if (looksLikeFIX(query)) {
      const { rows, summary } = parseFIX(query);
      return NextResponse.json({ answer: summary, table: rows });
    }

    // Otherwise call Hugging Face model
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL_MAP[MODEL]}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: query,
          parameters: { max_new_tokens: 300, temperature: 0.2 },
        }),
      }
    );

    const data = await response.json();

    let output = "No response generated.";
    if (Array.isArray(data) && data[0]?.generated_text) {
      output = data[0].generated_text.trim();
    } else if (typeof data === "object" && data.generated_text) {
      output = data.generated_text.trim();
    } else if (data.error) {
      output = `⚠️ Model error: ${data.error}`;
    }

    return NextResponse.json({ answer: output, table: null });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
