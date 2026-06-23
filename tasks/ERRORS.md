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
**Tried:** N/A — read-first investigation, no fix attempted
**Worked:** N/A — root cause confirmed, fix proposed but not applied per prompt constraint
**Next time:** When Garmin body battery is missing from the deduped table, check
  `stressDetails[].timeOffsetBodyBatteryValues` in the raw webhook payload first.
  This device sends `bodyBatteryChargedValue`/`bodyBatteryDrainedValue` in `dailies`
  but the absolute body-battery level only arrives as a time series in `stressDetails`
  (key `timeOffsetBodyBatteryValues`, format `{offsetSeconds: value}`).
  Fix site: `buildDailyMetricsRows()` in `v0/lib/server/garmin-analytics-store.ts`
  lines ~291-302 — add extraction of the last entry from `timeOffsetBodyBatteryValues`
  as `metric.bodyBattery`. `normalizeDaily.ts` / `upsert.ts` is a secondary path and
  also lacks this field but is not the active write path for this account.

---
