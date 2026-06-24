# Work Packet: Wire Up a Real Entry Point for Garmin Wellness

> Run this in a new session inside the iOS repo:
> `/Users/nadavyigal/Documents/Projects /IOS RunSmart light /IOS RunSmart app`
>
> One story, small diff, lint+build+test before declaring done. Follow this repo's existing
> patterns exactly — don't introduce new navigation abstractions.

## Why this exists

The Garmin Developer Production resubmission evidence package includes a screenshot
(`06-garmin-wellness.png`) of a "Garmin Wellness" screen (Body Battery, attribution footer
"Insights derived in part from Garmin device-sourced data."). That screen is implemented in
`SecondaryFlowView.swift` as `SecondaryDestination.garminWellness`, but **nothing in the live app
navigates to it**. The only call site that ever resolves to `.garminWellness` is
`RunSmartGate4ScreenshotMode.swift`, a DEBUG-only launch-argument harness built solely to capture
that one screenshot. A real user running the shipped app has no way to reach this screen.

This was discovered during the 2026-06-24 device-verification pass for the Gate-4 brand
resubmission (see `docs/garmin-application/13-GATE-4-v1.0.4-build17-VERIFICATION-FINDINGS.md` and
`GARMIN-STATUS.md`). Founder decision: wire up a real entry point rather than ship a screenshot of
an unreachable screen.

## What to build

Add a tile to the Profile screen's "Connected" section that opens `.garminWellness`, following the
exact existing pattern used for Garmin Connect and HealthKit on the same screen.

**File:** `IOS RunSmart app/Features/Profile/ProfileTabView.swift`

Current code (around line 305-315), the `connectedSection` computed property:

```swift
private var connectedSection: some View {
    RunSmartPanel(cornerRadius: 20, padding: 14) {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(title: "Connected")
            VStack(spacing: 8) {
                ConnectedServiceTile(title: "Garmin", detail: "Garmin Connect", status: statusLabel("Garmin Connect"), symbol: "link.circle.fill", tint: .accentPrimary) {
                    open(.connectedService("Garmin Connect"))
                }
                ConnectedServiceTile(title: "HealthKit", detail: "HealthKit read/write", status: statusLabel("HealthKit"), symbol: "heart.fill", tint: .accentHeart) {
                    open(.connectedService("HealthKit"))
                }
                ConnectedServiceTile(title: "Prefs", detail: "Reminders", status: ..., symbol: "bell.fill", tint: .accentRecovery) {
                    open(.reminders)
                }
                ConnectedServiceTile(title: "Account", detail: "Privacy", status: "Manage", symbol: "lock.shield.fill", tint: .textSecondary) {
                    open(.account)
                }
            }
        }
    }
}
```

`open(_:)` is a one-line helper a few lines above: `private func open(_ destination: SecondaryDestination) { navPath.append(destination) }`. This is the same navigation mechanism every other tile on this screen already uses — `.garminWellness` is already a valid case of `SecondaryDestination` (defined in `IOS RunSmart app/Features/Secondary/SecondaryFlowView.swift`), so no new navigation plumbing is needed, just a new tile that calls `open(.garminWellness)`.

**Add one new `ConnectedServiceTile`** to that `VStack`, after the Garmin tile (so it reads as a
related, secondary entry under the primary Garmin Connect tile — don't put it before Garmin
Connect, since Wellness is meaningless without an active connection):

```swift
ConnectedServiceTile(title: "Garmin Wellness", detail: "Body Battery & insights", status: statusLabel("Garmin Connect") == "Connected" ? "View" : "Connect Garmin first", symbol: "waveform.path.ecg", tint: .accentRecovery) {
    open(.garminWellness)
}
```

Notes on the exact values (already verified against the current code, no further checking needed):
- `symbol: "waveform.path.ecg"` — confirmed this is the exact SF Symbol `SecondaryFlowView.swift`
  already uses for `.garminWellness` (`case .garminWellness: "waveform.path.ecg"`), so the tile's
  icon matches the destination's own icon.
- `tint: .accentRecovery` — matches the tint already used for Recovery-adjacent surfaces elsewhere
  in this file (see the "Prefs" tile above for an example of `.accentRecovery` usage in this exact
  section).
- The `status` ternary gates the visible label on whether Garmin is actually connected.
  `statusLabel(_:)` is defined a few lines below `connectedSection` as
  `deviceStatuses.first(where: { $0.provider == provider })?.state.rawValue.capitalized ?? "Disconnected"`
  — confirmed it returns the literal string `"Connected"` when `DeviceConnectionState` is
  `.connected`, so the ternary `statusLabel("Garmin Connect") == "Connected"` is correct as written.

## Scope boundaries — do NOT do these

- Do not change `SecondaryFlowView.swift`'s `.garminWellness` case itself (its copy, icon, or
  attribution logic) — that's already correct and already verified compliant in
  `13-GATE-4-v1.0.4-build17-VERIFICATION-FINDINGS.md`. This work packet is purely about adding a
  way to *reach* it, not changing what it shows.
- Do not touch `RunSmartGate4ScreenshotMode.swift` — it remains the screenshot-capture path; this
  new tile is a second, independent way to reach the same destination for real users.
- Do not add this tile to any other screen (Recovery, Today) — Profile's "Connected" section is the
  correct home since Garmin Wellness is conceptually a sub-feature of the Garmin connection, exactly
  parallel to how Garmin Connect's own tile lives there.

## Verification before declaring done

1. `xcodebuild -project "IOS RunSmart app.xcodeproj" -scheme "IOS RunSmart app" -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` — must succeed.
2. Run on simulator or device: Profile tab → Connected section → tap the new "Garmin Wellness" tile
   → confirm it opens the same screen previously only reachable via screenshot mode (neutral header
   icon, "Garmin" attribution, Body Battery data if connected).
3. If Garmin is NOT connected, confirm the tile still renders sensibly (doesn't crash, shows the
   "Connect Garmin first" status) rather than opening a broken/empty Wellness screen.
4. Update `docs/garmin-application/GARMIN-STATUS.md` and
   `docs/garmin-application/13-GATE-4-v1.0.4-build17-VERIFICATION-FINDINGS.md`: change the note
   about shot 06 from "screenshot-mode only" to confirm Garmin Wellness now has a real in-app entry
   point (Profile → Connected → Garmin Wellness tile), so the next person reading those docs doesn't
   have to rediscover this.
5. One story, one PR, normal review flow (CodeRabbit + GitGuardian checks) before merge.

## Out of scope (separate, already-tracked items — do not pull into this work packet)

- `garmin_connections.scopes` being an empty array (cosmetic Permissions-screen display bug).
- `garmin_activities` rows with `sport: "wheelchair_push_walk"` / `"unknown"` being excluded from
  the running feed.
- Gate 2's `GC_ACTIVITY_UPDATE` webhook coverage gap.

These are tracked separately (see Agentic OS task list / `tasks/ERRORS.md`) and are unrelated to
wiring up this entry point.
