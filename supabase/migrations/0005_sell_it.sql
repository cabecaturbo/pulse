-- Phase 4: exec league with shift filter, and a public RPC for the /demo
-- world (demo hospitals contain only synthetic data, flagged is_demo).

alter table hospitals add column is_demo boolean not null default false;

drop function api_hospital_league(uuid);
create function api_hospital_league(p_hospital uuid, p_shift text default null)
returns table (
  unit_id uuid, unit_name text,
  recent_n int, recent_energy numeric, prior_energy numeric,
  recent_break_rate numeric
)
language sql stable security definer set search_path = public
as $$
  with scoped as (
    select r.*, u.name as unit_name
    from pulse_responses r
    join units u on u.id = r.unit_id
    where u.hospital_id = p_hospital
      and can_view_hospital(p_hospital)
      and (p_shift is null or r.shift_type = p_shift)
      and r.created_at >= date_trunc('week', now()) - interval '8 weeks'
  ),
  recent as (
    select unit_id, unit_name, count(*) as n, avg(energy) as e, avg(got_break::int) as b
    from scoped where created_at >= date_trunc('week', now()) - interval '4 weeks'
    group by 1, 2 having count(*) >= kmin()
  ),
  prior as (
    select unit_id, avg(energy) as e
    from scoped where created_at < date_trunc('week', now()) - interval '4 weeks'
    group by 1 having count(*) >= kmin()
  )
  select r.unit_id, r.unit_name, r.n::int, round(r.e, 2), round(p.e, 2), round(r.b, 2)
  from recent r left join prior p using (unit_id)
$$;

revoke execute on function api_hospital_league(uuid, text) from public, anon;

-- The demo world is public by design (synthetic data only). Returns
-- everything /demo needs in one call: per-unit weekly aggregates, shift
-- splits, latest action + tally, cohort info, and hospital config.
create function api_demo_data()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'hospital', (
      select jsonb_build_object(
        'name', h.name,
        'nurses_per_unit', h.nurses_per_unit,
        'replacement_cost', h.replacement_cost
      )
      from hospitals h where h.is_demo limit 1
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'unit_id', u.id,
        'unit_name', u.name,
        'join_code', u.join_code,
        'weekly', (
          select coalesce(jsonb_agg(w order by (w->>'week')), '[]'::jsonb) from (
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
            where r.unit_id = u.id
            group by date_trunc('week', r.created_at)
            having count(*) >= kmin()
          ) ww
        ),
        'shifts', (
          select coalesce(jsonb_agg(s order by (s->>'week')), '[]'::jsonb) from (
            select jsonb_build_object(
              'week', date_trunc('week', r.created_at)::date,
              'shift_type', r.shift_type,
              'n', count(*),
              'avg_workload', round(avg(r.workload), 2),
              'avg_support', round(avg(r.support), 2),
              'avg_energy', round(avg(r.energy), 2),
              'break_rate', round(avg(r.got_break::int), 2)
            ) as s
            from pulse_responses r
            where r.unit_id = u.id
            group by date_trunc('week', r.created_at), r.shift_type
            having count(*) >= kmin()
          ) ss
        ),
        'cohort', (
          select to_jsonb(c) from (
            select count(*) filter (where r.is_new_grad) as cohort_n,
                   count(*) as unit_n,
                   round(avg(r.support) filter (where r.is_new_grad), 2) as cohort_avg_support,
                   round(avg(r.support), 2) as unit_avg_support
            from pulse_responses r
            where r.unit_id = u.id
              and r.created_at >= date_trunc('week', now()) - interval '4 weeks'
            having count(*) filter (where r.is_new_grad) >= kmin()
               and count(*) >= kmin()
          ) c
        ),
        'latest_action', (
          select jsonb_build_object(
            'text', a.text,
            'created_at', a.created_at,
            'helped', (select count(*) from action_feedback f where f.action_id = a.id and f.helped),
            'not_helped', (select count(*) from action_feedback f where f.action_id = a.id and not f.helped)
          )
          from actions a where a.unit_id = u.id
          order by a.created_at desc limit 1
        )
      )), '[]'::jsonb)
      from units u
      join hospitals h on h.id = u.hospital_id
      where h.is_demo
    )
  )
$$;
