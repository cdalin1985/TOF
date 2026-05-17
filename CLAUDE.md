# CLAUDE.md — TOC Project Memory

## Workspace policy

TOC_WORKSPACE is the command center.
claude-agent0toc is the app code repo only.
TOC-Agent-Swarm is the automation/swarm folder only.

Never dump random work files into the app repo. Keep scratch files, patch archives, copied prompts, and temporary exports in TOC_WORKSPACE.

## Canonical paths

- TOC workspace: C:\Users\chase\Desktop\TOC_WORKSPACE
- TOC app repo: C:\Users\chase\Desktop\claude-agent0toc
- TOC swarm: C:\Users\chase\Desktop\TOC-Agent-Swarm
- Old incoming folder: D:\documents\Claude\Projects\toc

## Work style

Chase does not want to babysit multi-step commands.
Prefer direct tool work.
When local work is unavoidable, provide one copy/paste command.
For terminal snippets, always put the correct cd path as the first line.
Protect the repo from clutter.
Use branch/PR workflow.
Run lint/build before claiming success.

## TOC canon

Minimum race = 6.
New member first challenge = up to 10 spots above.
Regular non-top-10 = up to 5 spots above only.
Top 10 = up/down 5 spots.
Rank #1 can challenge anyone.
Post-loss cooldown = 24 hours.
One unified ranking list across 8 Ball, 9 Ball, 10 Ball.
Venues are Eagles 4040 and Valley Hub.
Treasury is visible to all players.
Only super_admin manages treasury.

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
