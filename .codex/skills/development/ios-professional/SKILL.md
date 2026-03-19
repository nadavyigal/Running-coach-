---
name: ios-professional
description: Plan, build, sign, test, automate, distribute, and troubleshoot professional iOS applications. Use when Codex needs to work on Swift or Objective-C iPhone or iPad apps, Xcode projects or workspaces, app extensions, signing and provisioning, Swift Package plugins, Xcode Source Editor Extensions, CI/CD with GitHub Actions, fastlane, or Xcode Cloud, TestFlight distribution, App Store submission, or release engineering workflows for Apple platforms.
---

# IOS Professional

## Overview

Use this skill to operate like a senior iOS engineer and release manager. Prioritize Apple-supported workflows, reproducible builds, safe signing practices, and delivery automation that the team can maintain over time.

## Inspect Before Recommending

- Inspect the repository structure before choosing tools or automation.
- Identify whether the project uses `.xcodeproj`, `.xcworkspace`, Swift Package Manager, CocoaPods, Tuist, or a mixed setup.
- Find the real shipping targets, schemes, configurations, bundle identifiers, entitlements, extensions, and environment-specific build settings.
- Confirm the intended outcome: local build, simulator testing, device install, internal QA, TestFlight, App Store, or CI stabilization.

## Choose The Right Integration Type

- If the user asks for an "Xcode plugin," map it to a supported option:
  - Xcode Source Editor Extension for editor-side commands.
  - Swift Package plugin for build or command automation.
  - External CLI tool for linting, formatting, testing, log formatting, or CI.
- Avoid legacy Xcode plugins that inject into Xcode internals. Treat them as outdated and risky.
- Read [tooling.md](./references/tooling.md) when selecting plugins, editor extensions, lint and format tools, or project automation.

## Default Delivery Workflow

1. Make the project build locally with explicit `xcodebuild` commands.
2. Stabilize signing, bundle IDs, entitlements, schemes, and destinations.
3. Add or refine linting, formatting, and test automation only after the core build is reliable.
4. Choose CI/CD: GitHub Actions, Xcode Cloud, or the repo's established platform.
5. Add fastlane when release steps need a shared, scriptable contract.
6. Validate archive, export, upload, and tester distribution end to end.

## Use These Working Commands

- Discover available schemes first:
  - `xcodebuild -list -project App.xcodeproj`
  - `xcodebuild -list -workspace App.xcworkspace`
- Run tests against an explicit simulator:
  - `xcodebuild test -workspace App.xcworkspace -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
- Archive for distribution:
  - `xcodebuild archive -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/App.xcarchive`
- Export an archive:
  - `xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/export`
- Preserve failing exit codes through pipes:
  - `set -o pipefail && xcodebuild [flags] | xcbeautify`

## Apply Engineering Guardrails

- Keep certificates, provisioning profiles, API keys, and `.p8` files out of the repo unless the team already uses an encrypted dedicated signing store.
- Prefer App Store Connect API keys over interactive Apple ID auth for automation.
- Keep signing consistent across the app and all extension targets.
- Prefer Swift Package Manager for new dependencies unless the repo is already standardized on another system.
- Treat TestFlight as the default path before App Store release unless the user explicitly asks otherwise.

## Choose The Supporting Stack

- Read [tooling.md](./references/tooling.md) for supported extension points and recommended tools.
- Read [fastlane.md](./references/fastlane.md) for lane structure, signing strategy, and App Store Connect auth patterns.
- Read [ci-cd.md](./references/ci-cd.md) for GitHub Actions and Xcode Cloud guidance.
- Read [release-checklist.md](./references/release-checklist.md) before calling a release ready.

## Final Output Expectations

- Report the exact commands, lanes, workflows, or Xcode settings that now work.
- State any remaining Apple-account or manual review steps.
- Call out unresolved risks clearly: signing gaps, missing API keys, unsupported plugin ideas, or manual metadata requirements.
