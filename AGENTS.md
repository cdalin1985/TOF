# AGENTS.md — TOC Agent Instructions

## Workspace policy

TOC_WORKSPACE is the command center.
claude-agent0toc is the app code repo only.
TOC-Agent-Swarm is the automation/swarm folder only.

Do not place scratch files, patch ZIPs, exported prompts, or temporary documents in this app repo unless they are intentional project documentation under docs/.

## Canonical paths

- App repo: C:\Users\chase\Desktop\claude-agent0toc
- Swarm: C:\Users\chase\Desktop\TOC-Agent-Swarm
- Workspace: C:\Users\chase\Desktop\TOC_WORKSPACE

## Operating rule

When doing TOC work:

1. Protect TOC canon first.
2. Use small branch/PR slices.
3. Run lint/build before PR.
4. Do not modify .env, secrets, node_modules, dist, or lockfiles without explicit instruction.
5. Keep app code in this repo, automation in the swarm folder, and project support files in TOC_WORKSPACE.
6. For terminal snippets, always put the correct cd path as the first line.

## TOC canon

- Minimum race = 6.
- New league member first challenge = up to 10 spots above.
- Regular non-top-10 = up to 5 spots above only.
- Top 10 = up/down 5 spots.
- Rank #1 can challenge anyone.
- Post-loss cooldown = 24 hours.
- Single unified ranking list.
- Disciplines = 8 Ball, 9 Ball, 10 Ball.
- Venues = Eagles 4040 and Valley Hub.
- Treasury visible to all players.
- Only super_admin manages treasury.

## Agent dev tooling

### GitNexus MCP (one-time per machine)

GitNexus is an MCP server that indexes this repo into a code-intelligence
graph. Each Windows machine that runs Claude Code on this repo installs it
once — config lives in your user-scope `.claude.json`, not in this repo.

```cmd
cd C:\Users\chase\Desktop\claude-agent0toc
npm install -g gitnexus
gitnexus setup
```

Requires Node ≥ 22. To skip native tree-sitter-dart/proto builds (no
python/make/g++ needed), prefix the install with
`set GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1`.

`gitnexus setup` auto-detects Claude Code and writes absolute-path MCP
config. To build the graph for this repo, run `npx gitnexus analyze` from
the repo root.

Manual fallback (skip global install):
`claude mcp add gitnexus -- cmd /c npx -y gitnexus@latest mcp`. Slower;
first launch can hit Claude Code's ~30s MCP_TIMEOUT on cold npm cache.

Reference: https://github.com/abhigyanpatwari/GitNexus

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **claude-agent0toc** (985 symbols, 1563 relationships, 20 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/claude-agent0toc/context` | Codebase overview, check index freshness |
| `gitnexus://repo/claude-agent0toc/clusters` | All functional areas |
| `gitnexus://repo/claude-agent0toc/processes` | All execution flows |
| `gitnexus://repo/claude-agent0toc/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
