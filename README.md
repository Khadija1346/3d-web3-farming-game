# GARRI: Rise of the Town

A premium 3D Nigerian farming and garri-processing game for mobile and desktop browsers. Players can farm cassava, process garri, store and sell in-game goods, and save authoritative progress to a Supabase-backed account when the backend is deployed and configured.

## App routes
- **`/`** — landing page and farmer account.
- **`/play`** — playable 3D village with farm, water district, factory, warehouse, Oja market, NPCs, day/night and rain visuals, tractor and water tanker.
- **`/embed`** — chrome-less game view for an approved DAO/mobile host.
- **`/hub`** — $GARRI token and community hub, live leaderboard when backend is connected, and honest pending states for integrations not yet configured.

## Gameplay
The core loop is till → plant → water → weed → harvest → process through eight factory stages → store in warehouse → sell at Oja market. Signed-in accounts use server-authoritative actions for field work, factory, warehouse, market and tanker. Unsigned-in play is a local preview and is not cloud-saved.

The in-game naira (₦), XP, roots, stems and garri inventory have no cash or token value. Real $GARRI rewards and withdrawals are disabled.

## Controls
Desktop: WASD/arrows to move, Shift to run, drag to look, scroll to zoom, **E** to interact, **F** to enter/leave a vehicle.
Mobile: left thumbstick, drag to look, pinch to zoom, on-screen action / Drive / Run buttons.

## Tech
React 19 · TypeScript · Vite 8 · Babylon.js 8 · React Router 7 · Netlify Functions · Supabase Auth/Postgres.

## Local development
```bash
npm install
npm run dev
```

## Backend setup
Read [docs/supabase-setup.md](./docs/supabase-setup.md) and [docs/backend-api-contract.md](./docs/backend-api-contract.md). Apply migrations 0001–0004 in order and configure the server-only Netlify environment variables. Never expose the Supabase service-role key to the browser.

## Embedding
Load `/embed` full-screen in an approved WebView or iframe. The game emits `garri:ready` and `garri:level` events through `window.parent.postMessage` and an optional `window.GarriHost.onEvent` hook. See [src/embed/bridge.ts](./src/embed/bridge.ts).

## Roadmap and launch blockers
See [PLAN.md](./PLAN.md). Google/X OAuth, wallet sign-in, live token data, social verification, quests, NFTs, moderator tools and real-token payouts still require implementation and/or official team configuration.
