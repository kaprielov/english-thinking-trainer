import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";

import { normalizeAnswer } from "../src/lib/grading.mjs";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const PORT = Number(process.env.PORT || 8787);
const LLMGATEWAY_API_KEY = process.env.LLMGATEWAY_API_KEY;
const REQUEST_TIMEOUT_MS = 12000;
const client = new OpenAI({
  apiKey: LLMGATEWAY_API_KEY ?? "",
  baseURL: "https://api.llmgateway.io/v1/",
});
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function stripJsonFence(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function normalizeExamples(examples) {
  if (!Array.isArray(examples)) return [];
  return examples.map((item) => String(item).trim()).filter(Boolean).slice(0, 5);
}

function fallbackResponse(payload) {
  const pattern = payload.pattern ?? {};
  return {
    // "ungraded" tells the client the answer could not be judged; it must NOT be
    // counted as a mistake. The client offers self-assessment instead.
    source: "fallback",
    grade: "ungraded",
    rubric: null,
    correctedAnswer: pattern.correctEnglish || "",
    reasonWhyUnnatural:
      "The API could not be reached, so the app fell back to the built-in pattern metadata.",
    nativeSpeakerThinking: pattern.nativeThinking || "",
    patternSummary: pattern.title || "",
    moreExamples: normalizeExamples(pattern.examples),
    commonMistake: (pattern.commonMistakes && pattern.commonMistakes[0]) || "",
  };
}

// Cache LLM verdicts so repeated submissions of the same answer don't re-hit the
// gateway. Keyed by exercise type + prompt + normalized answer.
const verdictCache = new Map();
const VERDICT_CACHE_LIMIT = 500;

function cacheKey(payload) {
  const exercise = payload.exercise ?? {};
  return [exercise.type || "", normalizeAnswer(exercise.prompt || ""), normalizeAnswer(payload.answer || "")].join("|");
}

function rememberVerdict(key, value) {
  if (verdictCache.size >= VERDICT_CACHE_LIMIT) {
    const oldest = verdictCache.keys().next().value;
    if (oldest !== undefined) verdictCache.delete(oldest);
  }
  verdictCache.set(key, value);
}

async function evaluateAnswer(payload) {
  if (!LLMGATEWAY_API_KEY) {
    return fallbackResponse(payload);
  }

  const key = cacheKey(payload);
  const cached = verdictCache.get(key);
  if (cached) return { ...cached, source: "cache" };

  const pattern = payload.pattern ?? {};
  const exercise = payload.exercise ?? {};
  const prompt = [
    "You are an English pattern coach.",
    "Judge the learner's answer along three independent dimensions for the given pattern.",
    "Return only strict JSON with keys:",
    "usesPattern:boolean (does the answer use the target construction), grammatical:boolean, natural:boolean (does it sound like a native speaker), correctedAnswer:string, reasonWhyUnnatural:string, nativeSpeakerThinking:string, moreExamples:string[], commonMistake:string",
    "Do not add markdown, code fences, or extra keys.",
    "",
    `Pattern title: ${pattern.title || ""}`,
    `Pattern description: ${pattern.description || ""}`,
    `Native thinking: ${pattern.nativeThinking || ""}`,
    `Literal learner translation: ${pattern.literalThinking || ""}`,
    `Correct English: ${pattern.correctEnglish || ""}`,
    `Common mistakes: ${(pattern.commonMistakes || []).join(" | ")}`,
    `Examples: ${(pattern.examples || []).join(" | ")}`,
    "",
    `Exercise type: ${exercise.type || ""}`,
    `Exercise prompt: ${exercise.prompt || ""}`,
    `Learner answer: ${payload.answer || ""}`,
  ].join("\n");

  try {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`LLM Gateway timed out after ${REQUEST_TIMEOUT_MS}ms`)),
        REQUEST_TIMEOUT_MS,
      );
    });

    try {
      const request = client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a precise evaluator for English learning patterns. Focus on naturalness, not just literal correctness.",
          },
          { role: "user", content: prompt },
        ],
        // @ts-expect-error LLM Gateway extension
        free_models_only: true,
      });

      const response = await Promise.race([request, timeout]);

      const content = response?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("LLM Gateway returned an empty answer.");
      }

      const parsed = JSON.parse(stripJsonFence(content));
      const parsedExamples = Array.isArray(parsed.moreExamples) ? parsed.moreExamples : pattern.examples;

      const result = {
        source: "llmgateway",
        // Advisory rubric — the client folds this into a final grade and drives
        // progress primarily from its own deterministic checks.
        rubric: {
          usesPattern: Boolean(parsed.usesPattern),
          grammatical: Boolean(parsed.grammatical),
          natural: Boolean(parsed.natural),
        },
        correctedAnswer: String(parsed.correctedAnswer || pattern.correctEnglish || ""),
        reasonWhyUnnatural: String(parsed.reasonWhyUnnatural || pattern.description || ""),
        nativeSpeakerThinking: String(parsed.nativeSpeakerThinking || pattern.nativeThinking || ""),
        patternSummary: String(pattern.title || ""),
        moreExamples: normalizeExamples(parsedExamples),
        commonMistake: String(parsed.commonMistake || (pattern.commonMistakes && pattern.commonMistakes[0]) || ""),
      };

      rememberVerdict(key, result);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return {
      ...fallbackResponse(payload),
      error: error instanceof Error ? error.message : "DeepSeek request failed",
    };
  }
}

export function createApiServer({ evaluator = evaluateAnswer } = {}) {
  return http.createServer(async (req, res) => {
    if (!req.url) {
      sendJson(res, 400, { error: "Missing URL" });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url === "/api/check-answer") {
      try {
        const body = await readBody(req);
        const result = await evaluator(body);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 200, {
          ...fallbackResponse({}),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createApiServer();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`API server listening on http://127.0.0.1:${PORT}`);
  });
}
