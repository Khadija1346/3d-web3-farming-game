# AGENTS.md — GARRIVERSE

Continue from [PLAN.md](./PLAN.md) and [docs/backend-api-contract.md](./docs/backend-api-contract.md).

## Current architecture
- Frontend: static Vite + React + TypeScript SPA; Babylon.js 3D world.
- Hosting: Netlify static site and Netlify Functions.
- Identity/data: Supabase Auth + PostgreSQL.
- `src/pages/Play.tsx` owns game page lifecycle and installs the authenticated cloud action handler.
- `src/game/state.ts` owns UI/game snapshots. Cloud commands must be server-authoritative; do not trust client balances, rewards, crop growth, factory timing or revisions.
- `src/game/World.ts` owns scene layout, movement, vehicles, NPCs and interactions.
- `src/fixtures/catalog.ts` contains public game-design data only, never player data.
- `src/config/garri.ts` reads official public token/social values from `VITE_*` env vars. Never hard-code an unverified mint address or buy URL.
- `src/embed/bridge.ts` defines the host event contract.
- `netlify/functions` contains server endpoints; `_lib/supabase.mts` verifies Supabase bearer tokens and keeps service-role access server-side.
- `supabase/migrations` are applied in numeric order. CI runs them against an ephemeral PostgreSQL database.

## Non-negotiable security rules
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or other server secrets in Vite/browser code, logs, screenshots or Git.
- Never trust client-submitted user IDs, XP, inventory, token balances, crop growth, factory timing or quest completion.
- Use server-side authorization and idempotency keys for state-changing actions.
- Do not create fake balances, users, NFTs, leaderboard rows, transactions or social verifications.
- The in-game naira and XP have no cash value. Real $GARRI transfers, staking, payouts and withdrawals stay disabled until the exact approved contract, tokenomics, eligibility and security model are implemented and audited.
- Never claim a feature is live merely because its frontend UI or CI build exists. Confirm production health and an end-to-end test.
- Do not apply production migrations, merge to main or deploy production without explicit user approval and a backup/rollback plan.

## Workflow
1. Inspect the latest branch state before editing.
2. Work on `feature/garri-backend-foundation` unless the user directs otherwise.
3. Add/update SQL integration tests for database behavior.
4. Run GitHub Actions build, function bundling and SQL migration tests.
5. Report exactly what CI proves and what still requires real Supabase/Netlify verification.
