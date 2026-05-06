# iOS Native Legacy Audit

Date: 2026-05-06

## Sources Checked

- `apps/ios-old-old`: renamed legacy Capacitor/Cordova iOS app.
- `origin/ios`: legacy iOS branch with Capacitor shell, iOS GitHub Actions, Fastlane, docs, and iOS agent notes.
- `origin/iOS-application`: smaller legacy branch with Fastlane and generated shared model output.
- `apps/ios-native`: native Swift app submodule tracking `IOS-runsmart-light-app-`, branch `runsmart-lite-build`.

## Worth Imitating

- Fastlane lane shape from the legacy app: `test`, `beta`, `release`, `screenshots`, and `clean`.
- App Store Connect API key support through environment variables so CI can upload without local Apple account state.
- `select-simulator.rb` helper for picking a usable current simulator instead of hardcoding one device name.
- TestFlight checklists that cover install, first launch, permissions, GPS tracking, background tracking, run history, AI coach, Garmin, and HealthKit.
- Separate release signing assumptions in `Appfile` and `Matchfile`, driven by environment variables.

## Copied Forward Now

- Added native Fastlane files under `apps/ios-native/fastlane`.
- Added the simulator selector under `apps/ios-native/scripts/select-simulator.rb`.
- Updated parent GitHub Actions to initialize `apps/ios-native` and build/deploy from the native project.
- Kept the native bundle identifier as `com.runsmart.lite`, matching the current Xcode project.

## Do Not Copy

- Capacitor/Cordova runtime files, `config.xml`, generated `public` web assets, and the old `AppDelegate`/`SceneDelegate` webview boot flow.
- Old generated `SharedModels.swift` output from `origin/iOS-application`; it contains TypeScript union/object syntax that is not valid Swift and should only be treated as schema history.
- DerivedData, Pods, local build products, and Xcode user state.
- Old iOS GitHub Actions as-is. They synced Capacitor and built `apps/ios`; the parent workflows now target `apps/ios-native`, initialize that submodule, and build `IOS RunSmart app.xcodeproj`.

## Branch Cleanup Note

Remote branches found: `origin/ios` and `origin/iOS-application`.

Do not delete either branch until the parent repo commit that points to `apps/ios-native` is pushed and verified in GitHub/Xcode. After that, deleting both legacy branches is reasonable if no active PR or deployment still references them.
