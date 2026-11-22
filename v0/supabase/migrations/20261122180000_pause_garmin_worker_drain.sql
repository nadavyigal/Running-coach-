-- FALLBACK ONLY. Apply this only if the founder chooses to pause the Garmin worker
-- instead of fixing the key (see docs/runbooks/2026-11-22-garmin-worker-500.md).
--
-- Why: cron job `garmin-worker-drain` (every 5 min, SELECT public.invoke_garmin_worker())
-- gets HTTP 500 from www.runsmart-ai.com: "Failed to claim Garmin import jobs:
-- Unregistered API key". Every call has failed since at least 2026-11-22 11:50 UTC.
--
-- Effect: stops the 5-minute calls. Queued Garmin imports will not drain until it is
-- scheduled again. Nothing else changes; the function and data stay.
--
-- Undo (re-schedule):
--   select cron.schedule('garmin-worker-drain', '*/5 * * * *', $$ SELECT public.invoke_garmin_worker(); $$);

do $$
begin
  if exists (select 1 from cron.job where jobname = 'garmin-worker-drain') then
    perform cron.unschedule('garmin-worker-drain');
  end if;
end
$$;
