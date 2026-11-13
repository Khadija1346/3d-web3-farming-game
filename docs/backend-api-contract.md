# GARRIVERSE backend API

Netlify server-side environment variables required:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (required for leaderboard and database reads)

Never use VITE_ prefixes for secrets, commit credentials, or paste them into chat. Rotate any credential previously shared in a chat.

## Implemented routes
| Method | Route | Purpose |
| --- | --- | --- |
| GET | /.netlify/functions/health | Reports configured credentials (not DB reachability) |
| POST | /.netlify/functions/auth-register | Supabase email registration |
| POST | /.netlify/functions/auth-login | Email/password sign-in |
| GET | /.netlify/functions/auth-me | Verify bearer access token |
| POST | /.netlify/functions/auth-logout | End Supabase session |
| GET | /.netlify/functions/game-state | Read authenticated player's saved state |
| GET | /.netlify/functions/leaderboard?limit=20 | Public leaderboard, limit 1–50 |

The landing page now includes farmer registration/sign-in. The community hub reads the public leaderboard from the backend. The browser stores the returned Supabase session locally; do not expose the service-role key to the browser.

Registration JSON: { "email": "player@example.com", "password": "minimum-8-characters", "displayName": "Farmer" }
Login JSON: { "email": "player@example.com", "password": "your-password" }

Use Authorization: Bearer <access_token> for authenticated endpoints. Supabase email-confirmation settings determine whether registration returns a session immediately.

## Important limitation
State reads are implemented. State writes and farming actions remain deliberately disabled until transactional, server-authoritative game rules are implemented. Current gameplay still runs locally and is not cloud-saved; XP and resources do not yet sync to the profile or leaderboard. Never send browser-generated XP, balances, harvests, factory progress, or sale prices to a write endpoint. Real $GARRI payouts and withdrawals remain disabled.

## Authoritative farming action foundation (migration 0002)
Apply `supabase/migrations/0002_authoritative_farming_actions.sql` in the Supabase SQL Editor before enabling this route. The migration grants execution only to `service_role`; browser clients cannot call the RPC directly.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /.netlify/functions/farming-action | Authenticated, server-validated till/plant/water/weed/harvest command |

Request JSON contains only `action`, `plotId`, `idempotencyKey`, and optional `expectedRevision`. The server derives the player ID from the verified bearer token. XP, level, stems, water usage, root yield, plot transitions, and revision are computed in PostgreSQL. Repeated idempotency keys return the original result. Stale revisions return HTTP 409.

This is a backend foundation, not yet the live gameplay save loop. The 3D client is not wired to submit these commands, crop growth/maturity is still simulated locally, and factory/warehouse/market actions are not yet server-authoritative. Do not describe progress as cloud-saved until the client migration and server-side crop/factory simulation are complete. Apply migration 0002 only after reviewing it in Supabase; this branch work does not run it.


## 3D gameplay cloud connection (partial milestone)
When a valid Supabase session is present, `src/pages/Play.tsx` loads the signed-in player's saved state and configures `GameStore` to send till, plant, watering-can, refill-can, weed, and harvest commands to `/.netlify/functions/farming-action`. The browser no longer advances crop growth in signed-in cloud mode; the SQL function advances crops from server elapsed time and derives XP, level, water use, stems and harvest yield. Each successful command returns a canonical state snapshot and revision which the client applies.

Without a signed-in account the game remains a local preview. In signed-in mode the current cloud milestone covers the five field actions only. Tanker/rain watering, factory processing, warehouse deposits, market sales, stem purchases, day/weather, and vehicle state are not yet cloud-backed; the UI labels factory and market as preview-only. No real-money or $GARRI reward path is enabled. The browser generates an idempotency key per command and submits only the action, plot ID, and expected revision.

Before this feature can run in a deployed environment, review and apply migrations 0001 and 0002 in the intended Supabase project, confirm the three server-side Netlify environment variables are configured, and deploy the Netlify functions. This branch work does not apply migrations or deploy.
