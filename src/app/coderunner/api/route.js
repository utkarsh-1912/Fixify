// import fetch from 'node-fetch';

const JUDGE0_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || "";

const languageMap = {
  cpp: 54,
  java: 62,
  python: 71,
};

async function createSubmission(source_code, language_id, stdin = "") {
  const url = `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`;
  const body = { source_code, language_id, stdin };
  const headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": JUDGE0_KEY,
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
  };
  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return resp.json();
}

async function getSubmission(token) {
  const url = `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`;
  const headers = {
    "X-RapidAPI-Key": JUDGE0_KEY,
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
  };
  const resp = await fetch(url, { headers });
  return resp.json();
}

export async function POST(req) {
  try {
    const { language, source, stdin } = await req.json();
    const language_id = languageMap[language];
    if (!language_id) {
      return new Response(JSON.stringify({ error: "language not supported" }), { status: 400 });
    }

    const create = await createSubmission(source, language_id, stdin || "");
    if (!create.token) {
      return new Response(JSON.stringify({ error: "submission creation failed", raw: create }), { status: 500 });
    }

    // Poll until result
    let out;
    for (let i = 0; i < 30; i++) {
      out = await getSubmission(create.token);
      if (out.status && out.status.id > 2) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    return new Response(JSON.stringify(out), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
