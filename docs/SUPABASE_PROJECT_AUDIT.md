# TOF Supabase Project Audit

## Correct TOF production target

- **Customer/league:** Top of the Falls / Great Falls, MT
- **Supabase project name:** `TOF`
- **Supabase project ref:** `sqcqmovskpoyutfyslym`
- **Supabase URL:** `https://sqcqmovskpoyutfyslym.supabase.co`
- **GitHub repo:** `cdalin1985/TOF`
- **Vercel project:** `tof-app` (`prj_aLBKEgmOlGbbCcrq4PhDAUVwp80e`)
- **Production URL:** `https://tof-app-theta.vercel.app`
- **Local checkout:** `C:/Users/chase/tof-app`

## Separation from TOC.Monster

TOC.Monster is the original/live Top of the Capital app and must remain separate from TOF.

- **TOC Supabase project:** `toc1`
- **TOC GitHub repo:** `cdalin1985/claude-agent0toc`
- **TOC Vercel project:** `toc-app` (`prj_cpSNmnjRXFK14Jadp2yU4tEghDFQ`)
- **TOC production URL:** `https://toc.monster`
- **TOC local checkout:** `C:/Users/chase/toc-monster-app`

## Verification commands

From the TOF checkout:

```bash
cd /c/Users/chase/tof-app
git remote -v
cat .vercel/project.json
cat supabase/.temp/project-ref 2>/dev/null || true
npx supabase db query --linked "select venues, disciplines, min_race, max_race, challenge_range, cooldown_hours, challenge_expiry_days, first_challenge_range, theme_name from league_settings limit 1;"
```

Expected identity:

```text
origin -> https://github.com/cdalin1985/TOF.git
.vercel projectName -> tof-app
.vercel projectId -> prj_aLBKEgmOlGbbCcrq4PhDAUVwp80e
Supabase project ref -> sqcqmovskpoyutfyslym
```

## Current TOF settings

- Venues: `Silver Spur`, `Lido`, `Black Eagle Country Club`
- Disciplines: `8 Ball`, `9 Ball`, `10 Ball`, `Saratoga`
- Minimum race: `6`
- Maximum race: none (`max_race = null`)
- Challenge range: `2`
- First challenge range: `2`
- Cooldown: `24` hours
- Challenge expiry: `2` days
- Theme: `emerald-forest`
