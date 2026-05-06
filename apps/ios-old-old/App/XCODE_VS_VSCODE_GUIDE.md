# 🗺️ XCODE vs VS CODE - WHEN TO USE WHAT

**You said you get lost between Xcode and VS Code.**  
**This guide shows you exactly when to use each tool.**

---

## 📋 QUICK ANSWER

### VS Code = Write Code
**Use VS Code for:**
- Editing your app code (JavaScript, TypeScript, React, Next.js)
- Running terminal commands (`npm`, `npx`)
- Managing files and folders
- Git commits

### Xcode = Build iOS App
**Use Xcode for:**
- Building the iOS app
- Running on your iPhone
- Managing iOS settings (permissions, signing)
- Uploading to TestFlight

---

## 🔄 TYPICAL WORKFLOW

```
┌─────────────────────────────────────────────────────┐
│ 1. VS CODE: Write your app code                    │
│    - Edit files in app/, components/, etc.         │
│    - Make changes, add features, fix bugs          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 2. VS CODE TERMINAL: Build the app                 │
│    Run: npm run build                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 3. VS CODE TERMINAL: Sync to iOS                   │
│    Run: npx cap sync ios                           │
│    (Copies your web app into iOS project)          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 4. VS CODE TERMINAL: Open Xcode                    │
│    Run: npx cap open ios                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 5. XCODE: Build and test on iPhone                 │
│    - Select your iPhone                            │
│    - Press Run button (▶️)                         │
│    - Test on device                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 6. XCODE: Upload to TestFlight (when ready)        │
│    - Product → Archive                             │
│    - Distribute to App Store Connect               │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 FOR YOUR GPS ISSUE

**Here's what tool to use for each step:**

### Step 1: Fix Info.plist
**Tool:** VS Code Terminal (or any terminal)

```bash
python3 fix-infoplist.py
```

**What it does:** Adds location permission keys to your iOS Info.plist

---

### Step 2: Sync to iOS
**Tool:** VS Code Terminal

```bash
npx cap sync ios
```

**What it does:** Updates the iOS project with the fixed Info.plist

---

### Step 3: Open Xcode
**Tool:** VS Code Terminal

```bash
npx cap open ios
```

**What it does:** Opens Xcode with your iOS project

---

### Step 4: Clean Build
**Tool:** Xcode

Press: `⌘⇧K` (Command + Shift + K)  
Or: Menu → Product → Clean Build Folder

**What it does:** Clears old build files so changes take effect

---

### Step 5: Delete App from iPhone
**Tool:** Your iPhone (manually)

Long-press RunSmart app → Remove App → Delete

**What it does:** Ensures iOS recognizes new permissions on next install

---

### Step 6: Build and Run
**Tool:** Xcode

Press: `▶️` button or `⌘R`

**What it does:** Installs updated app on your iPhone

---

### Step 7: Test GPS
**Tool:** Your iPhone (RunSmart app)

Start a run → Location permission popup should appear → Allow

**What it does:** Tests that GPS now works with permissions

---

## 📝 FILE LOCATIONS

**VS Code shows your web app files:**
```
your-project/
├── app/              ← Your Next.js pages
├── components/       ← Your React components
├── package.json      ← Dependencies
└── apps/
    └── ios/          ← iOS project (don't edit here often)
```

**Xcode shows your iOS project:**
```
apps/ios/App/
├── App/
│   ├── Info.plist    ← iOS permissions (edited by script)
│   └── public/       ← Your web app (copied by Capacitor)
└── App.xcodeproj     ← Xcode project file
```

**Key insight:** The `apps/ios/App/App/public/` folder contains your web app, which Capacitor copies from your build output when you run `npx cap sync ios`.

---

## 🔄 WHEN DO CHANGES GO WHERE?

### Changes in VS Code (app code):
1. Edit files in VS Code
2. Run `npm run build`
3. Run `npx cap sync ios` ← This copies to Xcode project
4. Open Xcode and rebuild

### Changes in Xcode (iOS settings):
1. Edit in Xcode (like signing, permissions)
2. Just rebuild in Xcode
3. No need to go back to VS Code

### For your GPS fix:
The script edits `Info.plist` which is in the Xcode project, but you run it from VS Code terminal. Then you sync and rebuild in Xcode.

---

## 🎯 RULE OF THUMB

### "I want to change app behavior/UI" → VS Code
- Edit code
- Build
- Sync to iOS
- Test in Xcode

### "I want to change iOS settings" → Xcode
- Signing
- Permissions
- Capabilities
- Build settings

### "I want to fix GPS" → Both!
1. VS Code terminal: Run fix script
2. VS Code terminal: Sync to iOS  
3. Xcode: Clean, delete app, rebuild
4. iPhone: Test

---

## 📱 CURRENT STATE: GPS FIX

**You are here:**
```
VS Code Terminal ← You need to run the fix script here
    ↓
Xcode ← Then rebuild here
    ↓
iPhone ← Then test here
```

**Next steps:**
1. Open VS Code (or any terminal)
2. Navigate to your project folder
3. Run: `python3 fix-infoplist.py`
4. Run: `npx cap sync ios`
5. Run: `npx cap open ios`
6. In Xcode: Clean, delete app, rebuild
7. Test on iPhone

---

## 🆘 STILL CONFUSED?

### Think of it this way:

**VS Code** = Your web development environment
- You're building a web app (Next.js/React)
- This is where you spend most of your coding time

**Capacitor** = The bridge
- `npx cap sync ios` copies your web app into a native iOS shell
- It's like packaging your web app as an iOS app

**Xcode** = Apple's iOS development tool
- Takes the packaged app and builds it for iPhone
- Handles iOS-specific stuff (signing, permissions, etc.)
- Required for TestFlight and App Store

**Your iPhone** = The testing device
- Where you actually run and test the app

---

## ✅ TL;DR

**For GPS fix:**
1. **VS Code terminal:** `python3 fix-infoplist.py` → Type `y`
2. **VS Code terminal:** `npx cap sync ios`
3. **VS Code terminal:** `npx cap open ios`
4. **Xcode:** Clean (⌘⇧K)
5. **iPhone:** Delete app
6. **Xcode:** Build and run (⌘R)
7. **iPhone:** Test GPS → Should work! ✅

**Total time: 5-10 minutes**

---

## 📚 AFTER GPS IS FIXED

Follow **XCODE_FINAL_STEPS.md** to upload to TestFlight.

Most of that is done in Xcode (building, archiving, uploading).

---

**Ready to fix GPS? Run this now:**

```bash
python3 fix-infoplist.py
```

**Then follow the steps above!** 🚀
