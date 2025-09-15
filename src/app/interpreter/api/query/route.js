import { NextResponse } from "next/server";
import { MODEL, MODEL_MAP } from "@/lib/config";

export async function POST(req) {
  try {
    const { query, context } = await req.json();

    const prompt = `
You are a FIX protocol interpreter. 
Context: ${context}
Message: ${query}
Explain the meaning in plain English with clarity.
`;

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

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    const output =
      (data[0]?.generated_text || "")
        .replace(prompt, "")
        .trim() || "No response generated.";

    return NextResponse.json({ answer: output });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
