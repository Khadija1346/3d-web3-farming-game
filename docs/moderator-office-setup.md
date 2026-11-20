# Moderator Office activation

The Moderator Office is available at `/moderator`. Its APIs are Netlify Functions and must remain server-side.

## 1. Apply the database migration

After taking a database backup, apply `supabase/migrations/0006_moderator_office.sql` after migrations 0001–0005.

The migration creates:
- `staff_roles`: explicit `admin`, `moderator` and `support` assignments.
- `moderation_reports`: authenticated player reports and workflow status.
- `player_moderation_state`: current suspension metadata.
- `moderation_actions`: append-only audit events.

RLS is enabled and no browser roles receive direct table policies. Netlify functions use the server-only Supabase secret/service-role credential.

## 2. Assign the first administrator

Do not expose a self-service role-grant flow. After the owner confirms the email used for their GARRIVERSE login, run this SQL as a trusted project administrator, replacing the placeholder:

```sql
insert into public.staff_roles (user_id, role, active)
select id, 'admin', true
from auth.users
where lower(email) = lower('OWNER_LOGIN_EMAIL')
on conflict (user_id, role)
do update set active = true;
```

Confirm exactly one row was inserted or updated. Never grant a role to an account based only on a display name or Telegram handle.

## 3. Staff roles

- `admin`: all dashboard views, report actions, player suspension and unsuspension.
- `moderator`: dashboard views and report review/resolution/dismissal; cannot suspend accounts.
- `support`: read-only dashboard access.

Add staff only by inserting a role row through a trusted database admin session. Set `active = false` to revoke access.

## 4. Deploy and verify

1. Ensure Netlify has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a server-only `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`.
2. Deploy the branch after review/merge.
3. Sign in with the assigned staff account and open `/moderator`.
4. Submit a test report from the Community Hub, review it, and confirm the audit event appears.
5. Test suspension only with a dedicated test account; confirm the account cannot sign in during the ban and can sign in after unban.

Do not call the feature production-live until the migration, role assignment, Netlify deployment and end-to-end tests all pass.
