# iOS Professional Tooling

Use this reference to choose modern, maintainable tooling for iOS projects.

## Supported Xcode Extension Paths

- Prefer Xcode Source Editor Extensions for editor commands inside Xcode.
- Prefer Swift Package plugins for build-tool or command-based automation.
- Prefer external CLI tools for CI, pre-commit hooks, and deterministic local workflows.
- Avoid legacy plugin systems that patch Xcode internals.

Apple's Source Editor Extension documentation says source editor extensions can inspect and modify source text and the current selection. Apple's Swift Package plugin guidance says package plugins can perform actions on Swift packages and Xcode projects, with support for command plugins and build tool plugins.

## Default Tool Recommendations

### SwiftLint

- Use for lint enforcement and style rules.
- Prefer repo-checked configuration.
- Prefer build tool plugin integration when the project already uses Swift Package Manager heavily.
- For CI, review plugin trust settings carefully when using package plugin validation bypass flags.

SwiftLint describes itself as a tool to enforce Swift style and conventions and documents plugin support for Swift Package and Xcode projects.

### SwiftFormat

- Use for formatting.
- Choose the integration that matches team workflow:
  - CLI for deterministic CI and local commands.
  - Xcode Source Editor Extension for explicit editor formatting.
  - Build phase or package plugin when the team wants formatting wired into project tooling.
  - Pre-commit hook when the team wants clean diffs before push.
- Keep rules in version control.

SwiftFormat documents support as a command-line tool, Xcode extension, build phase integration, Swift Package plugin, pre-commit hook, and GitHub Actions integration.

### xcbeautify

- Use to make `xcodebuild` logs readable in CI.
- Pair it with `set -o pipefail`.
- Use its GitHub Actions renderer when annotating logs directly in Actions UI is useful.

`xcbeautify` describes itself as a formatter for `xcodebuild` output and documents renderer support for GitHub Actions and other CI systems.

### fastlane

- Use when the team needs a shared release contract instead of tribal knowledge.
- Keep lanes focused and composable: `tests`, `beta`, `release`, `metadata`, `screenshots`.
- Prefer built-in actions first and plugins second.

The fastlane beta deployment guide documents `build_app`, `sync_code_signing`, `upload_to_testflight`, changelog generation, and optional third-party distribution plugins.

### Xcode Cloud

- Use when the team wants Apple-native hosted CI/CD, integrated results in Xcode, parallel testing, and direct TestFlight handoff.
- Check the compute-hour model before recommending it as the default.

Apple says Xcode Cloud is built into Xcode, supports automated workflows, parallel testing, TestFlight delivery, and includes 25 compute hours per month with Apple Developer Program membership as of March 18, 2026.

## Simple Recommendation Matrix

- Want the safest Xcode-side "plugin" answer: Source Editor Extension or Swift Package plugin.
- Want standardized linting: SwiftLint.
- Want standardized formatting: SwiftFormat.
- Want cleaner build logs: `xcbeautify`.
- Want scripted releases and signing management: fastlane.
- Want Apple-native hosted CI/CD: Xcode Cloud.

## Sources

- Apple Source Editor Extensions: https://developer.apple.com/documentation/XcodeKit/creating-a-source-editor-extension
- Apple WWDC on Swift Package plugins: https://developer.apple.com/videos/play/wwdc2022/110359/
- Apple WWDC on creating Swift Package plugins: https://developer.apple.com/videos/play/wwdc2022/110401/
- Apple Xcode Cloud overview: https://developer.apple.com/xcode-cloud/
- SwiftLint: https://github.com/realm/SwiftLint
- SwiftFormat: https://github.com/nicklockwood/SwiftFormat
- xcbeautify: https://github.com/cpisciotta/xcbeautify
- fastlane beta deployment: https://docs.fastlane.tools/getting-started/ios/beta-deployment/
