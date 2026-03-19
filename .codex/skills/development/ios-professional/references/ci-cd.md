# iOS Professional CI/CD

Use this reference when setting up or reviewing hosted automation for iOS apps.

## Choose Between GitHub Actions And Xcode Cloud

Choose GitHub Actions when:
- The repository already standardizes on GitHub automation.
- You want flexible multi-platform workflows or custom scripting.
- The team is comfortable managing signing material and secrets directly.

Choose Xcode Cloud when:
- The team wants Apple-native CI/CD integrated into Xcode and App Store Connect.
- Parallel testing and built-in TestFlight handoff are priorities.
- The compute-hour model is acceptable.

Apple says Xcode Cloud supports automated workflows, parallel testing, TestFlight delivery, and shows results inside both Xcode and App Store Connect.

## GitHub Actions Signing Pattern

GitHub's documentation recommends storing signing material as secrets. It specifically documents keeping the signing certificate, provisioning profile, and keychain password in GitHub secrets, with the certificate and provisioning profile Base64-encoded.

Example secret names from GitHub's docs:
- `BUILD_CERTIFICATE_BASE64`
- `P12_PASSWORD`
- `BUILD_PROVISION_PROFILE_BASE64`
- `KEYCHAIN_PASSWORD`

GitHub also documents decoding those secrets on the runner, creating a temporary keychain, importing the certificate, and copying the provisioning profile into `~/Library/MobileDevice/Provisioning Profiles`.

## GitHub Actions Example

Use this as a starting point, then replace workspace, scheme, and destinations:

```yaml
name: ios-ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v5
      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode.app
      - name: Resolve dependencies
        run: xcodebuild -resolvePackageDependencies -workspace MyApp.xcworkspace -scheme MyApp
      - name: Run tests
        run: set -o pipefail && xcodebuild test -workspace MyApp.xcworkspace -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | xcbeautify --renderer github-actions
```

For signed archives, add a second job or workflow that installs signing assets using GitHub's documented temporary-keychain pattern.

## Xcode Cloud Notes

- Start with the built-in workflow, then customize.
- Use quick checks on one or two device types for routine changes.
- Reserve broader test matrices for release candidates or higher-risk branches.
- Keep an eye on compute-hour consumption.

Apple's current Xcode Cloud overview says Apple Developer Program membership includes 25 compute hours per month, with paid tiers available for more.

## CI Best Practices

- Separate pull-request validation from release distribution.
- Keep tests and release builds on explicit schemes and destinations.
- Fail fast on signing errors instead of masking them with retries.
- Keep build logs readable with `xcbeautify`.
- Prefer App Store Connect API key auth where supported by the tooling stack.

## Sources

- Apple Xcode Cloud overview: https://developer.apple.com/xcode-cloud/
- GitHub signing Xcode applications: https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications
