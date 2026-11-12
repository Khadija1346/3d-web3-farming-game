# Supabase setup for GARRIVERSE

This guide prepares the hosted PostgreSQL project. The schema is versioned in this repository; applying it does not by itself turn on game persistence or authentication.

## 1. Create the project
1. Open https://supabase.com/dashboard and sign in.
2. Create a new project named `garriverse`.
3. Choose a strong database password and store it in your password manager. Do not send it in chat or commit it to GitHub.
4. Select a nearby region with good latency for your expected players.
5. Wait until the database is ready.

## 2. Apply the schema
1. In the Supabase dashboard, open **SQL Editor**.
2. Open `supabase/migrations/0001_initial_schema.sql` from this repository.
3. Paste its contents into a new SQL query and run it.
4. Confirm that `player_profiles`, `player_game_states`, `game_action_events`, and `player_leaderboard` exist.

The migration enables row-level security. It intentionally gives browser clients no write policies for game state or action events. The auth trigger creates an initial profile and empty game state when a Supabase Auth user is created.

## 3. Keep credentials private
The Netlify Functions will eventually need a server-side Supabase credential. Add it only in the hosting provider's encrypted environment-variable settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never use a `VITE_...` prefix for these values. Never put the service-role key in frontend code, GitHub, screenshots, or chat. The service-role key bypasses RLS and must only be used by trusted server functions after verifying the player's identity.

## 4. Current implementation boundary
This migration creates the database structure only. It does not yet implement register/login endpoints, session verification, game-action transactions, saved game-state reads/writes, or a live leaderboard endpoint. Do not advertise those features as live until the server functions are implemented and tested.

Real $GARRI rewards and withdrawals remain disabled. XP, inventory, and game progress are not token balances.
