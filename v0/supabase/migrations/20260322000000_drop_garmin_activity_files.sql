-- Remove FIT file pipeline: drop garmin_activity_files table
-- FIT binary processing has been removed; sync now uses JSON-only data from Garmin Health API.

DROP TABLE IF EXISTS garmin_activity_files CASCADE;
