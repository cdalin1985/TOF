# TOC Release Readiness Design

## Goal

Prepare TOC for league-member release by fixing the remaining functional trust points before visual polish: match-fee payment clarity, treasury correctness, declined-challenge forfeits, activity-feed transparency, rehearsal scripts, and professional social previews.

## Scope

This design is split into five deliverable slices:

1. Payment and treasury correctness.
2. Declined challenge as automatic forfeit/loss with admin reversal.
3. Activity feed as the public journal of league actions.
4. Compressed admin rehearsal script for release testing.
5. Real Open Graph preview image.
6. Table-side match scoreboard experience.

The visual redesign / curb appeal work remains parked until these release mechanics are reliable.

## Current Evidence

The app already asks for a match-fee method on result submission, but stores only `envelope` or `digital` on the match. It does not create treasury credits automatically.

The public treasury page fetches the full ledger and computes balance in the frontend. The admin treasury tab fetches only the latest 20 rows and computes a separate balance. Both ignore non-credit/debit semantics beyond display.

Declining a challenge currently marks the challenge `declined`, notifies admins, and tells the challenger that an admin will confirm the spot move. The desired rule is different: a decline is an automatic forfeit/loss and does not need admin confirmation.

Publicly visible league data currently includes players, rankings, challenges, matches, cooldowns, activity feed, treasury, player stats, discipline stats, and reference metrics. Profiles are own-user-only after the recent privacy fix.

The HTML points social sharing to `/og-image.png`, but `public/og-image.png` does not exist.

## Slice 1: Payment And Treasury

### Payment Methods

Replace the current two-value method with explicit values:

- `cash_envelope`
- `paypal`
- `cash_app`
- `venmo`

The match result submission UI should show each method as its own choice. Cash envelope is treated as a factual payment when submitted. Any real-world envelope mishap is handled outside the app.

Digital payment buttons should support league payment links for PayPal, Cash App, and Venmo after testing. During testing, missing URLs should not block match submission. A missing URL should show the method as unavailable for external handoff while still allowing test environments to record the method if the feature flag/config allows it.

### Treasury Source Of Truth

Treasury totals should come from one shared source instead of two frontend calculations. The preferred approach is a database view or RPC that returns:

- `total_credit_cents`
- `total_debit_cents`
- `balance_cents`
- ledger rows ordered by `created_at desc`

Entry sign rules:

- `credit`: increases balance.
- `debit`: decreases balance.
- `correction`: applies `amount_cents` as signed value, so positive corrections increase and negative corrections decrease.
- `reversal`: negates the referenced entry's balance effect when `reversed_entry_id` is present.

The public treasury page and admin treasury tab must use the same helper so their balances cannot drift.

### Automatic Match Fee Entries

When a match result is confirmed, each submitted payment method should create a traceable treasury credit for the $5 fee:

- One credit per player payment.
- Description includes player name, match id shorthand, and payment method.
- Match id and player id should be captured in structured ledger metadata or audit detail.
- The insertion must be idempotent so retrying result confirmation does not double-charge the treasury.

For admin-resolved matches, the admin should be able to record or skip payment entries explicitly. Force-completing a dispute should not silently invent payment credits unless payment methods are known.

## Slice 2: Declined Challenge Forfeits

### Rule

A declined challenge is an automatic forfeit. It should behave as a loss-equivalent event with no admin confirmation.

When the challenged player declines:

- Challenge status becomes `forfeited`.
- The challenger is treated as the forfeit winner.
- The challenged player is treated as the forfeiting player.
- If the challenger is lower ranked than the challenged player, the normal ranking cascade is applied.
- The forfeiting player receives the normal post-loss cooldown.
- No match fee is owed because no match was played.
- The activity feed records the forfeit clearly.
- Notifications go to both players.

### Record Format

League records should display as three integers:

`wins-losses-forfeits`

Example: a player with six match wins, five match losses, and one declined challenge is shown as `6-5-1`.

Data model implication:

- Add `forfeits` to season stats.
- Add `forfeit_wins` to season stats.
- Add `forfeits` and `forfeit_wins` to discipline stats because each challenge already has a discipline.
- Increment the challenger's `wins` and `forfeit_wins`.
- Increment the declining player's `forfeits`, not their played `losses`.
- Treat the forfeit as loss-equivalent for ranking and cooldown rules, while keeping the public record as `wins-losses-forfeits`.

Recommended public display:

- Player card and profile: `W-L-F`.
- Activity: "Player A won by forfeit after Player B declined the challenge."
- Admin detail: show whether a win was played or by forfeit.

### Admin Reversal

Admins need a safe reversal for accidental declines.

Reversal should:

- Be available for `forfeited` challenges caused by decline.
- Restore the challenge to `pending`.
- Remove or mark reversed the forfeit/cooldown/stat effects.
- Restore rankings only if the app can prove no later ranking mutation depends on the forfeit.
- If a later ranking mutation exists, block automatic reversal and direct the admin to a manual correction workflow.
- Log the reversal to audit events and activity feed.
- Notify both players that the decline was reversed and the challenge is pending again.

Implementation should store enough for safe reversal at the moment of forfeit:

- Challenge id.
- Challenger id.
- Forfeiting player id.
- Previous challenge status.
- Previous affected ranking positions.
- Stat deltas applied.
- Cooldown id created.
- Activity event id and notification ids created by the forfeit action.
- Created-by actor or system marker.

## Slice 3: Public Activity Journal

The activity feed should be treated as an intentionally detailed public journal of app actions. If a table is public because league transparency matters, the action that produced or changed that public state should also be narrated in activity.

Events to log:

- Challenge issued.
- Challenge accepted.
- Challenge scheduled.
- Challenge cancelled.
- Challenge expired.
- Challenge forfeited by decline.
- Accidental decline reversed.
- Match started.
- Result submitted by first player.
- Result disputed.
- Match confirmed.
- Dispute resolved.
- Ranking changed.
- Rank #1 obligation initialized, satisfied, overdue, or penalized.
- Player activated/deactivated.
- Player added or claimed.
- Treasury entry added, corrected, or reversed.
- Match fee recorded, including method category.
- League settings changed.

The feed should reveal the direct event context in correlation with the event. Player names, emails, challenge/match context, ranking positions, treasury descriptions, public league actions, and relevant before/after values are acceptable under the league transparency model.

Emails are acceptable everywhere when they are part of a public app event. Profile visibility can be relaxed if the implementation needs public email access for the journal or admin workflows; if it stays restricted, event-specific emails should still be written into activity/audit details when relevant.

## Slice 4: Admin Rehearsal Script

The rehearsal script should simulate roughly a week or more of league behavior in a two to three hour session.

Cast:

- Chase Dalin: super admin, rank #3, in-character.
- Frank Kincl: admin, rank #2.
- Dave Alderman: admin, rank #4.
- Thomas E. Kingston: admin, rank #9.
- Eric Croft: admin, rank #14.
- Director/Scribe: separate observer if available.
- Supporting test players at key ladder positions: #1, #5, #6, #7, #8, #10, #11, #12, bottom rank, inactive player, unclaimed player, pending challenge player, disputed match player, cooldown player.

The rehearsal should be written like a movie script:

- Act.
- Scene.
- Cast members.
- Dialogue/action prompts.
- Exact app actions.
- Expected app response.
- Watch-for notes.
- Failure signals.
- Scribe notes.
- Cleanup instructions.

It should intentionally surface:

- Heavy-use challenge and match flows.
- Payment confusion.
- Treasury reconciliation.
- Dispute and wrong-score behavior.
- Decline/forfeit and reversal.
- Rank movement.
- Rank #1 pressure.
- Admin permissions.
- Inactive/unclaimed player quirks.
- Notification and activity-feed timing.
- Mobile friction and unclear copy.

## Slice 5: Social Preview Image

Add a real `public/og-image.png` at 1200 x 630.

Preferred source:

1. Use the TOC app PNG saved on the desktop if located during implementation.
2. If no desktop PNG is available, generate the preview from existing app assets, especially `public/toc-icon.svg`, plus the text "Top of the Capital" and "Helena Pool League".

Verification:

- `https://toc.monster/og-image.png` returns `200 OK`.
- Content type is `image/png`.
- The response is not the app HTML.
- Shared-link metadata continues to point at `https://toc.monster/og-image.png`.

## Slice 6: Match Scoreboard Experience

Replace the current small-button in-progress scoring surface with a table-side scoreboard that is easy to use during a real match and visually memorable.

Design direction: "Table-Side Scoreboard."

Core behavior:

- The whole player score zone is tappable while the match is in progress.
- Each side shows player name, rank ball, current score, and race progress.
- The tap target must be large enough for one-handed phone use.
- The latest score tap should be reversible with an "Undo last point" action while the match remains in progress.
- Undo should call the same score-update Edge Function with the previous score state instead of editing locally only.
- Scoring controls disappear or disable once either player reaches race length or after the viewer has submitted the final result.
- The final-submit flow stays below the scoreboard.

Interaction and visual requirements:

- Use the current TOC dark/red/gold brand language, but make the scoreboard feel less like a form and more like a live match surface.
- Prefer lucide icons over emoji for controls.
- Provide strong pressed/selected feedback within 100ms.
- Preserve accessibility: buttons need labels, score changes need visible state, and text must fit on mobile.
- Avoid relying on tiny plus buttons as the primary score input.

## Release Order

1. Implement payment method enum and treasury source-of-truth.
2. Implement automatic match-fee ledger credits.
3. Implement declined-challenge forfeits and safe reversal.
4. Expand activity feed events.
5. Write the admin rehearsal script from the final workflows.
6. Add and verify `og-image.png`.
7. Replace the in-progress scoreboard with the table-side scoreboard and undo-last-point flow.
8. Run local tests, lint, build, live Supabase checks, and Vercel preview.

## Testing Strategy

Use test-driven development for behavior changes.

Minimum tests:

- Treasury balance rules for credit, debit, correction, and reversal.
- Idempotent match-fee credit creation.
- Payment method validation.
- Decline creates forfeit status, ranking movement, cooldown, stats, notifications, and activity.
- Decline reversal succeeds when no later ranking mutation exists.
- Decline reversal blocks when later ranking mutation exists.
- Public pages and admin pages read the same treasury balance.
- OG image path resolves to a PNG in build output.
- In-progress match scoring exposes large tappable player score zones and an undo-last-point action.

Manual rehearsal verifies the human workflow layer after code tests pass.
