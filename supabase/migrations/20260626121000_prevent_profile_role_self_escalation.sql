-- Privilege-escalation fix. The "Users can update own profile" policy had no
-- WITH CHECK, so any authenticated user could set their own role to
-- 'super_admin' via a direct profiles UPDATE with the anon key. Role is only
-- meant to be assigned by the signup trigger / admin (service-role) flows.
--
-- Pin role to its current value in the UPDATE policy so non-role fields (e.g.
-- display_name) stay editable but role cannot be changed by the user.
--
-- The current role is read through a SECURITY DEFINER helper rather than an
-- inline subquery on public.profiles: an inline subquery re-enters the table's
-- RLS and raises "infinite recursion detected in policy for relation
-- profiles", which blocks every profile update. The definer function bypasses
-- RLS for that single lookup and avoids the recursion.
create or replace function public.current_profile_role()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.current_profile_role());
