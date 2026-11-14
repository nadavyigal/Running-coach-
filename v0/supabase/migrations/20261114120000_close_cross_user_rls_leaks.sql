-- Close cross-user data leaks before coach access (Story 1.1).
-- Safe to re-run: only DROP POLICY IF EXISTS statements. DROP POLICY IF EXISTS
-- still errors when the table itself is missing, so the web 007 tables (absent
-- in production) are dropped through a to_regclass guard.
--
-- WEB REPO: this must also be copied into the web migration tree
-- (Running-coach-/v0/supabase/migrations/). It drops policies created there
-- by 008_analytics_events.sql, 009_fix_analytics_rls.sql,
-- 007_rls_policies_authenticated.sql and 20260208134814_fix_rls_policies_v3.sql.
--
-- Not touched: owner-only policies (plans_owner_access, workouts_owner_access,
-- conversations_*_own, conversation_messages_*_own) and every service-role
-- policy, including the role-public ones that check auth.jwt() role.

-- analytics_events -----------------------------------------------------------
-- Drop the "any signed-in user reads every event" policies (009, and the 008
-- original whose check was only auth.uid() IS NOT NULL).
-- No owner SELECT replaces them: neither app reads its own events, and
-- analytics_events.user_id holds the legacy numeric local profile id, not
-- auth.uid(), so there is no column to scope an owner read on.
-- The web /admin/analytics dashboard (useFunnelData, useRealtimeEvents) and
-- GET /api/analytics/events read through the user's JWT and relied on the
-- broad read; after this they return no rows until they move to the service
-- role behind a server-side admin check.
-- INSERT policies (anon + authenticated, WITH CHECK true) are kept: they are
-- write-only, and restricting user_id to auth.uid() would break web event
-- logging, which writes the numeric profile id or null.
drop policy if exists "Authenticated users can view all events"
    on public.analytics_events;

drop policy if exists "Admin users can view all analytics events"
    on public.analytics_events;

-- idempotency_keys -----------------------------------------------------------
-- Service role only. No iOS or web client reads or writes this table; the only
-- caller is the delete_account Edge Function, which uses the service role.
drop policy if exists "Authenticated users can manage idempotency keys"
    on public.idempotency_keys;

-- plans, workouts, conversations, conversation_messages -----------------------
-- Old "any authenticated user" policies from web 20260208134814. Not present
-- in production as of 2026-11-14 (conversation ones were dropped by
-- 20260518133000); repeated here so every environment converges.
drop policy if exists "Authenticated users can manage plans"
    on public.plans;

drop policy if exists "Authenticated users can manage workouts"
    on public.workouts;

drop policy if exists "Authenticated users can manage conversations"
    on public.conversations;

drop policy if exists "Authenticated users can read messages"
    on public.conversation_messages;

drop policy if exists "Authenticated users can insert messages"
    on public.conversation_messages;

-- Web 007 admin read -----------------------------------------------------------
-- Dropped on purpose. These policies grant read on every row when
-- auth.users.raw_user_meta_data->>'role' = 'admin', and raw_user_meta_data is
-- writable by the user themself (supabase.auth.updateUser({ data })), so any
-- user could make themselves "admin". No iOS or web code depends on them (web
-- admin pages gate on ADMIN_EMAILS instead). None were live in production as of
-- 2026-11-14; dropped here so no environment keeps them.
do $$
declare
    admin_policy record;
begin
    for admin_policy in
        select * from (values
            ('runs', 'Admins can view all runs'),
            ('goals', 'Admins can view all goals'),
            ('shoes', 'Admins can view all shoes'),
            ('sleep_data', 'Admins can view all sleep data'),
            ('hrv_measurements', 'Admins can view all hrv measurements'),
            ('recovery_scores', 'Admins can view all recovery scores'),
            ('personal_records', 'Admins can view all personal records'),
            ('heart_rate_zones', 'Admins can view all heart rate zones')
        ) as p(table_name, policy_name)
    loop
        if to_regclass('public.' || admin_policy.table_name) is not null then
            execute format('drop policy if exists %I on public.%I',
                admin_policy.policy_name, admin_policy.table_name);
        end if;
    end loop;
end $$;
