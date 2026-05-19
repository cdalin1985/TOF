# TOC Admin Rehearsal Script

> **Audience:** TOC admin cast running a release dress rehearsal of Top of the
> Capital before opening it up to the wider league.
>
> **Format:** Three acts, two-to-three hours total. Each scene lists the cast
> on stage, the dialogue/action prompt, the exact app actions to perform,
> the response to expect, what to watch for, the failure signals that should
> stop the scene, scribe prompts, and any cleanup notes.
>
> **Environment:** Run against a clean test database or a sandbox project
> with at least 16 seeded players. Confirm migrations `001_schema.sql`
> through `013_release_readiness.sql` are applied before Act I.

---

## Runway, Timing, and Skip Rules

**Runway:**
- T-48 hours: confirm the sandbox database is clean, migrations 001-013 are applied, and every current Edge Function directory is deployed.
- T-24 hours: confirm seeded players, role assignments, push notification permission, OG image response, and admin/super-admin login access.
- T-2 hours: open the deployed app on two phones plus one laptop, clear stale sessions, and assign the Director/Scribe.
- T-15 minutes: freeze seed data except for the script, start the scribe log, and mark the rehearsal start timestamp for cleanup.

**Timing target:** 150 minutes total. Act I gets 25 minutes, Act II gets 70 minutes, Act III gets 45 minutes, and Curtain gets 10 minutes. Call a five-minute reset if any scene burns more than 1.5x its budget.

**Critical path:** do not launch without passing auth/home, public treasury read, normal challenge acceptance, first-challenge up-10 validation, Rank #1 challenge-anyone validation, regular non-top-10 up-5 validation, completed-match treasury credits, decline-as-forfeit cooldown, inactive/unclaimed rejection, non-super-admin treasury denial, and Rank #1 enforcement.

**Skip rules:**
- Never skip a critical-path scene.
- If time is short, skip only optional depth scenes: 2.3 disputed match, 3.2 hard reversal, or 3.6 settings change visibility.
- Do not skip cleanup notes. If a scene is skipped, the scribe records the reason, owner, and whether that gap blocks release.
- If a critical-path scene fails, stop the rehearsal and file the follow-up before continuing. Later passing scenes do not erase the failure.

---

## Cast

**Admin players (in-character on their real accounts):**

| Role             | Name                | App Rank | Notes                                          |
| ---------------- | ------------------- | -------- | ---------------------------------------------- |
| Super admin      | Chase Dalin         | #3       | League owner; also the on-table scribe sign-off |
| Admin            | Frank Kincl         | #2       | Pairs with Chase for Rank #1 obligation drills |
| Admin            | Dave Alderman       | #4       | Drives a contested forfeit reversal           |
| Admin            | Thomas E. Kingston  | #9       | Borderline of the top-10 challenge band       |
| Admin            | Eric Croft          | #14      | Outside top-10; tests "regular" challenge band |
| Director/Scribe  | (volunteer)         | —        | Reads the prompts, records all failure signals|

**Supporting test players (seeded accounts the admins drive remotely):**

| Tag            | Position    | Purpose                                              |
| -------------- | ----------- | ---------------------------------------------------- |
| TOP-1          | #1          | Holds the #1 obligation; receives Frank's challenge  |
| TOP-5          | #5          | Top-5 opponent for Rank #1 compliance                |
| MID-6          | #6          | Receives Chase's challenge                           |
| MID-7          | #7          | Disputed-match challenger                            |
| MID-8          | #8          | Disputed-match opponent                              |
| MID-10         | #10         | Top-10 boundary; can challenge up the ladder         |
| MID-11         | #11         | Just outside top-10; tests normal ±5 range          |
| MID-12         | #12         | Cooldown subject after Act II match                  |
| BOTTOM         | last rank   | First-challenge up-10 band test; no prior challenges |
| INACTIVE       | varies      | Marked inactive — should reject challenges          |
| UNCLAIMED      | varies      | No profile attached — should not log in            |
| PENDING        | varies      | Already has an open incoming challenge              |

> The scribe maintains a one-page paper grid with these tags and ticks them off
> as each scene retires the role.

---

# Act I — League opens for the day

Goal: prove the read-only surfaces are believable before anyone touches state.

## Scene 1.1 — Cold open

**Cast on stage:** Chase, Frank, Dave, Thomas, Eric, Scribe.

**Prompt (read aloud):**
> "Open the app fresh. We are about to spin up the league for the day. Do not
> tap anything except where the script tells you to. Tell me if anything
> looks wrong."

**Exact app actions:**
1. Each admin opens the deployed URL on their phone in a private/incognito tab.
2. Log in with their TOC account.
3. Land on Home.

**Expected response:**
- Home renders inside 2 seconds on cellular.
- Player card shows correct name, rank, FR if present, and the new
  `Wins · Losses · Forfeits` strip plus Win % and Streak.
- Activity preview shows 6 recent events.
- No banners about challenges that do not exist.

**Watch for:**
- Wrong rank or wrong stats on the player card.
- Activity card empty when it should not be.
- Notifications badge stale (read items still counted).
- Skeletons that never resolve.

**Failure signals (stop scene):**
- Any admin sees another user's stats on their own card.
- Home crashes / shows a white screen.
- Auth state desyncs between tabs.

**Scribe prompts:**
- "Anyone showing a stat or rank that does not match what you expect?"
- "How long until the page felt usable on cellular?"

**Cleanup:** none.

## Scene 1.2 — Public read-only walk

**Cast:** Same.

**Prompt:**
> "Go to The List. Then Activity. Then Treasury. Tell me anything that reads
> like it was written for engineers rather than players."

**Exact app actions:**
1. Tap Rankings.
2. Filter to "Can Challenge."
3. Open three random player profiles.
4. Tap back, tap Activity, scroll until you see at least one challenge,
   match, treasury, and admin event icon.
5. Tap Treasury and confirm the three summary cards plus the ledger render.

**Expected response:**
- Rankings list paginates smoothly. W-L-F columns line up.
- "Can Challenge" filter respects each admin's rank band.
- Profile page shows the new Forfeits stat, the Record W-L-F line above the
  grid, and three discipline tabs with the discipline-level Forfeits stat.
- Activity icons match the event type (no `?` or fallback `🎱` for every row).
- Treasury cards show `Total In`, `Total Out`, `Balance` from the shared view,
  and the ledger reflects credits as `+$X.XX` and debits as `-$X.XX`.

**Watch for:**
- Top-10 player seeing a stranger above them they cannot challenge.
- Empty Forfeits stat showing `undefined` or `NaN` instead of `0`.
- Treasury balance differing between the summary card and the running ledger.
- Copy that still says "envelope" or "digital" instead of the four explicit
  payment methods.

**Failure signals:**
- Treasury balance card disagrees with the sum of `effect_cents` shown in
  the ledger.
- Inactive or unclaimed player exposed in a context they should not be.

**Scribe prompts:**
- "Read me one sentence on each page that confused you."

**Cleanup:** none.

---

# Act II — A live league day

Goal: drive enough volume through the core flows that breakage shakes loose.
Run the scenes in order; do not interleave.

## Scene 2.0 - BOTTOM first challenge can reach 10 spots up

**Cast:** BOTTOM, MID-6.

**Prompt:**
> "BOTTOM is a new league member with no prior challenge history. Their first
> challenge should be allowed up to 10 spots above, but not 11 or more."

**Exact app actions:**
1. BOTTOM opens Rankings, taps Can Challenge.
2. Confirm the highest eligible target is the player 10 spots above BOTTOM
   (with 16 seeded players, rank #6).
3. BOTTOM opens the direct challenge URL for the player 11 spots above
   BOTTOM (with 16 seeded players, rank #5) and tries to submit race 6.
4. BOTTOM challenges MID-6, 9 Ball, race 6.
5. BOTTOM opens Challenges and cancels the outgoing challenge before MID-6
   responds.

**Expected response:**
- Step 2 shows up to 10 spots above BOTTOM, not just the regular five.
- Step 3 is rejected with a clear first-challenge range message.
- Step 4 creates the challenge without a range error.
- Step 5 leaves MID-6 with no pending incoming challenge.

**Watch for:**
- BOTTOM getting only the regular five-spot band on their first challenge.
- The direct URL bypassing the first-challenge range cap.

**Failure signals:**
- A first challenge more than 10 spots above BOTTOM is created.
- Cleanup leaves MID-6 blocked by an open incoming challenge.

**Scribe prompts:**
- "Could a new member understand why the 10-spot rule applied only to their first challenge?"

**Cleanup:** confirm the BOTTOM -> MID-6 challenge is cancelled before Scene 2.1.

## Scene 2.1 — Chase challenges MID-6

**Cast:** Chase, MID-6 (Chase drives MID-6's session on a second device).

**Prompt:**
> "Chase wants to climb. Send a clean, normal challenge to MID-6 from the
> Rankings page."

**Exact app actions:**
1. Chase: Rankings → Can Challenge → tap MID-6 → Challenge → 9 Ball, race 7.
2. MID-6: open notification → accept with venue Eagles 4040, scheduled
   tomorrow 7 pm.
3. Both check that a match card appears on Home.

**Expected response:**
- Notification reaches MID-6 within 10s.
- Activity feed records both `challenge_issued` and `challenge_accepted`,
  with race length, rank movement context, and venue/date in the detail line.
- A `match` row links the challenge in both Home cards.

**Watch for:**
- Activity detail line missing the new rank/venue context.
- Challenge response window not shown on the challenger's outgoing card.

**Failure signals:**
- Notification never arrives.
- Match is created without `scheduled_at`.

**Scribe prompts:**
- "Did either of you have to scroll to find the action button?"

**Cleanup:** leave the match card in place for later match-flow review.

## Scene 2.2A - TOP-1 can challenge anyone

**Cast:** Frank (acts as TOP-1), BOTTOM.

**Prompt:**
> "Rank #1 is not trapped at the top. We want to prove #1 can issue a
> challenge to any active, claimed player, including the bottom of the list."

**Exact app actions:**
1. TOP-1 opens Rankings and taps Can Challenge.
2. Confirm BOTTOM and at least two mid-table players show Challenge buttons.
3. TOP-1 challenges BOTTOM, 10 Ball, race 6.
4. TOP-1 opens Challenges and cancels the outgoing challenge before BOTTOM
   responds.

**Expected response:**
- BOTTOM is eligible even though the rank gap is larger than five spots.
- The challenge is created without a range error.
- The cancellation posts cleanly and BOTTOM has no pending challenge left.

**Watch for:**
- Can Challenge filtering TOP-1 down to only nearby ranks.
- Direct challenge creation blocked by the normal up/down five rule.

**Failure signals:**
- Rank #1 cannot create the challenge.
- Cleanup leaves BOTTOM with an open incoming challenge.

**Scribe prompts:**
- "Did the app make it clear that Rank #1 has the special challenge-anyone rule?"

**Cleanup:** confirm the TOP-1 -> BOTTOM challenge is cancelled before later challenge-band scenes.

## Scene 2.2B - Frank challenges TOP-1 for Rank #1 pressure

**Cast:** Frank, TOP-1.

**Prompt:**
> "Frank is at #2. We want to start the Rank #1 obligation clock and prove
> the system tells TOP-1 they must play top-5 opponents within 30 days."

**Exact app actions:**
1. Frank: challenge TOP-1, 8 Ball, race 6.
2. TOP-1: accept, Valley Hub, tomorrow 6 pm.
3. Frank: open the match, tap "Start Match", then add a couple points using
   the new table-side scoreboard.

**Expected response:**
- TableSideScoreboard renders large side panels, race progress bar updates,
  Undo last point appears after the first tap.
- Each tap has a visible pressed state and updates within 100ms.

**Watch for:**
- Scoreboard tap target smaller than 44 pt or buried under modal padding.
- Undo button gone before the second point is added.
- Rank #1 obligation badge on TOP-1's Home banner not lighting up.

**Failure signals:**
- Scoreboard registers a tap on the wrong side.
- Undo last point silently bumps the wrong player's score.

**Scribe prompts:**
- "How obvious was the undo? Where did you look first?"

**Cleanup:** leave the match in progress only if it will not block later Rank #1 enforcement; otherwise reset it in the sandbox before Scene 3.3.

## Scene 2.3 — Disputed match (MID-7 vs MID-8)

**Cast:** Chase (acts as MID-7), Frank (acts as MID-8), Dave (admin resolver).

**Prompt:**
> "MID-7 and MID-8 disagree on the final score. We want a real dispute and an
> admin resolution that records the dispute detail in activity."

**Exact app actions:**
1. MID-7 and MID-8 already have a scheduled match (seed it before rehearsal).
2. MID-7 starts the match, adds 7 points for himself, 4 for MID-8.
3. MID-7 taps Submit Final Result → winner MID-7 → payment method **PayPal**.
4. MID-8 opens the match, taps Submit Final Result → winner **MID-8** with
   the same scores. The system should flag a dispute.
5. Dave: Admin → Disputes → resolve as MID-7 wins 7–4, notes "MID-8 mis-tapped
   own score." Leave payment unset for now.

**Expected response:**
- Match status becomes `disputed` after step 4.
- Dave sees the disputed match with both players' submitted scores.
- After Dave resolves, activity feed records `dispute_resolved` with the
  final score and admin notes in the detail line.
- No treasury credit is created because Dave did not record a payment.

**Watch for:**
- Payment selected by MID-7 in step 3 disappears silently.
- Activity feed `dispute_resolved` event missing the detail line.

**Failure signals:**
- Treasury fee credited without a payment method recorded.
- Match locks before the second submission can register.

**Scribe prompts:**
- "Did the dispute UI make the conflict clear, or did Dave have to guess?"

**Cleanup:** Dave can re-resolve later and add explicit payment methods if
the league wants the $5 captured.

## Scene 2.4 — Clean match + match fee credits

**Cast:** Thomas, MID-10.

**Prompt:**
> "We want one match that flows perfectly end-to-end and produces two treasury
> credits."

**Exact app actions:**
1. Thomas challenges MID-10 (10 Ball, race 6).
2. MID-10 accepts and schedules now.
3. Both tap Start Match. Thomas scores 6, MID-10 scores 3.
4. Thomas submits → winner Thomas → payment **Cash envelope**.
5. MID-10 submits → winner Thomas → payment **Venmo**.
6. Open Treasury (public and admin).

**Expected response:**
- Both players see Victory/Defeat screens.
- Treasury balance increases by exactly `$10.00`.
- Ledger shows two new entries, one per payer, with full names, payment
  method label, and the short match id.
- The public Treasury page and the admin Treasury tab show the same balance
  (they read the same view).
- Activity feed records `match_confirmed` and two `match_fee_recorded` rows.

**Watch for:**
- Either side double-counted in the ledger (idempotency check).
- Activity headline omitting the payer's name.

**Failure signals:**
- Treasury balance moves by more than $10.
- Submitting twice creates duplicate ledger rows.

**Scribe prompts:**
- "Did either player wait noticeably on the second submission?"

**Cleanup:** none, leave entries in place for Act III treasury reconciliation.

## Scene 2.5 — Eric challenges MID-11 to test the regular ±5 band

**Cast:** Eric, MID-11.

**Prompt:**
> "Eric is #14 — outside top-10. He should only be able to challenge upward by
> 5 spots."

**Exact app actions:**
1. Eric opens Rankings, taps Can Challenge.
2. Confirms only positions 9-13 are eligible (5 spots up from 14).
3. Tries to challenge BOTTOM directly via the URL `/challenge/<bottom_id>`.

**Expected response:**
- Step 2: BOTTOM, MID-7, MID-8, etc. outside the ±5 band do not show a
  Challenge button.
- Step 3: the Edge Function refuses with a clear error mentioning the
  challenge range.

**Watch for:**
- Rankings filter showing players Eric cannot challenge.
- Server error that exposes a stack trace instead of a friendly message.

**Failure signals:**
- A challenge is created that breaches the band.

**Scribe prompts:**
- "Was the rejection message helpful enough for a player to fix the issue?"

**Cleanup:** none.

---

# Act III — Sharp edges

Goal: drive the painful flows. Decline-as-forfeit, reversal, cooldown, rank
movement, inactive players, treasury corrections.

## Scene 3.1 — Decline-as-forfeit

**Cast:** Eric (challenger), MID-12 (challenged).

**Prompt:**
> "Eric challenges MID-12. MID-12 declines on purpose, then panics and asks
> an admin to reverse it."

**Exact app actions:**
1. Eric challenges MID-12 (8 Ball, race 6).
2. MID-12 opens the incoming challenge, taps Decline (forfeit). The new
   warning panel appears.
3. MID-12 taps Decline anyway.
4. Both players verify in the activity feed.
5. Chase opens Admin → Challenges → the now-`forfeited` row shows a
   Reverse Decline button.
6. Chase taps Reverse Decline → confirms.

**Expected response:**
- Step 3: challenge status becomes `forfeited`. Eric receives a "challenge
  won by forfeit" notification; MID-12 gets a "decline recorded as forfeit"
  notification. MID-12 gains a post-match cooldown.
- Eric's record gains a Win and a Forfeit Win. MID-12's record gains a
  Forfeit (not a Loss).
- Activity feed: `challenge_forfeited` with rank movement and "no match
  fee" detail.
- Step 6: status returns to `pending`, MID-12's cooldown disappears,
  ranking returns to its prior position, both players receive a
  "decline reversed" notification, activity logs
  `challenge_forfeit_reversed`.

**Watch for:**
- Reversal silently failing because something else moved stats.
- Cooldown still present after reversal.

**Failure signals:**
- Reverse Decline succeeds when it should not (e.g., Eric already won a
  follow-up match that shifted stats).
- The challenge ends up as `pending` while stats remain at the post-forfeit
  values.

**Scribe prompts:**
- "Did Chase trust what the Reverse Decline preview told him?"

**Cleanup:** MID-12 may now accept the original challenge to complete the
arc, or the rehearsal can leave it pending.

## Scene 3.2 — Hard reversal: forfeit a long-ago decline

**Cast:** Dave, MID-12.

**Prompt:**
> "We want the reversal path to refuse cleanly when the world has moved on."

**Exact app actions:**
1. After Scene 3.1 cleanup, manually edit MID-12's `current_streak` in the
   admin SQL console to simulate later play (`UPDATE player_season_stats
   SET current_streak = -1 WHERE player_id = '<MID-12>'`).
2. Re-issue Eric → MID-12 decline so the forfeit fires again.
3. Manually bump `current_streak` again to `-2` to imitate a later
   real loss.
4. Dave: Admin → Challenges → Reverse Decline.

**Expected response:**
- Step 4: the RPC refuses with "Cannot automatically reverse challenge…".
  The Admin UI surfaces the error inline.

**Watch for:**
- A successful reversal here is a failure — that would mean the safety
  guard does not work.

**Failure signals:**
- App lets reversal through, mutating stats incorrectly.
- Error string leaks the raw SQL message without context.

**Scribe prompts:**
- "Did the failure message tell Dave what to do next, or just give up?"

**Cleanup:** manually restore stats. Record in the scribe log that a
manual-correction workflow is needed for this branch.

## Scene 3.3 — Rank #1 obligation enforcement

**Cast:** Frank (acts as TOP-1), Chase (super admin), TOP-5.

**Prompt:**
> "We want to verify the Rank #1 obligation banners and the admin enforce
> tool."

**Exact app actions:**
1. In SQL console, set TOP-1's `rank1_since` to 31 days ago and confirm only
   1 top-5 match exists in that window.
2. TOP-1: open Home. Confirm the orange/red banner reads "Rank #1 obligation
   not met" with the right counters.
3. Chase: Admin → Rank #1 → Check Status. Confirm the same numbers.
4. Chase: Enforce Now (super admin only).
5. Confirm TOP-1 moves to #10 and an activity event `rank1_penalty` posts.

**Expected response:**
- Steps 2-3: banners and counters match.
- Step 4: TOP-1 ranking position becomes 10; everyone else shuffles up; the
  banner on TOP-1's Home flips to a post-penalty notice.

**Watch for:**
- Enforcement available to a non-super-admin.
- Ranking cascade leaves gaps or duplicates.

**Failure signals:**
- Position #10 occupied by two players.
- Activity feed missing the penalty event.

**Scribe prompts:**
- "Did Chase have to leave the app to know the right thing to do?"

**Cleanup:** restore TOP-1's position to #1 (or accept the new order for the
rest of the rehearsal).

## Scene 3.4 — Inactive and unclaimed players

**Cast:** Thomas, INACTIVE, UNCLAIMED.

**Prompt:**
> "We want to see that the app stops people from playing in ways that
> shouldn't be possible."

**Exact app actions:**
1. Thomas tries to challenge INACTIVE via Rankings and via the direct
   challenge URL.
2. Thomas tries to challenge UNCLAIMED.
3. Chase opens Admin → Players, toggles INACTIVE back on, then immediately
   off. Confirm two activity events fire (`player_activated`,
   `player_deactivated`).

**Expected response:**
- Step 1: app blocks the challenge with "That player is currently inactive
  and cannot be challenged."
- Step 2: same kind of block, message reads naturally.
- Step 3: activity events appear with admin actor and the player's name.

**Watch for:**
- Inactive player visible on the leaderboard with a misleading rank.
- Unclaimed player appears in notifications as if they could respond.

**Failure signals:**
- A challenge is created against either player.

**Scribe prompts:**
- "If a real player had been confused here, would the message have helped?"

**Cleanup:** restore INACTIVE/UNCLAIMED to their seeded state.

## Scene 3.5 — Treasury reconciliation

**Cast:** Chase, Frank.

**Prompt:**
> "The activity feed and the treasury page should agree on every dollar."

**Exact app actions:**
1. Both open Treasury and write down the balance.
2. Frank: Admin -> Treasury -> try to add a +$1 credit "Unauthorized test."
3. Confirm Frank is denied because he is an admin, not a super_admin, and
   the public balance does not move.
4. Chase: Admin -> Treasury -> add a +$25 credit "Test sponsorship deposit."
5. Chase: add a -$5 debit "Refund for cancelled match." (Description
   counts.)
6. Chase: add a correction entry of -$0.50 by entering a `correction`
   row via SQL or the manage-treasury edge function (the UI currently
   exposes only credit/debit; record this as a rehearsal note).
7. Frank refreshes Treasury and confirms balance moved by exactly +$19.50
   from the original balance.

**Expected response:**
- Step 2: the Edge Function refuses Frank with a clear permission error and
  creates no ledger or activity row.
- Step 4-5: activity feed shows `treasury_entry_credit` and
  `treasury_entry_debit` events with the description.
- Step 7: public and admin balances agree; the ledger sign column reads
  `+`, `-`, `-` for the three new rows.

**Watch for:**
- Non-super-admin seeing a successful treasury mutation.
- Public Treasury page lagging behind the admin tab.
- Correction entry showing `correction` but altering the balance the
  wrong direction.

**Failure signals:**
- Frank's unauthorized +$1 appears in the ledger or activity feed.
- Balance moves by an unexpected amount.
- Audit log missing one of the three entries.

**Scribe prompts:**
- "If a player asked us to explain the balance from scratch, could we?"

**Cleanup:** Chase may post a fourth reversal entry to undo the test
sponsorship. Record any UI work needed to add corrections to the admin
tab in the scribe log.

## Scene 3.6 — Settings change visibility

**Cast:** Chase (super admin), Frank, Dave.

**Prompt:**
> "When we change a rule, players should see the change reflected and we
> should see a record of it."

**Exact app actions:**
1. Chase: Admin → Settings → bump `min_race` from 6 to 7. Save.
2. Frank: try to issue a race-6 challenge.
3. Confirm Edge Function refuses with the updated minimum.
4. Chase: revert `min_race` to 6.

**Expected response:**
- Step 1: settings save; admin sees "✓ Saved".
- Step 2: refusal mentions race length 7.
- Activity feed (or audit log if activity copy not added yet) records
  the settings change.

**Watch for:**
- Settings cache that does not invalidate after the save.
- Refusal message that still mentions race length 6.

**Failure signals:**
- A race-6 challenge succeeds after the change.

**Scribe prompts:**
- "Were any other settings exposed that we don't want admins editing?"

**Cleanup:** make sure `min_race` is back at 6.

---

# Curtain — Sign-off

**Cast:** Director, all admins.

**Prompt:**
> "Stand around the table. Anything from the night that we cannot launch
> with?"

**Checklist before signing off:**

- [ ] No failure signals in the scribe log are open.
- [ ] Treasury balance reconciles against expectations.
- [ ] Rankings have no gaps and no duplicates (`select position, count(*)
      from rankings group by position having count(*) > 1`).
- [ ] All challenges created during rehearsal are either resolved,
      cancelled, or intentionally left pending.
- [ ] OG image responds with `image/png` at `/og-image.png`.
- [ ] All admin notifications and activity events from the night render
      with the right icon and detail.

**Scribe deliverable:** a short report (Friday after rehearsal) listing
each scene, the failure signals observed, the open follow-up tickets,
and a thumbs-up/thumbs-down per release slice.

**Cleanup commands (run by Chase, post-rehearsal):**

```sql
-- Reset rehearsal artifacts in the sandbox project, NOT in production.
truncate table public.challenge_forfeiture_events restart identity;
delete from public.treasury_ledger where source_type = 'match_fee' and metadata->>'recorded_via' = 'rehearsal';
delete from public.activity_feed where created_at >= '<rehearsal start timestamp>';
```

> Run cleanup only in the rehearsal/sandbox project. The production project
> should never receive the rehearsal data set.
