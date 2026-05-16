# Implementation Plan: Admin Player Management Improvements

## Scope

Improve the Admin → Players management workflow with:

1. Fargo rating support when adding a player.
2. Starting rank placement when adding a player.
3. Claimed / unclaimed filters in the admin player list.
4. Safer add-player validation on both client and Edge Function.
5. No changes to TOC challenge/ranking rules canon.

This should use the existing unified `players`, `rankings`, and `player_reference_metrics` tables. No schema change appears necessary because `player_reference_metrics.fargo_rating` already exists.

---

## Likely Files to Modify

### 1. `src/pages/AdminPage.tsx`

Update the existing `PlayersTab` section.

Planned changes:

- Add claimed status filter:
  - `All`
  - `Claimed`
  - `Unclaimed`
- Display claimed status based on `player.profile_id`.
- Display Fargo rating in admin player rows using `player_reference_metrics.fargo_rating`.
- Expand add-player form with:
  - Player full name
  - Optional Fargo rating
  - Starting rank placement
- Default starting rank should be bottom of the current unified list: `currentPlayerCount + 1`.
- Add client-side validation:
  - Name is required.
  - Name is trimmed and whitespace-normalized.
  - Duplicate exact name warning/block, case-insensitive.
  - Fargo rating must be blank or a whole number in a safe range, likely `0–1000`.
  - Starting rank must be an integer from `1` to `current ranked count + 1`.
- Submit add-player through the existing `add-player` Supabase Edge Function.
- Invalidate relevant queries after success:
  - Admin players query
  - Rankings query
  - Players lookup query, if used elsewhere

Likely query shape:

```ts
players
rankings
player_reference_metrics
```

joined in client memory by `player_id`, avoiding schema or relationship assumptions.

---

### 2. `supabase/functions/add-player/index.ts`

Update the existing add-player Edge Function.

Planned request payload:

```ts
{
  full_name: string;
  fargo_rating?: number | null;
  starting_position?: number | null;
}
```

Server-side validation:

- Auth required.
- Caller must have profile role `admin` or `super_admin`.
- Normalize player name:
  - `trim()`
  - collapse repeated whitespace
- Reject:
  - Empty name
  - Too-short name, e.g. `< 2 chars`
  - Too-long name, e.g. `> 80 chars`
  - Case-insensitive duplicate normalized name
- Fargo rating:
  - Optional
  - Must be an integer if provided
  - Suggested valid range: `0–1000`
- Starting position:
  - Optional
  - Defaults to bottom of list
  - Must be integer from `1` to `current ranked count + 1`

Ranking insertion behavior:

- If starting position is bottom, insert normally.
- If starting position is inside the list:
  - Fetch rankings ordered descending by position.
  - Shift each ranking at or below the insertion point down by 1, updating one row at a time in descending order to avoid the `position UNIQUE` constraint.
  - Insert the new ranking at the requested position.
- Add a `player_reference_metrics` row with the Fargo rating, even if null, for consistency.
- Preserve any existing behavior in the current function:
  - Player creation
  - Season stats initialization
  - Discipline stats initialization, if present
  - Audit event creation, if present
  - Activity feed creation, if present

Important safety improvement:

- Track created player and shifted rankings.
- If a later step fails, attempt compensation:
  - Delete the created player.
  - Reverse any shifted rankings.
- This does not fully replace a database transaction, but reduces risk without adding a migration.

---

### 3. `docs/feature-plans/YYYYMMDD_admin-player-management.md`

Optional but recommended.

Add a brief implementation note documenting:

- Validation rules.
- Payload shape for `add-player