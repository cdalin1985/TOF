# UI Bakery live data guide for TOF

Use this when building an external admin dashboard for the live Top of the Falls app.

## What to connect to

Connect UI Bakery to the **TOF Supabase project**, not the older TOC.Monster project.

- Supabase project name: `TOF`
- Supabase project ref: `sqcqmovskpoyutfyslym`
- Supabase URL: `https://sqcqmovskpoyutfyslym.supabase.co`
- App URL: `https://tof-app-theta.vercel.app`
- Public schema: `public`

In plain English: this is the live TOF database. If UI Bakery is pointed anywhere else, the dashboard can show the wrong league.


## Copy/paste inputs for the required UI Bakery boxes

Use these exact choices for the required boxes shown in UI Bakery. A blank value means leave that box empty.

| UI Bakery box | Put this in the box | Kid-simple explanation |
| --- | --- | --- |
| Data Source name | `TOF Live Supabase` | This is just the nickname for the connection. |
| Host | Use the **Session pooler** host from Supabase, shaped like `aws-0-REGION.pooler.supabase.com` | This avoids the IPv6-only direct host that caused `ENETUNREACH`. |
| Port | `5432` | This is the normal Postgres door number. |
| Username | Use the **Session pooler** username from Supabase, shaped like `postgres.sqcqmovskpoyutfyslym` | The pooler username includes the project ref. Plain `postgres` is for direct connections. |
| Password | Use the TOF database password from Supabase. | I cannot safely know or write the secret password here. Copy it from Supabase. |
| Database | `postgres` | Supabase's default database name. |
| Schema names | `public` | This is where the TOF app tables live. |
| Table or Materialized View names | Add each view one at a time: `admin_dashboard_league_overview`, `admin_dashboard_leaderboard`, `admin_dashboard_challenges`, `admin_dashboard_matches`, `treasury_summary`, `treasury_ledger_effects` | These are the safe/easy data sources for your dashboard widgets. |
| Use SSL/TLS | Checked / On | This keeps the database connection encrypted, like putting the data in a locked box while it travels. |
| Enable SSH tunnel | Unchecked / Off | Supabase does not need this for UI Bakery. |
| Convert SQL queries to prepared statements | Checked / On | Keep UI Bakery's default safety setting. |
| Ignore Browser Timezone | Unchecked / Off | Dates should show naturally for the person using the dashboard. |
| Allow override database name in action | Unchecked / Off | This prevents actions from accidentally pointing at another database. |
| Format date-like strings to ISO format | Unchecked / Off | Leave dates in the normal database format unless you later need a special display format. |
| Parse numeric values to JavaScript numbers | Checked / On | This lets dashboard cards treat counts and dollar amounts like real numbers. |
| Outbound region | `Default` | Default is fine. |
| Anonymous access | `Disallow` | Only logged-in/admin UI Bakery users should use this data source. |

If Supabase asks for allowed IP addresses, add the two UI Bakery IPs shown on your screen: `52.176.109.125` and `20.52.252.203`.

### Fix for `Can't be connected! connect ENETUNREACH ... :5432`

That error means UI Bakery tried to use Supabase's direct database host, which can resolve to IPv6. UI Bakery is reaching out over a network path that cannot reach that IPv6 address. Supabase's own fix is to use the **Session pooler** connection instead of the direct connection. In Supabase, open the TOF project → click **Connect** → choose **Session pooler** → copy its host and username into UI Bakery. Keep port `5432` for Session pooler. If you use **Transaction pooler** instead, use port `6543` and turn **Convert SQL queries to prepared statements** off.

### Fix for `getaddrinfo ENOTFOUND postgresql://...pooler.supabase.com:5432/postgres`

That error means a full connection string was pasted where UI Bakery expected one small piece, or the pooler host was typed instead of copied. Split the Supabase connection string into separate UI Bakery boxes:

```text
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

For UI Bakery, do **not** paste `postgresql://`, the password, `:5432`, or `/postgres` into the **Host** box. The **Host** box should contain only the pooler host, for example `aws-0-REGION.pooler.supabase.com`. The **Username** box should contain only the username, for example `postgres.sqcqmovskpoyutfyslym`. Copy the host exactly from Supabase; do not hand-type `aws-1` or guess the region.

## Fill in the UI Bakery Postgres form

The screen in UI Bakery is asking for a Postgres database connection. Get these values from **Supabase Dashboard → Connect → Session pooler** for project `sqcqmovskpoyutfyslym`.

Suggested values:

| UI Bakery field | What to enter |
| --- | --- |
| Data Source name | `TOF Live Supabase` |
| Host | Copy the **Session pooler** host from Supabase for project `sqcqmovskpoyutfyslym` |
| Port | `5432` for **Session pooler** |
| Username | Copy the **Session pooler** username from Supabase, usually shaped like `postgres.sqcqmovskpoyutfyslym`. |
| Password | Paste the database password from Supabase. Do **not** commit this password into this repo. |
| Database | `postgres` |
| Schema names | `public` |
| Table or Materialized View names | Start with the `admin_dashboard_*` views listed below. |
| SSL | Turn SSL on / require SSL if UI Bakery offers that option. |

## Best tables/views for dashboard widgets

Prefer the reporting views because they already join names, rankings, stats, and treasury totals into easier dashboard shapes.

- `public.admin_dashboard_league_overview`: one-row summary for top dashboard cards.
- `public.admin_dashboard_leaderboard`: ranked players with active/claimed status, Fargo info, and season stats.
- `public.admin_dashboard_challenges`: challenge list with challenger/challenged names and ranks.
- `public.admin_dashboard_matches`: match list with player names, scores, winner, loser, and dates.
- `public.treasury_summary`: current treasury totals.
- `public.treasury_ledger_effects`: treasury ledger rows with signed balance effects.

## Starter SQL queries for UI Bakery

### Dashboard cards

```sql
select *
from public.admin_dashboard_league_overview;
```

### Current leaderboard

```sql
select *
from public.admin_dashboard_leaderboard
order by position asc;
```

### Open challenges

```sql
select *
from public.admin_dashboard_challenges
where status in ('pending', 'accepted', 'scheduled', 'in_progress', 'submitted', 'disputed')
order by created_at desc;
```

### Recent matches

```sql
select *
from public.admin_dashboard_matches
order by coalesce(completed_at, scheduled_at, created_at) desc
limit 50;
```

### Treasury balance in dollars

```sql
select
  balance_cents / 100.0 as balance_dollars,
  total_credit_cents / 100.0 as total_credit_dollars,
  total_debit_cents / 100.0 as total_debit_dollars,
  entry_count,
  last_entry_at
from public.treasury_summary;
```

## Safety note

For a dashboard that only shows data, use a read-only database user or read-only queries. Do not use the Supabase `service_role` API key inside UI Bakery browser-side actions, because that key can bypass normal app protections.

## After the connection works: make UI Bakery show TOF data

Once **Test connection** succeeds, the connection is only the pipe. You still need to tell UI Bakery what data to pull through that pipe.

### Step 1: Load the safe dashboard views

In the datasource settings, add these names under **Table or Materialized View names** one at a time:

```text
admin_dashboard_league_overview
admin_dashboard_leaderboard
admin_dashboard_challenges
admin_dashboard_matches
treasury_summary
treasury_ledger_effects
```

If UI Bakery says one of the `admin_dashboard_*` views does not exist, the reporting-view migration has not been applied to the live Supabase database yet. Apply `supabase/migrations/20260628120000_admin_dashboard_reporting_views.sql` first, then refresh UI Bakery.

### Step 2: Create the main dashboard queries

Create one SQL query/action per dashboard section.

#### Top summary cards

```sql
select *
from public.admin_dashboard_league_overview;
```

Use this for cards like active players, claimed players, open challenges, open matches, completed matches, and treasury balance.

#### Leaderboard table

```sql
select *
from public.admin_dashboard_leaderboard
order by position asc;
```

Use this for the main ranked player list.

#### Open challenges table

```sql
select *
from public.admin_dashboard_challenges
where status in ('pending', 'accepted', 'scheduled', 'in_progress', 'submitted', 'disputed')
order by created_at desc;
```

Use this for a list of challenges that still need attention.

#### Recent matches table

```sql
select *
from public.admin_dashboard_matches
order by coalesce(completed_at, scheduled_at, created_at) desc
limit 50;
```

Use this for recent and upcoming match activity.

#### Treasury card

```sql
select
  balance_cents / 100.0 as balance_dollars,
  total_credit_cents / 100.0 as total_credit_dollars,
  total_debit_cents / 100.0 as total_debit_dollars,
  entry_count,
  last_entry_at
from public.treasury_summary;
```

Use this for the money/balance section. Treasury is only a ledger in TOF; it is not real payment processing.

### Step 3: Attach each query to a UI Bakery component

Think of each UI Bakery component like an empty TV screen. The SQL query is the TV channel.

- Use **Text/Card** components for `admin_dashboard_league_overview` numbers.
- Use a **Table** component for `admin_dashboard_leaderboard`.
- Use another **Table** component for `admin_dashboard_challenges`.
- Use another **Table** component for `admin_dashboard_matches`.
- Use **Text/Card** components for `treasury_summary` dollar values.

### Step 4: Add refresh behavior

Set each query to run when the page loads. If UI Bakery offers auto-refresh, a 30-to-60 second refresh is enough for an admin dashboard.

### Step 5: Keep this dashboard read-only at first

Start with viewing data only. Do not add buttons that change rankings, matches, players, or treasury until those actions are intentionally wired through the app's protected admin flows.
