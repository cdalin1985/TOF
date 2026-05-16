# Implementation Plan — Admin Player Invite Flow

## Goal

Add an admin-only flow that lets TOC admins invite players into the app from the Admin → Players area.

The invite flow should:

- Allow `admin` and `super_admin` users to invite a player by name + email.
- Create or link the player record safely.
- Keep the unified ranked list intact.
- Add new invited players to the bottom of the list, matching current TOC join canon.
- Send the user through Supabase Auth invite/magic-link flow.
- Avoid changing league/challenge rules:
  - Min race remains `6`
  - First challenge range remains `10`
  - Regular challenge range remains `5`
  - Top 10 / Rank 1 behavior unchanged
  - Venues and disciplines unchanged

---

## Recommended Approach

### Prefer extending the existing `add-player` Edge Function

There is already:

```text
supabase/functions/add-player/index.ts
```

This likely already handles admin-only player creation, bottom-rank insertion, stats initialization, and audit logging.

The cleanest implementation is to extend it with optional invite support:

```ts
{
  full_name: string;
  email?: string;
  send_invite?: boolean;
  player_id?: string; // optional, for inviting an existing unclaimed player
}
```

Behavior:

1. Verify caller session.
2. Verify caller profile role is `admin` or `super_admin`.
3. Normalize and validate email if `send_invite === true`.
4. If `player_id` is provided:
   - Load existing player.
   - Require `profile_id IS NULL`, unless it already belongs to the target invited user.
   - Preserve the player’s current ranking.
5. If no `player_id`:
   - Create the player using existing add-player logic.
   - Add the player to the bottom of the ranked list.
   - Initialize stats/metrics exactly as existing code does.
6. Send Supabase invite:
   - Use service role client.
   - Use `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })`.
   - Redirect to existing auth route, probably:

```ts
`${origin}/auth/callback`
```

7. Upsert/ensure the `profiles` row.
8. Link `players.profile_id` to the invited auth user.
9. Insert `audit_events` row, e.g. `admin_player_invited`.
10. Return structured result to UI:

```ts
{
  success: true,
  player_id: string,
  profile_id: string,
  email: string,
  invite_sent: boolean,
  message: string
}
```

If existing users cannot be re-invited through Supabase’s invite API, return a clear message:

```ts
{
  success: true,
  invite_sent: false,
  message: "Player linked to existing account. Ask them to log in with their email."
}
```

---

## UX Plan

### Admin → Players tab

Add an “Invite Player” card/form near the existing add-player controls.

Fields:

- Full name
- Email address
- Optional mode:
  - “Invite new player”
  - “Invite existing unclaimed player”

For a small vertical slice, start with:

```text
Full name
Email
[Send Invite]
```

Optional enhancement if simple enough:

- For each unclaimed player in the Players tab, show:

```text
Invite
```

Clicking it opens a small inline form/modal asking for the player’s email.

### UI States

Handle:

- Loading: “Sending invite…”
- Success:
  - “Invite sent to player@example.com”
  - “Player added to the bottom of the list.”
- Existing account linked:
  - “Player linked to existing account. They can log in with their email.”
- Error:
  - Invalid email
  - Duplicate linked profile
  - Non-admin
  - Supabase invite email failure

After success, invalidate relevant query caches:

```ts
qc.invalidateQueries({ queryKey: ['players-lookup'] });
qc.invalidateQueries({ queryKey: ['rankings'] });
qc.invalidateQueries({ queryKey: ['admin-players'] });
qc.invalidateQueries({ queryKey: ['admin-audit'] });
```

Exact query keys should be confirmed in `AdminPage.tsx`.

---

## Likely Files

### Required

```text
supabase/functions/add-player/index.ts
```

Extend existing admin player creation function with optional invite handling.

```text
src/pages/AdminPage.tsx
```

Add invite form/UI in the Players tab and call the Edge Function.

### Possible / Optional

```text
docs/feature-plans/YYYYMMDD_HHMMSS_add-admin-player-invite-flow.md
```

Document implementation decisions and rollout notes.

```text
src/types/database.ts
```

Probably not needed if no schema changes are made.

### Avoid if possible

```text
supabase/migrations/*
```

A migration is not required for the first vertical slice if invite status is inferred from existing `players.profile_id`.

If persistent invite tracking is desired later, add a separate approved migration for a `player_invites` table, but that is beyond the smallest safe slice.

---

## Backend Details

### Invite redirect URL

Use the browser `Origin` header when available:

```ts
const origin = req.headers.get('origin') ?? Deno.env.get('SITE_URL') ?? '';
const redirectTo = origin ? `${origin}/auth/callback` : undefined;
```

Deployment note: the redirect URL must be allowlisted in Supabase Auth settings.

### Email normalization

Normalize before comparisons:

```ts
const normalizedEmail = email.trim().toLowerCase();
```

Validate basic shape server-side.

### Existing Auth User Handling

Supabase Admin API does not always make “invite existing user” seamless.

Plan:

1. Try to invite by email.
2. If Supabase says the user already exists:
   - Locate matching profile by email.
   - Link the player if safe.
   - Return success with `invite_sent: false`.
3. If email belongs to a profile already linked to another player:
   - Return error.

### Player Linking Rules

Never overwrite an existing claimed player accidentally.

Allowed:

- `players.profile_id IS NULL`
- `players.profile_id === invitedProfileId`

Blocked:

- `players.profile_id` belongs to someone else
- email belongs to a profile already linked to another player

---

## Security Requirements

The Edge Function must enforce admin access server-side.

Do not rely on the Admin page route guard alone.

Required check:

```ts
const { data: profile } = await supabase