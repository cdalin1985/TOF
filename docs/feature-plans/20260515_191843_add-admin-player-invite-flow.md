# Feature Builder Plan

## Task

Add admin player invite flow

## Mode

Claude was unavailable, so this is a fallback plan.

## TOC canon that must not drift

```json
{
  "min_race": 6,
  "first_challenge_range": 10,
  "challenge_range": 5,
  "top_ten": "up_or_down_5",
  "rank_one": "anyone",
  "regular_non_top_ten": "up_5_only",
  "post_loss_cooldown_hours": 24,
  "disciplines": [
    "8 Ball",
    "9 Ball",
    "10 Ball"
  ],
  "venues": [
    "Eagles 4040",
    "Valley Hub"
  ],
  "treasury": "visible_to_all_super_admin_edits",
  "unified_list": true
}
```

## Likely files to inspect

- `package.json`
- `README.md`
- `TOC_CANON_ALIGNMENT.md`
- `src/App.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/ChallengePage.tsx`
- `src/pages/ChallengesPage.tsx`
- `src/pages/RankingsPage.tsx`
- `src/pages/MatchesPage.tsx`
- `src/lib/supabase.ts`
- `src/types/database.ts`
- `supabase/functions/create-challenge/index.ts`
- `supabase/functions/submit-result/index.ts`

## Safe implementation loop

```powershell
cd C:\Users\chase\Desktop\claude-agent0toc
git checkout main
git pull
git checkout -b feature/add-admin-player-invite-flow
npm run lint
npm run build
```

## Next

Re-run Feature Builder with Claude available, or use a smaller feature request.
