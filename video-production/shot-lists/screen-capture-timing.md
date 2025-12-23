# Screen Capture Timing Guide

**Purpose:** Frame-by-frame timing guidance for each screen to ensure smooth editing and proper pacing.

**Key Principle:** Record with generous padding. It's easier to trim in editing than to stretch short clips.

---

## General Timing Rules

### The Pause-Action-Pause Pattern

Every screen recording should follow this rhythm:

```
[1-2s PAUSE] → [ACTION] → [1-2s PAUSE]
```

**Why?**
- Gives editors clean in/out points
- Lets viewers process what they're seeing
- Creates natural, calm pacing
- Allows for voiceover synchronization

### Frame Rate Notes
- Record at **30fps minimum** (60fps is better for smooth motion)
- All timings below assume 30fps
- 1 second = 30 frames

---

## Screen-by-Screen Timing Breakdown

### Screen 1: Onboarding (8-10s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Full screen visible | 0 | Both goal and level selectors visible |
| 0:00-1:00 | Initial pause | 0-30 | Let viewer see the options |
| 1:00 | Cursor begins moving toward goal | 30 | Slow, deliberate movement |
| 1:30 | Cursor hovers over goal (e.g., "5K") | 45 | Brief hover before click |
| 1:50 | Click goal | 55 | Selection highlights |
| 2:00-2:30 | Pause after goal selection | 60-75 | Let highlight settle |
| 2:30 | Cursor moves toward experience level | 75 | Slow movement |
| 3:00 | Cursor hovers over level (e.g., "Beginner") | 90 | Brief hover |
| 3:20 | Click experience level | 100 | Selection highlights |
| 3:30-4:00 | Pause after level selection | 105-120 | Let highlight settle |
| 4:00 | Cursor moves toward "Continue" button | 120 | Slow movement |
| 4:30 | Hover over "Continue" | 135 | Optional button hover state |
| 4:50 | Click "Continue" | 145 | Button press animation |
| 5:00-6:00 | Pause/transition to next screen | 150-180 | Loading state or fade |
| 6:00+ | Extra padding | 180+ | Gives editor flexibility |

**Total:** 8-10 seconds with padding

---

### Screen 2: Today (6-8s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Today screen fully loaded | 0 | Workout card is centered and visible |
| 0:00-2:00 | Initial pause | 0-60 | Let viewer read workout details |
| 2:00-3:00 | Optional: Slow scroll down | 60-90 | Only if workout details extend below fold |
| 3:00-4:00 | Pause at final position | 90-120 | Hold on full workout view |
| 4:00 | Optional: Cursor moves to "Start" button | 120 | Only if showing button interaction |
| 4:30 | Hover over "Start" (don't click) | 135 | Show hover state |
| 5:00-6:00 | Final pause | 150-180 | Clean ending |
| 6:00+ | Extra padding | 180+ | Editor flexibility |

**Total:** 6-8 seconds (shorter if no scroll/interaction)

**Special Note:** If recording a "tap to start" version, add 2s for tap animation and transition.

---

### Screen 3: Plan/Calendar (8-10s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Full week visible | 0 | Current week with today highlighted |
| 0:00-2:00 | Initial pause | 0-60 | Let viewer see workout distribution |
| 2:00-3:00 | Begin slow scroll | 60-90 | Scroll down OR horizontally to next week |
| 3:00-5:00 | Continue scroll (gentle) | 90-150 | Maximum 1 full scroll |
| 5:00-6:00 | Pause at final position | 150-180 | Let viewer see the next week |
| 6:00-8:00 | Final hold | 180-240 | Clean ending |
| 8:00+ | Extra padding | 240+ | Editor flexibility |

**Total:** 8-10 seconds

**Scroll Speed:** ~100 pixels per second (very gentle)

---

### Screen 4: Missed Workout (6-8s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Calendar with missed workout visible | 0 | "Missed" badge or indicator clearly visible |
| 0:00-2:00 | Initial pause | 0-60 | Let viewer identify the missed workout |
| 2:00 | Optional: Cursor moves to missed workout | 60 | If showing tap interaction |
| 2:30 | Optional: Tap missed workout | 75 | Opens detail modal |
| 3:00-4:00 | Optional: Pause on detail modal | 90-120 | If modal opened |
| 4:00 | Optional: Close modal | 120 | If modal was opened |
| 4:30-6:00 | Final pause | 135-180 | Back to calendar view or hold on modal |
| 6:00+ | Extra padding | 180+ | Editor flexibility |

**Total:** 6-8 seconds

**Alternative (Move Workout):** If showing "move workout" instead of just "missed":
- Add 2-4s for selecting new day
- Add 1s for confirmation animation

---

### Screen 5: Adaptation Result ⭐ CRITICAL (8-12s total)

**This is the MAGIC MOMENT—take extra care with timing.**

#### Option A: Automatic Adaptation (Recommended)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - "Before" state (missed workout visible) | 0 | Calendar showing missed workout |
| 0:00-1:00 | Initial pause on "before" | 0-30 | Clear before state |
| 1:00 | Trigger adaptation | 30 | Click "Update Plan" or "Refresh" button |
| 1:20 | Loading/transition animation begins | 40 | Spinner, fade, or custom animation |
| 1:20-2:20 | Loading state | 40-70 | Keep this brief (0.5-1s max) |
| 2:20 | "After" state begins to appear | 70 | Updated plan fades in |
| 2:20-3:00 | Reveal animation | 70-90 | Workouts rearrange or update |
| 3:00-5:00 | Pause on "after" state | 90-150 | Let viewer see the changes |
| 5:00-5:30 | Optional: Visual callout appears | 150-165 | "Updated" badge or highlight |
| 5:30-8:00 | Extended pause | 165-240 | Hold on final result |
| 8:00+ | Extra padding | 240+ | Editor flexibility |

**Total:** 8-12 seconds

#### Option B: Overnight Simulation (Alternative)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - "Before" state | 0 | Evening view showing missed workout |
| 0:00-1:00 | Initial pause | 0-30 | Clear before state |
| 1:00-2:00 | "Overnight" transition overlay | 30-60 | Moon icon, "Next morning," time-lapse |
| 2:00 | "After" state appears | 60 | Morning view with updated plan |
| 2:00-3:00 | Reveal animation | 60-90 | Updated workouts appear |
| 3:00-6:00 | Pause on "after" state | 90-180 | Let viewer see changes |
| 6:00-8:00 | Extended pause | 180-240 | Hold on final result |
| 8:00+ | Extra padding | 240+ | Editor flexibility |

**Total:** 8-12 seconds

**Critical Success Factors:**
- Before/after difference must be OBVIOUS
- Transition feels intentional (not accidental)
- Updated plan makes logical sense
- Visual feedback is clear (highlight, badge, animation)

**Record 2-3 takes of this screen minimum.**

---

### Screen 6: AI Chat (8-10s total)

#### Option A: Typing Live (More Dynamic)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Chat interface ready | 0 | Input field is visible and empty |
| 0:00-0:50 | Initial pause | 0-15 | Brief pause before typing |
| 0:50 | Begin typing question | 15 | "Should I run today?" |
| 0:50-2:50 | Type question slowly | 15-85 | ~2 seconds for full question |
| 2:50-3:20 | Pause after typing | 85-100 | Let viewer read question |
| 3:20 | Press send/enter | 100 | Send button animation |
| 3:50 | AI "typing..." indicator appears | 115 | Animated dots or similar |
| 3:50-4:50 | Typing indicator active | 115-145 | Keep this brief (~1s) |
| 4:50 | Answer begins appearing | 145 | First line of answer |
| 4:50-5:50 | Answer fully appears | 145-175 | Streaming or instant |
| 5:50-8:00 | Pause on answer | 175-240 | Let viewer read (2-3s minimum) |
| 8:00+ | Extra padding | 240+ | Editor flexibility |

**Total:** 8-10 seconds

#### Option B: Pre-Populated (Faster)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Question already visible | 0 | "Should I run today?" is already sent |
| 0:00-1:00 | Pause on question | 0-30 | Let viewer read question |
| 1:00-2:00 | Optional: Scroll to show previous context | 30-60 | Show chat history briefly |
| 2:00-5:00 | Pause on answer | 60-150 | Focus on coach's response |
| 5:00+ | Extra padding | 150+ | Editor flexibility |

**Total:** 5-6 seconds (much faster)

**Recommended Question:** "Should I run today?" or "How hard should I push?"

**Recommended Answer Length:** 2-3 sentences, ~30-40 words max

Example: "Yes! You're recovered and today's easy run will build your aerobic base. Keep the pace comfortable and focus on time, not speed."

---

### Screen 7: Recovery/Insights (6-8s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Recovery screen loaded | 0 | Score is prominently displayed |
| 0:00-2:00 | Initial pause | 0-60 | Let viewer see score and status |
| 2:00 | Optional: Tap to expand details | 60 | Show sleep/HRV breakdown |
| 2:30-4:00 | Optional: Pause on details | 75-120 | If details shown |
| 4:00 | Optional: Tap to return | 120 | Return to main recovery view |
| 4:30-6:00 | Final pause | 135-180 | Clean ending |
| 6:00+ | Extra padding | 180+ | Editor flexibility |

**Total:** 6-8 seconds

**Score Display:** Should be visible for minimum 2 seconds

**Status Examples:**
- "Recovery Score: 82 - Ready to train"
- "Recovery Score: 68 - Train at moderate intensity"
- "Recovery Score: 55 - Take it easy today"

---

### Screen 8: Progress/Results (6-8s total)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Progress screen loaded | 0 | Stats clearly visible |
| 0:00-2:00 | Initial pause | 0-60 | Let viewer see progress metrics |
| 2:00-3:00 | Optional: Slow scroll down | 60-90 | Show more stats or next workout |
| 3:00-4:00 | Pause at final position | 90-120 | Hold on key metric or next workout |
| 4:00 | Optional: Tap "Next Workout" | 120 | If showing preview interaction |
| 4:30-6:00 | Final pause | 135-180 | Clean ending |
| 6:00+ | Extra padding | 180+ | Editor flexibility |

**Total:** 6-8 seconds

**Progress Examples:**
- "5-day streak"
- "8 runs completed"
- "Week 3 of 12"
- "12.4 miles this week"

---

### Screen 9: CTA End Card (3-5s static hold)

| Time | Action | Frames (30fps) | Notes |
|------|--------|----------------|-------|
| 0:00 | START - Static end card | 0 | No animation or interaction |
| 0:00-3:00 | Hold | 0-90 | Minimum 3 seconds |
| 3:00-5:00 | Extended hold | 90-150 | Give viewers time to note URL |
| 5:00+ | Fade to black (optional) | 150+ | Editor can add fade |

**Total:** 3-5 seconds (static)

**Design Elements:**
- Run-Smart logo (top third)
- Headline: "Book a 15-minute walkthrough" (center)
- Booking URL or QR code (lower third)
- Optional: "Beta access available" badge

---

## Editing Assembly Guide

### How These Clips Fit Into Videos

#### Landing Page Hero (80s)
- Use **Screen 1** (onboarding): 6-8s
- Use **Screen 2** (today): 5-6s
- Use **Screen 3** (calendar): 7-8s
- Use **Screen 4** (missed workout): 5-6s
- Use **Screen 5** (adaptation) ⭐: 10-12s (LONGEST)
- Use **Screen 6** (AI chat): 8-9s
- Use **Screen 7** (recovery): 5-6s
- Use **Screen 8** (progress): 4-5s
- Use **Screen 9** (CTA end card): 5s
- **Total:** ~60-65s of UI + 15-20s of transitions/overlays = 80s

#### Instagram Reel (30s)
- Use **Screen 4** (missed workout): 3-4s (fast)
- Use **Screen 5** (adaptation) ⭐: 6-8s (core moment)
- Use **Screen 1** (onboarding): 3-4s (quick)
- Use **Screen 2** (today): 3-4s (quick)
- Use **Screen 3** (calendar): 3-4s (quick)
- Use **Screen 9** (CTA end card): 4-5s
- **Total:** ~22-27s of UI + 3-8s of text overlays = 30s

#### YouTube Overview (95s)
- Use **Screen 1** (onboarding): 8-10s
- Use **Screen 2** (today): 7-8s
- Use **Screen 3** (calendar): 8-9s
- Use **Screen 4** (missed workout): 6-7s
- Use **Screen 5** (adaptation) ⭐: 12-14s (LONGEST, with detail)
- Use **Screen 6** (AI chat): 9-10s
- Use **Screen 7** (recovery): 6-7s
- Use **Screen 8** (progress): 5-6s
- Use **Screen 9** (CTA end card): 5s
- Optional B-roll: 5-10s (2 clips × 2-5s each)
- **Total:** ~70-80s of UI + 10-25s of B-roll/transitions = 95s

---

## Transition Timing Between Screens

### Smooth Cuts (Recommended)
- **Cut on action:** When button is clicked, cut immediately to result
- **Match cut:** If calendar → today → calendar, maintain visual continuity
- **Crossfade:** 0.5s fade between unrelated screens

### Timing Example (Screen 1 → Screen 2)
```
Screen 1: ... [Click "Continue" at 4:50] → [Hold button press for 0.3s]
CUT (at 5:20 of Screen 1)
Screen 2: [Starts with Today screen already loaded at 0:00]
```

**Result:** Feels like instant navigation, no dead time

---

## Recording Tips for Perfect Timing

### Use a Metronome or Timer
- Set a timer for "1 second" beep intervals
- Practice your pauses to match the beep
- Maintain consistent rhythm across all recordings

### Practice Runs
- Do 2-3 practice recordings before "official" take
- Time yourself with a stopwatch
- Adjust speed to hit target durations

### Record Long, Trim Short
- Always record 2-3 extra seconds at start and end
- Easier to cut down than to stretch
- Gives editors clean handles

### The "Hold Still" Test
- After recording, pause the video at any frame
- If UI looks clean and readable, timing is good
- If UI is mid-transition or blurry, re-record

---

## Frame-Perfect Editing Markers

For video editors using this guide:

### In-Point (Start of usable footage)
- First frame where UI is fully loaded
- No loading spinners or partial renders
- Text is crisp and readable

### Out-Point (End of usable footage)
- Last frame before next action begins
- UI is stable and complete
- Cursor is stationary (if visible)

### Action Point (Key interaction frame)
- Exact frame where button is clicked
- Exact frame where text input begins
- Exact frame where animation triggers

**Mark these in your editing software for precise cuts.**

---

## Quick Reference: Target Durations

| Screen | Short (Reel) | Standard (Landing) | Long (YouTube) |
|--------|--------------|-------------------|----------------|
| 1. Onboarding | 3-4s | 6-8s | 8-10s |
| 2. Today | 3-4s | 5-6s | 7-8s |
| 3. Calendar | 3-4s | 7-8s | 8-9s |
| 4. Missed Workout | 3-4s | 5-6s | 6-7s |
| 5. Adaptation ⭐ | 6-8s | 10-12s | 12-14s |
| 6. AI Chat | Skip | 8-9s | 9-10s |
| 7. Recovery | Skip | 5-6s | 6-7s |
| 8. Progress | Skip | 4-5s | 5-6s |
| 9. CTA End Card | 4-5s | 5s | 5s |

---

**Next Steps:**
1. Review [recording-checklist.md](recording-checklist.md) to track your progress
2. Consult [../scripts/recording-guidelines.md](../scripts/recording-guidelines.md) for technical setup
3. Reference [../storyboards/](../storyboards/) for visual context
