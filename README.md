# Top of the Capital 🎱

**A competitive pool ranking list for Helena, Montana.**

TOC is a live challenge league where players fight for the top spot on a single ranked list. Think of it like a boxing ranking — you climb by beating the people above you, one rack at a time. No seasons, no brackets. Just a living leaderboard that shifts every time someone wins.

---

## How the List Works

Every player holds a numbered rank. To move up, you challenge players above you and win. Beat someone higher than you and you take their spot — everyone between you drops one.

### Who You Can Challenge

- **First challenge ever** — you can challenge anyone up to 10 spots above you
- **After your first** — you can challenge anyone up to 5 spots above you
- **Top 10 players** — can challenge up or down 5 spots
- **#1 ranked player** — can challenge anyone, but must play at least 2 top-5 opponents within 30 days or be moved to #10

### Challenge Rules

- Maximum **2 challenges per week** (rolling 7-day window from your first challenge of the week)
- You must play the first person who challenged you before accepting any others
- The challenged player has **48 hours to respond**
- Once accepted, the match must be played within **10 days**

---

## After a Match

**If you win (lower seed beats higher seed):**
You take their spot. They drop one. Everyone between your old spot and theirs also drops one. You must wait 24 hours before challenging up again.

**If you defend your spot (higher seed wins):**
You can challenge up immediately — but you must post that challenge with your match results to lock it in.

**If you lose:**
You must either defend your new position or wait 24 hours before challenging up.

**If the challenged player declines:**
The challenger takes their spot automatically (confirmed by admin).

**If you can't agree on a time:**
The challenge is a wash. No penalties for either player.

---

## Match Setup

- **Challenger** picks the game (8-Ball, 9-Ball, or 10-Ball) and the race length
- **Both players** agree on the time and venue
- Matches are played at **Eagles 4040** or **Valley Hub** — other venues with admin approval
- **Minimum race to 6.** No maximum as long as both players agree
- **Match fee: $5 per player.** Use the supplied envelopes at either venue, or pay digitally (Venmo/Cash App/PayPal)

---

## Game Rules

**8-Ball** — BCA Rules
- Magic rack allowed if both players agree
- Scratch on the break: ball in hand anywhere
- Scratch on the 8: ball in hand for opponent (not a loss unless you pocket the 8 and scratch on the same shot)

**9-Ball** — Modified BCA Rules
- No magic rack
- 9-ball on the break only counts if it drops in one of the top two pockets
- Must call the 9-ball
- No three-foul rule

**10-Ball** — Call Shot
- Magic rack allowed
- Rack: 1-ball at front, 10-ball in the middle, everything else random
- 10-ball pocketed early via combo or carom if called — gets spotted, shooter continues
- No three-foul rule

---

## Inactive Players

- You can go inactive at any time
- After 30 days inactive: you drop 2 spots for every additional 30 days
- Returning: must defend your position or wait 7 days before challenging up
- Exception: if you're last on the list, only 24 hours
- Players inactive for 90+ days may be removed at admin discretion

---

## How to Join

1. Get approved by a TOC admin
2. You're added to the bottom of the list
3. Follow the **Top of the Capital Facebook page** — that's where all challenges and results are posted

---

## The App

Built to feel like something more than a spreadsheet. Dark glass UI, animated rankings, live challenge notifications, and a leaderboard that updates the moment a match is confirmed.

- **Magic link login** — no passwords, just your email
- **Claim your profile** — find your name, tap it, it's yours
- **Real-time updates** — rankings shift live as matches are confirmed
- **Full stats by discipline** — win rates, streaks, challenger vs defender record in 8-Ball, 9-Ball, and 10-Ball separately
- **Works on your phone** — installable PWA, designed mobile-first

---

## Where to Play

- **Valley Hub** — envelopes and drop box on site
- **Eagles 4040** — envelopes and drop box on site

---

## Tech Stack

- **React 18 + TypeScript + Vite** — frontend
- **Tailwind CSS v4** — styling
- **Framer Motion** — animations
- **Supabase** — Postgres, Auth, Realtime, Edge Functions
- **TanStack Query + Zustand** — data fetching and state

All mutations (challenges, results, ranking updates) go through Supabase Edge Functions. The client never writes directly to ranked tables.

---

*Helena, Montana*
