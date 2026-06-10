# Project Boundaries: TOF vs TOC.Monster

This repository is **Top of the Falls (TOF)** only.

## TOF / Top of the Falls

- Customer/league: Top of the Falls, Great Falls, MT
- GitHub repo: `cdalin1985/TOF`
- Vercel project: `tof-app`
- Public URL: `https://tof-app-theta.vercel.app`
- Supabase project/ref: TOF / `sqcqmovskpoyutfyslym`
- Local checkout should be: `C:/Users/chase/tof-app`
- Package name: `tof-app`
- Branch used for production deploys: `main`

TOF-specific files such as roster seeds, Carl handoff notes, and Top of the Falls migrations belong in this repo/workspace only.

## TOC.Monster / Top of the Capital

TOC.Monster is a separate production app and must not receive TOF customer data.

- League/app: Top of the Capital / Helena Pool League
- GitHub repo: `cdalin1985/claude-agent0toc`
- Vercel project: `toc-app`
- Public URL: `https://toc.monster`
- Supabase project: `toc1`
- Local checkout should be: `C:/Users/chase/toc-monster-app`

## Rule

Do not mix TOF files into the TOC.Monster workspace, and do not use TOC.Monster deployment/database targets for TOF work.

If a folder name and project identity disagree, stop and verify with:

```bash
git remote -v
cat .vercel/project.json
cat supabase/.temp/project-ref 2>/dev/null || true
```
