# Implementation Plan — Admin Player Management Hardening Slice 1

## Scope

Implement a small admin-player-management hardening slice:

1. Add **claimed / unclaimed / all** filter in Admin → Players.
2. Display each player’s **Fargo rating** in the admin player list.
3. Allow optional **Fargo rating** when adding a player.
4. Prevent duplicate player names.
5. **Do not** implement starting-rank placement.
6. Do **not** change TOC league canon/rules.

---

## Likely Files

### 1. `src/pages/AdminPage.tsx`

Primary UI changes inside the existing `PlayersTab`.

Planned changes:

- Add local filter state:

  ```ts
  type ClaimFilter = 'all' | 'claimed' | 'unclaimed';
  ```

- Fetch or join:

  - `players`
  - `rankings`
  - `player_reference_metrics`

- Display:

  - Player name
  - Rank / active status as currently shown
  - Claimed/unclaimed badge based on `profile_id`
  - Fargo rating:
    - `Fargo 625`
    - or `Unrated`

- Add filter buttons:

  - All
  - Claimed
  - Unclaimed

- Add Fargo input to the add-player form:

  - Optional field
  - Blank means no Fargo rating / `null`
  - If entered, validate as a whole number before submit

- Add frontend duplicate-name guard:

  - Normalize names by trimming, collapsing whitespace, and comparing case-insensitively.
  - Example duplicate matches:
    - `John Smith`
    - ` john   smith `
    - `JOHN SMITH`

- On successful add-player:

  - Reset name input
  - Reset Fargo input
  - Invalidate relevant queries:
    - `admin-players`
    - `rankings`
    - likely `players-lookup`

Important: no starting-rank input or placement UI.

---

### 2. `supabase/functions/add-player/index.ts`

Server-side source-of-truth hardening.

Planned changes:

- Accept optional `fargo_rating` in request body.

  Example payload:

  ```json
  {
    "full_name": "Jane Doe",
    "fargo_rating": 625
  }
  ```

  Or:

  ```json
  {
    "full_name": "Jane Doe"
  }
  ```

- Normalize submitted name:

  ```ts
  name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  ```

- Prevent duplicates before insert using normalized comparison against existing `players.full_name`.

- Return a clear error for duplicates, preferably HTTP `409`:

  ```json
  {
    "error": "A player named Jane Doe already exists."
  }
  ```

- Validate Fargo rating only if provided:

  - Blank / missing / `null` = no rating
  - Provided value must be an integer
  - Avoid adding league-rule semantics beyond basic data validation

- Preserve existing add-player behavior:

  - Continue adding the player wherever current logic places them, likely bottom of the list.
  - Do not add starting-rank placement.
  - Do not change ranking rules.

- After creating the player, insert/upsert into `player_reference_metrics` when `fargo_rating` is provided:

  ```ts
  await supabase.from('player_reference_metrics').upsert({
    player_id: player.id,
    fargo_rating: parsedFargoRating,
  });
  ```

---

### 3. Optional: `docs/feature-plans/...`

If desired during implementation, add a short feature-plan note under `docs/feature-plans/`.

Not required for the functional slice.

---

## Duplicate Name Strategy

Use the same normalization in both frontend and edge function:

```ts
function normalizePlayerName(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
```

Frontend duplicate check improves UX, but the edge function is the required enforcement point.

Example blocked duplicates:

| Existing Name | New Input | Should Block |
|---|---:|---:|
| `John Smith` | `John Smith` | yes |
| `John Smith` | ` john smith ` | yes |
| `John Smith` | `JOHN   SMITH` | yes |

---

## Not in This Slice

Do **not** implement:

- Starting-rank placement
- Rank insertion controls
- Rank shifting for manually placed players
- New league rules
- Challenge rule changes
- Match rule changes
- Treasury changes

---

## Risks

### Medium: no DB-level uniqueness constraint

Because allowed edit paths do not include migrations, this slice should enforce duplicates in the admin UI and `add-player` edge function only.

Risk:

- Direct database writes or future functions could still bypass duplicate prevention.
- Two admins adding the same normalized name at the exact same time could theoretically race.

Mitigation:

- Edge-function duplicate check before insert.
- Future separate migration could add a normalized unique index if approved.

### Low/Medium: Fargo metrics visibility

If RLS prevents direct client reads from `player_reference_metrics`, the Admin Players query may need adjustment.

Mitigation:

- Verify current RLS.
- Since rankings already display Fargo rating via existing app data, metrics are likely readable.
- If needed, fetch through existing allowed paths or adjust only within approved scope.

### Low: partial add if Fargo insert fails

If the existing edge function inserts the player/ranking/stats first and the metrics insert fails afterward, the player could still be created without Fargo rating.

Mitigation:

- Validate Fargo before player insert.
- Use simple `upsert`.
- Treat metrics insert failures carefully and avoid creating inconsistent UX.

---

## Test Plan

### Automated/local checks

Run:

```bash
cd C:\Users\chase\Desktop\claude-agent0toc
npm run lint
npm run build
```

### Manual admin UI QA

1. Log in as admin/super_admin.
2. Open `/admin`.
3. Go to **Players** tab.

Verify:

- All players appear by default.
- `Claimed` filter shows only players where `profile_id` is not null.
- `Unclaimed` filter shows only players where `profile_id` is null.
- Fargo rating appears for rated players.
- Unrated players display `Unrated` or equivalent.
- Existing claimed/unclaimed badge behavior still works.

### Add player without Fargo

Input:

- Name: `Test