# Supabase setup for GARRIVERSE

The Supabase project stores verified player accounts, cloud game state, action history and leaderboard data. The repository contains the database migrations and Netlify Functions; applying the migrations and configuring the hosting environment are separate launch steps.

## 1. Create or select the Supabase project

1. Open https://supabase.com/dashboard.
2. Select the approved GARRIVERSE project.
3. In **Project Settings → API**, locate the Project URL, anon/public key and service-role key.
4. Keep the service-role key private in a password manager. Never paste it into chat, screenshots or GitHub.

## 2. Apply migrations in order

Open **SQL Editor** and run the complete contents of these files in numeric order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_authoritative_farming_actions.sql`
3. `supabase/migrations/0003_authoritative_factory_warehouse_market.sql`
4. `supabase/migrations/0004_authoritative_tanker_actions.sql`

Confirm that `player_profiles`, `player_game_states`, `game_action_events` and `player_leaderboard` exist. The RPC functions must be executable by `service_role` only. Browser clients must not receive direct write policies for player state or action events.

## 3. Configure Netlify environment variables

In the correct Netlify site, open **Site configuration → Environment variables** and add:

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_ANON_KEY` — Supabase anon/public key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service-role key.

Do not add a `VITE_` prefix to any of these values. The service-role key bypasses RLS and must never enter the browser bundle.

After setting variables, trigger a new deploy so Netlify Functions receive them.

## 4. Verify the deployed backend

Open `/.netlify/functions/health` on the deployed site. A `ready` status means the API can reach Supabase Auth, the game-state table, leaderboard view and the three authoritative gameplay RPCs. A degraded/not-configured result must be resolved before announcing cloud gameplay as live.

Then create a test account and verify:
- Register, sign in, sign out and sign in again.
- Game state loads for the signed-in player.
- Till, plant, water, weed, harvest and watering-can refill persist.
- Factory stages cannot be completed early; completed batches produce two in-game bags.
- Warehouse deposit, market sale and stem purchase persist.
- Tanker watering and tanker refill persist.
- Leaderboard displays only actual registered players.

## 5. Security boundary

The in-game naira, XP, roots, stems and garri inventory have no cash or token value. Real $GARRI transfers, reward claims and withdrawals are not enabled by these migrations. They require a separately approved payout design, audited contract, eligibility rules, custody/authority model, monitoring and incident controls.
