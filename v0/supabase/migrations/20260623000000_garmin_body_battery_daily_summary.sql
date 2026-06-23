-- Store beginning, peak, and end-of-day Body Battery from stressDetails time series.

ALTER TABLE public.garmin_daily_metrics
  ADD COLUMN IF NOT EXISTS body_battery_start integer NULL,
  ADD COLUMN IF NOT EXISTS body_battery_peak integer NULL,
  ADD COLUMN IF NOT EXISTS body_battery_end integer NULL;
