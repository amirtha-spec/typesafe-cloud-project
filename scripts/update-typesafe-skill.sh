#!/usr/bin/env bash
# Refresh the vendored TypeSafe agent skill from upstream.
#
# The skill is vendored into .claude/skills/ rather than installed as a Claude
# Code plugin because repo-committed `extraKnownMarketplaces`/`enabledPlugins`
# are silently ignored in Claude Code web sessions:
#   https://github.com/anthropics/claude-code/issues/78119
set -euo pipefail

UPSTREAM="https://github.com/typesafe-ai/skills.git"
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.claude/skills/typesafe-ai"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --depth 1 "$UPSTREAM" "$TMP/skills" >/dev/null 2>&1
REV="$(git -C "$TMP/skills" rev-parse HEAD)"

install -D -m 0644 "$TMP/skills/skills/typesafe-ai/SKILL.md" "$DEST/SKILL.md"
install -D -m 0644 "$TMP/skills/skills/typesafe-ai/LICENSE"  "$DEST/LICENSE"

echo "Updated vendored typesafe-ai skill to ${UPSTREAM}@${REV}"
