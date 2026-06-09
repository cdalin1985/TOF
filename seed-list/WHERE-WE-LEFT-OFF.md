# Top of the Falls — Seeding: Where We Left Off (2026-06-08)

## Status
- Customer-handoff walkthrough was in progress
- Carl Higgins sent the player list as 4 Facebook screenshots
- The images could NOT be read directly in our environment (no vision tool, no tesseract binary)
- Roster size: **117 ranked players**

## What we have verified from the screenshots (high confidence)
- Ranks 1–35 (page 1 + page 2 of screenshots)
- Ranks 69–91 (page 3 of screenshots)
- Ranks 92–117 (page 4 of screenshots)

## What is MISSING — needs re-supply from the user
- **Ranks 36–68** (33 names) — this is the gap we couldn't read
- The user is filling it in via a mobile template, off the desktop

## Open questions for Carl / clarifications
- The list has duplicates of "Barnes" (Jack, Dusty, John), "Smith" (Edin, Landon),
  "Tomlinson" (Owen, Nicole, Andrew, Tish, Schur), "Korsten" (Jerrod, Brittany, David, Tyler),
  "Thompson" (Wade, Stephanie, Curtis G.), "Farris" (Mark, Kristi).
  Confirm these are intentional (separate people, not dupes).
- Email list is empty — that's expected (Carl only had names).
- Several names with special chars need exact spelling: "God'King Deezie Ratcliff",
  "Drayke Anthony Holefelder", "Ricky Sauvé", "Cassidy P. Knapstad",
  "Gary Skunkcap", "Kory Trash Panda Boots", "Kayla Leighann Norris",
  "Malaki Hvamstad", "Nicole Tomlinson Lundquist", "Brian D. Lundquist",
  "Mark O'loughlin", "Jan Nicola-Higgins", "Jennifer LaPlante Allan".

## Template for mobile handoff
- File: `top-of-the-falls-players.template.md` in this directory
- 117 numbered slots, ranks 1–117
- Designed for iPhone: tap to fill, scroll-friendly 1-per-line

## Next step
- User fills the template on iPhone, sends it back
- We generate a Supabase migration with `INSERT INTO players` statements
- Migration filename pattern: `<timestamp>_seed_top_of_the_falls_players.sql`
- Migration includes `on conflict do nothing` for idempotency
- Then a second migration to grant Carl's admin role
- Apply via `npx supabase db push` against the customer instance
- Verify by logging in as Carl and confirming the full roster shows in order

## Seeding command skeleton (to be run on the Supabase project)
```sql
-- supabase/migrations/<timestamp>_seed_top_of_the_falls_players.sql
-- Re-runnable: uses on conflict do nothing
insert into players (rank, full_name, is_active) values
  (1,  'Jerrod Korst',  true),
  (2,  'Roger Kriedeman', true),
  -- ... 117 rows total
on conflict (full_name) do nothing;

-- Lock the league identity
insert into league_settings (slug, display_name, region, theme, primary_admin_email)
values ('top-of-the-falls', 'Top of the Falls', 'Great Falls, MT', 'emerald-forest', 'carl@...')
on conflict (slug) do update set
  display_name = excluded.display_name,
  region = excluded.region,
  theme = excluded.theme;
```

## Out of scope (do NOT promise Carl)
- Custom subdomain (e.g. tof.toc.monster) — follow-up, not tonight
- Real payment processing (Stripe) — match fees are a ledger entry only
- Push notifications — web-push is wired but disabled in this build
