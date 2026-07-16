-- Data source for the Monday digest edge function. service_role only.
-- Even here, the k-anonymity floor applies: the digest reads the same
-- floored weekly aggregates managers see, never raw rows.

create function api_digest_data()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(manager_row), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'email', u.email,
      'name', m.full_name,
      'units', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'unit_name', un.name,
          'weeks', (
            select coalesce(jsonb_agg(w order by w->>'week'), '[]'::jsonb)
            from (
              select jsonb_build_object(
                'week', date_trunc('week', r.created_at)::date,
                'n', count(*),
                'avg_workload', round(avg(r.workload), 2),
                'avg_support', round(avg(r.support), 2),
                'avg_energy', round(avg(r.energy), 2),
                'break_rate', round(avg(r.got_break::int), 2),
                'float_rate', round(avg(r.was_floated::int), 2)
              ) as w
              from pulse_responses r
              where r.unit_id = un.id
                and r.created_at >= now() - interval '6 weeks'
              group by date_trunc('week', r.created_at)
              having count(*) >= kmin()
            ) weekly
          )
        )), '[]'::jsonb)
        from manager_units mu
        join units un on un.id = mu.unit_id
        where mu.manager_id = m.user_id
      )
    ) as manager_row
    from managers m
    join auth.users u on u.id = m.user_id
  ) rows
$$;

revoke execute on function api_digest_data() from public, anon, authenticated;

-- Cron scheduling (pg_cron + pg_net) is configured separately once the edge
-- function URL exists; see supabase/functions/weekly-digest/README in repo docs.
create extension if not exists pg_cron;
create extension if not exists pg_net;
