# Backend foundation — API contract

This document defines the first server boundary for GARRIVERSE. It is a contract, not a claim that persistence or authentication is already live.

## Runtime
- Netlify Functions live under `netlify/functions/`.
- Health check: `GET /.netlify/functions/health`.
- Database credentials must remain server-side and must never use `VITE_*` variables.
- Player-specific responses must use `Cache-Control: no-store`.
- Never trust client-supplied XP, balances, crop maturity, factory progress, or sale prices.

## Health response
The endpoint reports whether `DATABASE_URL` is present. A configured variable is not proof of a successful database connection; the endpoint therefore reports `configured_not_connection_tested`.

## Planned player API
| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/.netlify/functions/auth-register` | Create an account after choosing an auth provider |
| POST | `/.netlify/functions/auth-login` | Start a secure session |
| POST | `/.netlify/functions/game-action` | Execute a validated farming/factory action |
| GET | `/.netlify/functions/game-state` | Read the authenticated player's saved state |
| GET | `/.netlify/functions/leaderboard` | Read server-calculated rankings |

These routes are not available until implementation, persistence, and tests are complete.

## Server-authoritative action rules
1. Resolve the player from a verified server session, never from a request body player ID.
2. Validate action type, plot/job ownership, current state, resource requirements, and cooldowns on the server.
3. Apply state changes and append the audit event in one database transaction.
4. Use an idempotency key for retryable commands.
5. Return committed state/version; clients may animate optimistically but must reconcile to the server result.
6. Keep XP/in-game items separate from any future $GARRI entitlement ledger.
7. Keep token payouts and withdrawals disabled until the GARRI team approves the contract, tokenomics, and eligibility rules.

## Configuration still required
- PostgreSQL database and private `DATABASE_URL`.
- Database adapter and migration strategy.
- Production-grade authentication/session provider.
- Approved OAuth credentials for Google or X sign-in.

Never commit credentials.
