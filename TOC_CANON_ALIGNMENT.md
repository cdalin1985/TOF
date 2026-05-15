# TOC Canon Alignment

This repository patch mirrors the live Supabase canon alignment for project `toc1 / ankvjywsnydpkepdvuvm`.

## Current canon

- Minimum race length is **6**.
- New league member / first challenge: may challenge up to **10 spots above**.
- Regular non-top-10 player: may challenge up to **5 spots above** only.
- Top-10 player: may challenge **up or down 5 spots**.
- Rank #1 player: may challenge **anyone**.
- Post-loss cooldown is **24 hours**.
- One active outgoing challenge is enforced.
- Active incoming challenge conflicts are blocked.
- Challenge expiry comes from `league_settings.challenge_expiry_days`.

## Files patched

```text
supabase/functions/create-challenge/index.ts
supabase/functions/submit-result/index.ts
```

## Live Supabase function versions

```text
create-challenge: version 13
submit-result: version 13
```
