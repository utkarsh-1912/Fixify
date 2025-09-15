const MODEL = process.env.MODEL || "falcon";

const MODEL_MAP = {
  falcon: "tiiuae/falcon-7b-instruct",
  gptj: "EleutherAI/gpt-j-6B",
  bloom: "bigscience/bloom-7b1",
};

module.exports = { MODEL, MODEL_MAP };
