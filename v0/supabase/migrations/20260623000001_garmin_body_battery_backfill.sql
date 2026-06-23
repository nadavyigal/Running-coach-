-- Backfill body_battery_start/peak/end and legacy body_battery from stressDetails time series.

CREATE OR REPLACE FUNCTION public.garmin_extract_body_battery_summary(bb_map jsonb)
RETURNS TABLE(body_battery_start integer, body_battery_peak integer, body_battery_end integer)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH pairs AS (
    SELECT
      (entry.key)::integer AS offset_seconds,
      LEAST(
        100,
        GREATEST(0, ROUND((entry.value)::numeric))
      )::integer AS val
    FROM jsonb_each_text(bb_map) AS entry(key, value)
    WHERE entry.key ~ '^\d+$'
      AND entry.value ~ '^-?\d+(\.\d+)?$'
  ),
  ordered AS (
    SELECT val, offset_seconds
    FROM pairs
    ORDER BY offset_seconds ASC
  )
  SELECT
    (SELECT val FROM ordered ORDER BY offset_seconds ASC LIMIT 1),
    (SELECT MAX(val) FROM ordered),
    (SELECT val FROM ordered ORDER BY offset_seconds DESC LIMIT 1)
  WHERE EXISTS (SELECT 1 FROM ordered);
$$;

WITH source AS (
  SELECT
    g.id,
    (
      SELECT elem -> 'timeOffsetBodyBatteryValues'
      FROM jsonb_array_elements(COALESCE(g.raw_json -> 'stressDetails', '[]'::jsonb)) AS elem
      WHERE jsonb_typeof(elem -> 'timeOffsetBodyBatteryValues') = 'object'
        AND elem -> 'timeOffsetBodyBatteryValues' <> '{}'::jsonb
      LIMIT 1
    ) AS bb_map
  FROM public.garmin_daily_metrics AS g
  WHERE g.body_battery_start IS NULL
     OR g.body_battery_peak IS NULL
     OR g.body_battery_end IS NULL
     OR g.body_battery IS NULL
),
computed AS (
  SELECT
    s.id,
    x.body_battery_start,
    x.body_battery_peak,
    x.body_battery_end
  FROM source AS s
  CROSS JOIN LATERAL public.garmin_extract_body_battery_summary(s.bb_map) AS x
  WHERE s.bb_map IS NOT NULL
)
UPDATE public.garmin_daily_metrics AS g
SET
  body_battery_start = COALESCE(g.body_battery_start, c.body_battery_start),
  body_battery_peak = COALESCE(g.body_battery_peak, c.body_battery_peak),
  body_battery_end = COALESCE(g.body_battery_end, c.body_battery_end),
  body_battery = COALESCE(g.body_battery, c.body_battery_end),
  updated_at = NOW()
FROM computed AS c
WHERE g.id = c.id;

DROP FUNCTION IF EXISTS public.garmin_extract_body_battery_summary(jsonb);
