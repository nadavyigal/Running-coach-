# ⚡ QUICK FIX COMMANDS - GPS

**Copy and paste these commands in order.**

---

## 📍 Step 1: Run Fix Script

```bash
python3 fix-infoplist.py
```

Type `y` when asked.

---

## 📍 Step 2: Sync to iOS

```bash
npx cap sync ios
```

---

## 📍 Step 3: Open Xcode

```bash
npx cap open ios
```

---

## 📍 Step 4: In Xcode

**Clean Build:**
- Press: `⌘⇧K` (Command + Shift + K)

**Delete app from iPhone:**
- Long-press RunSmart app → Remove App → Delete

**Build and Run:**
- Press: `⌘R` (Command + R)

---

## 📍 Step 5: Test

- Start a run in app
- Permission popup appears ✅
- Tap "Allow While Using App"
- GPS works! 🎉

---

## ✅ Verify

iPhone Settings → RunSmart → Should see "Location" option

---

## 🆘 If Script Doesn't Work

**Find Info.plist:**
```bash
find . -name "Info.plist" -path "*/ios/*" -not -path "*/node_modules/*"
```

**Check if permissions exist:**
```bash
grep "NSLocationWhenInUse" apps/ios/App/App/Info.plist
```

If nothing appears, see **FIX_GPS_NOW.md** for manual fix.

---

**Total time: 5-10 minutes** ⏱️
