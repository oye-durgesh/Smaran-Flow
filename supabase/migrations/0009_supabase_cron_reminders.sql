-- Optional minute-level due processing via Supabase Cron (pg_cron + pg_net).
-- Vercel Hobby cron is daily/hourly and must not be treated as a minute scheduler.
-- This file is intentionally a no-op so applying it does not change existing data.
-- Enable extensions and create the job in the Supabase dashboard:
--   1. Database → Extensions → enable pg_cron and pg_net
--   2. Vault / Edge secrets: CRON_SECRET, SMARAN_CRON_URL (https://<host>/api/cron/reminders)
--   3. SQL:
--      select cron.schedule(
--        'smaran-reminders-minute',
--        '* * * * *',
--        $$
--        select net.http_get(
--          url := current_setting('app.smaran_cron_url', true),
--          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.smaran_cron_secret', true))
--        );
--        $$
--      );
-- Inspect: select * from cron.job; select * from cron.job_run_details order by start_time desc limit 20;

select 1;
