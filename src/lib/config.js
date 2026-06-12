// src/lib/config.js
export const MODEL = process.env.MODEL || "falcon";

export const MODEL_MAP = {
  falcon: "tiiuae/falcon-7b-instruct",
  gptj: "EleutherAI/gpt-j-6B",
  bloom: "bigscience/bloom-7b1",
  apertus: "swiss-ai/Apertus-8B-Instruct-2509",
};
