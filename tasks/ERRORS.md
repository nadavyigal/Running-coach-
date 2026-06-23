# RunSmart — Failed Approaches Log

Read this before proposing any fix in RunSmart. Never propose an approach already logged here.

## Format
```
## YYYY-MM-DD — [Issue description]
**Tried:** [What was attempted and why it failed]
**Worked:** [What finally resolved it — fill in when resolved]
**Next time:** [Key insight to carry forward]
```

---

## 2026-06-23 — body_battery always NULL in garmin_daily_metrics_deduped
**Project:** RunSmart
**Tried:** Read-first investigation into raw `garmin_webhook_events.raw_payload`.
**Worked:** Confirmed root cause and fixed in PR #101. Garmin sends absolute body-battery
  level only as a time series under `stressDetails[].timeOffsetBodyBatteryValues`
  (format `{offsetSeconds: value}`), not as a single daily field — `dailies` only carries
  `bodyBatteryChargedValue`/`bodyBatteryDrainedValue`. Added
  `extractBodyBatteryDailySummary()` in `v0/lib/garmin/bodyBatteryTimeSeries.ts` to derive
  start/peak/end from that time series, wired it into `buildDailyMetricsRows()` in
  `v0/lib/server/garmin-analytics-store.ts`, added `body_battery_start/peak/end` columns,
  and backfilled 81 existing rows via migration.
**Next time:** If a Garmin metric is silently NULL despite a connected, syncing account,
  check the raw webhook payload before assuming a scope/entitlement gap — Garmin often
  nests the real value in a time-series sub-object rather than as a flat daily field.

---
