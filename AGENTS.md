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
