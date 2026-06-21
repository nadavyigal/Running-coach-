-- Restrict execute privileges on Garmin import-worker RPCs.
--
-- claim_garmin_import_jobs / requeue_garmin_import_job / fail_garmin_import_job
-- are SECURITY DEFINER functions that mutate public.garmin_import_jobs and bypass
-- RLS. The worker invokes them only with the service_role key
-- (see v0/lib/integrations/garmin/service.ts -> createAdminClient()).
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which leaves
-- anon and authenticated able to claim, requeue, or fail other users' import
-- jobs. Lock execution down to service_role only. This mirrors the web-repo
-- table grants (tables are already revoked from anon/authenticated) and the
-- equivalent lockdown applied in the RunSmart iOS repo context.
--
-- REVOKE/GRANT are idempotent, so this migration is safe to re-run.

revoke execute on function public.claim_garmin_import_jobs(integer, text) from public, anon, authenticated;
revoke execute on function public.requeue_garmin_import_job(uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.fail_garmin_import_job(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.claim_garmin_import_jobs(integer, text) to service_role;
grant execute on function public.requeue_garmin_import_job(uuid, timestamptz, text) to service_role;
grant execute on function public.fail_garmin_import_job(uuid, text, boolean) to service_role;
