-- Weekly log cleanup. Keeps the Garmin queue tables and pg_cron history small.
-- Only finished log rows are removed: no runs, activities, plans or account data.
--   garmin_import_jobs     success / failed, older than 30 days
--   garmin_webhook_events  processed / failed / ignored_duplicate, older than 30 days,
--                          and not linked to a job that is still kept
--   cron.job_run_details   older than 7 days

create or replace function public.cleanup_old_logs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jobs integer;
  v_events integer;
  v_cron integer;
begin
  delete from public.garmin_import_jobs
  where status in ('success', 'failed')
    and created_at < now() - interval '30 days';
  get diagnostics v_jobs = row_count;

  delete from public.garmin_webhook_events e
  where e.status in ('processed', 'failed', 'ignored_duplicate')
    and e.received_at < now() - interval '30 days'
    and not exists (
      select 1 from public.garmin_import_jobs j where j.webhook_event_id = e.id
    );
  get diagnostics v_events = row_count;

  delete from cron.job_run_details
  where end_time < now() - interval '7 days';
  get diagnostics v_cron = row_count;

  return jsonb_build_object(
    'garmin_import_jobs', v_jobs,
    'garmin_webhook_events', v_events,
    'cron_job_run_details', v_cron
  );
end;
$$;

-- Server-only. Signed-in and signed-out users cannot call it.
revoke all on function public.cleanup_old_logs() from public, anon, authenticated;

-- Every Sunday at 03:00 UTC. Re-running this migration replaces the schedule.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-log-cleanup') then
    perform cron.unschedule('weekly-log-cleanup');
  end if;
  perform cron.schedule('weekly-log-cleanup', '0 3 * * 0', 'select public.cleanup_old_logs();');
end;
$$;
