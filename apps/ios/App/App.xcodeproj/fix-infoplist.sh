#!/bin/bash

# ================================================================
# RunSmart Info.plist Fixer
# This script finds and updates your iOS Info.plist with required
# location permissions for GPS tracking
# ================================================================

echo "🔍 Searching for Info.plist in iOS project..."
echo ""

# Common locations for Capacitor iOS projects
POSSIBLE_LOCATIONS=(
    "ios/App/App/Info.plist"
    "apps/ios/App/App/Info.plist"
    "App/App/Info.plist"
    "ios/App/Info.plist"
    "apps/ios/App/Info.plist"
)

FOUND_PLIST=""

# Search for Info.plist
for location in "${POSSIBLE_LOCATIONS[@]}"; do
    if [ -f "$location" ]; then
        echo "✅ Found Info.plist at: $location"
        FOUND_PLIST="$location"
        break
    fi
done

# If not found in common locations, search entire project
if [ -z "$FOUND_PLIST" ]; then
    echo "⚠️  Not found in common locations. Searching entire project..."
    FOUND_PLIST=$(find . -name "Info.plist" -path "*/ios/*" -not -path "*/node_modules/*" -not -path "*/Pods/*" | head -n 1)
    
    if [ -n "$FOUND_PLIST" ]; then
        echo "✅ Found Info.plist at: $FOUND_PLIST"
    else
        echo "❌ Error: Could not find Info.plist in iOS project"
        echo ""
        echo "Please locate your Info.plist manually in Xcode:"
        echo "1. Open Xcode"
        echo "2. Look in left navigator: App > App > Info.plist"
        echo "3. Or select App target > Info tab"
        exit 1
    fi
fi

echo ""
echo "📋 Checking for required location permissions..."
echo ""

# Check if location permissions already exist
if grep -q "NSLocationWhenInUseUsageDescription" "$FOUND_PLIST"; then
    echo "✅ NSLocationWhenInUseUsageDescription already exists"
else
    echo "⚠️  NSLocationWhenInUseUsageDescription is MISSING"
fi

if grep -q "NSLocationAlwaysAndWhenInUseUsageDescription" "$FOUND_PLIST"; then
    echo "✅ NSLocationAlwaysAndWhenInUseUsageDescription already exists"
else
    echo "⚠️  NSLocationAlwaysAndWhenInUseUsageDescription is MISSING"
fi

echo ""
read -p "❓ Would you like to add/update the location permissions? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled. No changes made."
    exit 0
fi

echo ""
echo "📝 Creating backup of Info.plist..."
cp "$FOUND_PLIST" "$FOUND_PLIST.backup"
echo "✅ Backup created at: $FOUND_PLIST.backup"

echo ""
echo "🔧 Adding/updating location permissions..."

# Check if permissions exist, if not add them before the closing </dict>
if ! grep -q "NSLocationWhenInUseUsageDescription" "$FOUND_PLIST"; then
    # Add NSLocationWhenInUseUsageDescription
    sed -i.tmp '/<\/dict>/i\
	<key>NSLocationWhenInUseUsageDescription<\/key>\
	<string>RunSmart needs access to your location to accurately track your running distance, pace, and route while you use the app.<\/string>\
' "$FOUND_PLIST"
    rm "$FOUND_PLIST.tmp"
    echo "✅ Added NSLocationWhenInUseUsageDescription"
fi

if ! grep -q "NSLocationAlwaysAndWhenInUseUsageDescription" "$FOUND_PLIST"; then
    # Add NSLocationAlwaysAndWhenInUseUsageDescription
    sed -i.tmp '/<\/dict>/i\
	<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\
	<string>RunSmart needs continuous location access to track your runs even when the app is in the background, ensuring accurate route and distance tracking throughout your entire workout.<\/string>\
' "$FOUND_PLIST"
    rm "$FOUND_PLIST.tmp"
    echo "✅ Added NSLocationAlwaysAndWhenInUseUsageDescription"
fi

if ! grep -q "NSMotionUsageDescription" "$FOUND_PLIST"; then
    # Add NSMotionUsageDescription for step tracking
    sed -i.tmp '/<\/dict>/i\
	<key>NSMotionUsageDescription<\/key>\
	<string>RunSmart uses motion sensors to track your steps, cadence, and running form for more accurate fitness insights.<\/string>\
' "$FOUND_PLIST"
    rm "$FOUND_PLIST.tmp"
    echo "✅ Added NSMotionUsageDescription"
fi

echo ""
echo "🎉 Success! Info.plist has been updated."
echo ""
echo "📋 Next steps:"
echo "1. In Xcode, close the project if open (⌘Q)"
echo "2. Reopen Xcode: npx cap open ios"
echo "3. Delete the app from your iPhone 13"
echo "4. Clean build folder: Product > Clean Build Folder (⌘⇧K)"
echo "5. Build and run: Product > Run (⌘R)"
echo "6. Test GPS - permission dialog should appear"
echo ""
echo "💾 A backup of your original Info.plist was saved at:"
echo "   $FOUND_PLIST.backup"
echo ""
echo "If you need to restore the backup:"
echo "   cp $FOUND_PLIST.backup $FOUND_PLIST"
echo ""
