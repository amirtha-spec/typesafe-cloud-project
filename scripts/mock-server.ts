/**
 * A local stand-in for POST /v1/systemone.
 *
 * It exists so the whole pipeline can be run end to end without reaching
 * api.typesafe.ai: same wire shape, same field names, keyword heuristics in
 * place of judgement. It is a plumbing check, not an accuracy check — the
 * answers are crude by construction, and nothing about model quality can be
 * concluded from them.
 *
 *   node scripts/mock-server.ts &
 *   TYPESAFE_API_KEY=local TYPESAFE_BASE_URL=http://127.0.0.1:8787 \
 *     npm run triage -- --body "I was charged twice"
 */

import { createServer } from "node:http";
import { choiceAnswer, noulAnswer, scoreAnswer } from "../src/typesafe/testing.ts";
import { TRIAGE_QUESTIONS } from "../src/triage/questions.ts";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const LABELS = Object.keys(TRIAGE_QUESTIONS.category.criteria);
const LEVELS = TRIAGE_QUESTIONS.severity.criteria as readonly string[];

const has = (text: string, words: string[]) =>
  words.some((w) => text.toLowerCase().includes(w));

function answerFor(state: unknown) {
  const text = JSON.stringify(state ?? "").toLowerCase();

  const category = has(text, ["charge", "invoice", "refund", "billed", "payment", "price"])
    ? "billing"
    : has(text, ["error", "500", "crash", "broken", "down", "slow", "bug"])
      ? "technical"
      : has(text, ["login", "password", "access", "permission", "seat", "sso"])
        ? "account"
        : "other";

  const urgent = has(text, ["urgent", "asap", "immediately", "down", "outage", "blocked", "losing"]);
  const severe = has(text, ["down", "outage", "cannot", "can't", "unusable", "data loss", "critical"]);
  const payment = /\b(?:\d[ -]?){13,16}\b/.test(text) || has(text, ["cvv", "iban", "sort code"]);

  return {
    category: choiceAnswer(category, category === "other" ? 0.42 : 0.88, LABELS),
    urgency: noulAnswer(urgent ? 0.85 : 0.2),
    severity: scoreAnswer(severe ? 2.7 : urgent ? 1.8 : 0.6, LEVELS),
    containsPaymentDetails: noulAnswer(payment ? 0.93 : 0.04),
  };
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/v1/systemone")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "not found" } }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c as Buffer));
  req.on("end", () => {
    let state: unknown;
    try {
      state = JSON.parse(Buffer.concat(chunks).toString("utf8")).state;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "invalid JSON body" } }));
      return;
    }
    res.writeHead(200, {
      "content-type": "application/json",
      "x-typesafe-request-id": `req_mock_${Date.now()}`,
    });
    res.end(
      JSON.stringify({
        model: "jev-mock",
        answers: answerFor(state),
        usage: { input_tokens: 100, output_tokens: 25 },
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock systemone listening on http://127.0.0.1:${PORT}`);
  console.log("NOT the real model — keyword heuristics for plumbing only.");
});
