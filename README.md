# TypeSafe Cloud Project

A project for using TypeSafe with Claude Code on the web.

## TypeSafe agent skill

The [TypeSafe agent skill](https://github.com/typesafe-ai/skills) is vendored into
this repo at `.claude/skills/typesafe-ai/` (upstream `v0.5.7`), so Claude Code
sessions — including ephemeral web sessions — pick it up automatically from the
checkout. Invoke it by asking your agent to "use the TypeSafe skill".

Use this manual install only; do not also add the plugin
(`claude plugin install typesafe@typesafe-ai`) or the skills.sh package, or you
will end up with duplicate copies.

To update, replace the directory with the latest upstream version:

```bash
git clone --depth 1 https://github.com/typesafe-ai/skills /tmp/typesafe-skills
rm -rf .claude/skills/typesafe-ai
cp -R /tmp/typesafe-skills/skills/typesafe-ai .claude/skills/typesafe-ai
```

**Note on sandboxed environments:** the skill treats `https://docs.typesafe.ai`
as its source of truth and fetches pages at runtime. If your agent runs behind an
egress policy, allowlist `docs.typesafe.ai` (and `console.typesafe.ai` for
cookbooks and API keys) or the skill will fall back to its own static guidance.
