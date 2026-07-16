# Scheduling the Monday digest

The `weekly-digest` edge function is deployed but not yet scheduled (creating
a persistent cron job on the live project requires the owner's approval).

Run this once in the Supabase SQL editor to send digests every Monday 07:00 UTC:

```sql
select cron.schedule(
  'weekly-digest-monday',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://vondstzlkfqdribzykqb.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_LEGACY_JWT>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `<ANON_LEGACY_JWT>` with the project's legacy anon key (Dashboard →
Settings → API). The function requires a valid JWT (`verify_jwt: true`); the
anon key satisfies it. pg_cron and pg_net are already enabled by migration
0003.

Emails send via Resend when the `RESEND_API_KEY` secret is set on the
function (Dashboard → Edge Functions → weekly-digest → Secrets, optional
`DIGEST_FROM`). Without it, digests are logged to the function logs instead
of sent — useful for testing.

To unschedule: `select cron.unschedule('weekly-digest-monday');`
