-- Clear the security_definer_view advisor ERRORs on the treasury views.
--
-- treasury_ledger_effects and treasury_summary were SECURITY DEFINER views,
-- meaning they ran with the view owner's privileges and bypassed the querying
-- user's RLS. Both read treasury_ledger, which already has a public read policy
-- ("Anyone can view treasury" USING (true)), so switching them to
-- security_invoker does not change who can read them — the app's reads via
-- src/lib/treasury.ts keep working — it just makes the views honor the caller's
-- RLS instead of the definer's.
alter view public.treasury_ledger_effects set (security_invoker = true);
alter view public.treasury_summary set (security_invoker = true);
