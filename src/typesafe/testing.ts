/**
 * Test doubles for the TypeSafe API.
 *
 * The SDK accepts an injected `fetch`, so tests exercise the real client —
 * validation, error mapping, response parsing — without a network. Building
 * answers through these helpers keeps fixtures shaped like real responses
 * (probabilities that sum to one, a legend on every score) instead of drifting
 * into shapes the API would never return.
 */

import type { Fetch } from "@typesafe-ai/sdk";

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
};
export type AnyAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export function noulAnswer(probability: number): NoulAnswer {
  return { type: "noul", noul: probability };
}

/**
 * Give `selected` the stated confidence and spread the remainder evenly across
 * the other labels, so probabilities always sum to one.
 */
export function choiceAnswer(
  selected: string,
  confidence: number,
  labels: readonly string[],
): ChoiceAnswer {
  const others = labels.filter((l) => l !== selected);
  const share = others.length > 0 ? (1 - confidence) / others.length : 0;
  const probabilities: Record<string, number> = { [selected]: confidence };
  for (const label of others) probabilities[label] = share;
  return { type: "choice", choice: selected, confidence, probabilities };
}

/**
 * Concentrate probability on the levels bracketing `expected`, so the reported
 * expected value is consistent with the distribution around it.
 */
export function scoreAnswer(
  expected: number,
  levels: readonly string[],
  confidence = 0.8,
): ScoreAnswer {
  const lower = Math.max(0, Math.min(levels.length - 1, Math.floor(expected)));
  const upper = Math.min(levels.length - 1, lower + 1);
  const frac = expected - lower;
  const probabilities: Record<string, number> = {};
  levels.forEach((_, i) => (probabilities[String(i)] = 0));
  if (lower === upper) {
    probabilities[String(lower)] = 1;
  } else {
    probabilities[String(lower)] = 1 - frac;
    probabilities[String(upper)] = frac;
  }
  const legend: Record<string, string> = {};
  levels.forEach((text, i) => (legend[String(i)] = text));
  return { type: "score", score: expected, confidence, legend, probabilities };
}

export type FakeResponseSpec = {
  answers: Record<string, AnyAnswer>;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
};

/** Records what each call received, for assertions on the request body. */
export type FakeTransport = {
  fetch: Fetch;
  calls: { url: string; body: unknown }[];
};

/**
 * A transport that answers every systemOne call with `spec`, or fails with
 * `status` when one is given.
 */
export function fakeTransport(
  spec: FakeResponseSpec | ((body: any) => FakeResponseSpec),
  options: { status?: number; errorBody?: unknown } = {},
): FakeTransport {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: Fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });

    if (options.status && options.status >= 400) {
      return new Response(
        JSON.stringify(options.errorBody ?? { error: { message: "fake failure" } }),
        { status: options.status, headers: { "content-type": "application/json" } },
      );
    }

    const resolved = typeof spec === "function" ? spec(body) : spec;
    return new Response(
      JSON.stringify({
        model: resolved.model ?? "jev-latest",
        answers: resolved.answers,
        usage: resolved.usage ?? { input_tokens: 128, output_tokens: 32 },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-typesafe-request-id": "req_fake_0001",
        },
      },
    );
  };
  return { fetch, calls };
}
