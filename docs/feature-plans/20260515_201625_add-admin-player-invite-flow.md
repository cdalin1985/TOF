# Implementation Plan — Admin Player Invite Flow

## Goal

Add an admin-only flow that lets TOC admins invite approved players by email from the Admin area.

The flow should **not change league rules**. It should only support onboarding approved players onto the existing unified ranked list.

## Canon Constraints

This feature must preserve current TOC canon:

- New players are added to the unified list only.
- New players are added at the bottom unless linking an existing unclaimed player.
- Challenge ranges, minimum race, cooldowns, rank #1 rules, venues, and disciplines are unchanged.
- Player/ranking mutations should go through a Supabase Edge Function, not direct client writes.

---

## Proposed UX

Add an invite panel/modal inside the existing Admin Players tab.

### Admin can choose:

1. **Invite a new player**
   - Full name
   - Email
   - Optional Fargo rating / robustness if existing add-player flow supports it
   - Submit

2. **Invite/link an existing unclaimed player**
   - Select unclaimed player from list
   - Email
   - Submit

### After submit

Admin sees one of:

- `Invite sent`
- `Player linked to existing profile`
- Clear validation error:
  - Email already belongs to another claimed player
  - Selected player is already claimed
  - Caller is not admin
  - Supabase email invite failed

---

## Backend Design

Create a new Supabase Edge Function:

```text
supabase/functions/invite-player/index.ts
```

### Endpoint

`POST /functions/v1/invite-player`

### Request shape

```ts
type InvitePlayerRequest =
  | {
      mode: 'create';
      full_name: string;
      email: string;
      fargo_rating?: number | null;
      fargo_robustness?: number | null;
      redirect_to?: string;
    }
  | {
      mode: 'existing';
      player_id: string;
      email: string;
      redirect_to?: string;
    };
```

### Response shape

```ts
type InvitePlayerResponse = {
  success: boolean;
  player_id?: string;
  profile_id?: string;
  invite_status?: 'sent' | 'linked_existing_profile';
  error?: string;
};
```

### Function responsibilities

1. Handle CORS/options.
2. Authenticate caller from bearer token.
3. Verify caller profile role is `admin` or `super_admin`.
4. Validate input:
   - valid email
   - full name required for new player
   - player exists and is unclaimed for existing-player mode
5. Resolve or create invited auth/profile:
   - Prefer `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })`.
   - If email already exists in `profiles`, link to that profile if not already linked to another player.
   - If the existing profile is already linked to a different player, reject.
6. Player handling:
   - `mode: create`
     - Create player.
     - Add ranking at bottom.
     - Create default stats/metrics records using the same behavior as existing `add-player`.
   - `mode: existing`
     - Do not create a duplicate player.
     - Do not alter rankings.
7. Link player:
   - `players.profile_id = invitedProfileId`
   - Upsert/update `profiles.display_name`
   - Keep role as `player` unless an existing profile already has admin/super_admin role.
8. Insert `audit_events` row:
   - action: `player_invited`
   - target_type: `player`
   - target_id: player id
   - detail includes email, mode, invite_status.
9. Return success.

---

## Frontend Design

Modify Admin page Players tab.

Likely existing file:

```text
src/pages/AdminPage.tsx
```

### UI additions

- Add `Invite Player` button/card near the Players tab top.
- Add modal or inline panel:
  - Mode toggle: `New Player` / `Existing Unclaimed`
  - Email field
  - Full name field for new player
  - Existing unclaimed player select for existing mode
  - Submit button
  - Success/error message
- Query unclaimed players:

```ts
supabase
  .from('players')
  .select('id, full_name')
  .is('profile_id', null)
  .order('full_name');
```

- Submit through edge function with current auth session token.
- On success invalidate relevant queries:
  - `players-lookup`
  - Admin players query key, depending on existing implementation
  - `rankings`
  - `audit-events`

---

## Likely Files

Maximum implementation should stay under 6 files.

### Required

```text
supabase/functions/invite-player/index.ts
src/pages/AdminPage.tsx
```

### Optional, only if useful

```text
src/types/database.ts
docs/feature-plans/add-admin-player-invite-flow.md
```

`src/types/database.ts` should only be touched if the UI needs a small type helper. No schema changes should be required.

---

## Important Existing Files to Inspect First

Before implementation, inspect these fully:

```text
supabase/functions/add-player/index.ts
src/pages/AdminPage.tsx
src/stores/authStore.ts
src/pages/AuthCallbackPage.tsx
src/pages/ClaimPage.tsx
```

Reason:

- `add-player` likely already contains correct admin-only bottom-of-list insert logic.
- `authStore` determines whether pre-linked invited users skip claim.
- `AuthCallbackPage` must already support Supabase invite/magic-link redirects.
- `ClaimPage` behavior should remain unchanged for normal unclaimed users.

---

## Edge Cases

### Existing email already has profile and no player

Allowed:

- Link profile to selected/new player.
- Return `linked_existing_profile`.
- UI should tell admin the player can log in with their existing magic link.

### Existing email already linked to same player

Allowed/idempotent:

- Return success.

### Existing email linked to different player

Reject:

```text
That email is already linked to another player.
```

### Existing unclaimed player mode

Must verify:

- Player exists.
- `profile_id IS NULL`.
- Do not change rank.
- Do not duplicate stats.

### New player mode

Must verify:

- No duplicate exact active player name, or at minimum warn/reject exact duplicate if current `add-player` does.
- Ranking append uses existing `add-player` logic where possible.

### Auth invite failure

Return clean error. Common causes:

- SMTP not configured.
- Redirect URL not allowed in Supabase Auth settings.
- Email already registered but no profile row exists.

---

## Risks

**Risk: medium**

Main risks:

1. **Supabase invite behavior**
   - `inviteUserByEmail` depends on Supabase Auth email settings and allowed redirect URLs.

2. **Existing users**
   - Supabase Auth Admin API does not make email lookup as straightforward as normal table queries.
   - Profiles table may not exist for older auth users until they log in.

3. **AdminPage size**
   - `src/pages/AdminPage.tsx` is already large.
   - Prefer a small self-contained invite component inside the file or a new component if needed.

4. **Ranking insert race**
   - Adding new player at bottom can conflict if two admins invite at the same time.
   - Existing `add-player` implementation should be reused/copied to keep behavior consistent.

5. **Email delivery**
   - Local/dev testing may not actually send an email unless Supabase email provider is configured.

---

## Testing Plan

### Static checks

```bash
npm run lint
npm run build
```

### Edge function local smoke test

If Supabase CLI is available:

```bash
supabase functions serve invite-player --env-file .env.local
```

Then call with an admin JWT:

```bash
curl -i \
  -X POST "$VITE_SUPABASE_URL/functions/v1/invite-player" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create",
    "full_name": "Invite Test Player",
    "email": "invite-test@example.com",
    "redirect_to": "http://localhost:5173/auth/callback"
  }'
```

### Manual app tests

1. Log in as `admin` or `super_admin`.
2. Go to `/admin`.
3. Open Players tab.
4. Invite a new test player.
5. Confirm:
   - New player row exists.
   - Ranking exists at bottom.
   - Stats rows exist if existing add-player flow normally creates them.
   - `players.profile_id` is set.
   - `profiles.email` matches invited email.
   - `audit_events` has `player_invited`.
6. Open invite email or simulate invited login.
7. Confirm invited user lands in app as claimed player, not on claim flow.
8. Invite an existing unclaimed player.
9. Confirm:
   - No new player was created.