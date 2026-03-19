# RunSmart iOS Local Build Commands

Date: 2026-03-18

## Prerequisites

- Install Node.js and npm so `v0/package.json` dependencies can be installed.
- Keep Apple signing material out of the repo. Use local Xcode settings or CI secrets.

## Normal Local Iteration

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npm install
npx cap sync ios
```

## Regenerate The Native Project From Scratch

The project is already bootstrapped under `apps/ios/App/App.xcodeproj`. Only run `cap add ios` again if you intentionally want to regenerate the native shell.

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx cap add ios --packagemanager SPM
npx cap sync ios
```

Capacitor CLI 7.6.0 still performs a CocoaPods presence check during `cap add ios` even when `--packagemanager SPM` is used. If `pod` is not available, run the add step from an environment where CocoaPods exists or provide a temporary `pod` shim just for the add preflight.

RunSmart intentionally uses live URL mode via `v0/capacitor.config.ts`:

- Primary runtime URL: `https://runsmart-ai.com`
- Fallback `webDir`: `v0/capacitor-fallback/`

This is a deliberate product choice for the current Next.js architecture, even though Capacitor documents `server.url` as a live-reload-oriented setting rather than a normal production default.

## Open Xcode

Open Xcode after the Capacitor iOS platform has been generated and synced.

```bash
open /Users/nadavyigal/Documents/RunSmart/apps/ios/App/App.xcodeproj
```

## Canonical Local xcodebuild Commands

```bash
cd /Users/nadavyigal/Documents/RunSmart

xcodebuild -list \
  -project apps/ios/App/App.xcodeproj

xcodebuild build \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.3'

xcodebuild test \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.3'

xcodebuild archive \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath apps/ios/build/RunSmart.xcarchive
```

## Current Blocker On This Machine

At implementation time, the real iOS project was generated successfully, but `xcodebuild -list` was still spending time resolving SwiftPM dependencies and Capacitor binary artifacts. If that lingers on your machine, open `App.xcodeproj` once in Xcode and let package resolution finish there before retrying the command-line build.
