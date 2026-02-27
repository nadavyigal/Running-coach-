-- Garmin body battery balance support.
-- Adds charged/drained/balance columns and backfills from existing dailies raw_json payloads.

alter table if exists public.garmin_daily_metrics
  add column if not exists body_battery_charged numeric null,
  add column if not exists body_battery_drained numeric null,
  add column if not exists body_battery_balance numeric null;

with parsed as (
  select
    g.id,
    case
      when (entry.value->>'bodyBatteryChargedValue') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (entry.value->>'bodyBatteryChargedValue')::numeric
      else null
    end as charged,
    case
      when (entry.value->>'bodyBatteryDrainedValue') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (entry.value->>'bodyBatteryDrainedValue')::numeric
      else null
    end as drained,
    row_number() over (
      partition by g.id
      order by
        case
          when (entry.value->>'startTimeInSeconds') ~ '^[0-9]+$'
          then (entry.value->>'startTimeInSeconds')::bigint
          else null
        end desc nulls last
    ) as rank
  from public.garmin_daily_metrics g
  join lateral jsonb_array_elements(coalesce(g.raw_json->'dailies', '[]'::jsonb)) as entry(value) on true
  where
    entry.value ? 'bodyBatteryChargedValue'
    or entry.value ? 'bodyBatteryDrainedValue'
),
latest as (
  select id, charged, drained
  from parsed
  where rank = 1
)
update public.garmin_daily_metrics g
set
  body_battery_charged = coalesce(g.body_battery_charged, latest.charged),
  body_battery_drained = coalesce(g.body_battery_drained, latest.drained),
  body_battery_balance = coalesce(
    g.body_battery_balance,
    case
      when latest.charged is not null and latest.drained is not null
      then latest.charged - latest.drained
      else null
    end
  )
from latest
where g.id = latest.id;
