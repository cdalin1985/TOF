# TOC App — Setup Guide

This guide points at the Supabase project, GitHub repo, and Vercel app that are connected now.

- **Supabase project name:** `toc1`
- **Supabase project ref:** `ankvjywsnydpkepdvuvm`
- **Supabase region:** `us-west-2`
- **Supabase URL:** `https://ankvjywsnydpkepdvuvm.supabase.co`
- **GitHub repo:** `cdalin1985/claude-agent0toc`
- **Vercel project:** `toc-app` (`prj_cpSNmnjRXFK14Jadp2yU4tEghDFQ`)
- **Production domain:** `https://toc.monster`

Think of the project ref like the street address for the database. If the app points at the wrong address, the right code can still update the wrong database.

## Step 1: Apply Database Migrations

Migrations live in `supabase/migrations/` as timestamp-named files. They are the same migrations Supabase has applied to production — what is tracked in `supabase_migrations.schema_migrations` matches what is in this directory.

### For a fresh setup (new Supabase project)

Apply every migration in timestamp order using the Supabase CLI:

```bash
export SUPABASE_ACCESS_TOKEN=your_temporary_token_here
npx supabase link --project-ref <your-new-project-ref>
npx supabase db push
```

`db push` reads every `.sql` file in `supabase/migrations/`, sorts by filename (timestamp order), and applies any that the project does not already have in its tracker. Safe to re-run.

### For the existing `toc1` production project (`ankvjywsnydpkepdvuvm`)

All current migrations are already applied. New migrations land via PRs and either:
- merge to `main` and you run `npx supabase db push` once linked, or
- get applied via the Supabase Branching workflow on PR merge if branching is enabled.

### Why this changed

Earlier setup instructions listed sequence-named files (`001_schema.sql` through `013_*`). Those have been removed — production's migration tracker only knows the timestamp-named versions, and the dual naming caused the `Supabase Preview` GitHub check to fail on every commit to `main`. The timestamp files are the canonical set going forward.

## Step 2: Get Your Service Role Key

Go to: https://supabase.com/dashboard/project/ankvjywsnydpkepdvuvm/settings/api

Copy the **service_role** key from Supabase. Treat it like a house key: do not post it publicly, do not put it in GitHub, and rotate it if it was shared accidentally.

## Step 3: Deploy Edge Functions

```bash
# Get a temporary Supabase access token from:
# https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=your_temporary_token_here

npx supabase link --project-ref ankvjywsnydpkepdvuvm
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
npx supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key_here
npx supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key_here
npx supabase secrets set VAPID_SUBJECT=mailto:your_email@example.com

npx supabase functions deploy claim-player
npx supabase functions deploy create-challenge
npx supabase functions deploy respond-to-challenge
npx supabase functions deploy update-match-score
npx supabase functions deploy submit-result
npx supabase functions deploy resolve-dispute
npx supabase functions deploy manage-treasury
npx supabase functions deploy rank1-compliance
npx supabase functions deploy add-player
npx supabase functions deploy send-push
```

After the deploy works, revoke the temporary Supabase access token from your Supabase account page.

## Step 4: Set Chase as Super Admin

After you claim your player profile, run this in the Supabase SQL Editor:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'chase.dalin@gmail.com';
```

## Step 5: Deploy to Vercel

1. Go to vercel.com → New Project → Import from GitHub.
2. Select `cdalin1985/claude-agent0toc`.
3. Framework: Vite.
4. Add env vars:
   - `VITE_SUPABASE_URL` = `https://ankvjywsnydpkepdvuvm.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon public key from Supabase → Project Settings → API
   - `VITE_VAPID_PUBLIC_KEY` = your VAPID public key
5. Deploy.

## Step 6: Verify Rank #1 Automation

Run this in the Supabase SQL Editor:

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

Expected result:

- `jobname` = `rank1-obligation-check`
- `schedule` = `0 0,12 * * *`
- `active` = `true`

You do not need to wait until the next run to see whether the job exists. You only wait for 00:00 UTC or 12:00 UTC if you want the scheduled job to run by itself. During Mountain Daylight Time, that is 6am and 6pm Mountain.
