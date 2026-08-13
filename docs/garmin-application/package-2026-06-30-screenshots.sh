#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/nadavyigal/Documents/RunSmart/docs/garmin-application"
SHOT_DIR="$ROOT/runsmart-garmin-screenshots-ios-2026-06-30"
ZIP_PATH="$ROOT/runsmart-garmin-screenshots-ios-2026-06-30.zip"

required=(
  "01-connect-garmin-devices.png"
  "02-garmin-oauth-consent.png"
  "03-garmin-connected-state.png"
  "04-garmin-imported-runs.png"
  "05-garmin-recovery-analytics.png"
  "06-garmin-wellness.png"
)

mkdir -p "$SHOT_DIR"

missing=()
for file in "${required[@]}"; do
  if [[ ! -f "$SHOT_DIR/$file" ]]; then
    missing+=("$file")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing screenshot(s) in:"
  echo "  $SHOT_DIR"
  printf '  - %s\n' "${missing[@]}"
  echo
  echo "Add the six live 1.0.5 screenshots with the exact filenames above, then rerun:"
  echo "  bash \"$0\""
  exit 1
fi

rm -f "$ZIP_PATH"
(
  cd "$SHOT_DIR"
  zip -j "$ZIP_PATH" "${required[@]}"
)

echo
echo "Created:"
echo "  $ZIP_PATH"
echo
echo "Zip contents:"
unzip -l "$ZIP_PATH"
echo
echo "Email attachment line:"
echo "• runsmart-garmin-screenshots-ios-2026-06-30.zip (6 screenshots)"
