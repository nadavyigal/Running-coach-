# iOS Professional Fastlane

Use this reference when the project needs repeatable release automation.

## When To Introduce fastlane

- Introduce fastlane when build, signing, beta distribution, and release steps are being repeated manually.
- Skip it for tiny prototypes if simple `xcodebuild` plus Xcode archive flows are enough.
- Prefer it when multiple developers or CI jobs need the same release contract.

## Recommended Lane Shape

- `tests`: run unit tests and optional lint.
- `beta`: sync signing, build, upload to TestFlight, publish changelog.
- `release`: build release artifact and upload to App Store Connect or prepare submission steps.

## Baseline Beta Lane

The fastlane beta deployment guide documents this baseline:

```ruby
lane :beta do
  sync_code_signing(type: "appstore")
  build_app(scheme: "MyApp")
  upload_to_testflight
end
```

Expand it carefully rather than turning the lane into an opaque script.

## Recommended Auth Pattern

- Prefer `app_store_connect_api_key` over interactive Apple ID auth in CI.
- Keep `key_id`, `issuer_id`, and the `.p8` content in secret storage.
- Pass the resulting API key object into other fastlane actions when supported.

fastlane documents `app_store_connect_api_key` as the action that loads the App Store Connect API token for other tools and actions. It documents `key_id`, `issuer_id`, `key_filepath`, and `key_content` inputs.

Example:

```ruby
api_key = app_store_connect_api_key(
  key_id: ENV["APP_STORE_CONNECT_KEY_ID"],
  issuer_id: ENV["APP_STORE_CONNECT_ISSUER_ID"],
  key_content: ENV["APP_STORE_CONNECT_KEY_CONTENT"],
  is_key_content_base64: true
)
```

## Recommended Signing Pattern

- Prefer `match` when the team needs shared signing across developers and CI.
- Use a dedicated private repo or other supported secure storage for signing assets.
- Keep the encryption password in CI secrets as `MATCH_PASSWORD`.

fastlane documents `match` as a way to share one signing identity across the development team and store encrypted certificates and provisioning profiles in Git, Google Cloud, or Amazon S3.

## Practical Fastfile Skeleton

```ruby
default_platform(:ios)

platform :ios do
  desc "Run tests"
  lane :tests do
    scan(
      scheme: "MyApp",
      clean: true
    )
  end

  desc "Distribute a beta build"
  lane :beta do
    api_key = app_store_connect_api_key(
      key_id: ENV["APP_STORE_CONNECT_KEY_ID"],
      issuer_id: ENV["APP_STORE_CONNECT_ISSUER_ID"],
      key_content: ENV["APP_STORE_CONNECT_KEY_CONTENT"],
      is_key_content_base64: true
    )

    match(
      type: "appstore",
      readonly: true,
      api_key: api_key
    )

    build_app(
      workspace: "MyApp.xcworkspace",
      scheme: "MyApp",
      export_method: "app-store"
    )

    changelog = changelog_from_git_commits(
      merge_commit_filtering: "exclude_merges"
    )

    upload_to_testflight(
      api_key: api_key,
      changelog: changelog
    )
  end
end
```

## Best Practices

- Keep secret material in CI secret stores, not in `Fastfile`.
- Make lane inputs explicit: workspace, scheme, export method, bundle identifier when needed.
- Keep `match` readonly in CI once signing material is established.
- Generate changelogs from commits or release notes files instead of hardcoding them.
- Avoid overusing plugins. Add a plugin only when a built-in action does not cover the job.

## Sources

- fastlane beta deployment: https://docs.fastlane.tools/getting-started/ios/beta-deployment/
- fastlane match: https://docs.fastlane.tools/actions/match/
- fastlane app_store_connect_api_key: https://docs.fastlane.tools/actions/app_store_connect_api_key/
