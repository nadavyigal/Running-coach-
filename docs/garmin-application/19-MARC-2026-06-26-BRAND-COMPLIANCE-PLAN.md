# Plan: Full Garmin Brand Compliance (Marc Lussi, 2026-06-26 rejection)

> Run via `superpowers:brainstorming` / `superpowers:writing-plans` then
> `superpowers:test-driven-development` before touching code. This plan spans both repos
> (iOS app + web/Supabase) and is 6+ files — flag scope to the founder before starting
> per the standing >3-file rule. Do NOT send `17-GARMIN-REPLY-DRAFT-2026-06-25.md` until
> this plan ships and is reverified on device — Marc just rejected the screenshots that
> reply references again.

## Marc's exact feedback (2026-06-26, ticket 213145/213165)

> Still not brand compliant on any screen.
> For 01-03; please add Garmin square logo instead of the connection icon.
> 04-06: Please review provided examples and bullet point of the requirement list

## Root cause (verified directly against code + live production data, not assumed)

### Screens 01-03 — Garmin Connect connection screen
`SecondaryFlowView.swift:329-341` (`FlowHeader.headerMark`) renders an **SF Symbol**
(`Image(systemName: destination.symbol)` — `"link.circle.fill"` / `"waveform.path.ecg"`)
inside a generic rounded tile. This is the "connection icon" Marc is rejecting. A code
comment at lines 314-317 already anticipated this: *"Replace with the official Garmin
Connect tile (Image("GarminConnectTile")) once it is added to the asset catalog."*
**No such asset exists anywhere in either repo** — confirmed via exhaustive search of
both `Assets.xcassets` trees and all `*.png/*.svg/*.pdf` files for "garmin", "logo",
"tile", "GarminConnect". The brand guideline's AUTHENTICATING APPLICATIONS rule is
explicit: *"use the full app name and tile to display the connection. Do not
abbreviate, truncate or stylize the Garmin app name."* We have neither the tile asset
nor (per the rule) license to fake one with an SF Symbol substitute.

### Screens 04-06 — Activity feed / Recovery dashboard / Garmin Wellness
All three show the bare word `"Garmin"` with no device model:
- `ActivityRow.swift:62-65` — `"\(date) · \(run.source.rawValue)"` → `"Garmin"`
- `RecoveryDashboardView.swift:32` — `Text("Garmin")`
- `GarminWellnessViews.swift:18` — `Text("Garmin")`

All three have a code comment admitting the same thing: *"Device model is not yet
surfaced... we fall back to 'Garmin'."* The brand guideline's TITLE-LEVEL / PRIMARY
DISPLAYS rule requires **"Garmin [device model]"** specifically — not bare "Garmin".
The reference examples Garmin sent (Hashiri.AI, NeverDone) confirm this literally:
every screenshot shows `"Garmin Forerunner 265S"` / `"Garmin Forerunner 570"` in the
date/metadata line of activity cards and feed entries — never bare "Garmin". Our
attribution *placement* is already correct (above the fold, directly under/adjacent to
the heading, not buried in a tooltip) — only the *text content* is non-compliant.

**Data check (direct Supabase query against live `garmin_webhook_events.raw_payload`,
2026-06-26):**
- `activities[]` entries DO carry `"deviceName": "Garmin Forerunner 265"` per record.
- `dailies[]`, `stressDetails[]`, and `epochs[]` entries — which feed Recovery
  dashboard and Garmin Wellness — carry **no device field at all**. This is a real
  Garmin API limitation, not a parsing gap: device identity is only ever reported on
  activity recordings, never on daily wellness/stress summaries.
- Conclusion: device name must be captured once per user (from their most recent
  activity sync) and reused for wellness/recovery attribution, since those payloads
  have no per-record device info to pull from.

## Step 1 — Screens 01-03: obtain and wire the official Garmin Connect tile

1. **Get the actual asset before writing any code.** Two paths, pick the faster one:
   - Ask Elena/Marc directly for the official square logo file in the next reply — they
     are already engaged on this exact rejection and may just send it (fastest, zero
     ambiguity about which asset is "correct").
   - Self-serve from Garmin's brand asset kit (`creative.garmin.com/styleguide/brand/`,
     referenced in earlier session notes) — requires founder login/access.
   Do not substitute a hand-drawn or SF Symbol approximation; the rule explicitly bars
   "stylized" representations.
2. Add the asset to `Assets.xcassets` as `GarminConnectTile` (matching the existing code
   comment's expected name).
3. Wire it into `FlowHeader.headerMark` in `SecondaryFlowView.swift` for the
   `.connectedService` (Garmin Connect) and `.garminWellness` destinations — replace the
   `Image(systemName:)` branch with `Image("GarminConnectTile")` for these cases only
   (other non-Garmin destinations keep their current icon).
4. Confirm the adjacent text label still reads the full, unabbreviated "Garmin Connect"
   (already true per current code — verify it wasn't accidentally shortened anywhere).

## Step 2 — Screens 04-06: thread real device-model attribution through the pipeline

### Web repo (`/Users/nadavyigal/Documents/RunSmart`)
1. **Migration**: add `device_name text` to `garmin_activities` (per-activity, already
   has the source data) and `device_name text` to `garmin_connections` (per-user,
   "most recently seen device" — this is what Recovery/Wellness will read since their
   own payloads have no device field).
2. **Ingestion**: in the activity-webhook ingestion path (`v0/lib/server/garmin-analytics-store.ts`
   or equivalent — confirm exact function during implementation), parse `deviceName`
   from each incoming `activities[]` entry, write it to `garmin_activities.device_name`,
   and upsert the same value onto `garmin_connections.device_name` for that user (last
   write wins — a user typically wears one device, so this is an honest, defensible
   simplification, not a fabrication).
3. Confirm whatever endpoint the iOS app already calls for Garmin connection status
   (used for "Connected"/"Disconnected" state) can also return `device_name` — extend
   its response shape rather than adding a new endpoint if possible.

### iOS repo
1. Add `deviceName: String?` to `DBGarminActivity` and to the connection-status DTO.
2. `ActivityRow.swift` — change the fallback from bare `"Garmin"` to
   `"Garmin \(deviceName)"` when present, falling back to bare `"Garmin"` only if the
   user has never had a device name recorded (e.g. before their first activity sync).
3. `RecoveryDashboardView.swift` / `GarminWellnessViews.swift` — same substitution,
   sourcing `deviceName` from the connection-status fetch (not from the daily/stress
   data itself, since that never carries it).
4. Keep the existing "Insights derived in part from Garmin device-sourced data." footer
   on Recovery dashboard as-is — this already matches Garmin's COMBINED OR DERIVED DATA
   rule and the reference examples (the Hashiri.AI AI Coach screenshot uses near-identical
   wording). Don't touch it.

## Step 3 — Recapture, re-verify, re-zip, reply

1. Build and run on a real device (founder-only step, per the standing rule that the
   live App Store build must match submitted evidence before any Garmin reply goes out).
2. Recapture all 6 Gate-4 screenshots. For each, manually re-check against the brand PDF
   bullet list one more time before re-zipping — don't assume the code change alone is
   sufficient without a visual check.
3. Re-zip as `runsmart-garmin-screenshots-ios-2026-06-26-v2.zip` (or whatever date is
   current at execution time).
4. Replace/update `17-GARMIN-REPLY-DRAFT-2026-06-25.md` — it currently doesn't address
   Marc's 2026-06-26 rejection at all. The new reply should explicitly name what changed
   for each flagged item: "01-03: replaced the connection icon with the official Garmin
   Connect tile" and "04-06: added the specific Garmin device model (e.g. 'Garmin
   Forerunner 265') to the attribution, not just 'Garmin'." Keep the existing Training
   API guidance-request and Gate-2 coverage notes from that draft — those weren't part
   of Marc's rejection.

## Out of scope for this plan

- The Training API scope question and USER_DEREG coverage gap (already handled in the
  existing reply draft and `GARMIN-STATUS.md` — unaffected by this rejection).
- Any new screenshot content beyond what's already captured (no new screens needed,
  just brand-compliance fixes to the existing 6).

## Done when

All 6 screenshots show: (01-03) the actual Garmin Connect square logo/tile instead of an
SF Symbol icon; (04-06) "Garmin [actual device model]" attribution instead of bare
"Garmin". Verified on a real device against the brand PDF and the Hashiri.AI/NeverDone
reference examples before recapturing. Reply sent only after re-verification.
