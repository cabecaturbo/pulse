-- Tighten function grants: default EXECUTE is granted to PUBLIC, which the
-- earlier per-role revokes did not remove (caught by Supabase security advisor).

alter function kmin() set search_path = public;

-- Helper predicates: needed by authenticated (RLS policies reference them),
-- never by anon.
revoke execute on function is_admin() from public, anon;
revoke execute on function can_view_unit(uuid) from public, anon;
revoke execute on function can_view_hospital(uuid) from public, anon;

-- Dashboard RPCs: authenticated only.
revoke execute on function api_unit_weekly(uuid, int) from public, anon;
revoke execute on function api_unit_shift_split(uuid, int) from public, anon;
revoke execute on function api_unit_cohort(uuid, int) from public, anon;
revoke execute on function api_unit_comments(uuid, int) from public, anon;
revoke execute on function api_hospital_league(uuid) from public, anon;

-- Staff RPCs stay anon-callable on purpose (they are the check-in surface):
-- api_unit_by_code, api_latest_action, api_unit_public_context.
