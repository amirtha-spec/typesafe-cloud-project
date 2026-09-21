# TypeSafe Cloud Project

Support-ticket triage built on [TypeSafe](https://typesafe.ai) System One (Jev):
the model supplies judgement, ordinary TypeScript owns the workflow.

One request classifies a ticket, rates its urgency and impact, and flags payment
details in the body. Code then decides the queue, the priority and whether a
human needs to look first. Runs on Node 22 with no build step and one runtime
dependency.

```
$ npm run triage -- --subject "Site down" --body "URGENT: 500s everywhere, we cannot use the product"

route      queue
category   technical  confidence 0.88
priority   P0
urgency    0.85
severity   2.70 / 3
redaction  not needed

why:
  - Routed to technical (confidence 0.88).
  - Time-critical (0.85).
  - Major impact (severity 2.70 of 3).
```

## Quick start

```bash
npm install

# Offline: local mock, no API key or network needed.
node scripts/mock-server.ts &
TYPESAFE_API_KEY=local-mock TYPESAFE_BASE_URL=http://127.0.0.1:8787 \
  npm run triage -- --body "I was charged twice"

# Live: real API. No TYPESAFE_BASE_URL — the SDK defaults to api.typesafe.ai.
export TYPESAFE_API_KEY=sk-...   # from https://console.typesafe.ai/keys
npm run triage -- --body "I was charged twice"
```

`npm test` (13 tests, no network) and `npm run typecheck` both pass.

## What to review

Two files carry every decision worth arguing about:

| File | Holds |
| --- | --- |
| `src/triage/questions.ts` | The four questions and all four thresholds. **Start here.** |
| `src/triage/triage.ts` | The routing rules applied to the answers. |

Everything else is plumbing. No question text or cutoff is hardcoded anywhere
else, so tuning triage means editing one file.

The questions were drafted by an agent and have never been run against the real
model — expect to rewrite them once you see live answers. That is the normal
workflow, not a defect.

## How the three primitives are used

| Question | Type | Returns | Used for |
| --- | --- | --- | --- |
| `category` | `choice` | label + confidence + per-label probabilities | Which queue |
| `urgency` | `noul` | probability 0–1 | Time pressure |
| `severity` | `score` | expected score 0–3 over a rubric | Impact |
| `containsPaymentDetails` | `noul` | probability 0–1 | Redaction gate |

All four go in a **single** `systemOne` call — one round trip, not one per
question.

Two deliberate choices, both from the TypeSafe guidance on common mistakes:

- **The category is not threshold-picked.** Jev already selects the best label;
  re-deriving one from the probabilities would be redundant. Confidence is used
  only as an *ambiguity gate* — below `MIN_CATEGORY_CONFIDENCE` the ticket goes
  to a human rather than being filed into a guessed queue.
- **Urgency and severity are separate questions.** A wrong invoice on a dormant
  account is severe but not urgent; a password reset before a demo is urgent but
  not severe. Collapsing them loses the distinction that decides priority.

`containsPaymentDetails` is the clearest case for using a model at all: it
replaces a card-number regex, which misses "the one ending 4242", spaced digits,
IBANs and sort codes, and false-positives on order numbers.

## Testing without the API

The SDK accepts an injected `fetch`, so tests exercise the real client —
validation, retries, error mapping, response parsing — with no network:

```ts
const transport = fakeTransport({ answers: { /* ... */ } });
const client = createClient({ apiKey: "test-key", fetch: transport.fetch });
```

Helpers in `src/typesafe/testing.ts` keep fixtures shaped like real responses
(probabilities summing to one, a legend on every score). `scripts/mock-server.ts`
serves the same wire shape over HTTP for end-to-end runs.

**The mock is keyword heuristics, not a model.** It proves the plumbing works.
It says nothing about whether the questions are any good — only a live key can.

## Layout

```
src/triage/questions.ts    questions + thresholds   <- the review surface
src/triage/triage.ts       workflow and routing rules
src/typesafe/client.ts     client construction and config
src/typesafe/testing.ts    test doubles
src/cli.ts                 command-line entry point
scripts/mock-server.ts     offline stand-in for POST /v1/systemone
test/triage.test.ts        13 tests, no network
```

Configuration is read by the SDK from the environment: `TYPESAFE_API_KEY`,
`TYPESAFE_BASE_URL`, `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`) and
`TYPESAFE_LOG_LEVEL`.

## Network requirements

The TypeSafe hosts must be reachable:

| Host | Needed for |
| --- | --- |
| `api.typesafe.ai` | All live API calls |
| `docs.typesafe.ai` | Agents reading the live docs via the skill |
| `console.typesafe.ai` | API keys and cookbooks |

If you are running behind an egress policy — including Claude Code on the web —
these must be allowlisted, or live calls fail at CONNECT with a 403 before
reaching TypeSafe. The mock server path above needs no network at all.

## The TypeSafe agent skill

The [agent skill](https://github.com/typesafe-ai/skills) is vendored at
`.claude/skills/typesafe-ai/` (upstream v0.5.7) so Claude Code picks it up from
the checkout, including in ephemeral web sessions where a home-directory plugin
install would not survive. Ask your agent to "use the TypeSafe skill".

Use this copy only — adding the plugin (`claude plugin install typesafe@typesafe-ai`)
or the skills.sh package as well gives you duplicates. To update:

```bash
git clone --depth 1 https://github.com/typesafe-ai/skills /tmp/typesafe-skills
rm -rf .claude/skills/typesafe-ai
cp -R /tmp/typesafe-skills/skills/typesafe-ai .claude/skills/typesafe-ai
```

Note when installing SDKs: on npm the package is `@typesafe-ai/sdk`; on PyPI it
is `typesafe-sdk` (`typesafe-ai` is a redirect shim). PyPI `typesafe` is an
**unrelated** project by a different author.
