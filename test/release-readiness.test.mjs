import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const migration = read('supabase/migrations/013_release_readiness.sql');
const submitResult = read('supabase/functions/submit-result/index.ts');
const respondToChallenge = read('supabase/functions/respond-to-challenge/index.ts');
const databaseTypes = read('src/types/database.ts');
const matchPage = read('src/pages/MatchPage.tsx');

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
