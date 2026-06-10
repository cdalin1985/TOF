# Top of the Falls — Setup Guide

This guide points at the Supabase project, GitHub repo, and Vercel app connected to the live TOF white-label app.

## Connected production resources

- **Customer/league:** Top of the Falls / Great Falls, MT
- **Local checkout:** `C:/Users/chase/tof-app`
- **GitHub repo:** `cdalin1985/TOF`
- **GitHub production branch:** `main`
- **Vercel project:** `tof-app` (`prj_aLBKEgmOlGbbCcrq4PhDAUVwp80e`)
- **Vercel team/org:** `cdalin-projects` / `team_JIGWMVABx7X7cCpDMuWcujgZ`
- **Production URL:** `https://tof-app-theta.vercel.app`
- **Supabase project name:** `TOF`
- **Supabase project ref:** `sqcqmovskpoyutfyslym`
- **Supabase URL:** `https://sqcqmovskpoyutfyslym.supabase.co`

TOC.Monster is separate:

- **TOC GitHub repo:** `cdalin1985/claude-agent0toc`
- **TOC Vercel project:** `toc-app`
- **TOC production URL:** `https://toc.monster`
- **TOC local checkout:** `C:/Users/chase/toc-monster-app`

Do not point TOF work at TOC.Monster's Vercel project, GitHub repo, Supabase project, or local checkout.

## Local development

```bash
cd /c/Users/chase/tof-app
npm install
npm run build
npm run test
npm run preview -- --port 4173 --host 127.0.0.1
```

## Database migrations

Migrations live in `supabase/migrations/` as timestamp-named files.

Release hardening guardrail to keep visible in this checklist: `20260519110000_release_hardening_guardrails.sql`.

For the existing TOF Supabase project:

```bash
cd /c/Users/chase/tof-app
npx supabase link --project-ref sqcqmovskpoyutfyslym
npx supabase db push --linked
```

For a fresh replacement project, apply every migration in timestamp order with `npx supabase db push` after linking the new ref, then seed/configure TOF roster data intentionally. Do not reuse TOC.Monster production data.

## Edge functions

Deploy TOF functions to the TOF project only:

```bash
cd /c/Users/chase/tof-app
npx supabase functions deploy claim-player --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy create-challenge --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy respond-to-challenge --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy update-match-score --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy submit-result --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy resolve-dispute --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy manage-treasury --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy rank1-compliance --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy add-player --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy send-push --project-ref sqcqmovskpoyutfyslym
npx supabase functions deploy set-player-active --project-ref sqcqmovskpoyutfyslym
```

## Vercel deploys

The TOF Vercel project is Git-linked:

- Repo: `cdalin1985/TOF`
- Branch: `main`
- Framework: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

A push to `main` triggers a Vercel production deployment.

## Auth and admin notes

- Member login is email → 6-digit code.
- Claiming a player row is separate from admin role.
- Carl Higgins can be `super_admin` before claiming the `Carl Higgins` roster row.
- Members should claim their own unclaimed roster name after first login.

## TOF league settings snapshot

Current live TOF settings:

- Venues: `Silver Spur`, `Lido`, `Black Eagle Country Club`
- Disciplines: `8 Ball`, `9 Ball`, `10 Ball`, `Saratoga`
- Minimum race: `6`
- No maximum race configured (`max_race = null`)
- Challenge range: `2`
- First challenge range: `2`
- Cooldown: `24` hours
- Challenge expiry: `2` days
- Theme: `emerald-forest`
