-- Coach Experience v2, story C7.5: the four insert triggers that call coach_notify.
-- Batch B ops. Replaces the four Dashboard Database Webhooks in
-- docs/coach-v2-batch-b-runbook.md section 4, so the shared secret never sits in a
-- webhook's header settings.
--
-- Applied to production on 2026-11-26 by the overseer session on the founder's
-- explicit yes ("Yes, set up push"). Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/.
--
-- What this file creates:
--   coach_notify_webhook()   trigger function. On each new row it posts
--                            { type: 'INSERT', table, schema, record: { id } } to
--                            coach_notify with the header x-coach-notify-secret.
--                            coach_notify reads the row again by id with the
--                            service role, so the body is only a pointer.
--   Four AFTER INSERT ... FOR EACH ROW triggers on runs, athlete_run_flags,
--   coach_feedback and coach_feedback_replies. Insert only: an upsert that updates
--   a run must not push again.
--
-- Configuration lives in Vault, never in this file:
--   coach_notify_url      the coach_notify endpoint of this project.
--   coach_notify_secret   the same value as the COACH_NOTIFY_SECRET function secret.
-- While either is missing the trigger sends nothing.
--
-- The call is pg_net's asynchronous queue, and any error is swallowed: a push
-- problem never blocks a run upload, a flag, a note or a reply.
--
-- Off switch without touching this file: runtime_flags.coach_v2_push = false
-- (coach_notify then sends nothing and keeps held rows). Removal:
-- supabase/rollback/20261126110000_coach_notify_triggers.sql.
--
-- Idempotent: the function is create or replace; each trigger is dropped if it
-- exists and created again.

create or replace function public.coach_notify_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select ds.decrypted_secret into v_url
  from vault.decrypted_secrets ds
  where ds.name = 'coach_notify_url';

  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'coach_notify_secret';

  if v_url is null or v_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-coach-notify-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', jsonb_build_object('id', new.id)
    ),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.coach_notify_webhook() from public, anon, authenticated;

drop trigger if exists coach_notify_runs on public.runs;
create trigger coach_notify_runs
  after insert on public.runs
  for each row execute function public.coach_notify_webhook();

drop trigger if exists coach_notify_flags on public.athlete_run_flags;
create trigger coach_notify_flags
  after insert on public.athlete_run_flags
  for each row execute function public.coach_notify_webhook();

drop trigger if exists coach_notify_notes on public.coach_feedback;
create trigger coach_notify_notes
  after insert on public.coach_feedback
  for each row execute function public.coach_notify_webhook();

drop trigger if exists coach_notify_replies on public.coach_feedback_replies;
create trigger coach_notify_replies
  after insert on public.coach_feedback_replies
  for each row execute function public.coach_notify_webhook();
