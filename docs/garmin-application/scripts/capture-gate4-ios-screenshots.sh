#!/usr/bin/env bash
# Capture Gate 4 Garmin UX screenshots from RunSmart iOS Simulator (DEBUG demo mode).
set -euo pipefail

IOS_ROOT="/Users/nadavyigal/Documents/Projects /IOS RunSmart light /IOS RunSmart app"
OUT_DIR="/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/screenshots"
SCHEME="IOS RunSmart app"
BUNDLE_ID="com.runsmart.lite"
SIM_NAME="${SIM_NAME:-iPhone 17 Pro Max}"
DERIVED="${TMPDIR:-/tmp}/RunSmartGate4Derived"
SETTLE_SECONDS="${SETTLE_SECONDS:-12}"

mkdir -p "$OUT_DIR"

echo "Building Debug for Simulator ($SIM_NAME)..."
xcodebuild \
  -project "$IOS_ROOT/IOS RunSmart app.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=$SIM_NAME" \
  -derivedDataPath "$DERIVED" \
  build \
  CODE_SIGNING_ALLOWED=NO \
  | tail -20

APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/IOS RunSmart app.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Build failed: app not found at $APP_PATH" >&2
  exit 1
fi

SIM_UDID="$(xcrun simctl list devices available | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]+)\).*/\1/')"
if [[ -z "$SIM_UDID" ]]; then
  echo "Simulator not found: $SIM_NAME" >&2
  exit 1
fi

xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
xcrun simctl bootstatus "$SIM_UDID" -b

xcrun simctl install "$SIM_UDID" "$APP_PATH"

launch_and_capture() {
  local outfile="$1"
  shift
  xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$SIM_UDID" "$BUNDLE_ID" \
    -RUNSMART_DEMO_MODE -RUNSMART_SCREENSHOT_MODE "$@" >/dev/null
  sleep "$SETTLE_SECONDS"
  xcrun simctl io "$SIM_UDID" screenshot "$OUT_DIR/$outfile"
  echo "Captured $outfile"
}

# 1 — Disconnected Garmin detail (Connect action visible)
launch_and_capture "01-connect-garmin-devices.png" \
  -INITIAL_TAB Profile -GATE4_GARMIN_DISCONNECTED -OPEN_SECONDARY garminConnect

# 2 — Garmin OAuth (Safari). Consent appears after Garmin login; capture OAuth entry.
xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" 2>/dev/null || true
OAUTH_URL='https://connect.garmin.com/oauth2Confirm?client_id=6149b041-557f-4ad0-82ea-ef5c3d6e867d&response_type=code&redirect_uri=https%3A%2F%2Fwww.runsmart-ai.com%2Fgarmin%2Fcallback&state=gate4-screenshot&code_challenge=placeholder&code_challenge_method=S256'
xcrun simctl openurl "$SIM_UDID" "$OAUTH_URL"
sleep 5
xcrun simctl io "$SIM_UDID" screenshot "$OUT_DIR/02-garmin-oauth-consent.png"
echo "Captured 02-garmin-oauth-consent.png (Safari OAuth entry — replace with consent after login if Garmin requires sign-in)"

# 3 — Connected state
# Shot 1's terminate-only relaunch leaves app-container state in place; without a
# clean reinstall this can carry shot 1's disconnected state into shot 3
# (observed 2026-06-22). Uninstall/reinstall here forces RunSmartPreviewData's
# default Garmin-connected demo state instead of stale persisted state.
xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl uninstall "$SIM_UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$SIM_UDID" "$APP_PATH"
launch_and_capture "03-garmin-connected-state.png" \
  -INITIAL_TAB Profile -OPEN_SECONDARY garminConnect

# 4 — Imported Garmin runs (Report tab)
launch_and_capture "04-garmin-imported-runs.png" -INITIAL_TAB Report

# 5 — Recovery / analytics
launch_and_capture "05-garmin-recovery-analytics.png" \
  -INITIAL_TAB Today -OPEN_SECONDARY recoveryDashboard

ZIP_PATH="/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip"
rm -f "$ZIP_PATH"
(
  cd "$OUT_DIR"
  zip -j "$ZIP_PATH" \
    01-connect-garmin-devices.png \
    02-garmin-oauth-consent.png \
    03-garmin-connected-state.png \
    04-garmin-imported-runs.png \
    05-garmin-recovery-analytics.png
)

echo "Zip: $ZIP_PATH"
ls -la "$OUT_DIR"/*.png
