# TypeSafe Cloud Project

A project for using [TypeSafe AI](https://typesafe.ai) with Claude Code on the web.

TypeSafe's **System One** models — the flagship being **Jev** — don't generate text.
You send them application state plus typed questions, and they return typed answers
with probabilities in a single parallel pass. Code keeps the workflow; the model
supplies semantic judgment where plain code can't.

The three primitives are **Choice** (pick one of a defined set), **Noul** (does this
condition hold), and **Score** (degree along a described dimension).

## The agent skill

TypeSafe publishes an agent skill that teaches Claude its API, patterns, and
cookbooks. This repo doesn't vendor it — it's installed at the account level, so
it's available in every session without anything committed here.

To install it elsewhere, as a Claude Code plugin:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

Or for other agents:

```bash
npx skills add typesafe-ai/skills --skill typesafe-ai
```

> **Don't try to ship it via committed plugin config.** The documented
> team-distribution route — `extraKnownMarketplaces` + `enabledPlugins` in
> `.claude/settings.json` — is silently ignored in Claude Code web sessions
> ([anthropics/claude-code#78119](https://github.com/anthropics/claude-code/issues/78119),
> open). Committing the skill to `.claude/skills/` does work, if you ever need
> it to travel with the repo for someone without account-level access.

## Calling Jev from code

Get an API key from the TypeSafe console (`console.typesafe.ai/settings/keys`),
then:

```bash
export TYPESAFE_API_KEY=...
uv add typesafe-sdk
```

```python
from typesafe_sdk import Choice, TypeSafeClient

with TypeSafeClient() as client:
    response = client.system_one(
        state={"document": "I was charged twice. Please fix this ASAP."},
        questions={
            "category": Choice(
                instructions="What is this ticket about?",
                criteria={"billing": None, "technical": None, "other": None},
            ),
        },
    )

print(response.choices["category"].choice)
```

Both SDKs read `TYPESAFE_API_KEY` from the environment. Keep the key server-side
in web apps.

## Cloud environment setup

The skill treats <https://docs.typesafe.ai> as its source of truth and fetches
pages live while it works, so the cloud environment has to allow that host.

Open the environment selector at [claude.ai/code](https://claude.ai/code) — the
cloud icon above the message box, there's no settings URL — hover the environment
and click the gear. Then:

- **Network access** → **Custom**, with these in **Allowed domains**:
  ```
  typesafe.ai
  *.typesafe.ai
  ```
  Tick **"Also include default list of common package managers"**, or you'll drop
  npm, PyPI, and the rest of the defaults.
- **Environment variables** → `TYPESAFE_API_KEY=...`, or on Pro/Max use
  **API credentials** so the key never enters the session (Bearer, allowed website
  `api.typesafe.ai`).

Environment config is read at session startup, so start a new session afterward.

See [Configure cloud environments](https://code.claude.com/docs/en/cloud-environments)
for the full reference.
