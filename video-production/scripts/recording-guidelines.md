# Screen Recording Guidelines

**Purpose:** Technical setup and best practices for capturing high-quality screen recordings of the Run-Smart UI.

---

## Recording Software Recommendations

### For Desktop/Web App (16:9 recordings)

#### Option 1: OBS Studio (Free, Professional)
- **Pros:** Free, high quality, full control, no watermarks
- **Cons:** Steeper learning curve
- **Download:** https://obsproject.com/
- **Recommended Settings:**
  - Output: MP4
  - Encoder: x264
  - Rate Control: CBR
  - Bitrate: 15000 Kbps
  - Keyframe Interval: 2
  - Preset: Quality
  - Profile: High
  - Resolution: 1920×1080 (16:9)
  - FPS: 30 or 60

#### Option 2: Loom (Easiest, Web-based)
- **Pros:** Very easy, instant sharing, cloud storage
- **Cons:** Free tier has limits, less control
- **Download:** https://www.loom.com/
- **Recommended Settings:**
  - Quality: 1080p HD
  - Frame rate: 30fps
  - Record: "Screen only" (not camera)
  - Download MP4 after recording

#### Option 3: ScreenFlow (Mac, Paid)
- **Pros:** Professional, built-in editing, easy to use
- **Cons:** Mac only, $169
- **Download:** https://www.telestream.net/screenflow/
- **Recommended Settings:**
  - Resolution: 1920×1080
  - Frame rate: 30fps
  - Quality: High

#### Option 4: Camtasia (Windows/Mac, Paid)
- **Pros:** Professional, built-in editing, cursor effects
- **Cons:** Expensive ($299)
- **Download:** https://www.techsmith.com/video-editor.html

### For Mobile App (9:16 recordings)

#### Option 1: QuickTime Player + iPhone (Mac, Free)
- Connect iPhone to Mac via USB
- Open QuickTime Player → File → New Movie Recording
- Select iPhone as camera source
- Record screen directly
- **Pros:** High quality, native resolution, free
- **Cons:** Mac only, requires USB connection

#### Option 2: iOS Built-in Screen Recording (iPhone, Free)
- Settings → Control Center → Add "Screen Recording"
- Swipe down from top-right, tap record button
- Recordings save to Photos app
- **Pros:** No additional software, native quality
- **Cons:** Need to AirDrop/transfer files to computer

#### Option 3: Android Screen Recording (Android, Free)
- Built-in on Android 11+
- Swipe down → "Screen record"
- **Pros:** Native, free
- **Cons:** Quality varies by device

#### Option 4: Responsive Design Mode (Desktop Browser)
- Use Chrome/Firefox DevTools responsive mode
- Set to 375×812 (iPhone 13 size)
- Record with OBS/Loom at 1080×1920 canvas
- **Pros:** Easy, no phone needed
- **Cons:** Not actual mobile device (may miss touch interactions)

---

## Pre-Recording Setup Checklist

### System Preparation

#### Operating System
- [ ] Close all unnecessary applications
- [ ] Disable notifications:
  - **Mac:** System Preferences → Notifications → Do Not Disturb ON
  - **Windows:** Settings → System → Focus Assist → Alarms only
- [ ] Hide desktop icons (optional, for clean look):
  - **Mac:** Terminal → `defaults write com.apple.finder CreateDesktop false; killall Finder`
  - **Windows:** Right-click desktop → View → uncheck "Show desktop icons"
- [ ] Set screen resolution to target:
  - **16:9 recordings:** 1920×1080 (Full HD)
  - **9:16 recordings:** Device native (usually 1080×1920 or 1170×2532)
- [ ] Disable screen saver and sleep mode
- [ ] Charge device to 100% (or plug in)

#### Browser/App Preparation (if recording web app)
- [ ] Use Chrome or Firefox (best rendering)
- [ ] Open in Incognito/Private mode (clean slate)
- [ ] Set browser zoom to 100% (Cmd/Ctrl + 0)
- [ ] Full screen mode (F11 on Windows, Cmd+Ctrl+F on Mac)
- [ ] Clear browser cache and cookies
- [ ] Close all other tabs
- [ ] Disable browser extensions (or use Incognito)
- [ ] Check DevTools console for errors (F12, then close DevTools)

#### App State Preparation
- [ ] Load demo user account (not personal data)
- [ ] Seed database with realistic demo data:
  - User: "Demo Runner" or "Alex Smith"
  - Goal: Realistic (e.g., "5K in 8 weeks")
  - Workouts: Varied and realistic (Easy Run, Intervals, Long Run, Rest)
  - Dates: Current week + upcoming weeks
  - Progress: Believable streak (3-7 days, not 347 days)
- [ ] Clear any error messages or warnings
- [ ] Ensure all images/assets are loaded
- [ ] Test navigation before recording (make sure everything works)

### Visual Settings
- [ ] Screen brightness: 100%
- [ ] Dark mode or light mode (choose one, be consistent)
- [ ] High contrast for readability
- [ ] Font rendering is crisp (check at 100% zoom)
- [ ] Colors match brand (if applicable)

### Audio Settings
- [ ] **Mute system audio** (unless recording voiceover simultaneously)
- [ ] If recording VO: Use external microphone (USB condenser minimum)
- [ ] Test mic levels: -18dB to -12dB average
- [ ] Quiet room: No background noise (AC, traffic, pets)
- [ ] Close windows, turn off fans
- [ ] Use headphones to monitor audio (if recording VO)

---

## Recording Best Practices

### The Slow Motion Principle

**Record everything at ~70% of normal speed.**

Why? Because:
- Viewers need time to process what they're seeing
- Editors need clean in/out points for cuts
- Slowing down feels calm and intentional
- Speeding up in post is easy; slowing down creates artifacts

### The Pause-Action-Pause Rhythm

Every interaction should follow this pattern:

```
1. PAUSE (1-2s) - Let UI settle
2. MOVE CURSOR SLOWLY - Telegraph intention
3. HOVER (0.5s) - Show target
4. CLICK/TAP - Deliberate action
5. PAUSE (1-2s) - Show result
```

### Cursor Movement Guidelines

#### Speed
- Move cursor at ~200 pixels per second (very slow)
- Think "teaching someone" not "using normally"
- Pretend you're demonstrating to someone over your shoulder

#### Path
- Move in straight lines or gentle curves (not erratic)
- Don't circle/hover excessively (looks nervous)
- One smooth motion from A to B

#### Visibility
- Enable cursor highlighting in recording software
- Use a larger cursor size (150-200% of normal)
- **OBS:** No built-in cursor highlight (use system settings or add-ons)
- **Loom:** Cursor highlighting available in settings
- **Mac System:** System Preferences → Accessibility → Display → Cursor Size (drag to right)
- **Windows System:** Settings → Ease of Access → Cursor & pointer → Change pointer size

### Click/Tap Guidelines

#### Desktop Clicks
- Single click only (no double-clicks unless necessary)
- Pause 0.5s after hover before clicking
- Hold click for 1 frame longer than normal (subtle but visible)
- Don't click and drag unless essential

#### Mobile Taps
- Use single finger (not thumb—looks awkward on camera)
- Tap and hold briefly (250-300ms)
- Don't obscure the UI element with your finger
- Keep hand out of frame when not tapping

### Scroll Guidelines

#### When to Scroll
- Only scroll if content extends below the fold
- Maximum 1 scroll per screen recording
- Prefer showing everything in one view if possible

#### How to Scroll
- **Speed:** ~100 pixels per second (very slow)
- **Distance:** 1-2 screen heights maximum
- **Method:**
  - Desktop: Use mouse wheel (not scrollbar drag)
  - Mobile: Single finger swipe (smooth and controlled)
- **Easing:** Start slow, constant speed, end slow (no sudden stops)

#### Scroll Timing
```
1. PAUSE (2s) - Show initial view
2. BEGIN SCROLL - Smooth start
3. SCROLL (1-2s) - Constant gentle speed
4. END SCROLL - Smooth stop
5. PAUSE (2s) - Show final view
```

---

## Recording Workflow

### Step-by-Step Process

#### 1. Test Recording (Always do this first)
- [ ] Record 10 seconds of any screen
- [ ] Stop recording
- [ ] Play back and check:
  - [ ] Resolution is correct
  - [ ] Frame rate is smooth (30fps minimum)
  - [ ] UI is crisp and readable
  - [ ] No audio recording (unless intended)
  - [ ] File saves correctly
- [ ] If any issues, adjust settings and test again

#### 2. Mental Rehearsal
- [ ] Review the shot list for the screen you're about to record
- [ ] Visualize the exact sequence of actions
- [ ] Practice the timing in your head: "Pause... move... pause... click... pause..."
- [ ] Identify the start and end frames

#### 3. Physical Rehearsal
- [ ] Do a "dry run" without recording
- [ ] Practice the cursor movement
- [ ] Practice the pauses
- [ ] Make sure the app responds correctly
- [ ] Adjust if anything feels awkward

#### 4. Record (The Real Take)
- [ ] Start recording software
- [ ] Count to 3 in your head (creates padding at start)
- [ ] Execute the planned actions at 70% speed
- [ ] Count to 3 at end (creates padding)
- [ ] Stop recording

#### 5. Immediate Review
- [ ] Watch the recording immediately
- [ ] Check for:
  - [ ] Clean start (UI fully loaded)
  - [ ] Clean end (UI stable, cursor still)
  - [ ] No accidental clicks
  - [ ] No notification pop-ups
  - [ ] Text is readable
  - [ ] Actions are smooth
- [ ] If ANY issues: Delete and re-record (don't try to "fix in post")

#### 6. Label and Save
- [ ] Rename file according to naming convention: `[Screen#]-[Name]-[AspectRatio]-[Take#].mp4`
  - Example: `05-adaptation-result-16x9-take1.mp4`
- [ ] Move to appropriate folder (16x9/ or 9x16/)
- [ ] If you record multiple takes, keep all until final selection
- [ ] Update recording checklist

---

## Common Recording Mistakes and How to Avoid Them

### Mistake 1: Moving Too Fast
**Problem:** Cursor movements look frantic, viewers can't follow
**Solution:** Slow down to 70% speed, count "one-Mississippi" between actions

### Mistake 2: No Pauses
**Problem:** Continuous action with no breaks, viewers get overwhelmed
**Solution:** Pause 1-2 seconds before and after every action

### Mistake 3: Notifications/Pop-ups
**Problem:** System notification appears during recording
**Solution:** Enable Do Not Disturb BEFORE recording, test it

### Mistake 4: Cursor Out of Frame
**Problem:** Cursor moves off-screen or disappears
**Solution:** Keep cursor visible at all times, plan movements within frame

### Mistake 5: Low Resolution
**Problem:** Text is blurry or pixelated
**Solution:** Record at native resolution (1920×1080 minimum for 16:9)

### Mistake 6: Inconsistent UI State
**Problem:** Different data in each recording (confusing for viewers)
**Solution:** Use the same demo data for all recordings, reset to known state

### Mistake 7: Audio Interference
**Problem:** Background noise, system sounds, mic pop
**Solution:** Mute system audio, use quiet room, use pop filter on mic

### Mistake 8: Jerky Scrolling
**Problem:** Scroll is too fast or stutters
**Solution:** Slow, constant speed; use mouse wheel, not scrollbar

### Mistake 9: Partial UI Elements
**Problem:** Button or text is cut off at edge of frame
**Solution:** Center important elements, leave 5% margin on all sides

### Mistake 10: App Freezes/Lags
**Problem:** UI stutters or freezes during recording
**Solution:** Close other apps, restart browser, clear cache

---

## File Management

### Naming Convention

Use this exact format:
```
[ScreenNumber]-[ScreenName]-[AspectRatio]-[TakeNumber].mp4
```

**Examples:**
- `01-onboarding-16x9-take1.mp4`
- `05-adaptation-result-9x16-take3.mp4`
- `06-ai-chat-16x9-final.mp4`

**Screen Numbers:**
- 01: Onboarding
- 02: Today
- 03: Calendar
- 04: Missed Workout
- 05: Adaptation Result
- 06: AI Chat
- 07: Recovery
- 08: Progress
- 09: End Card

### Folder Structure

```
video-production/assets/raw-footage/
├── 16x9/
│   ├── 01-onboarding-16x9-take1.mp4
│   ├── 01-onboarding-16x9-take2.mp4
│   ├── 02-today-16x9-take1.mp4
│   ├── 03-calendar-16x9-take1.mp4
│   ├── 04-missed-workout-16x9-take1.mp4
│   ├── 05-adaptation-result-16x9-take1.mp4 ⭐
│   ├── 05-adaptation-result-16x9-take2.mp4 ⭐
│   ├── 05-adaptation-result-16x9-take3.mp4 ⭐
│   ├── 06-ai-chat-16x9-take1.mp4
│   ├── 07-recovery-16x9-take1.mp4
│   ├── 08-progress-16x9-take1.mp4
│   └── 09-end-card-16x9.png
├── 9x16/
│   ├── 01-onboarding-9x16-take1.mp4
│   ├── 02-today-9x16-take1.mp4
│   └── ... (same structure)
└── b-roll/ (optional)
    ├── person-checking-calendar.mp4
    └── person-running-outdoors.mp4
```

### Backup Strategy
- [ ] Keep all takes until project is complete
- [ ] Upload to cloud storage (Google Drive, Dropbox, etc.) immediately
- [ ] Keep local copy on external drive
- [ ] Don't delete "bad" takes until you're sure you have good ones

---

## Quality Standards Checklist

Before moving to editing, ensure each recording meets these standards:

### Visual Quality
- [ ] Resolution: 1920×1080 (16:9) or 1080×1920 (9:16)
- [ ] Frame rate: 30fps minimum (60fps preferred)
- [ ] Bitrate: 10 Mbps minimum
- [ ] Codec: H.264 (MP4 container)
- [ ] Text is sharp and readable at 100% playback
- [ ] Colors are accurate and vibrant
- [ ] No compression artifacts or banding

### Content Quality
- [ ] UI is fully loaded at start of clip
- [ ] No loading spinners or partial renders
- [ ] All text is readable (no Lorem Ipsum)
- [ ] Demo data is realistic and consistent
- [ ] No personal information visible
- [ ] No error messages or warnings
- [ ] No notification pop-ups

### Action Quality
- [ ] Cursor movements are smooth and intentional
- [ ] Clicks/taps are visible and deliberate
- [ ] Pauses are consistent (1-2s before/after actions)
- [ ] Scrolls are gentle and controlled
- [ ] Transitions are clean (no flashing or glitching)

### Technical Quality
- [ ] No audio (unless intentional voiceover)
- [ ] File saves correctly and opens in media player
- [ ] File size is reasonable (not corrupted)
- [ ] No dropped frames
- [ ] Aspect ratio is correct (no stretching/squashing)

---

## Recording Session Checklist

Use this before each recording session:

### 15 Minutes Before
- [ ] Restart computer (fresh start)
- [ ] Close all applications except recording software and app
- [ ] Enable Do Not Disturb
- [ ] Set screen brightness to 100%
- [ ] Load app with demo data
- [ ] Test recording (10-second test)

### 5 Minutes Before
- [ ] Review shot list for today's screens
- [ ] Mental rehearsal of actions
- [ ] Check cursor settings (size, visibility)
- [ ] Check resolution and frame rate
- [ ] Take a deep breath and slow down mindset

### During Recording
- [ ] Pause-Action-Pause rhythm
- [ ] Move at 70% speed
- [ ] Check framing (nothing cut off)
- [ ] Watch for notifications
- [ ] Stay calm and deliberate

### After Each Recording
- [ ] Immediate playback review
- [ ] Label and save file
- [ ] Update recording checklist
- [ ] If bad take: Delete and re-record immediately (while setup is fresh)
- [ ] If good take: Keep recording more screens while in flow

### End of Session
- [ ] Review all recordings from session
- [ ] Backup to cloud storage
- [ ] Update master checklist
- [ ] Note any issues for next session
- [ ] Close apps and rest (recording is mentally taxing!)

---

## Advanced Tips

### For Smoother Recordings

#### Use External Mouse (Desktop)
- Trackpads are harder to control smoothly
- Wired mouse is more precise than wireless
- Lower mouse sensitivity in system settings
- Use large mouse pad

#### Use Tripod (Mobile)
- If recording mobile device screen externally (over-the-shoulder)
- Keeps device steady
- Consistent framing

#### Use Second Monitor
- Recording software on Monitor 1
- App being recorded on Monitor 2
- Easier to monitor recording status

### For Professional Polish

#### Cursor Highlighting
- Spotlight effect around cursor
- Helps viewers follow along
- Built into some recording software

#### Click Animation
- Visual ripple on click/tap
- Makes interactions obvious
- Can be added in post or via software

#### Grid Overlay (Optional)
- Helps align UI elements
- Rule of thirds for composition
- Turn off for final recording, use only for setup

---

## Troubleshooting

### Problem: Recording is Laggy/Stuttering
**Solutions:**
- Close other applications
- Lower recording quality temporarily (test mode only)
- Update graphics drivers
- Restart computer
- Disable hardware acceleration in browser

### Problem: File Size is Huge
**Solutions:**
- Check bitrate (15 Mbps is maximum needed)
- Use H.264 codec, not uncompressed
- Recording at 4K? Scale down to 1080p
- Recording at 120fps? Use 30fps or 60fps

### Problem: Text is Blurry
**Solutions:**
- Record at native resolution (no scaling)
- Disable browser zoom (100% only)
- Use crisp fonts in app
- Increase recording bitrate

### Problem: Colors Look Washed Out
**Solutions:**
- Check screen brightness (100%)
- Adjust recording software color settings
- Use sRGB color space
- Calibrate monitor

### Problem: Can't Record Mobile Device
**Solutions:**
- Use QuickTime Screen Recording (Mac + iPhone)
- Use built-in screen recording (iOS/Android)
- Use emulator in desktop browser (responsive mode)
- Use third-party apps (Reflector, AirServer)

---

## Final Pre-Recording Checklist

Print this and check off before EVERY recording session:

- [ ] Computer restarted
- [ ] Do Not Disturb enabled
- [ ] Screen brightness 100%
- [ ] Recording software tested (10s test clip reviewed)
- [ ] Resolution correct (1920×1080 or 1080×1920)
- [ ] Frame rate set (30fps minimum)
- [ ] App loaded with demo data
- [ ] Browser/app full screen
- [ ] No dev tools visible
- [ ] No error messages
- [ ] Cursor size increased (optional)
- [ ] Shot list reviewed
- [ ] Actions mentally rehearsed
- [ ] Calm and ready to go slow

**If all boxes are checked: Start recording!**

---

**Next Steps:**
1. Review [master-shot-list.md](../shot-lists/master-shot-list.md) for what to record
2. Use [recording-checklist.md](../shot-lists/recording-checklist.md) to track progress
3. Consult [screen-capture-timing.md](../shot-lists/screen-capture-timing.md) for precise timing
