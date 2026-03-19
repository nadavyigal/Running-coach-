# Xcode IOS Tooling

Use this reference when choosing supported plugin and automation options for Xcode-based iOS work.

## Prefer Supported Extension Points

- Prefer Xcode Source Editor Extensions for editor actions inside Xcode.
- Prefer Swift Package plugins for build-time or command-based automation.
- Prefer external CLI tools when the task belongs in CI, pre-commit hooks, or reproducible local scripts.
- Avoid legacy Xcode plugin systems that modify Xcode internals. Modern Xcode guidance centers on extensions and package plugins instead.

Apple's Source Editor Extension documentation says source editor extensions can read and modify source contents and the current text selection.

Apple's Swift Package plugin guidance says package plugins let you perform actions on Swift packages and Xcode projects, and Xcode 14 supports command plugins and build tool plugins.

## Recommended Tools

### SwiftLint

- Use for lint enforcement and convention checks.
- Prefer the build tool plugin for Swift Package or Xcode projects when the repo is already using Swift Package Manager.
- Add the plugin per target instead of assuming one global project toggle.
- For unattended CI, be careful with `-skipPackagePluginValidation` and `-skipMacroValidation`; SwiftLint documents the security tradeoff.

SwiftLint describes itself as a tool to enforce Swift style and conventions. Its README also documents build tool plugin support for both Swift Package projects and Xcode projects.

### SwiftFormat

- Use for formatting, not lint policy.
- Choose the integration mode that matches the repo:
  - CLI for deterministic local and CI usage.
  - Xcode Source Editor Extension for on-demand formatting in the editor.
  - Build phase or Swift Package plugin when the team wants formatting wired into builds.
  - Pre-commit hook when the repo favors clean diffs before push.
- Keep formatting rules checked into the repo to avoid machine-specific drift.

SwiftFormat documents support as a command-line tool, Xcode source editor extension, Xcode build phase, Swift Package Manager plugin, pre-commit hook, and GitHub Actions integration.

### xcbeautify

- Use for readable `xcodebuild` logs in CI.
- Keep `set -o pipefail` so build failures survive the pipe.
- Use the GitHub Actions renderer when annotating warnings and failures directly in Actions UI is useful.

`xcbeautify` describes itself as a formatter for `xcodebuild` output and documents GitHub Actions rendering support.

### fastlane

- Use when you need explicit, scriptable lanes for build, signing, beta, and release flows.
- Keep lanes small and legible: build, test, beta, release.
- Prefer App Store Connect API keys and managed signing flows over ad hoc local credentials.
- Use plugins only when the base actions do not cover the need.

The fastlane beta deployment guide documents `build_app`, `sync_code_signing`, and `upload_to_testflight`. It also documents plugin-based integrations such as `firebase_app_distribution`.

### Xcode Cloud

- Use when the team wants Apple-native CI/CD tightly integrated with Xcode, App Store Connect, and TestFlight.
- Favor it for teams that want parallel testing and a lower-maintenance Apple-hosted workflow.
- Confirm compute-hour budget and whether the team needs self-hosted flexibility before choosing it over other CI providers.

Apple describes Xcode Cloud as a continuous integration and delivery service built into Xcode that builds apps, runs automated tests in parallel, delivers apps to testers, and surfaces feedback in Xcode and App Store Connect.

## Default Shortlist

- First choice for linting: SwiftLint.
- First choice for formatting: SwiftFormat.
- First choice for prettier `xcodebuild` logs: `xcbeautify`.
- First choice for scripted releases: fastlane.
- First choice for Apple-native hosted CI/CD: Xcode Cloud.

## Sources

- Apple Source Editor Extensions: https://developer.apple.com/documentation/XcodeKit/creating-a-source-editor-extension
- Apple WWDC on Swift Package plugins: https://developer.apple.com/videos/play/wwdc2022/110359/
- Apple WWDC on creating Swift Package plugins: https://developer.apple.com/videos/play/wwdc2022/110401/
- SwiftLint: https://github.com/realm/SwiftLint
- SwiftFormat: https://github.com/nicklockwood/SwiftFormat
- xcbeautify: https://github.com/cpisciotta/xcbeautify
- fastlane beta deployment: https://docs.fastlane.tools/getting-started/ios/beta-deployment/
- Xcode Cloud overview: https://developer.apple.com/xcode-cloud/
