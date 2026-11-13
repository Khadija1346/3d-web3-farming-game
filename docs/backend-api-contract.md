# GARRIVERSE backend API

Netlify server-side environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose with a VITE_ prefix)

Never commit credentials or paste them into chat. Rotate any credential previously shared in a chat.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/.netlify/functions/health` | Reports whether required environment variables exist; it does not prove database reachability |
| POST | `/.netlify/functions/auth-register` | Supabase email registration |
| POST | `/.netlify/functions/auth-login` | Email/password sign-in |
| GET | `/.netlify/functions/auth-me` | Verify bearer access token |
| POST | `/.netlify/functions/auth-logout` | End Supabase session |
| GET | `/.netlify/functions/game-state` | Read the authenticated player's saved state |
| GET | `/.netlify/functions/leaderboard?limit=20` | Public leaderboard, limit 1–50 |
| POST | `/.netlify/functions/farming-action` | Server-authoritative field actions |
| POST | `/.netlify/functions/economy-action` | Server-authoritative factory, warehouse and in-game market actions |
| POST | `/.netlify/functions/utility-action` | Server-authoritative tanker watering and river-pump refills |

Use `Authorization: Bearer <access_token>` for authenticated endpoints. The server derives the player ID from the verified Supabase token; clients cannot submit another player's ID.

Registration JSON: `{ "email": "player@example.com", "password": "minimum-8-characters", "displayName": "Farmer" }`

Login JSON: `{ "email": "player@example.com", "password": "your-password" }`

## Server-authoritative gameplay

Apply migrations in numeric order:
1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_authoritative_farming_actions.sql`
3. `supabase/migrations/0003_authoritative_factory_warehouse_market.sql`
4. `supabase/migrations/0004_authoritative_tanker_actions.sql`

Migration 0001 creates player profiles, game state, idempotent action events, the auth-user trigger and public leaderboard view. Browser clients receive no direct write policies for game state or action events.

Migration 0002 owns field actions: `till`, `plant`, `water`, `weed`, `harvest`, and `refill_can`. Crop growth and harvest eligibility/yield are calculated with server time and database rules.

Migration 0003 owns:
- `factory_start`: consumes five harvested roots and opens a batch.
- `factory_run_stage`: starts the current processing stage on the server.
- `factory_complete_stage`: rejects early completion and advances only after the server-side stage duration has elapsed. The eighth stage packages two bags.
- `warehouse_deposit`: moves all carried bags into stored inventory.
- `market_sell`: sells one stored bag for 1,200 in-game naira.
- `market_buy_stems`: spends 150 in-game naira for four cassava stems.

Migration 0004 owns `water_tanker` and `refill_tanker`; it applies server-time crop growth before watering and persists tanker inventory and revision.

The farming, economy and utility action endpoints accept only an action, idempotency key and expected revision (the endpoints additionally accept a plot ID where applicable). XP, levels, balances, inventory, crop progression, factory timing, yield and revision are computed by PostgreSQL. Repeated idempotency keys return the original result; stale revisions return HTTP 409. RPC execution is granted to `service_role` only.

The 3D client now loads the signed-in player's cloud state and routes field, factory, warehouse, market and tanker actions to the server. Factory stage progress shown in the UI is a display estimate; the server checks elapsed time before accepting stage completion. Unsigned-in gameplay remains a local preview. Weather/day presentation remains client-side; rain does not water cloud crops. Quests, wallet features, NFT features and real token rewards are not cloud-backed.

## Economy and token safety

The naira balance and bag prices are fictional in-game values with no cash value. This implementation does not transfer, stake, mint, or pay real $GARRI; withdrawals and token rewards remain disabled pending explicit GARRI team approval, audited contracts, eligibility rules and operational safeguards.

## Validation and launch requirements

GitHub Actions validates the frontend build, bundles Netlify Functions, applies migrations 0001–0003 to an ephemeral PostgreSQL test database, and exercises the authoritative farming/economy RPCs including idempotency, revision conflicts, inventory and XP updates.

CI tests do not apply migrations to the user's Supabase project and do not verify Netlify environment variables. Before enabling the deployed game, apply migrations 0001–0004 to the intended Supabase project, configure the three server-side Netlify variables, deploy the Netlify functions, and run an end-to-end test with a test account. Never apply migrations to production without explicit approval and a backup/rollback plan.
