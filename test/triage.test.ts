import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createClient } from "../src/typesafe/client.ts";
import { triageTicket } from "../src/triage/triage.ts";
import { TRIAGE_QUESTIONS, THRESHOLDS } from "../src/triage/questions.ts";
import {
  choiceAnswer,
  noulAnswer,
  scoreAnswer,
  fakeTransport,
  type AnyAnswer,
} from "../src/typesafe/testing.ts";
import { APIError, AuthenticationError } from "@typesafe-ai/sdk";

const LABELS = Object.keys(TRIAGE_QUESTIONS.category.criteria);
const LEVELS = TRIAGE_QUESTIONS.severity.criteria as readonly string[];

/** Sensible defaults; each test overrides only the answer it cares about. */
function answers(over: Partial<Record<string, AnyAnswer>> = {}) {
  return {
    category: choiceAnswer("billing", 0.91, LABELS),
    urgency: noulAnswer(0.1),
    severity: scoreAnswer(0.5, LEVELS),
    containsPaymentDetails: noulAnswer(0.02),
    ...over,
  } as Record<string, AnyAnswer>;
}

function clientWith(over?: Partial<Record<string, AnyAnswer>>) {
  const transport = fakeTransport({ answers: answers(over) });
  const client = createClient({
    apiKey: "test-key",
    baseURL: "https://api.example.invalid",
    fetch: transport.fetch,
  });
  return { client, transport };
}

describe("triageTicket", () => {
  test("routes a confident category to its queue", async () => {
    const { client } = clientWith();
    const r = await triageTicket(client, { body: "I was charged twice." });

    assert.equal(r.route, "queue");
    assert.equal(r.category, "billing");
    assert.equal(r.priority, "P3");
    assert.equal(r.redactionRequired, false);
  });

  test("sends state and every question in a single request", async () => {
    const { client, transport } = clientWith();
    await triageTicket(client, {
      subject: "Double charge",
      body: "Charged twice",
      context: { plan: "pro" },
    });

    assert.equal(transport.calls.length, 1, "one round trip, not one per question");
    const body = transport.calls[0]!.body as any;
    assert.deepEqual(Object.keys(body.questions).sort(), [
      "category",
      "containsPaymentDetails",
      "severity",
      "urgency",
    ]);
    assert.equal(body.state.subject, "Double charge");
    assert.deepEqual(body.state.context, { plan: "pro" });
    assert.ok(body.model, "model is resolved before sending");
  });

  test("an ambiguous category goes to a human instead of a queue", async () => {
    const below = THRESHOLDS.MIN_CATEGORY_CONFIDENCE - 0.01;
    const { client } = clientWith({ category: choiceAnswer("other", below, LABELS) });
    const r = await triageTicket(client, { body: "hello?" });

    assert.equal(r.route, "human_review");
    assert.equal(r.category, null, "no queue is guessed at below the bar");
    assert.match(r.reasons[0]!, /unclear/i);
  });

  test("confidence exactly at the threshold routes to the queue", async () => {
    const { client } = clientWith({
      category: choiceAnswer("technical", THRESHOLDS.MIN_CATEGORY_CONFIDENCE, LABELS),
    });
    const r = await triageTicket(client, { body: "edge" });
    assert.equal(r.route, "queue", "the bar is inclusive");
    assert.equal(r.category, "technical");
  });

  test("urgency and severity together produce P0", async () => {
    const { client } = clientWith({
      urgency: noulAnswer(0.95),
      severity: scoreAnswer(2.8, LEVELS),
    });
    const r = await triageTicket(client, { body: "Everything is down." });
    assert.equal(r.priority, "P0");
  });

  test("urgency alone is P1, severity alone is P2", async () => {
    const urgentOnly = clientWith({ urgency: noulAnswer(0.9), severity: scoreAnswer(0.4, LEVELS) });
    assert.equal((await triageTicket(urgentOnly.client, { body: "asap" })).priority, "P1");

    const severeOnly = clientWith({ urgency: noulAnswer(0.05), severity: scoreAnswer(2.5, LEVELS) });
    assert.equal((await triageTicket(severeOnly.client, { body: "broken" })).priority, "P2");
  });

  test("suspected payment details force redaction", async () => {
    const { client } = clientWith({ containsPaymentDetails: noulAnswer(0.97) });
    const r = await triageTicket(client, { body: "my card is 4242 4242 4242 4242" });

    assert.equal(r.redactionRequired, true);
    assert.ok(r.reasons.some((x) => /redaction/i.test(x)));
  });

  test("reports model and usage for observability", async () => {
    const { client } = clientWith();
    const r = await triageTicket(client, { body: "hi" });
    assert.equal(r.model, "jev-latest");
    assert.equal(r.usage.input_tokens, 128);
  });
});

describe("failure handling", () => {
  test("a 401 surfaces as AuthenticationError, not a bad route", async () => {
    const transport = fakeTransport({ answers: answers() }, { status: 401 });
    const client = createClient({
      apiKey: "bad",
      baseURL: "https://api.example.invalid",
      fetch: transport.fetch,
    });

    await assert.rejects(
      () => triageTicket(client, { body: "x" }),
      (e: unknown) => e instanceof AuthenticationError && (e as APIError).status === 401,
    );
  });

  test("a missing API key fails loudly at construction", () => {
    const saved = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      assert.throws(() => createClient());
    } finally {
      if (saved !== undefined) process.env.TYPESAFE_API_KEY = saved;
    }
  });
});

describe("questions and thresholds", () => {
  test("severity rubric has at least two levels, as the API requires", () => {
    assert.ok(LEVELS.length >= 2);
  });

  test("category labels all carry a description", () => {
    for (const [label, description] of Object.entries(TRIAGE_QUESTIONS.category.criteria)) {
      assert.ok(description, `${label} needs a description so Jev is not guessing at the name`);
    }
  });

  test("every threshold probability stays within its range", () => {
    for (const key of ["MIN_CATEGORY_CONFIDENCE", "URGENT_AT", "REDACT_PAYMENT_AT"] as const) {
      const v = THRESHOLDS[key];
      assert.ok(v > 0 && v <= 1, `${key} must be a probability`);
    }
    assert.ok(
      THRESHOLDS.SEVERITY_ESCALATE_AT > 0 && THRESHOLDS.SEVERITY_ESCALATE_AT <= LEVELS.length - 1,
      "escalation point must be reachable on the rubric",
    );
  });
});
