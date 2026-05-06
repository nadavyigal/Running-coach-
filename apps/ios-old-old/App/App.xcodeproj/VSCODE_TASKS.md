# 🔍 VS CODE PRE-FLIGHT CHECKLIST
**Complete These Tasks Before Moving to Xcode**

Run through this checklist in VS Code to catch issues early.
Mark each item as you complete it.

---

## 🎯 TASK 1: RUN AUTOMATED VALIDATION

### Make script executable and run it:
```bash
chmod +x validate-for-testflight.sh
./validate-for-testflight.sh
```

### Expected output:
```
✅ ALL CHECKS PASSED
Your app is ready for TestFlight upload!
```

### If you see errors:
- ❌ **Red errors** = MUST fix before proceeding
- ⚠️ **Yellow warnings** = Review and fix if applicable
- ✅ **Green checks** = All good!

**Status:** ☐ Complete

---

## 🎯 TASK 2: VERIFY CAPACITOR CONFIG

### Open: `capacitor.config.json` OR `capacitor.config.ts`

### Check these critical settings:

```json
{
  "appId": "com.yourcompany.runsmart",
  // ↑ Must be unique, lowercase, reverse-domain format
  
  "appName": "RunSmart",
  // ↑ Your app's display name
  
  "webDir": "dist",  // or "build" or "www"
  // ↑ Must match where your build outputs files
  
  "server": {
    "url": "",  // ← CRITICAL: Must be EMPTY or omit this section
    "cleartext": false
  }
}
```

### ❌ COMMON MISTAKES TO FIX:
```json
// ❌ BAD - Will break production app
"server": {
  "url": "http://localhost:3000"
}

// ❌ BAD - Wrong for production
"server": {
  "url": "http://192.168.1.100:8100"
}

// ✅ GOOD - For production
"server": {
  "url": ""
}

// ✅ BETTER - Remove server section entirely for production
```

### Checklist:
- [ ] `appId` uses reverse-domain notation
- [ ] `appId` is all lowercase
- [ ] `server.url` is empty string or section removed
- [ ] `webDir` points to correct build output folder
- [ ] No `localhost` anywhere in file

**Status:** ☐ Complete

---

## 🎯 TASK 3: CHECK ENVIRONMENT VARIABLES

### Files to check:
- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- Any custom config files

### Search for these problematic patterns:

#### 🔍 Search for: `localhost`
```bash
# In VS Code: Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows)
# Search: localhost
# In files: .env*
```

#### ❌ Problems to fix:
```bash
# ❌ Development URLs in production
API_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
API_ENDPOINT=http://192.168.1.100:8080

# ✅ Production-ready URLs
API_URL=https://api.runsmart.com
BACKEND_URL=https://backend.runsmart.com
API_ENDPOINT=https://api.runsmart.com/v1
```

#### 🔍 Search for: `DEBUG` or `debug`
```bash
# Should be false/disabled for production
```

#### ❌ Problems to fix:
```bash
# ❌ Debug enabled
DEBUG=true
DEBUG_MODE=true
NODE_ENV=development

# ✅ Production settings
DEBUG=false
DEBUG_MODE=false
NODE_ENV=production
```

### Checklist:
- [ ] No `localhost` URLs
- [ ] No local IP addresses (192.168.x.x)
- [ ] All URLs use HTTPS (not HTTP)
- [ ] Debug flags are false/disabled
- [ ] `NODE_ENV` is `production` (if applicable)
- [ ] Production API keys are valid

**Status:** ☐ Complete

---

## 🎯 TASK 4: CLEAN UP DEBUG CODE

### 🔍 Search Pattern 1: `console.log`

**Search in:** All `.js`, `.ts`, `.jsx`, `.tsx` files in `src/`

**VS Code Search:**
```
Search: console\.log
Files to include: src/**/*.{js,ts,jsx,tsx}
Files to exclude: node_modules/
```

#### Options for fixing:
```typescript
// Option 1: Delete the line entirely (recommended)
// console.log('Debug info:', data);  // ← DELETE THIS

// Option 2: Wrap in debug flag (if you need it for development)
if (__DEV__) {
  console.log('Debug info:', data);
}

// Option 3: Replace with proper logging service
// logger.debug('Debug info:', data);
```

#### ⚠️ NEVER log sensitive data:
```typescript
// ❌ SECURITY RISK - Delete these!
console.log('Password:', password);
console.log('API Key:', apiKey);
console.log('User token:', token);
console.log('Credit card:', cardNumber);
```

---

### 🔍 Search Pattern 2: `console.debug`

**Same as console.log** - remove or wrap in debug flag

---

### 🔍 Search Pattern 3: `console.warn`

**Usually okay to keep** but review each one:
```typescript
// ✅ Okay - legitimate warning
console.warn('GPS accuracy is low');

// ❌ Remove - debug noise
console.warn('Component rendering');
```

---

### 🔍 Search Pattern 4: `debugger;`

**VS Code Search:**
```
Search: debugger;
Files to include: src/**/*.{js,ts,jsx,tsx}
```

#### ❌ MUST DELETE ALL:
```typescript
// ❌ REMOVE - Will pause app in production
debugger;
```

---

### 🔍 Search Pattern 5: `alert(`

**VS Code Search:**
```
Search: alert\(
Files to include: src/**/*.{js,ts,jsx,tsx}
```

#### ❌ Replace with proper UI:
```typescript
// ❌ BAD - Ugly browser alert
alert('Run saved!');

// ✅ GOOD - Toast notification or modal
showToast('Run saved successfully!');
showNotification({ message: 'Run saved!', type: 'success' });
```

---

### Checklist:
- [ ] Searched for `console.log` and cleaned up
- [ ] Searched for `console.debug` and cleaned up
- [ ] Searched for `debugger;` and removed all
- [ ] Searched for `alert(` and replaced with proper UI
- [ ] No sensitive data logged anywhere

**Status:** ☐ Complete

---

## 🎯 TASK 5: REVIEW API CONFIGURATION

### Find your API configuration files
Common locations:
- `src/services/api.js` or `api.ts`
- `src/config/api.js` or `config.ts`
- `src/utils/http.js` or `http.ts`
- `src/lib/api.js` or `api.ts`

### Check for these issues:

#### ❌ Hardcoded localhost:
```typescript
// ❌ BAD
const API_URL = 'http://localhost:3000';

// ✅ GOOD
const API_URL = process.env.REACT_APP_API_URL || 'https://api.runsmart.com';
```

#### ❌ No error handling:
```typescript
// ❌ BAD - No error handling
const response = await fetch(url);
const data = await response.json();
return data;

// ✅ GOOD - Proper error handling
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API request failed:', error);
  throw error;
}
```

#### ❌ No timeout:
```typescript
// ✅ Add timeout to all API calls
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
  const response = await fetch(url, { signal: controller.signal });
  // ... handle response
} finally {
  clearTimeout(timeoutId);
}
```

### Checklist:
- [ ] No hardcoded localhost URLs
- [ ] All API calls have error handling
- [ ] Timeout configured (30s max)
- [ ] User-friendly error messages shown
- [ ] Network errors handled gracefully

**Status:** ☐ Complete

---

## 🎯 TASK 6: VERIFY EMAIL VERIFICATION FIX

Since you mentioned this bug was fixed, let's verify:

### Find email verification code:
Look for files related to:
- Password reset
- Email verification
- Forgot password
- Account verification

### Test these endpoints (manually or with tests):

#### Password Reset Flow:
```typescript
// Should work without "Failed to send reset email" error
1. User enters email
2. Click "Send Reset Email"
3. Backend sends email successfully
4. User receives email
5. Click link in email
6. Reset password form appears
7. Submit new password
8. Successfully reset
```

### Check for these fixes:
- [ ] Backend endpoint is correct production URL
- [ ] Email service configured correctly
- [ ] Error handling shows user-friendly messages
- [ ] Success message confirms email sent
- [ ] No console errors when triggering

### Manual test on iPhone 13:
- [ ] Open app on device
- [ ] Go to "Forgot Password"
- [ ] Enter valid email
- [ ] Tap "Send Reset Email"
- [ ] Should see success message (not error)
- [ ] Check email inbox (may take 1-2 minutes)
- [ ] Email arrives successfully

**Status:** ☐ Complete

---

## 🎯 TASK 7: VERIFY GPS FIX

Since you mentioned this bug was fixed, let's verify:

### Find GPS/Location code:
Look for files related to:
- Location tracking
- GPS services
- Run tracking
- Map/route services

### Check implementation:

#### ✅ Proper permission request:
```typescript
// Should request permissions before accessing location
if (!hasLocationPermission) {
  await requestLocationPermission();
}

// Then start tracking
startGPSTracking();
```

#### ✅ Error handling:
```typescript
try {
  const position = await getCurrentPosition();
  // Use position
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    showMessage('Location permission required to track runs');
  } else if (error.code === 'POSITION_UNAVAILABLE') {
    showMessage('Unable to get your location. Make sure GPS is enabled.');
  }
}
```

### Manual test on iPhone 13:
- [ ] Open app on device
- [ ] Navigate to start run screen
- [ ] Tap "Start Run"
- [ ] Location permission prompt appears
- [ ] Grant permission "While Using the App"
- [ ] GPS starts tracking
- [ ] Walk/run outdoors for 2 minutes
- [ ] Verify map shows your route
- [ ] Verify distance updates correctly
- [ ] Stop run
- [ ] Run saves successfully

**Status:** ☐ Complete

---

## 🎯 TASK 8: BUILD PRODUCTION BUNDLE

### Step 1: Clean old builds
```bash
# Remove old build artifacts
rm -rf dist/
rm -rf build/
rm -rf www/

# Or if you use npm script:
npm run clean  # if available
```

### Step 2: Install dependencies
```bash
# Make sure all dependencies are installed
npm install

# Check for outdated packages (optional but recommended)
npm outdated

# Fix security vulnerabilities (if any)
npm audit fix
```

### Step 3: Build for production
```bash
# Your build command (adjust as needed):
npm run build

# OR
npm run build:prod

# OR
yarn build
```

### Expected output:
```
✓ Build completed successfully
✓ Output written to dist/ (or build/ or www/)
✓ No errors
✓ No critical warnings
```

### ❌ If build fails:
1. Read error messages carefully
2. Fix TypeScript errors (no `@ts-ignore` shortcuts)
3. Fix import errors
4. Fix syntax errors
5. Run build again

### Step 4: Verify build output
```bash
# Check that build folder exists and has content
ls -la dist/  # or build/ or www/

# Should see:
# - index.html
# - JavaScript bundle files (.js)
# - CSS files (.css)
# - Assets folder
```

### Checklist:
- [ ] Old builds cleaned
- [ ] Dependencies installed
- [ ] Build command runs without errors
- [ ] Build output folder exists
- [ ] Build output contains all necessary files
- [ ] No TypeScript compilation errors
- [ ] No critical webpack/bundler warnings

**Status:** ☐ Complete

---

## 🎯 TASK 9: SYNC WITH IOS

### Run Capacitor sync:
```bash
# This copies your web build to the iOS app
npx cap sync ios

# Should see output like:
# ✔ Copying web assets from dist to ios/App/public
# ✔ Copying native bridge
# ✔ Copying Capacitor plugins
# ✔ Updating iOS plugins
```

### Verify sync was successful:
```bash
# Check that iOS app has your web content
ls -la ios/App/public/

# Should contain:
# - Your built HTML, JS, CSS files
# - Assets from your build
```

### If sync fails:
```bash
# Try updating Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest @capacitor/ios@latest

# Then sync again
npx cap sync ios
```

### Checklist:
- [ ] `npx cap sync ios` completed successfully
- [ ] No errors in sync output
- [ ] `ios/App/public/` folder has your built files
- [ ] No missing assets

**Status:** ☐ Complete

---

## 🎯 TASK 10: FINAL SECURITY CHECK

### 🔍 Search for hardcoded secrets:

**VS Code Search patterns:**
```
Search 1: api[_-]?key.*=.*['"][a-zA-Z0-9]+
Search 2: secret.*=.*['"][a-zA-Z0-9]+
Search 3: password.*=.*['"][a-zA-Z0-9]+
Search 4: token.*=.*['"][a-zA-Z0-9]+
```

### ❌ NEVER hardcode:
```typescript
// ❌ DANGER - Exposed in app bundle
const API_KEY = 'abc123secretkey456';
const PASSWORD = 'mySecretPassword123';
const AUTH_TOKEN = 'Bearer abc123xyz789';

// ✅ SAFE - Use environment variables
const API_KEY = process.env.REACT_APP_API_KEY;
const API_URL = process.env.REACT_APP_API_URL;

// ✅ SAFE - Retrieve from secure backend
const token = await fetchTokenFromBackend();
```

### Check for exposed data in:
- [ ] Source files (.js, .ts, .jsx, .tsx)
- [ ] Configuration files
- [ ] .env files (these ARE bundled if not handled correctly)
- [ ] Comments (don't leave secrets in comments!)

### Checklist:
- [ ] No hardcoded API keys
- [ ] No hardcoded passwords
- [ ] No hardcoded tokens
- [ ] Secrets loaded from environment or backend
- [ ] .env.example exists (without real secrets)

**Status:** ☐ Complete

---

## ✅ VS CODE COMPLETION CHECKLIST

Mark all as complete before moving to Xcode:

- [ ] **Task 1:** Ran validation script - passed
- [ ] **Task 2:** Capacitor config verified
- [ ] **Task 3:** Environment variables checked
- [ ] **Task 4:** Debug code cleaned up
- [ ] **Task 5:** API configuration reviewed
- [ ] **Task 6:** Email verification tested
- [ ] **Task 7:** GPS tracking tested
- [ ] **Task 8:** Production build successful
- [ ] **Task 9:** Capacitor sync successful
- [ ] **Task 10:** Security check passed

---

## 🚀 NEXT STEPS

### When all VS Code tasks are complete:

1. **Open Xcode:**
   ```bash
   npx cap open ios
   ```

2. **Continue with Xcode tasks:**
   - See `QUICK_TESTFLIGHT_GUIDE.md` Phase 2
   - See `VSCODE_PREPARATION_CHECKLIST.md` Phase 1 (Xcode section)

3. **Archive and upload:**
   - Product → Archive
   - Distribute to App Store Connect

---

## 📝 NOTES / ISSUES FOUND

Use this space to document any issues you encounter:

```
Issue 1: [Description]
Solution: [How you fixed it]

Issue 2: [Description]
Solution: [How you fixed it]
```

---

## ⏱️ ESTIMATED TIME

- Tasks 1-3: 15 minutes
- Tasks 4-7: 30 minutes
- Tasks 8-10: 15 minutes

**Total: ~60 minutes**

---

**When complete, you're ready for Xcode! 🎉**

Open Xcode and follow `QUICK_TESTFLIGHT_GUIDE.md` Phase 2.
