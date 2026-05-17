import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '010_workflow_connection_fixes.sql'),
  'utf8',
);
const createChallengeFunction = readFileSync(
  join(process.cwd(), 'supabase', 'functions', 'create-challenge', 'index.ts'),
  'utf8',
);
const securityMigration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '011_lock_down_security_definer_rpc.sql'),
  'utf8',
);
const rankLockMigration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '012_serialize_ranking_mutations.sql'),
  'utf8',
);

test('migration allows the internal confirming match status used by submit-result', () => {
  assert.match(migration, /matches_status_check/i);
  assert.match(migration, /'confirming'::text/);
});

test('migration makes max_race nullable so null means no race maximum', () => {
  assert.match(migration, /ALTER TABLE public\.league_settings\s+ALTER COLUMN max_race DROP NOT NULL/i);
  assert.match(migration, /UPDATE public\.league_settings\s+SET max_race = NULL/i);
});

test('migration installs safe rank movement functions and cron wiring', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.cascade_ranking_after_win/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_rank1_penalty\(p_player_id uuid\)\s+RETURNS integer/i);
  assert.match(migration, /LOCK TABLE public\.rankings IN SHARE ROW EXCLUSIVE MODE/i);
  assert.match(migration, /position = position \+ 1000/i);
  assert.match(migration, /position = position - 1001/i);
  assert.match(migration, /SELECT public\.enforce_rank1_obligations\(\);/i);
});

test('migration revokes direct public execution of privileged rank helpers', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.cascade_ranking_after_win\(uuid, uuid\) FROM PUBLIC/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.apply_rank1_penalty\(uuid\) FROM PUBLIC/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.check_and_enforce_rank1_obligation\(\) FROM PUBLIC/i);
});

test('create-challenge treats null max_race as no maximum', () => {
  assert.doesNotMatch(createChallengeFunction, /settings\?\.max_race\s*\?\?\s*15/);
  assert.match(createChallengeFunction, /const maxRace = settings\?\.max_race;/);
});

test('security migration revokes explicit anon and authenticated RPC access', () => {
  for (const signature of [
    'public.cascade_ranking_after_win(uuid, uuid)',
    'public.apply_rank1_penalty(uuid)',
    'public.enforce_rank1_obligations()',
    'public.check_and_enforce_rank1_obligation()',
    'public.expire_stale_challenges()',
    'public.assign_admin_on_signup()',
    'public.get_ranked_players()',
    'public.handle_new_user()',
  ]) {
    assert.match(
      securityMigration,
      new RegExp(`REVOKE ALL ON FUNCTION ${signature.replace(/[().]/g, '\\$&')} FROM anon, authenticated`, 'i'),
    );
  }
});

test('ranking lock migration serializes concurrent rank mutators', () => {
  assert.match(rankLockMigration, /CREATE OR REPLACE FUNCTION public\.cascade_ranking_after_win/i);
  assert.match(rankLockMigration, /CREATE OR REPLACE FUNCTION public\.apply_rank1_penalty/i);
  assert.match(rankLockMigration, /LOCK TABLE public\.rankings IN SHARE ROW EXCLUSIVE MODE/i);
  assert.doesNotMatch(rankLockMigration, /IN ROW EXCLUSIVE MODE/i);
});
