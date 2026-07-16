# Pulse

Per-shift early-warning system for hospital nurse burnout. Nurses scan a QR code and do an
anonymous 30-second check-in — no login, no app install, no name ever. Managers get a
plain-language "unit weather forecast" instead of charts.

## Stack

- Next.js App Router + TypeScript + Tailwind (v4), PWA (manifest + service worker)
- Supabase: Postgres + RLS, email auth (managers/execs/admins only), edge functions
- Supabase project ref: `vondstzlkfqdribzykqb` (https://vondstzlkfqdribzykqb.supabase.co)
- Vitest for unit tests (forecast rules engine, k-anonymity)

## Routes

- `/p/[unitCode]` — staff check-in. Public, no auth, mobile-first, dark mode default.
- `/dashboard` — managers (auth). See only their own units.
- `/exec` — executives (auth). See all units in their hospital.
- `/admin` — setup (auth). Units, QR posters.
- `/trust` — public plain-English privacy promise.
- `/demo` — demo world with seeded data (sales tool).

## Hard rules — never violate these

1. **Zero user identifiers on staff responses.** No user id, session id, device id, IP,
   or fingerprint is ever written to the server with a `pulse_responses` row.
2. **Aggregates only shown when a group has 5+ responses — enforced in queries/views at
   the database level, not in UI code.** Any unit-week, shift-type, or cohort slice with
   fewer than 5 responses returns NULL.
3. **No PHI or patient data anywhere, ever.** Pulse is about staff, never patients.
4. **Mobile-first; dark mode is the default for staff screens** (night shift is the user).
5. **The staff flow must work offline** (IndexedDB queue + retry) **and complete in under
   30 seconds.** LCP target under 1s. No JS on the check-in path that it doesn't need.

## Design language

- Staff: full-bleed one-question-per-screen, thumb-zone controls, 17px+ text, spring
  animations as tap feedback only (200–300ms). Answer swatches run deep teal (good) →
  warm amber (strained). **Never red.**
- Manager/exec: glass-material cards (backdrop-blur) over ambient strain gradients
  (clear/calm → gathering grey → storm). Plain-language headlines first; charts only on
  tap-through. Restraint over decoration.

## Conventions

- Forecast rules engine lives in `lib/forecast/` as pure, unit-tested functions.
- k-anonymity is enforced by Postgres views/functions in migrations; tests in
  `tests/k-anonymity` try to defeat it and must fail.
- Personal nurse history (shift receipt stats) lives in localStorage/IndexedDB only —
  it never touches the server.
- Run `npm run test` and `npm run build` before committing.
