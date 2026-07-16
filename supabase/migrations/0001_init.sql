-- Pulse initial schema.
--
-- RLS philosophy (the part sales meetings ask about):
--  * pulse_responses has NO select policy for ANY role. Raw rows are unreadable
--    through the API, full stop. Reads happen only through security-definer
--    functions below, each of which enforces the 5-response floor in SQL.
--  * Anonymous (anon) can INSERT check-ins and action feedback. There is no
--    user/device/session column on those tables, so identity cannot leak even
--    by accident. Range validity is enforced by table constraints.
--  * Staff-side reads (unit lookup, latest action, receipt context) are
--    anon-callable RPCs that return only floor-respecting aggregates.
--  * Managers/execs/admins are scoped by helper predicates used in both RLS
--    policies and the aggregate functions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nurses_per_unit int not null default 30,
  replacement_cost numeric not null default 55000,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  join_code text not null unique check (join_code = lower(join_code)),
  bed_count int,
  day_shift_start time not null default '07:00',
  night_shift_start time not null default '19:00',
  created_at timestamptz not null default now()
);

-- Anonymous staff responses. NO user identifier of any kind — by design there
-- is no column that could hold one.
create table pulse_responses (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  shift_type text not null check (shift_type in ('day', 'night')),
  workload smallint not null check (workload between 1 and 5),
  support smallint not null check (support between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  got_break boolean not null,
  was_floated boolean not null,
  comment varchar(120),
  is_new_grad boolean not null default false,
  created_at timestamptz not null default now()
);

create index pulse_responses_unit_time_idx on pulse_responses (unit_id, created_at);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hospital_id uuid not null references hospitals(id) on delete cascade,
  full_name text
);

create table manager_units (
  manager_id uuid not null references managers(user_id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (manager_id, unit_id)
);

create table executives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hospital_id uuid not null references hospitals(id) on delete cascade,
  full_name text
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  manager_id uuid not null references managers(user_id) on delete cascade,
  text varchar(140) not null,
  created_at timestamptz not null default now()
);

create index actions_unit_time_idx on actions (unit_id, created_at desc);

-- Anonymous, like everything staff-side.
create table action_feedback (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references actions(id) on delete cascade,
  helped boolean not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper predicates
-- ---------------------------------------------------------------------------

-- The k-anonymity floor. One definition, referenced everywhere.
create function kmin() returns int
language sql immutable parallel safe
as $$ select 5 $$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create function can_view_unit(u uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin()
      or exists (select 1 from manager_units where manager_id = auth.uid() and unit_id = u)
      or exists (
           select 1 from executives e join units un on un.hospital_id = e.hospital_id
           where e.user_id = auth.uid() and un.id = u
         )
$$;

create function can_view_hospital(h uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin()
      or exists (select 1 from executives where user_id = auth.uid() and hospital_id = h)
      or exists (select 1 from managers where user_id = auth.uid() and hospital_id = h)
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table hospitals enable row level security;
alter table units enable row level security;
alter table pulse_responses enable row level security;
alter table admins enable row level security;
alter table managers enable row level security;
alter table manager_units enable row level security;
alter table executives enable row level security;
alter table actions enable row level security;
alter table action_feedback enable row level security;

create policy hospitals_select on hospitals for select to authenticated
  using (can_view_hospital(id));
create policy hospitals_admin_write on hospitals for all to authenticated
  using (is_admin()) with check (is_admin());

create policy units_select on units for select to authenticated
  using (can_view_hospital(hospital_id));
create policy units_admin_write on units for all to authenticated
  using (is_admin()) with check (is_admin());

-- Check-ins: anyone may insert; nobody may select/update/delete via the API.
create policy pulse_insert on pulse_responses for insert to anon, authenticated
  with check (true);
-- (no select policy on purpose)

create policy admins_self on admins for select to authenticated
  using (user_id = auth.uid());

create policy managers_select on managers for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy managers_admin_write on managers for all to authenticated
  using (is_admin()) with check (is_admin());

create policy manager_units_select on manager_units for select to authenticated
  using (manager_id = auth.uid() or is_admin());
create policy manager_units_admin_write on manager_units for all to authenticated
  using (is_admin()) with check (is_admin());

create policy executives_select on executives for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy executives_admin_write on executives for all to authenticated
  using (is_admin()) with check (is_admin());

create policy actions_select on actions for select to authenticated
  using (can_view_unit(unit_id));
create policy actions_insert on actions for insert to authenticated
  with check (
    manager_id = auth.uid()
    and exists (select 1 from manager_units where manager_id = auth.uid() and unit_id = actions.unit_id)
  );

-- Feedback: anonymous insert; managers/execs read tallies for their units.
create policy action_feedback_insert on action_feedback for insert to anon, authenticated
  with check (true);
create policy action_feedback_select on action_feedback for select to authenticated
  using (exists (select 1 from actions a where a.id = action_id and can_view_unit(a.unit_id)));

-- Belt and braces: raw response reads are also revoked at the grant level.
revoke select, update, delete on pulse_responses from anon, authenticated;
revoke update, delete on action_feedback from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff-side RPCs (anon-callable, aggregate-only)
-- ---------------------------------------------------------------------------

-- Resolve a QR join code to a unit for the check-in screen.
create function api_unit_by_code(code text)
returns table (unit_id uuid, unit_name text, hospital_name text, day_shift_start time, night_shift_start time)
language sql stable security definer set search_path = public
as $$
  select u.id, u.name, h.name, u.day_shift_start, u.night_shift_start
  from units u join hospitals h on h.id = u.hospital_id
  where u.join_code = lower(code)
$$;

-- Latest manager action + its anonymous tally, for you-said-we-did.
create function api_latest_action(code text)
returns table (action_id uuid, action_text text, created_at timestamptz, helped int, not_helped int)
language sql stable security definer set search_path = public
as $$
  select a.id, a.text, a.created_at,
         count(*) filter (where f.helped)::int,
         count(*) filter (where not f.helped)::int
  from units u
  join actions a on a.unit_id = u.id
  left join action_feedback f on f.action_id = a.id
  where u.join_code = lower(code)
  group by a.id, a.text, a.created_at
  order by a.created_at desc
  limit 1
$$;

-- Context for the Shift Receipt + constellation. Aggregates only, and only
-- for weeks that clear the k-anonymity floor.
create function api_unit_public_context(code text)
returns table (week date, n int, avg_energy numeric)
language sql stable security definer set search_path = public
as $$
  select date_trunc('week', r.created_at)::date, count(*)::int, round(avg(r.energy), 2)
  from pulse_responses r
  join units u on u.id = r.unit_id
  where u.join_code = lower(code)
    and r.created_at >= now() - interval '6 weeks'
  group by 1
  having count(*) >= kmin()
  order by 1
$$;

-- ---------------------------------------------------------------------------
-- Dashboard RPCs (authenticated; k-anonymity enforced in the HAVING clause)
-- ---------------------------------------------------------------------------

create function api_unit_weekly(p_unit uuid, p_weeks int default 12)
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
    and created_at >= now() - make_interval(weeks => p_weeks)
    and can_view_unit(p_unit)
  group by 1
  having count(*) >= kmin()
  order by 1
$$;

create function api_unit_shift_split(p_unit uuid, p_weeks int default 12)
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
    and created_at >= now() - make_interval(weeks => p_weeks)
    and can_view_unit(p_unit)
  group by 1, 2
  having count(*) >= kmin()
  order by 1, 2
$$;

-- New-grad cohort vs. unit average, floor applied to BOTH groups.
create function api_unit_cohort(p_unit uuid, p_weeks int default 4)
returns table (cohort_n int, unit_n int, cohort_avg_support numeric, unit_avg_support numeric)
language sql stable security definer set search_path = public
as $$
  with base as (
    select * from pulse_responses
    where unit_id = p_unit
      and created_at >= now() - make_interval(weeks => p_weeks)
      and can_view_unit(p_unit)
  )
  select (select count(*) from base where is_new_grad)::int,
         (select count(*) from base)::int,
         (select round(avg(support), 2) from base where is_new_grad),
         (select round(avg(support), 2) from base)
  where (select count(*) from base where is_new_grad) >= kmin()
    and (select count(*) from base) >= kmin()
$$;

-- Comments, only from weeks that clear the floor, stripped to text + week.
create function api_unit_comments(p_unit uuid, p_weeks int default 4)
returns table (week date, comment text)
language sql stable security definer set search_path = public
as $$
  with weekly as (
    select date_trunc('week', created_at)::date as wk, count(*) as n
    from pulse_responses
    where unit_id = p_unit
      and created_at >= now() - make_interval(weeks => p_weeks)
    group by 1
  )
  select w.wk, r.comment
  from pulse_responses r
  join weekly w on w.wk = date_trunc('week', r.created_at)::date
  where r.unit_id = p_unit
    and r.comment is not null
    and w.n >= kmin()
    and can_view_unit(p_unit)
    and r.created_at >= now() - make_interval(weeks => p_weeks)
$$;

-- Hospital league table for /exec: per-unit recent vs. prior energy trend.
create function api_hospital_league(p_hospital uuid)
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
      and r.created_at >= now() - interval '8 weeks'
  ),
  recent as (
    select unit_id, unit_name, count(*) as n, avg(energy) as e, avg(got_break::int) as b
    from scoped where created_at >= now() - interval '4 weeks'
    group by 1, 2 having count(*) >= kmin()
  ),
  prior as (
    select unit_id, avg(energy) as e
    from scoped where created_at < now() - interval '4 weeks'
    group by 1 having count(*) >= kmin()
  )
  select r.unit_id, r.unit_name, r.n::int, round(r.e, 2), round(p.e, 2), round(r.b, 2)
  from recent r left join prior p using (unit_id)
$$;

-- Function grants: staff RPCs are anon-callable, dashboard RPCs are not.
revoke execute on function api_unit_weekly(uuid, int) from anon;
revoke execute on function api_unit_shift_split(uuid, int) from anon;
revoke execute on function api_unit_cohort(uuid, int) from anon;
revoke execute on function api_unit_comments(uuid, int) from anon;
revoke execute on function api_hospital_league(uuid) from anon;
