import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const migration = read('supabase/migrations/20260517213621_013_release_readiness.sql');
const submitResult = read('supabase/functions/submit-result/index.ts');
const respondToChallenge = read('supabase/functions/respond-to-challenge/index.ts');
const resolveDispute = read('supabase/functions/resolve-dispute/index.ts');
const updateMatchScore = read('supabase/functions/update-match-score/index.ts');
const manageTreasury = read('supabase/functions/manage-treasury/index.ts');
const rank1Compliance = read('supabase/functions/rank1-compliance/index.ts');
const setPlayerActive = read('supabase/functions/set-player-active/index.ts');
const adminPage = read('src/pages/AdminPage.tsx');
const databaseTypes = read('src/types/database.ts');
const matchPage = read('src/pages/MatchPage.tsx');
const hardeningMigrationPath = 'supabase/migrations/20260519110000_release_hardening_guardrails.sql';
const hardeningMigration = existsSync(join(root, hardeningMigrationPath)) ? read(hardeningMigrationPath) : '';

test('payment methods are explicit and legacy digital/envelope values are retired', () => {
  for (const method of ['cash_envelope', 'paypal', 'cash_app', 'venmo']) {
    assert.match(migration, new RegExp(method));
    assert.match(databaseTypes, new RegExp(method));
  }

  assert.doesNotMatch(databaseTypes, /'envelope'\s*\|\s*'digital'/);
});

test('treasury has source metadata, idempotent match fee index, and shared balance view', () => {
  assert.match(migration, /ALTER TABLE public\.treasury_ledger\s+ADD COLUMN IF NOT EXISTS source_type/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS treasury_ledger_source_unique/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.treasury_ledger_effects/i);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.treasury_summary/i);
});

test('forfeit stats and reversal state are stored in the database', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS forfeits integer NOT NULL DEFAULT 0/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.challenge_forfeiture_events/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_challenge_decline_forfeit/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reverse_challenge_decline_forfeit/i);
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

test('match fees are recorded even when submissions transition to disputed', () => {
  // Shared helper is the single source of truth for fee recording.
  assert.match(submitResult, /async function recordSubmittedMatchFees/);
  // Helper is invoked from every disputed early-return so admin dispute
  // resolution doesn't have to recover payment methods after the fact.
  const disputedCalls = submitResult.match(/await recordSubmittedMatchFees\(supabase, updated, user\.id\)/g) ?? [];
  assert.ok(disputedCalls.length >= 3, `expected 3+ disputed-path fee recordings, found ${disputedCalls.length}`);
  // Confirmed path also uses the same helper.
  assert.match(submitResult, /await recordSubmittedMatchFees\(supabase, finalMatch, user\.id\)/);
});

test('release setup checklist includes the hardening guardrails migration', () => {
  const setup = read('SETUP.md');
  assert.match(setup, /20260519110000_release_hardening_guardrails\.sql/);
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

test('admin dispute resolution does not write retired season points column', () => {
  assert.doesNotMatch(resolveDispute, /points\s*:/);
});

test('score updates are limited to active matches and validate score bounds', () => {
  assert.match(updateMatchScore, /MATCH_SCORE_STATUSES/);
  assert.match(updateMatchScore, /Number\.isInteger\(my_score\)/);
  assert.match(updateMatchScore, /\.in\('status', MATCH_SCORE_STATUSES\)/);
  assert.match(hardeningMigration, /matches_score_bounds/i);
});

test('result submissions preserve independent player reports and dispute mismatches', () => {
  for (const column of [
    'player1_submitted_winner_id',
    'player2_submitted_winner_id',
    'player1_submitted_player1_score',
    'player2_submitted_player2_score',
  ]) {
    assert.match(hardeningMigration, new RegExp(column, 'i'));
    assert.match(submitResult, new RegExp(column));
  }

  assert.match(submitResult, /submissionsMatch/);
  assert.match(submitResult, /status:\s*'disputed'/);
});

test('admin match resolution is gated and explicit when forcing active matches', () => {
  assert.match(resolveDispute, /ALLOWED_RESOLUTION_STATUSES/);
  assert.match(resolveDispute, /force_complete/);
  assert.match(resolveDispute, /Winner must be one of the match players/);
  assert.match(resolveDispute, /winnerScore < raceTarget/);
  assert.match(adminPage, /force_complete:\s*true/);
});

test('match confirmation refreshes winner rank after rank cascade before stats update', () => {
  assert.match(submitResult, /refreshedWinnerRank/);
  assert.match(submitResult, /winnerCurrentPosition/);
});

test('accepted challenge scheduling validates inputs and checks write errors', () => {
  assert.match(respondToChallenge, /VALID_VENUES/);
  assert.match(respondToChallenge, /scheduledAt/);
  assert.match(respondToChallenge, /updateError/);
  assert.match(respondToChallenge, /insertError/);
  assert.match(respondToChallenge, /\.eq\('status', 'pending'\)/);
});

test('treasury ledger constrains amount direction and one reversal per entry', () => {
  assert.match(hardeningMigration, /treasury_ledger_amount_direction/i);
  assert.match(hardeningMigration, /treasury_ledger_one_reversal_per_entry/i);
  assert.match(manageTreasury, /TREASURY_ENTRY_TYPES/);
  assert.match(manageTreasury, /entry_type !== 'correction' && amount_cents <= 0/);
  assert.match(manageTreasury, /entry_type === 'correction' && amount_cents === 0/);
  assert.match(manageTreasury, /reversal.*reversed_entry_id/s);
});

test('rank one manual enforcement only penalizes after the obligation window is overdue', () => {
  assert.match(rank1Compliance, /enforce && overdue && !compliant/);
});

test('set-player-active writes audit and activity through service role and checks errors', () => {
  assert.match(setPlayerActive, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(setPlayerActive, /adminClient/);
  assert.match(setPlayerActive, /auditError/);
  assert.match(setPlayerActive, /activityError/);
});
