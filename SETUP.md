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

## Step 1: Run SQL Migrations in Supabase

Go to: https://supabase.com/dashboard/project/ankvjywsnydpkepdvuvm/sql/new

Run every migration in number order:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_seed.sql`
3. `supabase/migrations/003_rls.sql`
4. `supabase/migrations/004_rule_changes.sql`
5. `supabase/migrations/005_push_subscriptions.sql`
6. `supabase/migrations/006_profile_customization.sql`
7. `supabase/migrations/007_storage_avatars.sql`
8. `supabase/migrations/008_expire_stale_challenges.sql`
9. `supabase/migrations/009_rank1_obligation_cron.sql`

If you already ran migrations 001–008 before, run only the missing migrations. The Rank #1 cron migration is safe to run again because it replaces the cron job with the same job name instead of creating duplicates.

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
