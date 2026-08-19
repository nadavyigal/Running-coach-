# Next Steps: Fix GPS Permission on Device

## Background
Info.plist has all required location keys. Plugin.swift contains logging
(`[BackgroundGeolocation] Current authorization status`, etc.). The most
likely cause of GPS failure is a **cached permission denial** on the device.

---

## Step 1 — Clean Build in Xcode
- Menu: **Product → Clean Build Folder** (or press **⌘⇧K**)
- Wait for the clean to complete before proceeding

---

## Step 2 — Fix Cached Permission on iPhone 13

**Option A — Reset permission only:**
1. Go to **Settings → Privacy & Security → Location Services**
2. Scroll down and find **"RunSmart"** (or your app bundle name)
3. Check the current setting
4. If it shows **"Never"** or **"Ask Next Time"**, change it to **"While Using the App"**

**Option B — Full reset (recommended if Option A doesn't work):**
- Long-press the RunSmart app icon on iPhone → **Remove App**
- This clears all cached permissions; a fresh install will re-trigger the dialog

---

## Step 3 — Build and Run
1. In Xcode, confirm **iPhone 13** is selected as the destination (not Simulator)
2. Click **Run (▶)** or press **⌘R**
3. Open the Xcode console if not visible: **⌘⇧Y**

---

## Step 4 — Grant Permission on Device
When the app opens:
1. Navigate to start a run
2. Tap **"Start Run"**
3. A permission dialog **must appear** on a fresh install — tap **"Allow While Using App"**
4. Watch the Xcode console for:
   ```
   [BackgroundGeolocation] Starting location updates
   ```

---

## Step 5 — If Permission Dialog Never Appears

The permission is still cached as denied. Do a full reset:

1. Delete RunSmart from iPhone completely (long-press → Remove App)
2. In Xcode: **Product → Clean Build Folder (⌘⇧K)**
3. Build and run again — fresh install always triggers the permission dialog

---

## Step 6 — Still Failing?

Capture the Xcode console output when you attempt to start GPS and share it.
Key lines to look for:

| Log line | Meaning |
|---|---|
| `Current authorization status: 0` | Not determined — dialog should appear |
| `Current authorization status: 2` | Denied — delete app and reinstall |
| `Current authorization status: 3` | Always granted |
| `Current authorization status: 4` | While-in-use granted |
| `Starting location updates` | GPS started successfully |
| `Cannot start - no authorization` | Permission still denied |
