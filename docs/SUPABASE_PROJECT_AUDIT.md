# Supabase Project Audit

This audit is for the Supabase project that Vercel is connected to now.

- **Correct Supabase project name:** `toc1`
- **Correct project ref:** `ankvjywsnydpkepdvuvm`
- **Correct region:** `us-west-2`
- **Correct Supabase URL:** `https://ankvjywsnydpkepdvuvm.supabase.co`
- **Correct GitHub repo:** `cdalin1985/claude-agent0toc`
- **Correct Vercel project:** `toc-app` (`prj_cpSNmnjRXFK14Jadp2yU4tEghDFQ`)
- **Correct production domain:** `https://toc.monster`
- **Old/wrong refs found in repo before this audit:** `kdpyisylihlvxvinzgyr`
- **Other project ref discussed but not found in repo:** `yayflbtwngvatftbiymw`

## What I checked in the repo

Think of this like checking all the labels on moving boxes. If a box still has the old house address, it can send updates to the wrong place.

### Repo-side findings

| Area | Result | What it means |
| --- | --- | --- |
| Setup guide | Updated to `ankvjywsnydpkepdvuvm` | Future manual setup points to the correct Supabase project. |
| Vercel runtime URL | Uses `VITE_SUPABASE_URL` | The live Vercel value decides which project the app uses. |
| Supabase migrations | Migration `009_rank1_obligation_cron.sql` exists | The Rank #1 automation is available to apply to the correct project. |
| Automatic migration deployment | No GitHub Actions or package script found | Vercel builds the website, but this repo does not show a database migration step. |
| Rank #1 manual admin function | Updated to match the cron rule | The Admin page manual check/enforce flow follows the top-5/#10 rule and uses the penalty RPC. |
| Player Rank #1 banner | Updated to match the top-5 rule | The player home page shows top-5 match progress and days remaining. |
| Match-result Edge Function | Leaves penalties to cron/manual enforcement | Match confirmation no longer silently demotes Rank #1. |
| Secrets in docs | Replaced hard-coded VAPID examples with placeholders | Secret-looking values should not live in setup docs. Rotate any secret that was previously shared publicly. |

## Live Supabase checks to run

I cannot see inside a private Supabase dashboard unless credentials are provided. The safest audit path is for you to run these checks in the SQL Editor for the correct project:

https://supabase.com/dashboard/project/ankvjywsnydpkepdvuvm/sql/new

### 1. Confirm the Rank #1 cron job exists

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'rank1-obligation-check';
```

You want one row with:

- `schedule` = `0 0,12 * * *`
- `active` = `true`
- `command` includes `SELECT public.enforce_rank1_obligations();`

### 2. Confirm the Rank #1 function exists

```sql
SELECT
  p.proname,
  pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'enforce_rank1_obligations';
```

You want one row named `enforce_rank1_obligations`.

### 3. Confirm the key Rank #1 column exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rankings'
  AND column_name = 'rank1_since';
```

You want one row for `rank1_since`.

### 4. Confirm the penalty helper exists

```sql
SELECT
  p.proname,
  pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_rank1_penalty';
```

You want one row named `apply_rank1_penalty` with a `p_player_id uuid` argument.

### 5. Confirm league settings exist

```sql
SELECT
  min_race,
  max_race,
  challenge_range,
  cooldown_hours,
  challenge_expiry_days,
  challenge_response_hours,
  match_play_days,
  challenge_weekly_limit,
  first_challenge_range
FROM public.league_settings;
```

You want at least one settings row. The Rank #1 obligation is the 30-day top-5 match rule. `challenge_expiry_days` is still important for normal challenge expiration settings.

### 6. Confirm Edge Function secrets are set

This one is checked in the Supabase dashboard, not SQL:

1. Go to Supabase → Project Settings → Edge Functions or Secrets.
2. Confirm these exist:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`

Do not paste these secret values into GitHub or chat unless you plan to rotate them afterward.

## What to do if a check fails

### If the cron job or function is missing

Run this migration in the SQL Editor for `ankvjywsnydpkepdvuvm`:

```text
supabase/migrations/009_rank1_obligation_cron.sql
```

### If `rank1_since` is missing

Run this migration first:

```text
supabase/migrations/004_rule_changes.sql
```

Then run:

```text
supabase/migrations/009_rank1_obligation_cron.sql
```

### If league settings are missing

Run the original schema and seed migrations in order, or add the missing settings row carefully from a backup/source-of-truth.

## Recommended next steps

1. In Vercel, confirm `VITE_SUPABASE_URL` is exactly `https://ankvjywsnydpkepdvuvm.supabase.co`.
2. In Supabase SQL Editor, run the live checks above.
3. If the Rank #1 cron job is missing, paste and run `supabase/migrations/009_rank1_obligation_cron.sql`.
4. Deploy the updated `rank1-compliance` Edge Function so the Admin page manual button matches the scheduled cron rule.
5. Rotate any old secret-looking values that were previously stored in documentation.
