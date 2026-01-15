# Garmin Connect Integration Scope (Minimal Request)

CRITICAL: Do not invent facts. Replace any `[[FILL: ...]]` placeholders before submission.

We are applying only for Garmin access needed to import completed running activities into RunSmart.

---

## What We Want

"User connects Garmin -> completed run activities sync into RunSmart."

## What We Will Import (minimal)

MVP fields:
- Activity ID, start time (timestamps), activity type (running)
- Distance, duration, pace/speed
- Calories (if available)
- Elevation gain (if available)
- Heart rate summary (avg/max) (if available)

Optional (only when supported and justified for coaching features):
- GPS track/route
- Cadence/power/running dynamics

## What We Will NOT Do

- No password collection (OAuth only)
- No scraping of Garmin Connect web pages
- No selling/reselling Garmin user data
- No ad-targeting based on Garmin data
- No requesting unrelated APIs/scopes beyond activity import

## Timing / Frequency

Initial sync:
- Import recent completed activities after a user first connects.
- Initial import window: [[FILL: e.g., last 30 days OR last 50 activities]].

Ongoing sync:
- User-triggered manual sync and/or periodic sync when the app is active.
- Background sync frequency: [[FILL: desired sync cadence (e.g., hourly/daily)]].

## Backfill Behavior

- Default behavior: import new activities after connection; limited initial backfill as above.
- Full-history backfill: [[FILL: whether you support it; if not, say "not supported"]].

## Data Storage & User Control

- Tokens stored securely (encrypted) and used only to retrieve activities for the connected user.
- User can disconnect Garmin at any time; on disconnect, tokens are deleted/revoked.
- User can request deletion of imported Garmin activities. [[FILL: deletion flow + SLA]].
