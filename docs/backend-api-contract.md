# GARRIVERSE backend API

Netlify server-side environment variables required:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Never use VITE_ prefixes for secrets, commit credentials, or paste them into chat. Rotate any credential previously shared in a chat.

## Implemented routes
| Method | Route | Purpose |
| --- | --- | --- |
| GET | /.netlify/functions/health | Configuration presence only |
| POST | /.netlify/functions/auth-register | Supabase email registration |
| POST | /.netlify/functions/auth-login | Email/password sign-in |
| GET | /.netlify/functions/auth-me | Verify bearer access token |
| POST | /.netlify/functions/auth-logout | End Supabase session |
| GET | /.netlify/functions/game-state | Read authenticated player's saved state |
| GET | /.netlify/functions/leaderboard?limit=20 | Public leaderboard, limit 1–50 |

Registration JSON: { "email": "player@example.com", "password": "minimum-8-characters", "displayName": "Farmer" }
Login JSON: { "email": "player@example.com", "password": "your-password" }

Use Authorization: Bearer <access_token> for authenticated endpoints. Supabase email-confirmation settings determine whether registration returns a session immediately.

## Important limitation
State reads are implemented. State writes and farming actions remain deliberately disabled until transactional, server-authoritative game rules are implemented. Current game play remains a local preview and is not cloud-saved. Never send browser-generated XP, balances, harvests, factory progress, or sale prices to a write endpoint. Real $GARRI payouts and withdrawals remain disabled.