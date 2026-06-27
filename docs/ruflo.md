# ruflo — agent meta-harness (curated setup)

**ruflo** adds multi-agent capabilities to Claude Code / Codex: specialized
agents, self-learning memory, a vector DB, and background workers.

- Repo: `https://github.com/ruvnet/ruflo.git`
- Engine: wraps `@claude-flow/cli`. Requires **Node ≥ 20**.
- Full install (`npx ruflo@latest init wizard`) writes `.claude/`,
  `.claude-flow/`, `.mcp.json`, settings, **and a `CLAUDE.md`**, plus ~545
  files and 12 auto-triggered background workers. Web UI: `flo.ruv.io`.

## Why we do NOT run the full wizard inside this repo

The full harness is heavy for a single, customer-facing league app, and its
wizard **generates a `CLAUDE.md`** — which would clobber our hand-written
project canon. So we keep ruflo's machinery out of the product repo and commit
only a small, native set of Claude Code subagents.

## What lives where

```
ruflo-lab/        # OUTSIDE the repo — full ruflo if/when you want it
  .claude-flow/, .mcp.json, workers, vector DB …

<league>-app/     # the product repo stays clean
  CLAUDE.md       # untouched project canon
  docs/ruflo.md   # this file
  .claude/agents/ # the only committed footprint (portable, see below)
```

## The committed subagents (portable across leagues)

`.claude/agents/` holds three **league-agnostic** subagents. They encode the
*shared architecture* (the email→6-digit-code→claim flow, `league_settings` as
source of truth, treasury-as-ledger) and defer instance specifics to each
repo's own `CLAUDE.md` / live `league_settings`. Because they carry no ruflo
runtime, they travel with a clone — set up a new league from this codebase and
the same tooling is there for free.

- `claim-flow-auditor` — security review of the roster-claim/auth flow.
- `supabase-migration-reviewer` — reviews SQL migrations vs. schema conventions.
- `demo-readiness-checker` — runs build + test and spot-checks demo surfaces.

Invoke them normally, e.g. *"use the claim-flow-auditor on this PR."* No ruflo
install is needed to use these.

## If you want the full harness (isolated)

```bash
node -v                                          # confirm v20+
mkdir -p ../ruflo-lab && cd ../ruflo-lab
npx ruflo@latest init wizard                     # full harness, OUTSIDE the app
# then drive the app from the lab when you want heavy multi-agent work
```

If you ever run the wizard inside the repo anyway, back up first
(`cp CLAUDE.md CLAUDE.md.bak`) and review `git diff CLAUDE.md`. The repo's
`.gitignore` already guards `.claude-flow/`, `.mcp.json`, and `*.bak` so worker
state and any secrets never get committed.

## Lightweight alternative

Install individual ruflo commands at the Claude Code user level without touching
the repo:

```
/plugin marketplace add ruvnet/ruflo
/plugin install <command>
```
