-- Phase 3: trust architecture.
--
-- 1) Differencing-attack fix: time cutoffs previously used raw now(), so two
--    calls with different p_weeks could split the same week into overlapping
--    partial buckets; subtracting two >=5 aggregates could isolate individual
--    responses. All cutoffs now snap to whole-week boundaries, so every
--    p_weeks value sees identical buckets — differencing yields zero.
--    (Residual: the current week's bucket grows as responses arrive; that is
--    inherent to any live aggregate and still never shows a bucket under 5.)
--
-- 2) LMP dual-view: unit_reps see exactly what managers see for their unit —
--    same RPCs, same floor, nothing hidden — but cannot post actions
--    (actions_insert requires manager_units membership).

create table unit_reps (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  full_name text,
  primary key (user_id, unit_id)
);

alter table unit_reps enable row level security;

create policy unit_reps_select on unit_reps for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy unit_reps_admin_write on unit_reps for all to authenticated
  using (is_admin()) with check (is_admin());

-- Reps join the read path everywhere can_view_unit is consulted.
create or replace function can_view_unit(u uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin()
      or exists (select 1 from manager_units where manager_id = auth.uid() and unit_id = u)
      or exists (select 1 from unit_reps where user_id = auth.uid() and unit_id = u)
      or exists (
           select 1 from executives e join units un on un.hospital_id = e.hospital_id
           where e.user_id = auth.uid() and un.id = u
         )
$$;

-- Reps also need to see their unit row (units_select requires hospital scope).
create policy units_rep_select on units for select to authenticated
  using (exists (select 1 from unit_reps where user_id = auth.uid() and unit_id = units.id));

-- Week-snapped cutoffs -------------------------------------------------------

create or replace function api_unit_weekly(p_unit uuid, p_weeks int default 12)
returns table (
  week date, n int,
  avg_workload numeric, avg_support numeric, avg_energy numeric,
  break_rate numeric, float_rate numeric
)
language sql stable security definer set search_path = public
as $$
  select date_trunc('week', created_at)::date,
         count(*)::int,
         round(avg(workload), 2), round(avg(support), 2), round(avg(energy), 2),
         round(avg(got_break::int), 2), round(avg(was_floated::int), 2)
  from pulse_responses
  where unit_id = p_unit
    and created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
    and can_view_unit(p_unit)
  group by 1
  having count(*) >= kmin()
  order by 1
$$;

create or replace function api_unit_shift_split(p_unit uuid, p_weeks int default 12)
returns table (
  week date, shift_type text, n int,
  avg_workload numeric, avg_support numeric, avg_energy numeric, break_rate numeric
)
language sql stable security definer set search_path = public
as $$
  select date_trunc('week', created_at)::date, shift_type,
         count(*)::int,
         round(avg(workload), 2), round(avg(support), 2), round(avg(energy), 2),
         round(avg(got_break::int), 2)
  from pulse_responses
  where unit_id = p_unit
    and created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
    and can_view_unit(p_unit)
  group by 1, 2
  having count(*) >= kmin()
  order by 1, 2
$$;

create or replace function api_unit_cohort(p_unit uuid, p_weeks int default 4)
returns table (cohort_n int, unit_n int, cohort_avg_support numeric, unit_avg_support numeric)
language sql stable security definer set search_path = public
as $$
  with base as (
    select * from pulse_responses
    where unit_id = p_unit
      and created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
      and can_view_unit(p_unit)
  )
  select (select count(*) from base where is_new_grad)::int,
         (select count(*) from base)::int,
         (select round(avg(support), 2) from base where is_new_grad),
         (select round(avg(support), 2) from base)
  where (select count(*) from base where is_new_grad) >= kmin()
    and (select count(*) from base) >= kmin()
$$;

create or replace function api_unit_comments(p_unit uuid, p_weeks int default 4)
returns table (week date, comment text)
language sql stable security definer set search_path = public
as $$
  with weekly as (
    select date_trunc('week', created_at)::date as wk, count(*) as n
    from pulse_responses
    where unit_id = p_unit
      and created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
    group by 1
  )
  select w.wk, r.comment
  from pulse_responses r
  join weekly w on w.wk = date_trunc('week', r.created_at)::date
  where r.unit_id = p_unit
    and r.comment is not null
    and w.n >= kmin()
    and can_view_unit(p_unit)
    and r.created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
$$;

-- Staff badge: does this unit have a partnership (rep) view?
drop function api_unit_by_code(text);
create function api_unit_by_code(code text)
returns table (
  unit_id uuid, unit_name text, hospital_name text,
  day_shift_start time, night_shift_start time, has_rep boolean
)
language sql stable security definer set search_path = public
as $$
  select u.id, u.name, h.name, u.day_shift_start, u.night_shift_start,
         exists (select 1 from unit_reps ur where ur.unit_id = u.id)
  from units u join hospitals h on h.id = u.hospital_id
  where u.join_code = lower(code)
$$;
