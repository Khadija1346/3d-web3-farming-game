# GARRIVERSE — Delivery roadmap and launch status

## Milestone 1 — Playable village & product surface
**Implemented**
- Landing page, token/community hub, playable 3D village at `/play`, and chrome-less `/embed` view.
- Babylon.js village, 12 cassava plots, water district, factory, warehouse, market, NPCs, weather/day visuals and vehicles.
- Full local preview loop: till → plant → water → weed → harvest → eight factory stages → warehouse → market.
- Honest empty/pending states; no fabricated users, NFTs, token balances or social verifications.

## Milestone 2 — Backend foundation and authoritative game state
**Implemented in branch; CI verified**
- Supabase PostgreSQL schema, RLS and server-only service-role RPCs.
- Netlify Functions for game state, authentication, leaderboard and server actions.
- Server-authoritative field actions: till, plant, water, weed, harvest and watering-can refill.
- Server-authoritative factory, warehouse, market and tanker actions.
- Idempotency keys, optimistic revision checks, server-time crop growth and server-time factory stage validation.
- GitHub Actions applies migrations 0001–0004 to ephemeral PostgreSQL and tests gameplay RPCs.

## Milestone 3 — Accounts
**Email/password implementation present; deployment verification pending**
- Supabase email registration, sign-in, session verification and sign-out.
- Google and X OAuth are not implemented; they require approved OAuth credentials and callback configuration.
- Current browser session storage is not an httpOnly-cookie session. Harden session storage before treating this as a high-assurance production identity system.

## Milestone 4 — Quests and progression
**Pending**
- Daily/weekly quest progress and server-side claims.
- Referral validation, achievements, seasonal competitions and anti-cheat cadence rules.

## Milestone 5 — Wallet identity and token hub
**Pending external configuration and implementation**
- Solana wallet connect, nonce + signed-message authentication, wallet linking.
- Live $GARRI balance and transaction reads.
- Requires official mint address and a supported Solana RPC/data provider.

## Milestone 6 — Social verification
**Pending external credentials**
- X OAuth/API verification and Telegram membership checks.
- Requires approved X API access and a GARRI Telegram bot with membership-check permissions.

## Milestone 7 — NFT ecosystem
**Pending external configuration and implementation**
- Ownership reads and gallery for approved collections.
- Requires official collection addresses and a Solana DAS/indexer provider.

## Milestone 8 — Reward engine and ledger
**Disabled by design**
- Real $GARRI rewards, transfers and withdrawals are not implemented or enabled.
- Requires exact approved tokenomics, payout contract, eligibility rules, audited security model, custody/authority controls, monitoring and incident response.

## Milestone 9 — Moderator Office
**Pending**
- Server-side roles, reports, moderation actions and immutable audit logs.

## Milestone 10 — Asta DAO and Capacitor
**Embed route and host event bridge implemented; packaging/host integration pending**
- `/embed` and documented postMessage/host events exist.
- Actual DAO app hand-off and Capacitor packaging require the Asta team's approved integration contract.

## Milestone 11 — World depth and polish
**Ongoing**
- Additional licensed/approved animated assets, multiplayer presence, sound and low-end Android performance work.

---

## Launch checklist (not yet completed)
1. Apply Supabase migrations 0001–0004 to the intended project after backup and approval.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY` in Netlify.
3. Deploy Netlify Functions and verify `/.netlify/functions/health` reports `ready`.
4. Run the documented end-to-end tests with a dedicated test account.
5. Configure official public GARRI values (mint, buy URL and collection addresses) only after the team supplies the canonical values.
6. Keep real token payouts disabled until the approved contract and security controls are in place.

The current branch is a tested implementation branch. A passing CI run is not proof that the production Supabase project or Netlify site has been migrated/deployed.
