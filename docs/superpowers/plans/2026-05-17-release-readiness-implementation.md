# TOC Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved release-readiness slices: payment/treasury correctness, declined-challenge forfeits with reversal, activity journal detail, rehearsal script draft, Open Graph image support, and a table-side match scoreboard.

**Architecture:** Add one database migration for schema/views/RPCs, then update Edge Functions to call the new database behaviors. Keep frontend changes small and localized: payment selection, treasury rendering, admin reversal controls, `W-L-F` displays, and a dedicated scoreboard surface in the match page. Add static/behavioral Node tests that pin the migration, function contracts, and scoreboard affordances used by this Vite/Supabase app.

**Tech Stack:** React 19, Vite, TypeScript, Supabase Postgres migrations, Supabase Edge Functions, Node `node:test`, Vercel static deployment.

---

### Task 1: Pin Release Contracts With Failing Tests

**Files:**
- Create: `test/release-readiness.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests**

Create `test/release-readiness.test.mjs` with assertions for:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = readFileSync(join(root, 'supabase', 'migrations', '013_release_readiness.sql'), 'utf8');
const submitResult = readFileSync(join(root, 'supabase', 'functions', 'submit-result', 'index.ts'), 'utf8');
const respondToChallenge = readFileSync(join(root, 'supabase', 'functions', 'respond-to-challenge', 'index.ts'), 'utf8');
const databaseTypes = readFileSync(join(root, 'src', 'types', 'database.ts'), 'utf8');
const matchPage = readFileSync(join(root, 'src', 'pages', 'MatchPage.tsx'), 'utf8');

test('payment methods are explicit and legacy digital/envelope values are retired', () => {
  for (const method of ['cash_envelope', 'paypal', 'cash_app', 'venmo']) {
    assert.match(migration, new RegExp(method));
    assert.match(databaseTypes, new RegExp(method));
  }
  assert.doesNotMatch(databaseTypes, /'envelope' \\| 'digital'/);
});

test('treasury has source metadata, idempotent match fee index, and shared balance view', () => {
  assert.match(migration, /ALTER TABLE public\\.treasury_ledger\\s+ADD COLUMN IF NOT EXISTS source_type/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS treasury_ledger_source_unique/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\\.treasury_ledger_effects/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\\.treasury_summary/i);
});

test('forfeit stats and reversal state are stored in the database', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS forfeits integer NOT NULL DEFAULT 0/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\\.challenge_forfeiture_events/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\\.apply_challenge_decline_forfeit/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\\.reverse_challenge_decline_forfeit/i);
});

test('decline is implemented as a forfeit and admin reversal is available', () => {
  assert.match(respondToChallenge, /apply_challenge_decline_forfeit/);
  assert.match(respondToChallenge, /reverse_challenge_decline_forfeit/);
  assert.doesNotMatch(respondToChallenge, /admin will confirm your spot move/i);
});

test('match confirmation records idempotent match fee credits', () => {
  assert.match(submitResult, /recordMatchFeePayments/);
  assert.match(submitResult, /source_type: 'match_fee'/);
  assert.match(submitResult, /amount_cents: 500/);
});

test('admin rehearsal script and og image exist', () => {
  assert.ok(existsSync(join(root, 'docs', 'release', 'admin-rehearsal-script.md')));
  assert.ok(existsSync(join(root, 'public', 'og-image.png')));
});

test('match scoreboard exposes large tap targets and undo last point', () => {
  assert.match(matchPage, /TableSideScoreboard/);
  assert.match(matchPage, /Undo last point/);
  assert.match(matchPage, /aria-label=.*Add point/i);
  assert.match(matchPage, /lastScoreAction/);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test`

Expected: FAIL because migration `013_release_readiness.sql`, script draft, `public/og-image.png`, and the table-side scoreboard do not exist yet.

- [ ] **Step 3: Keep `package.json` unchanged if `npm test` already covers the new file**

The existing script `node --test test/*.test.mjs` already includes the new test.

### Task 2: Add Database Migration

**Files:**
- Create: `supabase/migrations/013_release_readiness.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add migration**

Create migration with:

- Payment method constraint migration from `envelope/digital` to `cash_envelope/paypal/cash_app/venmo`.
- `forfeits` columns on season and discipline stats.
- Treasury metadata columns and idempotent source unique index.
- `treasury_ledger_effects` and `treasury_summary` views.
- `challenge_forfeiture_events` table.
- `apply_challenge_decline_forfeit` RPC.
- `reverse_challenge_decline_forfeit` RPC.
- Service-role-only execute grants for new RPCs.

- [ ] **Step 2: Update generated DB types manually**

Update `src/types/database.ts` so:

```ts
player1_payment_method: 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo' | null;
player2_payment_method: 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo' | null;
forfeits: number;
source_type: string | null;
source_id: string | null;
player_id: string | null;
metadata: Json;
```

- [ ] **Step 3: Verify tests for this slice**

Run: `npm test`

Expected: release-readiness tests move past migration/type assertions and fail on later unimplemented function/script/image assertions.

### Task 3: Implement Explicit Payments And Treasury Summary

**Files:**
- Create: `src/lib/paymentMethods.ts`
- Create: `src/lib/treasury.ts`
- Modify: `src/pages/MatchPage.tsx`
- Modify: `src/pages/TreasuryPage.tsx`
- Modify: `src/pages/AdminPage.tsx`
- Modify: `supabase/functions/submit-result/index.ts`
- Modify: `supabase/functions/resolve-dispute/index.ts`

- [ ] **Step 1: Add payment method definitions**

Create `src/lib/paymentMethods.ts`:

```ts
export type PaymentMethod = 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; helper: string; urlEnv?: string }[] = [
  { id: 'cash_envelope', label: 'Cash envelope', helper: 'Cash in the venue envelope' },
  { id: 'paypal', label: 'PayPal', helper: 'Pay through the league PayPal link', urlEnv: 'VITE_PAYPAL_URL' },
  { id: 'cash_app', label: 'Cash App', helper: 'Pay through the league Cash App link', urlEnv: 'VITE_CASH_APP_URL' },
  { id: 'venmo', label: 'Venmo', helper: 'Pay through the league Venmo link', urlEnv: 'VITE_VENMO_URL' },
];
```

- [ ] **Step 2: Add shared treasury fetch helper**

Create `src/lib/treasury.ts` that fetches `treasury_summary` and `treasury_ledger_effects` from Supabase and returns the same balance object for public/admin pages.

- [ ] **Step 3: Update match submit modal**

Replace the two payment buttons in `MatchPage.tsx` with four explicit payment choices. Cash envelope remains a normal app-recorded payment. Digital methods can show a helper that links will be configured after testing.

- [ ] **Step 4: Record match fee credits in Edge Functions**

Add `recordMatchFeePayments` to `submit-result/index.ts`; call it only after both players submit and `confirmResult` succeeds. Add optional payment fields to `resolve-dispute/index.ts` and only record fees when admin sends explicit methods.

- [ ] **Step 5: Use shared treasury helper in both treasury surfaces**

Update public `TreasuryPage.tsx` and admin `TreasuryTab` to read the same summary and ledger-effect rows.

### Task 4: Implement Decline As Forfeit And Admin Reversal

**Files:**
- Modify: `supabase/functions/respond-to-challenge/index.ts`
- Modify: `src/pages/AdminPage.tsx`
- Modify: `src/pages/ChallengesPage.tsx`
- Modify: `src/pages/RankingsPage.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/PlayerPage.tsx`

- [ ] **Step 1: Change decline branch**

In `respond-to-challenge`, replace the current decline update/admin-confirm copy with `supabase.rpc('apply_challenge_decline_forfeit', ...)`.

- [ ] **Step 2: Add admin reversal action**

Add `action === 'reverse_decline'` to `respond-to-challenge`. It must verify caller role is `admin` or `super_admin`, then call `reverse_challenge_decline_forfeit`.

- [ ] **Step 3: Add Admin UI reversal**

Include `forfeited` declined challenges in the Admin Challenges tab and show `Reverse Decline` for forfeit rows.

- [ ] **Step 4: Display W-L-F**

Update Rankings, Home, and Player pages to display `wins-losses-forfeits`. Keep played losses separate from forfeits.

### Task 5: Expand Activity Journal Detail

**Files:**
- Modify: `supabase/functions/create-challenge/index.ts`
- Modify: `supabase/functions/respond-to-challenge/index.ts`
- Modify: `supabase/functions/submit-result/index.ts`
- Modify: `supabase/functions/resolve-dispute/index.ts`
- Modify: `supabase/functions/manage-treasury/index.ts`
- Modify: `supabase/functions/add-player/index.ts`
- Modify: `supabase/functions/set-player-active/index.ts`
- Modify: `src/pages/ActivityPage.tsx`

- [ ] **Step 1: Add event details at each workflow boundary**

Every new or touched workflow should insert activity with direct event context: names, emails when available, ids, rank before/after, payment method, treasury amount, and admin actor where relevant.

- [ ] **Step 2: Expand ActivityPage filters/icons**

Add event types for forfeits, reversal, treasury, settings, player management, match fee, dispute, and result submission.

### Task 6: Draft Admin Rehearsal Script

**Files:**
- Create: `docs/release/admin-rehearsal-script.md`

- [ ] **Step 1: Write rough draft**

Write a two-to-three hour script with acts, scenes, real admin cast, supporting test roles, exact app actions, expected results, failure signals, scribe prompts, and cleanup notes.

### Task 7: Add Open Graph Image

**Files:**
- Create: `public/og-image.png`

- [ ] **Step 1: Locate desktop TOC PNG**

Search desktop top-level and common image folders for a TOC PNG. If none exists, render `public/toc-icon.svg` into a 1200x630 PNG with title text.

- [ ] **Step 2: Verify image path**

After build/deploy, verify `/og-image.png` returns PNG content, not HTML.

### Task 8: Build Table-Side Scoreboard

**Files:**
- Modify: `src/pages/MatchPage.tsx`

- [ ] **Step 1: Extract scoreboard component inside MatchPage**

Create a local `TableSideScoreboard` component in `MatchPage.tsx` that receives the match, player labels, rank positions, active viewer flags, submission state, and scoring handlers.

- [ ] **Step 2: Replace tiny plus controls with large tap zones**

Each player panel must be a button while scoring is allowed. Use `aria-label="Add point for <name>"`, large score typography, rank ball, race progress, and pressed feedback.

- [ ] **Step 3: Add undo-last-point**

Track `lastScoreAction` before each score update. Show `Undo last point` while the match is in progress and the viewer has not submitted. Undo calls `update-match-score` with the previous score pair and clears `lastScoreAction` after success.

- [ ] **Step 4: Preserve final submission flow**

Keep result submission and payment flow below the scoreboard. Disable scoring after either player reaches race length or after the viewer has submitted.

### Task 9: Verify And Publish

**Files:**
- All changed files.

- [ ] **Step 1: Run local verification**

Run:

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 2: Apply Supabase migration and deploy changed Edge Functions**

Apply `013_release_readiness.sql` to project `ankvjywsnydpkepdvuvm`. Deploy changed Edge Functions.

- [ ] **Step 3: Run live SQL checks**

Confirm payment constraints, treasury views, forfeit columns, RPC grants, and no rank gaps/duplicates.

- [ ] **Step 4: Push branch and open PR**

Push `codex/release-readiness-spec`, open PR to `main`, wait for Supabase/Vercel checks, then merge only if green.
