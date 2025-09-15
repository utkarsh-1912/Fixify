import { NextResponse } from "next/server";
import { MODEL, MODEL_MAP } from "@/lib/config";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";

function looksLikeFIX(input) {
  return input.includes("=") && input.includes("|");
}

function parseFIX(message) {
  return message.split("|").map((pair) => {
    const [tag, value] = pair.split("=");
    const tagName = FIX_TAGS[tag] || "";
    const mappedValue = FIX_VALUES[tag]?.[value] || value;
    return [tag, value, tagName, mappedValue];
  });
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    let table = null;
    let prompt = query;

    if (looksLikeFIX(query)) {
      table = parseFIX(query);
      prompt = `
Interpret this FIX message in plain English, describing its purpose and meaning:

${query}
`;
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL_MAP[MODEL]}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: 300, temperature: 0.2 },
        }),
      }
    );

    const data = await response.json();

    const output =
      (data[0]?.generated_text || "").replace(prompt, "").trim() ||
      "No response generated.";

    return NextResponse.json({ answer: output, table });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
