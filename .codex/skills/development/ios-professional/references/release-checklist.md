# iOS Professional Release Checklist

Use this reference right before beta or production delivery.

## Build And Signing

- Confirm the shipping scheme is selected.
- Confirm Release configuration uses the intended signing settings.
- Confirm app and extension bundle identifiers match provisioning expectations.
- Confirm entitlements and capabilities are aligned across targets.
- Produce a clean archive successfully.

## Versioning

- Confirm marketing version and build number.
- Confirm changelog or release notes are ready.
- Confirm environment-specific flags are set for production.

## TestFlight Readiness

- Confirm test information is complete in App Store Connect when needed.
- Confirm the build was uploaded successfully.
- Confirm the build is assigned to the right internal or external groups.
- Confirm external testing needs are understood.

Apple's TestFlight help says you can invite up to 10,000 external testers per app. It also supports public invitation links, criteria by device or OS, and optional tester limits from 1 to 10,000.

## Upload Options

- Use Xcode when the team already ships manually through Xcode Organizer.
- Use fastlane when release automation is already established.
- Use `xcrun altool` or Transporter only when the operational workflow depends on them.

Apple's upload builds help says App Store Connect supports Xcode uploads and that upload for all target types is also supported for Transporter and `altool`.

## App Store Readiness

- Confirm metadata, screenshots, privacy details, and export compliance are current.
- Confirm review notes and contact information are accurate.
- Confirm rollout or release timing strategy.
- Confirm who owns post-release monitoring.

## Final Handoff

- Record the exact archive or lane used.
- Record the uploaded build number.
- Record who can approve or submit the release.
- Record any follow-up manual steps still pending.

## Sources

- Apple upload builds help: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- Apple invite external testers help: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
