#!/usr/bin/env bash
#
# setup-ruflo-lab.sh — the ONLY blessed way to install the full ruflo harness.
#
# Why this exists (see docs/ruflo.md): the ruflo wizard writes ~545 files,
# 12 background workers, and a generated CLAUDE.md into its working directory.
# Run inside this product repo, it would clobber the committed .claude/agents/
# and CLAUDE.md. This script enforces the guardrails so you don't have to
# remember them:
#   - hard-fails if Node < 20 (the wizard's requirement)
#   - ALWAYS runs the wizard OUTSIDE any git repo, in a sibling ruflo-lab/,
#     no matter where you launch it from
#
# Usage:   ./scripts/setup-ruflo-lab.sh [optional/lab/path]

set -euo pipefail

err()  { printf '\n\033[31mERROR:\033[0m %s\n\n' "$1" >&2; exit 1; }
note() { printf '\033[36m%s\033[0m\n' "$1"; }

# --- Guard 1: Node >= 20 -----------------------------------------------------
command -v node >/dev/null 2>&1 || err "Node.js is not installed. ruflo needs Node >= 20."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node $(node -v) found, but ruflo requires Node >= 20. Upgrade Node first (e.g. nvm-windows), then re-run."
fi
note "✓ Node $(node -v) (>= 20)"

# --- Guard 2: never let the wizard run inside a repo -------------------------
# Pick the lab location. Default: a sibling of the current repo (if any),
# otherwise ~/ruflo-lab. An explicit path argument overrides.
if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  DEFAULT_LAB="$(dirname "$REPO_ROOT")/ruflo-lab"
else
  REPO_ROOT=""
  DEFAULT_LAB="$HOME/ruflo-lab"
fi
LAB="${1:-$DEFAULT_LAB}"
LAB="$(cd "$(dirname "$LAB")" 2>/dev/null && pwd)/$(basename "$LAB")" || LAB="$DEFAULT_LAB"

# Refuse if the chosen lab path is inside ANY git repo — that's the clobber risk.
if ( cd "$(dirname "$LAB")" 2>/dev/null && git rev-parse --show-toplevel >/dev/null 2>&1 ); then
  err "Refusing to install ruflo at '$LAB' — it is inside a git repo. The full harness must live OUTSIDE your app repo. Pass a path that is not in a repo."
fi
note "✓ Lab location is outside any repo: $LAB"

# --- Token-spend warning -----------------------------------------------------
cat <<'WARN'

  ┌────────────────────────────────────────────────────────────────────┐
  │  HEADS UP: the full harness installs 12 background workers that      │
  │  auto-fire and consume LLM provider tokens even when idle. Watch     │
  │  your provider usage for the first few sessions. To slim it down,    │
  │  use the lightweight /plugin route instead (see docs/ruflo.md).      │
  └────────────────────────────────────────────────────────────────────┘

WARN

printf 'Install the full ruflo harness at: %s ? [y/N] ' "$LAB"
read -r ANSWER
case "$ANSWER" in
  y|Y|yes|YES) ;;
  *) note "Aborted. Nothing installed."; exit 0 ;;
esac

# --- Run the wizard outside the repo ----------------------------------------
mkdir -p "$LAB"
cd "$LAB"
note "Running: npx ruflo@latest init wizard  (in $LAB)"
npx ruflo@latest init wizard

note ""
note "✓ Done. Full ruflo lives in $LAB and persists across sessions there."
note "  Drive your app from this folder when you want the heavy swarm."
note "  Your app repo and its committed .claude/agents/ were never touched."
