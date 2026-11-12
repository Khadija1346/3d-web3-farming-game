# GARRI: Rise of the Town — Product Roadmap

GARRI is a large platform: a 3D farming game, a server-authoritative economy, social and Web3 identity, NFTs,
token rewards, moderation and a DAO-embeddable module. It is delivered in focused milestones so every step ships
something real and nothing is faked along the way.

## ✅ Milestone 1 — Playable village & product surface (done)
- Landing page, Token & Community Hub, and the playable 3D village (`/play`) plus a chrome-less embed view (`/embed`).
- Babylon.js 8 world: village houses, roads, plaza, cassava farm (12 plots), borehole, river water district with stilt
  huts and canoes, garri factory, warehouse, Oja market, palms/trees, NPCs, day/night cycle, rain, shadows.
- Third-person movement (keyboard + touch joystick), orbit/zoom camera, drivable tractor (tills) and water tanker (waters).
- Full plant → water → weed → harvest → 8-stage factory → warehouse → market loop with XP and levels.
- Honest status everywhere: token address/buy link are env-configured and show "pending" when unset; leaderboard,
  NFTs, quests and social tasks show empty/pending states with no placeholder data.
- Progress is kept only in the browser tab (clearly labelled "Preview session").

## Milestone 2 — Backend foundation & server-authoritative game state
- Add a Netlify Server (`netlify/server/index.mjs`, Hono) as the single API. The frontend stays a static Vite build.
- Netlify Database (Postgres + Drizzle) schema: `players`, `plots`, `inventory`, `factory_jobs`, `xp_events`,
  `action_log`. Every command in `src/game/state.ts` (till, plant, water, weed, harvest, startBatch, runStage,
  deposit, sellBag, buyStems) becomes a POST endpoint that validates timing server-side (growth timestamps, stage
  durations) — the client only predicts.
- Rate limiting per player/IP and an append-only audit log of every state change.
- Decision needed: the original brief names Supabase. Recommended: Netlify Database for data + realtime via the
  server (SSE/WebSocket); keep Supabase only if its Auth is chosen in Milestone 3.

## Milestone 3 — Accounts & sessions
- Sign up / sign in with email + password (verification, password recovery), Google OAuth and X OAuth.
- Secure httpOnly sessions, logout, protected routes (`/play` saves only when signed in), profile with username and avatar.
- Decision needed: Netlify Identity covers email + Google but not X; Supabase Auth or Auth.js covers all three.
- Needs from the GARRI team: Google OAuth client, X developer app (client ID/secret), email sender domain.

## Milestone 4 — Progression systems
- Achievements, daily check-in with streaks, daily/weekly quests, special missions, referrals (one claim per verified
  account, server-enforced idempotency keys), seasonal competitions, global leaderboard with live updates.
- Anti-cheat: server-side action cadence limits, impossible-progress detection, duplicate-claim protection.

## Milestone 5 — Wallet identity & token hub data
- Solana wallet adapter (Phantom, Solflare, Backpack): network detection, nonce + signed-message (SIWS) login,
  wallet linking to accounts. Typed addresses never authenticate.
- Live $GARRI balance and recent transactions from an RPC provider (needs RPC key) once the official mint is set via
  `VITE_GARRI_MINT_ADDRESS`; BUY button activates via `VITE_GARRI_PUMPFUN_URL`.

## Milestone 6 — Social verification
- X follow/verify via X OAuth (subject to X API tier), Telegram membership via a GARRI bot (`getChatMember`) and
  Telegram Login widget. Social quests award XP only after genuine verification.
- Needs: X API access level, Telegram bot token and admin rights in @GARRIONCHAIN.

## Milestone 7 — NFT ecosystem
- On-chain ownership reads (Metaplex / DAS API) for character, land, vehicle, equipment and achievement collections;
  gallery, metadata, and in-game utility (e.g. land NFT unlocks extra plots, vehicle NFT skins).
- Minting & marketplace integration later, only with approved collection addresses.

## Milestone 8 — Reward engine & ledger
- Separate ledgers for XP, in-game resources and (future) $GARRI entitlements; eligibility checks, bot scoring,
  audit history and admin review queue. Real payouts and withdrawals stay hard-disabled behind a server flag until
  the GARRI team approves contracts, tokenomics and eligibility rules.

## Milestone 9 — Moderator Office
- `/office` dashboard gated by server-side roles: player reports, mute/ban/restore actions, activity monitoring,
  reward review, immutable audit logs.

## Milestone 10 — Asta DAO & Capacitor packaging
- Capacitor project wrapping the Vite build; documented host events (extend `src/embed/bridge.ts`), deep-link routes,
  token-based auth hand-off that doesn't assume private DAO APIs.

## Milestone 11 — World depth & polish
- Licensed glTF character/building models with skeletal animation, harvester and transport truck, more crops and
  weather, multiplayer presence, sound design, performance budgets for low-end Android.
