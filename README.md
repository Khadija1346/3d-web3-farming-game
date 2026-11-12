# GARRI: Rise of the Town

A premium 3D Nigerian farming and garri-processing game for mobile and desktop browsers, with a roadmap toward
accounts, a server-authoritative economy, Solana wallet identity, NFTs, the $GARRI token hub and an embeddable
module for the Asta DAO app.

## What's in the app today
- **`/`** — landing page.
- **`/play`** — the playable 3D village: farm, borehole, river water district, garri factory (8 stages), warehouse,
  Oja market, NPCs, day/night and rain, tractor and water tanker.
- **`/embed`** — the same game without site chrome, for embedding in other apps.
- **`/hub`** — $GARRI token info, official X/Telegram links, rewards model, quests, leaderboard and NFT gallery
  (honest pending states until each service is connected).

Progress in the preview lives only in the current browser tab.

## Controls
Desktop: WASD/arrows to move, Shift to run, drag to look, scroll to zoom, **E** to interact, **F** to enter/leave a vehicle.
Mobile: left thumbstick, drag to look, pinch to zoom, on-screen action / Drive / Run buttons.

## Tech
React 19 · TypeScript · Vite 8 · Babylon.js 8 · React Router 7 · deployed on Netlify (static build, SPA fallback).
All 3D assets are generated procedurally at runtime (no third-party model licences).

## Run locally
```bash
npm install
npm run dev
```

## Configuration
Copy `.env.example` and set values in Netlify → Environment variables once the GARRI team confirms them:

| Variable | Purpose |
| --- | --- |
| `VITE_GARRI_MINT_ADDRESS` | Official $GARRI mint address (empty = shown as pending) |
| `VITE_GARRI_NETWORK` | Network label, defaults to `Solana` |
| `VITE_GARRI_PUMPFUN_URL` | Official Pump.fun page; must start with `https://pump.fun/` to enable BUY |
| `VITE_GARRI_WEBSITE_URL` | Official website link |

## Embedding (Asta DAO / Capacitor)
Load `/embed` full-screen in a WebView or iframe. The game emits events to the host via `window.parent.postMessage`
and, if present, `window.GarriHost.onEvent(event)`:

| Event | Payload |
| --- | --- |
| `garri:ready` | `{ type, version: 1 }` — scene loaded |
| `garri:level` | `{ type, level }` — player levelled up |

## Roadmap
See [PLAN.md](./PLAN.md): backend & server-authoritative state, accounts (email/Google/X), progression systems,
wallet sign-in, social verification, NFTs, reward ledger, Moderator Office, Capacitor packaging and world polish.
