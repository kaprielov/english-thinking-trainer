import { PassThrough } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";

import { createApiServer } from "../scripts/api-server.mjs";

function invoke(server, { method, url, body }) {
  return new Promise((resolve, reject) => {
    const req = new PassThrough();
    req.method = method;
    req.url = url;

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      },
    };

    server.emit("request", req, res);

    if (body !== undefined) {
      req.end(JSON.stringify(body));
    } else {
      req.end();
    }

    req.on("error", reject);
  });
}

test("POST /api/check-answer returns a rubric-based evaluation from injected AI client", async () => {
  const server = createApiServer({
    evaluator: async () => ({
      source: "llmgateway",
      rubric: { usesPattern: true, grammatical: true, natural: true },
      correctedAnswer: "How was your trip?",
      reasonWhyUnnatural: "Literal translation does not sound native.",
      nativeSpeakerThinking: "English describes the experience, not the verb 'pass'.",
      patternSummary: "How was + event",
      moreExamples: ["How was your weekend?", "How was the interview?"],
      commonMistake: "How did your trip pass?",
    }),
  });

  const response = await invoke(server, {
    method: "POST",
    url: "/api/check-answer",
    body: {
      answer: "How did your trip pass?",
      exercise: { type: "translation", prompt: "Как прошла поездка?" },
      pattern: {
        title: "How was + event",
        description: "English describes the experience.",
        nativeThinking: "Что это было за событие?",
        literalThinking: "How did the trip pass?",
        correctEnglish: "How was your trip?",
        commonMistakes: ["How did your trip pass?"],
        examples: ["How was your weekend?", "How was the interview?"],
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.source, "llmgateway");
  assert.deepEqual(data.rubric, { usesPattern: true, grammatical: true, natural: true });
  assert.equal(data.correctedAnswer, "How was your trip?");
  assert.equal(data.patternSummary, "How was + event");
  assert.equal(data.moreExamples.length, 2);
});

test("GET /api/health responds ok", async () => {
  const server = createApiServer({
    evaluator: async () => ({
      source: "llmgateway",
      rubric: { usesPattern: true, grammatical: true, natural: true },
      correctedAnswer: "",
      reasonWhyUnnatural: "",
      nativeSpeakerThinking: "",
      patternSummary: "",
      moreExamples: [],
      commonMistake: "",
    }),
  });

  const response = await invoke(server, {
    method: "GET",
    url: "/api/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});
