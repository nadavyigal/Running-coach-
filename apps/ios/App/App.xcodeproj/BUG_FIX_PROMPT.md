# 🐛 CRITICAL BUGS FOUND IN TESTFLIGHT PREP - APRIL 20, 2026

## 📍 CONTEXT
During final Xcode testing before TestFlight upload, two critical bugs were discovered on iPhone 13:

### BUG #1: GPS/Start Run Crash (CRITICAL - BLOCKER)
**Severity:** HIGH - BLOCKS TESTFLIGHT
**Status:** NEEDS IMMEDIATE FIX

**Description:**
When user clicks GPS button or attempts to start a run with GPS, the application crashes immediately and needs to reopen.

**Steps to Reproduce:**
1. Launch RunSmart app on iPhone 13
2. Sign in with user credentials
3. Navigate to run tracking screen
4. Click "Start Run" or GPS button
5. App crashes
6. iOS shows "RunSmart quit unexpectedly" or similar
7. Need to reopen app

**Expected Behavior:**
- GPS should initialize
- Location permission should be requested (if not already granted)
- Run should start tracking
- Map should show user location

**Actual Behavior:**
- App crashes immediately when GPS is accessed
- Complete app termination
- User returned to home screen

**Environment:**
- Device: iPhone 13
- iOS: 26.3
- Build: Debug build from Xcode (Version 1.0.0, Build 1)
- Network: Connected
- Location Services: Enabled system-wide

**Previous Context:**
- GPS location tracking was reported as "FIXED" 
- May have been tested in development mode
- May not have been tested with Release configuration
- Might be related to Info.plist permissions
- Could be related to Capacitor plugin configuration

**Possible Causes:**
1. Info.plist permissions not being read correctly
2. Capacitor Geolocation plugin issue
3. Background modes not properly configured in code
4. Permission request failing silently
5. Null/undefined reference when accessing location API
6. JavaScript bridge error between web and native
7. iOS 26.3 compatibility issue
8. Release build stripping necessary code

---

### BUG #2: Garmin Sync Error (MEDIUM PRIORITY)
**Severity:** MEDIUM - Should fix but not blocker
**Status:** NEEDS INVESTIGATION

**Description:**
User can see Garmin is connected, but sync fails with error message. Last successful sync was 25 days ago.

**Steps to Reproduce:**
1. Launch RunSmart app
2. Sign in with user credentials
3. Navigate to Garmin sync/integration screen
4. Garmin shows as "Connected"
5. Attempt to sync
6. Error message appears (exact message not captured)
7. Last sync timestamp shows "25 days ago"

**Expected Behavior:**
- Sync button should trigger data sync from Garmin
- Success message: "Synced successfully" or similar
- Last sync timestamp should update to current time
- Run data from Garmin should appear in app

**Actual Behavior:**
- Error message displayed (need exact error text)
- Sync fails to complete
- Last sync remains at 25 days ago
- No new data appears

**Possible Causes:**
1. Garmin API token expired (25 days = ~3.5 weeks)
2. API endpoint changed or deprecated
3. Network request timeout
4. CORS or API permissions issue
5. Backend service issue
6. Token refresh logic not working
7. Rate limiting from Garmin API
8. User's Garmin account disconnected/revoked access

---

## 🎯 PRIMARY FOCUS: FIX GPS CRASH (BLOCKER)

This is the critical issue. Garmin sync can be addressed after.

---

## 🔍 DIAGNOSTIC STEPS - GPS CRASH

### STEP 1: Check Xcode Console for Crash Logs

**When the crash happens, look in Xcode console for:**
- Error messages in red
- Stack traces
- "Terminating app due to..."
- Permission errors
- Null reference errors

**Common error patterns to look for:**
```
// Permission errors
"This app has attempted to access privacy-sensitive data..."
"NSLocationWhenInUseUsageDescription not found"

// Null/undefined errors
"Cannot read property 'getCurrentPosition' of undefined"
"null is not an object"

// Plugin errors
"Capacitor plugin not found"
"Native implementation not available"

// iOS errors
"Terminating app due to uncaught exception"
```

**Action:** Capture the EXACT error message from Xcode console when crash occurs.

---

### STEP 2: Check Capacitor Geolocation Plugin Installation

**Verify plugin is installed:**
```bash
# Check package.json
grep -i "geolocation" package.json

# Should see something like:
# "@capacitor/geolocation": "^5.0.0" or similar
```

**Check if plugin needs update:**
```bash
npm list @capacitor/geolocation
```

**Check iOS native plugin registration:**
Look in `apps/ios/App/App/AppDelegate.swift` or similar file for plugin registration.

---

### STEP 3: Review Geolocation Code

**Find where GPS is initialized:**

Search for these patterns in your codebase:
```bash
# Search for geolocation usage
grep -r "getCurrentPosition" app/ components/
grep -r "watchPosition" app/ components/
grep -r "Geolocation" app/ components/
grep -r "navigator.geolocation" app/ components/

# Search for Capacitor Geolocation
grep -r "@capacitor/geolocation" app/ components/
grep -r "Geolocation.getCurrentPosition" app/ components/
```

**Common file locations to check:**
- `app/` folder (Next.js pages)
- `components/` folder
- `lib/` or `utils/` folder (helper functions)
- Any file with "location", "gps", "run", "tracking" in the name

---

### STEP 4: Check Permission Request Logic

**Find where location permission is requested:**
```bash
grep -r "requestPermissions" app/ components/
grep -r "checkPermissions" app/ components/
```

**Proper Capacitor Geolocation pattern:**
```typescript
import { Geolocation } from '@capacitor/geolocation';

// Check current permissions
const permissions = await Geolocation.checkPermissions();

// Request if needed
if (permissions.location !== 'granted') {
  const request = await Geolocation.requestPermissions();
  if (request.location !== 'granted') {
    // Handle denied permission
    throw new Error('Location permission denied');
  }
}

// Then get position
const position = await Geolocation.getCurrentPosition();
```

**Look for missing permission checks or error handling.**

---

### STEP 5: Check Info.plist Keys Are Being Read

Even though we verified they exist, check if they're in the correct Info.plist:

**Verify file location:**
```bash
# Should be at:
apps/ios/App/App/Info.plist

# Check it contains our keys:
grep -A 1 "NSLocationWhenInUseUsageDescription" apps/ios/App/App/Info.plist
grep -A 1 "NSLocationAlwaysAndWhenInUseUsageDescription" apps/ios/App/App/Info.plist
```

**If keys are missing in this file, they need to be added.**

---

### STEP 6: Check for iOS 26.3 Compatibility Issues

iOS 26.3 is quite new (future version). Check if:
- Capacitor version supports it
- Geolocation plugin is compatible
- Any breaking changes in iOS 26

**Check Capacitor version:**
```bash
grep "@capacitor/core" package.json
```

**If version is old (< 5.0), consider updating:**
```bash
npm install @capacitor/core@latest @capacitor/geolocation@latest
npx cap sync ios
```

---

### STEP 7: Check for Try-Catch Blocks

**GPS code should have error handling:**
```typescript
try {
  const position = await Geolocation.getCurrentPosition();
  // Use position
} catch (error) {
  console.error('GPS Error:', error);
  // Show user-friendly error message
  // Don't let app crash
}
```

**Search for unhandled GPS calls:**
```bash
# Find getCurrentPosition without try-catch
grep -B 5 -A 5 "getCurrentPosition" app/ components/ | grep -v "try\|catch"
```

---

## 🛠️ LIKELY FIXES FOR GPS CRASH

### FIX 1: Add Permission Check Before GPS Access

**Find your GPS initialization code and add:**

```typescript
import { Geolocation } from '@capacitor/geolocation';

async function startGPSTracking() {
  try {
    // Check permissions first
    const permissions = await Geolocation.checkPermissions();
    
    if (permissions.location !== 'granted') {
      // Request permission
      const request = await Geolocation.requestPermissions();
      
      if (request.location !== 'granted') {
        // Show user-friendly message
        alert('Location permission is required to track your runs. Please enable it in Settings.');
        return;
      }
    }
    
    // Now safe to access GPS
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
    
    console.log('GPS position:', position);
    // Continue with run tracking...
    
  } catch (error) {
    console.error('GPS Error:', error);
    
    // Handle specific error types
    if (error.message.includes('location services are not enabled')) {
      alert('Please enable Location Services in your device settings.');
    } else if (error.message.includes('timeout')) {
      alert('Unable to get your location. Please make sure you have a clear view of the sky.');
    } else {
      alert('Unable to access GPS. Please try again.');
    }
  }
}
```

---

### FIX 2: Verify Geolocation Plugin is Imported Correctly

**Check your run tracking file imports:**

```typescript
// ✅ CORRECT - Capacitor Geolocation
import { Geolocation } from '@capacitor/geolocation';

// ❌ WRONG - Browser API (may not work in app)
// Using navigator.geolocation directly

// ❌ WRONG - Missing import
// Using Geolocation without import
```

**If using browser API, replace with Capacitor:**
```typescript
// ❌ Replace this:
navigator.geolocation.getCurrentPosition(success, error);

// ✅ With this:
const position = await Geolocation.getCurrentPosition();
```

---

### FIX 3: Add Null Checks

**Prevent crashes from null/undefined:**

```typescript
async function startRun() {
  // Check if Geolocation is available
  if (!Geolocation) {
    console.error('Geolocation plugin not available');
    alert('GPS not available on this device');
    return;
  }
  
  try {
    const position = await Geolocation.getCurrentPosition();
    
    // Check if position is valid
    if (!position || !position.coords) {
      throw new Error('Invalid GPS position');
    }
    
    // Safe to use
    const { latitude, longitude } = position.coords;
    console.log('Location:', latitude, longitude);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Unable to start GPS tracking');
  }
}
```

---

### FIX 4: Update Capacitor Plugins

**If plugins are outdated:**

```bash
# Update Capacitor core and plugins
npm install @capacitor/core@latest @capacitor/ios@latest @capacitor/geolocation@latest

# Sync changes
npx cap sync ios

# Rebuild
npm run build
npx cap sync ios
```

---

## 🔍 DIAGNOSTIC STEPS - GARMIN SYNC ERROR

### STEP 1: Capture Exact Error Message

**Add logging to Garmin sync code:**
```typescript
try {
  const response = await syncWithGarmin();
  console.log('Garmin sync response:', response);
} catch (error) {
  console.error('Garmin sync error:', error);
  console.error('Error message:', error.message);
  console.error('Error status:', error.status);
  console.error('Error response:', error.response);
}
```

### STEP 2: Check API Token

**Token might be expired after 25 days:**
```typescript
// Check if token exists and is valid
const garminToken = await getGarminToken();
console.log('Token exists:', !!garminToken);
console.log('Token expiry:', garminToken?.expiresAt);

// If expired, trigger refresh
if (isTokenExpired(garminToken)) {
  await refreshGarminToken();
}
```

### STEP 3: Test API Endpoint

**Verify backend is accessible:**
```bash
# Check if Garmin sync endpoint is reachable
curl -X POST https://your-api.com/garmin/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📋 IMMEDIATE ACTION PLAN

### PRIORITY 1: Fix GPS Crash (MUST DO NOW)

1. **Capture crash log from Xcode**
   - Run app with Xcode connected
   - Trigger GPS crash
   - Copy entire error message from console

2. **Find GPS initialization code**
   - Search for `getCurrentPosition` in codebase
   - Identify the file and function

3. **Add proper error handling**
   - Wrap in try-catch
   - Add permission checks
   - Add null checks

4. **Test fix**
   - Rebuild: `npm run build && npx cap sync ios`
   - Run from Xcode
   - Try starting GPS run
   - Should not crash

5. **Verify on device**
   - Test with location permission denied
   - Test with location services disabled
   - Test with permission granted
   - All scenarios should handle gracefully (no crash)

### PRIORITY 2: Fix Garmin Sync (After GPS is fixed)

1. **Capture exact error message**
2. **Check token expiration**
3. **Verify API endpoint**
4. **Add better error handling**
5. **Test sync**

---

## 🚨 BLOCKER STATUS

**TestFlight upload is BLOCKED until GPS crash is fixed.**

You cannot upload an app that crashes on core functionality.

**Estimated time to fix:**
- GPS crash: 30 minutes - 2 hours (depending on root cause)
- Garmin sync: 30 minutes - 1 hour

**Total delay: 1-3 hours before ready for TestFlight**

---

## 📝 NEXT STEPS FOR USER

1. **Go to VS Code**
2. **Run app with Xcode console visible**
3. **Trigger GPS crash and capture error log**
4. **Search codebase for GPS/geolocation code**
5. **Apply fixes based on error message**
6. **Test thoroughly**
7. **Return to Xcode steps when both bugs are fixed**

---

## 💾 UPDATE QA SESSION LOG

Once fixed, update `QA_SESSION_LOG.md` with:

**Bug #3: GPS Crash on Run Start**
- Severity: HIGH
- Found: April 20, 2026 during Xcode testing
- Root cause: [To be determined]
- Fix: [To be documented]
- Status: RESOLVED (after fix)

**Bug #4: Garmin Sync Fails**
- Severity: MEDIUM
- Found: April 20, 2026 during Xcode testing
- Root cause: [To be determined]
- Fix: [To be documented]
- Status: RESOLVED (after fix)

---

## 🎯 SUCCESS CRITERIA

**Before continuing to TestFlight:**
- [ ] GPS tracking starts without crash
- [ ] Run can be tracked for at least 2 minutes
- [ ] App handles denied permissions gracefully
- [ ] No crashes in Xcode console
- [ ] Garmin sync either works or shows clear error message (not crash)

**Once these are fixed, resume XCODE_FINAL_STEPS.md at Step 7.**

---

## 📞 DEBUGGING TIPS

**Enable verbose logging:**
```typescript
// Add this at top of GPS-related files
const DEBUG = true;

if (DEBUG) {
  console.log('GPS: Checking permissions...');
  console.log('GPS: Requesting position...');
  console.log('GPS: Position received:', position);
}
```

**Check Capacitor installation:**
```bash
npx cap doctor
```

**Rebuild from scratch if needed:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
npx cap sync ios
```

---

**GOOD LUCK! Fix these bugs and come back to complete the TestFlight upload!** 🐛🔧
