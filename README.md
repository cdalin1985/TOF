# Top of the Falls 🎱

**A Great Falls, Montana pool challenge list app for the Top of the Falls league.**

TOF is a live challenge league app where players compete for position on a single ranked list. Players challenge above them, matches update the ladder, and admins can manage the day-to-day operation without running the list from a spreadsheet.

This repo is the dedicated Top of the Falls white-label app. It is separate from TOC 1 / `toc1` and should not mutate the live TOC 1 app or database.

```text
TOF repo:      https://github.com/cdalin1985/TOF
TOF Vercel:    tof-app / https://tof-app-theta.vercel.app
TOF Supabase:  TOF / sqcqmovskpoyutfyslym
TOC 1 repo:    https://github.com/cdalin1985/claude-agent0toc
TOC 1 live:    https://toc.monster
TOF customer:  Top of the Falls / Great Falls, MT
```

---

## Current Status

- Built from the hardened TOC 1 production baseline.
- Customized for Top of the Falls / Great Falls branding and rules.
- Includes an emerald/gold `emerald-forest` theme.
- Has its own dedicated Supabase project (`sqcqmovskpoyutfyslym`) with the TOF roster seeded.
- Is deployed through the Git-linked Vercel project `tof-app` from the `main` branch.
- Includes a localhost-only review mode for non-production review/demo screens.

Safe local review URLs after starting preview:

```text
http://127.0.0.1:4173/login?demo=totf
http://127.0.0.1:4173/rankings?demo=totf
```

The `?demo=totf` mode is guarded to `localhost` / `127.0.0.1` and is intended only for local review. It does not seed or mutate Supabase.

---

## Top of the Falls Rules Snapshot

- Region: **Great Falls, MT**
- Drop/envelope locations: **Silver Spur**, **Lido**, **Black Eagle Country Club**
- Match fee: **$5 per player**
- Challenge response window: **48 hours**
- Accepted match play window: **10 days**
- Weekly challenge limit: **2**
- Minimum race: **6**
- Disciplines: **8 Ball**, **9 Ball**, **10 Ball**, **Saratoga**
- Saratoga is intended for Top 20 matches only.

Challenge movement is customized for TOF:

- Top 11 may challenge 1 spot up.
- Only #11 and #12 may challenge #10.
- Spots 12+ may challenge up to 2 spots.
- Rank #1 may challenge down to top 5 to fulfill obligation.

---

## Local Development

```bash
npm install
npm run build
npm run test
npm run preview -- --port 4173 --host 127.0.0.1
```

Recommended verification before any customer review:

```bash
npm run build
npx eslint src --max-warnings 0 --rule '{"react-hooks/set-state-in-effect":"off","react-refresh/only-export-components":"off"}'
node --test test/*.test.mjs
```

---

## Supabase Separation Rule

TOF must use its own Supabase project. Do **not** seed or edit TOC 1 / `toc1` while working on TOF or other white-label tasks.

The TOF database should start clean — feature parity with TOC 1 schema/functions, but without TOC 1's existing challenges, matches, or league history.

---

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Supabase Postgres/Auth/Realtime/Edge Functions
- TanStack Query + Zustand

All challenge/result/ranking mutations should go through Supabase Edge Functions. The client should not directly mutate ranked tables.
