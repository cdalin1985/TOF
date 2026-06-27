# Edge function write-batching plan (deferred optimization)

## Status: planned, NOT yet implemented — intentionally

This documents the highest-leverage scaling change for the TOF edge functions
and **why it is deliberately not done yet**.

## The issue

`submit-result` (match confirmation) and `resolve-dispute` perform many
sequential, dependent Supabase calls per invocation — read stats, write stats,
read discipline stats, write discipline stats, ranking cascade, cooldown,
rank-1 compliance, notifications, activity feed, treasury. A single confirmation
can be 15–25 round-trips, none in a database transaction.

Consequences:
- **Latency**: each call is slow (round-trips add up), and on free-tier compute
  the heavy paths can approach the function wall-clock limit under load.
- **Atomicity**: if the function dies partway, stats/rankings can be left
  partially updated (no transaction wraps the multi-table write). The code
  guards the *match status transition* atomically, but the downstream stat
  writes are not all-or-nothing.

## The fix (when warranted)

Move each multi-table mutation into a single Postgres `SECURITY DEFINER` RPC
that runs in one transaction, and have the edge function call it once:

- `confirm_match_result(match_id, winner_id, p1, p2, payment)` — does the
  match update, challenge update, ranking cascade, season + discipline stats,
  cooldown, and rank-1 check in one transaction.
- `resolve_disputed_match(...)` — same for the admin dispute path.

This collapses ~20 round-trips to 1, makes the write atomic, and removes the
free-tier timeout risk on the hot path.

## Why it is deferred

1. **Not needed at current scale.** TOF is a single league on Supabase free
   tier. At ~50 members / day (tens concurrent at peak) the existing code is
   comfortably within limits. This optimization raises a ceiling that is not
   currently being approached.
2. **Highest-risk surface.** These two functions are the match-confirmation and
   dispute engines. A subtle bug in a hand-written transactional RPC corrupts
   rankings / stats / treasury for the whole league — exactly the
   customer-facing breakage the project guards against.
3. **No automated test coverage** exists for these edge functions, and there is
   no staging project. Rewriting them safely needs a test harness + a Supabase
   branch/staging DB to validate full match flows first.

## Trigger to implement

Do this when any of these become true:
- TOF (or the TOC.Monster white-label) grows to multiple leagues / hundreds of
  concurrent users.
- Free-tier function timeouts start appearing in logs on `submit-result` /
  `resolve-dispute`.
- Partial-write inconsistencies are observed after a failed confirmation.

Implement behind a test plan: seed a staging branch, script the
submit → confirm and submit → dispute → resolve flows, diff resulting
rankings/stats against the current implementation, then deploy.
