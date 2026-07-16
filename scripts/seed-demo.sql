-- Pulse demo world: Riverbend Medical Center (is_demo = true).
-- 6 units, 16 weeks of synthetic data:
--   demo-icu : visibly storming, break rate collapsing
--   demo-4w  : declined for 8 weeks, manager posted an action, recovered
--   demo-ed  : struggling new-grad cohort (support gap)
--   demo-3n  : steady and healthy
--   demo-tele: steady mediocre
--   demo-peds: slowly improving
-- Idempotent-ish: deletes any prior demo hospital first.

delete from hospitals where is_demo;

with h as (
  insert into hospitals (name, is_demo, nurses_per_unit, replacement_cost)
  values ('Riverbend Medical Center (Demo)', true, 32, 55000)
  returning id
),
u as (
  insert into units (hospital_id, name, join_code, bed_count)
  select h.id, v.name, v.code, v.beds
  from h, (values
    ('ICU',      'demo-icu',  20),
    ('4-West',   'demo-4w',   28),
    ('ED',       'demo-ed',   40),
    ('3-North',  'demo-3n',   26),
    ('Telemetry','demo-tele', 30),
    ('Peds',     'demo-peds', 18)
  ) as v(name, code, beds)
  returning id, join_code
),
mgr_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
         'authenticated', 'demo-manager@pulse.test', crypt('pulse-demo-2026', gen_salt('bf')),
         now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  where not exists (select 1 from auth.users where email = 'demo-manager@pulse.test')
  returning id
),
mgr_ident as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text,
         jsonb_build_object('sub', id::text, 'email', 'demo-manager@pulse.test', 'email_verified', true),
         'email', now(), now(), now()
  from mgr_user returning user_id
),
mgr as (
  insert into managers (user_id, hospital_id, full_name)
  select coalesce(
           (select id from mgr_user),
           (select id from auth.users where email = 'demo-manager@pulse.test')
         ), h.id, 'Jordan Demo, RN'
  from h
  returning user_id
),
mgr_links as (
  insert into manager_units (manager_id, unit_id)
  select mgr.user_id, u.id from mgr, u
  returning unit_id
),
params as (
  select u.id as unit_id, u.join_code,
    case u.join_code
      when 'demo-icu'  then 4.2 when 'demo-4w' then 3.6 when 'demo-ed' then 3.4
      when 'demo-3n'   then 4.1 when 'demo-tele' then 3.2 else 3.3 end as e0,
    case u.join_code
      when 'demo-icu'  then -0.14 when 'demo-4w' then -0.20 when 'demo-ed' then -0.02
      when 'demo-3n'   then 0.0   when 'demo-tele' then 0.0 else 0.05 end as eslope,
    case u.join_code
      when 'demo-icu'  then 0.92 when 'demo-4w' then 0.85 when 'demo-ed' then 0.7
      when 'demo-3n'   then 0.9  when 'demo-tele' then 0.65 else 0.75 end as b0,
    case u.join_code
      when 'demo-icu'  then -0.035 when 'demo-4w' then -0.04 when 'demo-ed' then -0.005
      else 0.0 end as bslope
  from u
)
insert into pulse_responses (unit_id, shift_type, workload, support, energy,
                             got_break, was_floated, comment, is_new_grad, created_at)
select
  p.unit_id,
  case when random() < 0.5 then 'day' else 'night' end,
  least(5, greatest(1, round(6.4 - (p.e0 + p.eslope * t.eff_wk) + (random() - 0.5) * 1.6)))::smallint,
  least(5, greatest(1, round(
    (p.e0 + p.eslope * t.eff_wk)
    - case when p.join_code = 'demo-ed' and (random() < 0.35) then 1.4 else 0 end
    + (random() - 0.5) * 1.4)))::smallint,
  least(5, greatest(1, round((p.e0 + p.eslope * t.eff_wk) + (random() - 0.5) * 1.4)))::smallint,
  random() < greatest(0.15, p.b0 + p.bslope * t.eff_wk),
  random() < 0.08,
  case when random() < 0.18 then (array[
    'Short two RNs on nights again',
    'No break all shift',
    'Charge was drowning, no resource nurse',
    'Floated without warning',
    'Good teamwork today, felt supported',
    'Vents short on the floor',
    'New admit surge at 0300'
  ])[ceil(random() * 7)] else null end,
  case when p.join_code = 'demo-ed' then random() < 0.4 else random() < 0.12 end,
  now() - make_interval(weeks => 16 - t.wk) + make_interval(hours => (random() * 110)::int)
from params p
cross join lateral (
  -- 4-West recovers after week 8 (the posted action): its effective week
  -- reverses direction; everyone else trends linearly.
  select wk,
    case when p.join_code = 'demo-4w' and wk > 8 then 8 - (wk - 8) * 1.6 else wk end as eff_wk
  from generate_series(1, 16) wk
) t
cross join generate_series(1, 10 + (random() * 5)::int) resp;

-- The 4-West turnaround action, posted ~8 weeks ago, with strong helped votes.
with a as (
  insert into actions (unit_id, manager_id, text, created_at)
  select u.id,
         (select user_id from managers m join auth.users au on au.id = m.user_id
          where au.email = 'demo-manager@pulse.test'),
         'Added weekend float coverage + protected breaks on nights',
         now() - interval '8 weeks'
  from units u where u.join_code = 'demo-4w'
  returning id
)
insert into action_feedback (action_id, helped, created_at)
select a.id, random() < 0.82, now() - interval '7 weeks' + make_interval(days => (random() * 40)::int)
from a, generate_series(1, 17);
