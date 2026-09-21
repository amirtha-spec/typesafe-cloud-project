# TypeSafe Cloud Project

A project for using [TypeSafe AI](https://typesafe.ai) with Claude Code on the web.

TypeSafe's **System One** models — the flagship being **Jev** — don't generate text.
You send them application state plus typed questions, and they return typed answers
with probabilities in a single parallel pass. Code keeps the workflow; the model
supplies semantic judgment where plain code can't.

The three primitives are **Choice** (pick one of a defined set), **Noul** (does this
condition hold), and **Score** (degree along a described dimension).

## What's set up here

The TypeSafe agent skill is vendored into [`.claude/skills/typesafe-ai/`](.claude/skills/typesafe-ai/).
Claude Code loads project skills automatically, so it's active in any session opened
on this repo — web or local — with nothing to install.

Ask for it in plain language ("use TypeSafe to route these tickets by department"),
or invoke it directly with `/typesafe-ai`.

### Why vendored instead of installed as a plugin

Upstream ships this as a Claude Code plugin:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

That works locally, but the repo-committed equivalent
(`extraKnownMarketplaces` + `enabledPlugins` in `.claude/settings.json`) is
silently ignored in Claude Code web sessions —
[anthropics/claude-code#78119](https://github.com/anthropics/claude-code/issues/78119),
still open. Since this repo exists for web use, the skill is committed directly
instead. No marketplace, no per-session install step.

Refresh the vendored copy from upstream with:

```bash
./scripts/update-typesafe-skill.sh
```

## Calling Jev from code

Get an API key from the TypeSafe dashboard and export it:

```bash
export TYPESAFE_API_KEY=...
```

Python:

```bash
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

Keep the key server-side in web apps.

## Known limitation in this environment

The skill treats <https://docs.typesafe.ai> as its source of truth and fetches
pages live while it works. That host is currently **blocked by this environment's
network egress policy**, so the skill runs on its built-in guidance alone and
can't pull current API contracts, cookbooks, or SDK references.

To lift it, add `docs.typesafe.ai` to the allowed domains for this environment's
network policy — see the
[Claude Code on the web docs](https://code.claude.com/docs/en/claude-code-on-the-web).

## License

The vendored skill is MIT, copyright TypeSafe AI — see
[`.claude/skills/typesafe-ai/LICENSE`](.claude/skills/typesafe-ai/LICENSE).
