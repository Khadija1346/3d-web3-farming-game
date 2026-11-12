# AGENTS.md — GARRI: Rise of the Town

**Continue from [PLAN.md](./PLAN.md).** Milestone 1 (playable village + product surface) is done; Milestone 2
(Netlify Server + Netlify Database, server-authoritative state) is next.

## Architecture
- Static Vite + React SPA (no SSR framework) so it can also be wrapped by Capacitor. `netlify.toml` publishes `dist`
  with an SPA fallback. Backend work should be a **Netlify Server** (`netlify/server/index.mjs`) — no template/
  framework catch-all exists, so the server will receive `/api/*` traffic.
- `src/pages/` — `Landing`, `Hub`, `Play` (lazy-loaded; also serves `/embed` with `embed` prop).
- `src/game/state.ts` — `GameStore`: all game rules as named commands + `tick(dt)` clock. React reads it via
  `useSyncExternalStore` (published ~5 Hz). The 3D world reads `store.state` live. **When adding a backend, turn each
  command into an API call; keep the World/HUD reading snapshots.**
- `src/game/World.ts` — Babylon scene: layout, day/night, rain, movement, vehicles, NPCs, plot visuals, interaction
  zones. Writes only UI state (prompt, panel, vehicle) back into the store.
- `src/game/builders.ts` — procedural asset kit (humanoids, tractor, tanker, houses, palms, cassava, signs).
- `src/fixtures/catalog.ts` — static game-design data (crop rules, economy, factory stages, quest templates,
  integration status). Contains no player data.
- `src/config/garri.ts` — official token/social config from `VITE_*` env vars. Never hard-code addresses.
- `src/embed/bridge.ts` — host event contract for Asta/Capacitor.

## Conventions & non-negotiables
- No fake balances, users, NFTs, leaderboard rows, transactions or social verification. Unconnected features show a
  `StatusPill state="pending"` with an honest note.
- In-game naira (₦) and XP are play currency; real $GARRI payouts stay disabled until GARRI team approval.
- Images: AI-generated art in `public/img`, always referenced through `/.netlify/images?url=/img/...` (see `cdn()` in
  `components/Brand.tsx`).
- Styling: single `src/styles.css` with CSS variables (soil/laterite/gold palette, Bricolage Grotesque + Instrument Sans).
- Mobile performance: `World` takes a `mobile` flag (coarse pointer) that lowers resolution, shadow map size,
  tree and particle counts. Static meshes are frozen and instanced.
