// src/app/coderunner/api/route.js
import { jsonError, rateLimit, readJson } from "@/lib/serverGuards";

const JUDGE0_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || "";

const languageMap = {
  cpp: 54,
  java: 62,
  python: 71,
};

const MAX_SOURCE_CHARS = 64 * 1024;
const MAX_STDIN_CHARS = 16 * 1024;
const MAX_BODY_BYTES = MAX_SOURCE_CHARS + MAX_STDIN_CHARS + 1024;
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 40; // ~60 s

const judgeHeaders = {
  "X-RapidAPI-Key": JUDGE0_KEY,
  "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
};

async function createSubmission(source_code, language_id, stdin = "") {
  const resp = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...judgeHeaders },
    body: JSON.stringify({ source_code, language_id, stdin }),
    signal: AbortSignal.timeout(15000),
  });
  return resp.json();
}

async function getSubmission(token) {
  const resp = await fetch(`${JUDGE0_URL}/submissions/${encodeURIComponent(token)}?base64_encoded=false`, {
    headers: judgeHeaders,
    signal: AbortSignal.timeout(15000),
  });
  return resp.json();
}

export async function POST(req) {
  // Judge0 is a paid, shared quota: keep each client to a handful of runs per minute.
  const limited = rateLimit(req, "coderunner", { limit: 8 });
  if (limited) return limited;

  try {
    const { language, source, stdin } = await readJson(req, MAX_BODY_BYTES);
    const language_id = languageMap[language];
    if (!language_id) return jsonError("Language not supported.", 400);
    if (typeof source !== "string" || !source.trim()) return jsonError("Source code is required.", 400);
    if (source.length > MAX_SOURCE_CHARS) return jsonError(`Source is larger than ${MAX_SOURCE_CHARS / 1024} KB.`, 413);
    if (stdin != null && (typeof stdin !== "string" || stdin.length > MAX_STDIN_CHARS)) {
      return jsonError(`stdin must be a string up to ${MAX_STDIN_CHARS / 1024} KB.`, 413);
    }

    const create = await createSubmission(source, language_id, stdin || "");
    if (!create.token) {
      console.error("Judge0 submission creation failed:", create);
      return jsonError("The code execution service rejected the submission.", 502);
    }

    let out;
    for (let i = 0; i < MAX_POLLS; i++) {
      out = await getSubmission(create.token);
      if (out.status && out.status.id > 2) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!out?.status || out.status.id <= 2) return jsonError("Execution timed out waiting for a result.", 504);

    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err.status) return jsonError(err.message, err.status);
    console.error("coderunner error:", err);
    return jsonError("Code execution service unavailable.", 502);
  }
}
