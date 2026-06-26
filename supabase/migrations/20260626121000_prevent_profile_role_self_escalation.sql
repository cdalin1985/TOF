-- Privilege-escalation fix.
--
-- The "Users can update own profile" RLS policy used USING (auth.uid() = id)
-- with no WITH CHECK, while the `authenticated` role held a table-level UPDATE
-- grant on profiles and `role` is only ever set by a BEFORE INSERT trigger.
-- That let any signed-in user self-promote to super_admin with a direct
-- profiles UPDATE via the anon key, unlocking treasury, dispute resolution and
-- every admin flow.
--
-- Fix with column-level privileges: the owner may update their own row, but the
-- `authenticated` role is only granted UPDATE on non-sensitive columns
-- (display_name) and has no privilege to write `role` (or `email`). This is
-- enforced by Postgres grants rather than policy logic, so there is no
-- self-referential subquery (which would raise "infinite recursion detected in
-- policy for relation profiles"). Service-role edge functions and the signup
-- trigger bypass these grants and are unaffected.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
