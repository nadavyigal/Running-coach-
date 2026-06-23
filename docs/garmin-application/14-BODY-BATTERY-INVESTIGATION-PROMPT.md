# Investigation Prompt: Garmin Body Battery Never Populates

> Paste this whole file as your opening prompt in a new Cursor session, rooted at
> `/Users/nadavyigal/Documents/RunSmart`. This is a read-first investigation — do not change
> ingestion code until you've confirmed the root cause with real data.

## Context

RunSmart ingests Garmin daily wellness metrics (HRV, Body Battery, stress, sleep, steps) into the
Supabase table `garmin_daily_metrics_deduped` (project ref `dxqglotcyirxzyqaxqln`, project name
"Run-Smart"). The iOS app's Recovery dashboard and Today screen read from this table and show a
"Garmin" attribution whenever a metric has a value, per Garmin's brand compliance requirements.

**Confirmed via direct SQL query against `garmin_daily_metrics_deduped`:** for founder's account
(`nadav.yigal@gmail.com`), across all 14 rows from 2026-06-09 to 2026-06-22, `body_battery` is
**NULL in every single row**. This is not a sync-lag issue (HRV, by contrast, has gaps but also
real non-null values on most days in the same window) — Body Battery has *never once* been
populated for this account in two weeks of data.

This matters because the Garmin Wellness screenshot (shot 06) in the app's Garmin Developer
Production enablement submission is built around Body Battery — see
`docs/garmin-application/GARMIN-STATUS.md` and `docs/garmin-application/12-MARC-2026-06-22-REJECTION-REMEDIATION-PLAN.md`
for the full submission context. If Garmin's reviewer connects a real account and tests the app,
an always-empty Body Battery tile would undermine the submission regardless of brand-compliance
fixes already shipped.

## What to investigate

1. **Check the raw Garmin payload first, before touching any code.** There is a
   `garmin_webhook_events` table (columns: `id`, `delivery_key`, `event_type`, `provider_user_id`,
   `raw_payload` jsonb, `received_at`, `processed_at`, `status`, `error_message`,
   `attempt_count`). Query recent rows for this user's `provider_user_id` (look it up via
   `garmin_connections` joined on `auth_user_id` for `nadav.yigal@gmail.com`) and inspect
   `raw_payload` directly:
   - Does the raw payload from Garmin ever contain `bodyBattery` / `bodyBatteryMostRecentValue` /
     `bodyBatteryValue` / `bodyBatteryValuesArray` at all, for any `event_type`?
   - **If the raw payload never contains a Body Battery field**, this is very likely not a code
     bug — Body Battery is a Garmin-proprietary metric (Firstbeat-based) that not all Garmin
     device models support. Confirm what Garmin device model this account is paired with
     (check `garmin_connections` or any device-model field captured at OAuth time) and look up
     whether that model supports Body Battery. If it doesn't, the fix is a product decision
     (drop Body Battery for unsupported devices, or pick a different screenshot for shot 06), not
     an ingestion fix.
   - **If the raw payload DOES contain a Body Battery field but `body_battery` is still null in
     `garmin_daily_metrics_deduped`**, the bug is in our mapping/ingestion pipeline. Trace forward
     from there (see file map below).

2. **If it's a mapping bug, the relevant files are:**
   - `v0/lib/garmin/normalize/normalizeDaily.ts` — normalizes raw Garmin daily payload into our
     schema; look at lines ~59-94 where `body_battery`, `body_battery_charged`,
     `body_battery_drained`, `body_battery_balance` are derived from
     `record.body_battery` / `record.bodyBattery` / `record.bodyBatteryMostRecentValue`.
   - `v0/lib/garminBodyBattery.ts` — a second, separate extraction path (lines ~70-110) that
     checks `row.body_battery`, then `record.bodyBattery`/`bodyBatteryMostRecentValue`/
     `bodyBatteryValue`, then falls back to scanning `bodyBatteryValues` /
     `bodyBatteryValuesArray` / `bodyBatterySamples` arrays. Confirm which of these two
     normalizers is actually in the write path that populates `garmin_daily_metrics_deduped`
     (they may overlap or one may be dead code — check call sites).
   - `v0/lib/garminWellnessExtractor.ts` — a third Body Battery extraction site (lines ~88-91+),
     also worth checking for which is canonical vs. legacy.
   - `v0/app/api/devices/garmin/webhook/[token]/route.ts` and
     `v0/app/api/cron/garmin-nightly/route.ts` — entry points that receive/process Garmin daily
     data and presumably call into one of the normalizers above before writing to
     `garmin_daily_metrics_deduped`.
   - `v0/lib/server/garmin-derive-worker.ts` and `v0/lib/server/garmin-analytics-store.ts` —
     check if there's a derive/backfill step between raw ingestion and the deduped table that
     could be dropping the field.

3. **Check Garmin API scope/entitlement.** RunSmart's Garmin developer account is currently on the
   **Evaluation tier** (see `GARMIN-STATUS.md`). Confirm whether Body Battery requires a specific
   Health API summary type subscription (e.g. a separate webhook summary type beyond Dailies) that
   may not be enabled for this account/tier. Check `docs/garmin-application/GARMIN-STATUS.md` Gate
   2 notes and the Garmin Developer Portal webhook subscription configuration (founder has portal
   access at `developerportal.garmin.com`; you cannot check this from code, flag it as a manual
   founder check if it becomes the leading hypothesis).

4. **Rule out three or more competing hypotheses before changing code**, per the project's
   systematic-debugging norm — don't patch the first plausible-looking line. The three most likely,
   roughly in order of likelihood:
   - (a) Device model doesn't support Body Battery (hardware/feature limitation — no code fix).
   - (b) Webhook summary type for Body Battery isn't subscribed in the Garmin Developer Portal
     (config issue — founder action, not code).
   - (c) Raw payload has the field, but mapping/normalization code drops it (real code bug — fix
     in `normalizeDaily.ts` or wherever the canonical write path is).

## Output expected

A short report: which hypothesis is confirmed by the raw payload evidence, the exact file/line if
it's a code bug (with a proposed minimal fix, not yet applied), or the exact manual action needed
if it's a device/portal config issue. Do not modify `garmin_daily_metrics_deduped` data or ingestion
code until this is confirmed — this table also feeds the Garmin Developer Production submission
evidence, so any speculative fix needs to be verified against real payload data first.
