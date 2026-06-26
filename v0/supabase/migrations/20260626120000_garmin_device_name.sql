-- Garmin only reports device identity on activity records (e.g. "Garmin Forerunner 265"),
-- never on daily/wellness/stress summary payloads. Cache the most recently seen device name
-- on garmin_connections so Recovery dashboard and Garmin Wellness can attribute to a specific
-- device model, not just the bare word "Garmin" (required by Garmin API Brand Guidelines
-- v6.30.2025, Title-Level/Primary Displays section).
alter table public.garmin_activities add column if not exists device_name text;
alter table public.garmin_connections add column if not exists device_name text;
