---
name: xcode-ios-delivery
description: Build, sign, test, archive, and distribute iOS applications with modern Xcode workflows. Use when Codex needs to create or maintain an iPhone or iPad app, configure Xcode projects and schemes, add supported Xcode extensions or Swift Package plugins, automate CI/CD with xcodebuild, fastlane, or Xcode Cloud, prepare TestFlight or App Store releases, or troubleshoot provisioning, signing, archive, and upload failures.
---

# Xcode IOS Delivery

## Overview

Use this skill to work like a senior iOS build and release engineer. Prefer Apple-supported extension points, reproducible command-line builds, and explicit signing and distribution workflows over fragile IDE hacks.

## Start With Project Reality

- Inspect the repo before prescribing tooling. Confirm whether it uses pure Xcode projects, Swift Package Manager, CocoaPods, Tuist, or mixed tooling.
- Identify the active app targets, extensions, schemes, build configurations, bundle identifiers, entitlements, and signing style before changing anything.
- Confirm the delivery goal: local simulator, physical device, internal QA, TestFlight, or App Store release.
- Prefer the repository's existing conventions unless they are clearly broken.

## Choose Supported Integrations

- If the user asks for an "Xcode plugin," translate that into one of three supported paths:
  - Xcode Source Editor Extension for editor commands.
  - Swift Package plugin for build-tool or command automation.
  - External CLI tooling invoked from build phases or CI.
- Avoid recommending legacy plugin systems that patch Xcode internals. Treat them as unsupported and risky.
- Read [tooling.md](./references/tooling.md) when choosing plugins, extensions, linters, formatters, build log tooling, or release automation.
- Read [release-workflow.md](./references/release-workflow.md) when the task touches signing, archives, TestFlight, App Store Connect, or CI/CD.

## Default Working Pattern

1. Inspect project structure and current automation.
2. Stabilize dependencies, schemes, and signing.
3. Get a clean local build or test run with `xcodebuild` or Xcode.
4. Add or adjust tooling only if it clearly improves repeatability.
5. Automate beta or release flow with fastlane or Xcode Cloud when appropriate.
6. Validate archive, export, and upload behavior before calling delivery complete.

## Use These Command Patterns

- Discover schemes and settings first:
  - `xcodebuild -list -project App.xcodeproj`
  - `xcodebuild -list -workspace App.xcworkspace`
- Run tests on a named simulator instead of relying on implicit destinations:
  - `xcodebuild test -workspace App.xcworkspace -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
- Archive for device distribution with an explicit archive path:
  - `xcodebuild archive -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/App.xcarchive`
- Export with a checked-in `ExportOptions.plist` when the project already uses one:
  - `xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/export`
- When running through pipes in CI, preserve failure status with `set -o pipefail`.

## Apply Delivery Guardrails

- Keep secrets, API keys, certificates, and App Store Connect credentials out of the repository. Prefer CI secret stores and App Store Connect API keys.
- Keep signing consistent across app targets and extensions. Mismatched team IDs, bundle IDs, or entitlements are frequent release blockers.
- Prefer Swift Package Manager for new dependencies unless the project is already standardized elsewhere.
- Keep versioning and build numbers explicit and reproducible.
- Ship to TestFlight before pushing toward App Store release unless the user explicitly asks to skip beta.
- Treat build log readability, linting, and formatting as support tooling, not the release process itself.

## Recommended Tool Stack

- Use SwiftLint for lint enforcement.
- Use SwiftFormat for formatting, either as a CLI, source editor extension, build phase, or Swift Package plugin depending on repo needs.
- Use `xcbeautify` to improve `xcodebuild` logs in CI.
- Use fastlane when the team wants explicit lanes for signing, beta, and release workflows.
- Use Xcode Cloud when an all-Apple CI/CD workflow is the best fit.
- Use TestFlight and App Store Connect as the default Apple distribution surface.

## Finish Strong

- Report exactly what was changed: project settings, scheme settings, package dependencies, signing, CI, or release automation.
- State the exact build, archive, export, or upload command that now works.
- Call out any remaining manual Apple account steps, review gates, or certificate dependencies.
