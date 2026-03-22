-- Add new health metric columns to garmin_daily_metrics
-- These support additional Garmin Health API datasets: pulseox, allDayRespiration, skinTemp, bloodPressures

ALTER TABLE garmin_daily_metrics
  ADD COLUMN IF NOT EXISTS spo2 real,
  ADD COLUMN IF NOT EXISTS respiration_rate real,
  ADD COLUMN IF NOT EXISTS skin_temp_c real,
  ADD COLUMN IF NOT EXISTS blood_pressure_systolic integer,
  ADD COLUMN IF NOT EXISTS blood_pressure_diastolic integer;
