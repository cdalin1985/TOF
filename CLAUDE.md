# CLAUDE.md — TOF Project Memory

## Identity

This repository is **Top of the Falls (TOF)** only.

- Customer/league: Top of the Falls, Great Falls, MT
- Local checkout: `C:/Users/chase/tof-app`
- GitHub repo: `cdalin1985/TOF`
- Vercel project: `tof-app`
- Public URL: `https://tof-app-theta.vercel.app`
- Supabase project/ref: TOF / `sqcqmovskpoyutfyslym`
- Production branch: `main`

## Boundary rule

Do not mix TOF and TOC.Monster work.

- TOF work belongs in `C:/Users/chase/tof-app` and deploys to Vercel project `tof-app`.
- TOC.Monster work belongs in `C:/Users/chase/toc-monster-app` and deploys to Vercel project `toc-app`.
- Never put Top of the Falls roster files, Carl notes, TOF migrations, or TOF Supabase config in the TOC.Monster checkout.
- Never point TOF code at TOC.Monster's Supabase project or Vercel project.

If identity is unclear, verify before editing:

```bash
git remote -v
cat .vercel/project.json
cat supabase/.temp/project-ref 2>/dev/null || true
```

## TOF canon

Use live `league_settings` and migrations as the source of truth. Current TOF defaults:

- Disciplines: 8 Ball, 9 Ball, 10 Ball
- Venues: Silver Spur, Lido, Black Eagle Country Club
- Claim flow: email → 6-digit code → claim own unclaimed roster name
- Carl Higgins may be super_admin even before claiming his player row
- Treasury is a ledger/admin function; no real payment processing is live yet

## Work style

1. Protect customer/demo readiness first.
2. Use `main` for production deploys unless Chase explicitly asks for a branch/PR.
3. Run `npm run build` and `npm run test` before claiming app changes are ready.
4. Do not modify `.env`, secrets, `node_modules`, `dist`, or lockfiles without explicit instruction.
5. Keep scratch files out of the repo unless they are intentional project documentation under `docs/` or customer setup notes.
6. For terminal snippets, always use the correct TOF path first:

```bash
cd /c/Users/chase/tof-app
```

## Historical upstream notes

Some older docs may reference the original TOC.Monster app because TOF was split from that codebase. Treat those as upstream history, not current TOF deployment instructions, unless they have been explicitly updated for TOF.
