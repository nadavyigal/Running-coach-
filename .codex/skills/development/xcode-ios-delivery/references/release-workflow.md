# Xcode IOS Release Workflow

Use this reference when building, signing, archiving, and distributing an iOS app.

## Local Build Discipline

- Make builds reproducible from the command line before trusting GUI-only success.
- Prefer explicit workspace or project, scheme, destination, configuration, archive path, and export path.
- Keep one known-good simulator destination for routine tests.
- Store export behavior in `ExportOptions.plist` when the project already has a stable export process.

## Signing And Provisioning

- Align team ID, bundle ID, capabilities, and entitlements across the app and every extension target.
- Choose one signing model per environment:
  - Automatic signing for simple local development.
  - Managed shared signing for CI and multi-developer delivery.
- When signing fails, inspect provisioning profile type, certificate availability, entitlements, and target-specific overrides before changing random build settings.

## Beta Distribution

- Prefer TestFlight as the default Apple beta path.
- Keep release notes or "What to Test" notes current.
- Use external groups deliberately rather than broadcasting every build.

Apple's App Store Connect help says you can invite up to 10,000 external testers per app. It also supports public invitation links and tester criteria such as device and OS requirements.

If automation is needed, fastlane's documented baseline lane is:

```ruby
lane :beta do
  sync_code_signing(type: "appstore")
  build_app(scheme: "MyApp")
  upload_to_testflight
end
```

Adjust scheme, workspace, and changelog handling to the actual repo.

## Upload Options

- Prefer upload paths that the team can support consistently.
- Use `xcrun altool` when the pipeline already depends on command-line upload flows.
- Use Transporter when a simple GUI upload path is helpful for operations or release managers.

Apple documents both `xcrun altool` and Transporter for uploading builds to App Store Connect.

## CI/CD Choice

- Choose fastlane when you want portable, explicit release lanes.
- Choose Xcode Cloud when tight Xcode and App Store Connect integration outweighs vendor neutrality.
- Choose another CI only when the repo already depends on a broader multi-platform platform or custom infra.

Apple says Xcode Cloud is built into Xcode, supports automated workflows, parallel testing, and TestFlight delivery.

## Practical Checklist

- Confirm the selected scheme is the shipping scheme.
- Confirm Release configuration uses the intended signing settings.
- Run tests on a clean simulator.
- Produce an archive successfully.
- Export or upload with the intended distribution method.
- Verify the build appears in App Store Connect or TestFlight.
- Record any manual follow-up steps such as beta review, metadata, screenshots, or compliance questions.

## Sources

- Apple upload builds help: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- Apple invite external testers help: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
- Apple Xcode Cloud overview: https://developer.apple.com/xcode-cloud/
- fastlane beta deployment: https://docs.fastlane.tools/getting-started/ios/beta-deployment/
