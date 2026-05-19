-- Release hardening guardrails.
-- Adds server-enforced score/submission/treasury invariants used by the
-- May 2026 league rehearsal and release pass.

-- 1. Store each player's submitted result independently so mismatches can
-- become disputes instead of silently overwriting the shared score columns.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS player1_submitted_winner_id uuid REFERENCES public.players(id),
  ADD COLUMN IF NOT EXISTS player2_submitted_winner_id uuid REFERENCES public.players(id),
  ADD COLUMN IF NOT EXISTS player1_submitted_player1_score integer,
  ADD COLUMN IF NOT EXISTS player1_submitted_player2_score integer,
  ADD COLUMN IF NOT EXISTS player2_submitted_player1_score integer,
  ADD COLUMN IF NOT EXISTS player2_submitted_player2_score integer,
  ADD COLUMN IF NOT EXISTS player1_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS player2_submitted_at timestamptz;

-- 2. Scores cannot be negative or exceed the race target. NOT VALID keeps the
-- migration safe for existing rows while enforcing all new writes immediately.
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_score_bounds;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_score_bounds
  CHECK (
    player1_score >= 0
    AND player2_score >= 0
    AND player1_score <= race_length
    AND player2_score <= race_length
  ) NOT VALID;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_submitted_score_bounds;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_submitted_score_bounds
  CHECK (
    (player1_submitted_player1_score IS NULL OR (player1_submitted_player1_score >= 0 AND player1_submitted_player1_score <= race_length))
    AND (player1_submitted_player2_score IS NULL OR (player1_submitted_player2_score >= 0 AND player1_submitted_player2_score <= race_length))
    AND (player2_submitted_player1_score IS NULL OR (player2_submitted_player1_score >= 0 AND player2_submitted_player1_score <= race_length))
    AND (player2_submitted_player2_score IS NULL OR (player2_submitted_player2_score >= 0 AND player2_submitted_player2_score <= race_length))
  ) NOT VALID;

-- 3. Treasury signs are controlled by entry_type. Credits, debits, and
-- reversals must store positive amounts; corrections may be positive or
-- negative but cannot be zero.
ALTER TABLE public.treasury_ledger
  DROP CONSTRAINT IF EXISTS treasury_ledger_amount_direction;

ALTER TABLE public.treasury_ledger
  ADD CONSTRAINT treasury_ledger_amount_direction
  CHECK (
    (entry_type IN ('credit', 'debit', 'reversal') AND amount_cents > 0)
    OR (entry_type = 'correction' AND amount_cents <> 0)
  ) NOT VALID;

ALTER TABLE public.treasury_ledger
  DROP CONSTRAINT IF EXISTS treasury_ledger_reversal_requires_target;

ALTER TABLE public.treasury_ledger
  ADD CONSTRAINT treasury_ledger_reversal_requires_target
  CHECK (
    (entry_type = 'reversal' AND reversed_entry_id IS NOT NULL)
    OR (entry_type <> 'reversal' AND reversed_entry_id IS NULL)
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS treasury_ledger_one_reversal_per_entry
  ON public.treasury_ledger(reversed_entry_id)
  WHERE entry_type = 'reversal'
    AND reversed_entry_id IS NOT NULL;
