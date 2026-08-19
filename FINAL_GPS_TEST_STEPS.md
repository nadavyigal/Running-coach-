# FINAL GPS TEST - RunSmart

## Step 1: Link the xcconfig file in Xcode

The App.xcconfig was created but needs to be linked in Xcode:

1. In Xcode, click the blue project icon at the top of the left navigator (not the red App target)
2. Select the PROJECT (blue icon) in the list, not the target
3. Click the "Info" tab
4. Under "Configurations", you'll see Debug and Release rows
5. For the "App" target column:
   - Click the dropdown under Debug → select "App"
   - Click the dropdown under Release → select "release" (the one we created earlier)
6. If you don't see these options, you need to add the xcconfig file:
   - Right-click on the "App" folder in left navigator
   - Add Files to "App"
   - Navigate to apps/ios/App/App.xcconfig
   - Check "Copy items if needed"
   - Add it

## Step 2: Clean Build in Xcode

1. Product → Clean Build Folder (⌘⇧K)
2. Wait for completion

## Step 3: Verify iPhone Settings

On your iPhone 13:
1. Settings → Privacy & Security → Location Services
2. Make sure Location Services is ON at the top
3. Scroll down to find your app (RunSmart or bundle name)
4. If you see it, check what permission it has:
   - If "Never" → Change to "While Using the App"
   - If "Ask Next Time" → Good, leave it
5. If you DON'T see your app in the list → PERFECT (fresh install)

## Step 4: Build and Run

1. In Xcode, select your iPhone 13 as destination
2. Click Run (▶️) or press ⌘R
3. App installs and launches
4. IMMEDIATELY open the Xcode console:
   - Press ⌘⇧Y to show Debug area at bottom
   - You should see app launch logs

## Step 5: Test GPS and Watch Console

1. In the app on iPhone, navigate to start a run
2. KEEP WATCHING the Xcode console
3. Tap "Start Run" button
4. IMMEDIATELY look for these logs:

Expected console output:

```
[BackgroundGeolocation] Current authorization status: 0   ← Not determined (dialog will appear)
[BackgroundGeolocation] Requesting initial permission
```
→ Permission dialog appears on iPhone → Tap "Allow While Using App"
```
[BackgroundGeolocation] Authorization changed to: 4       ← While in use granted
[BackgroundGeolocation] Permission granted, starting location updates
[BackgroundGeolocation] Starting location updates
```

## Step 6: Interpret Console Output

| Log line | Status raw value | Meaning | Action |
|---|---|---|---|
| `authorization status: 0` | Not determined | Dialog will appear | Tap Allow |
| `authorization status: 2` | Denied | Cached denial | Delete app, reinstall |
| `authorization status: 3` | Always | Full access | GPS should work |
| `authorization status: 4` | While in use | Standard access | GPS should work |
| `Starting location updates` | — | GPS is running | Success |
| `Cannot start - no authorization` | — | Still denied | See Step 7 |

## Step 7: If GPS Still Fails

**Scenario A — status: 2 (Denied)**
1. Delete RunSmart from iPhone (long-press → Remove App)
2. In Xcode: Product → Clean Build Folder (⌘⇧K)
3. Run again — fresh install resets permissions

**Scenario B — No [BackgroundGeolocation] logs appear at all**
- The plugin is not loading. Check that the Xcode console filter is empty (no filter text in the search box at bottom right of console)
- Try typing "BackgroundGeolocation" in the console filter to isolate those logs

**Scenario C — Dialog appeared but GPS coordinates never update**
- The plugin started but the JS layer isn't receiving updates
- Share the full Xcode console output from app launch through attempting to start a run

## Step 8: Share Results

If GPS still fails after all steps above, copy and paste the full Xcode console output (from app launch to attempting GPS) into the chat. Key sections to include:

1. Everything logged at app launch
2. All `[BackgroundGeolocation]` lines
3. Any lines containing "error", "Error", or "denied"
4. Any JavaScript errors in the console

---

*Files changed in this session:*
- `apps/ios/App/App/Info.plist` — added `UIRequiresFullScreen`
- `apps/ios/App/App.xcconfig` — created with deprecation warning suppression
