# Quick Start Checklist for 5 Quick Wins Implementation

## Pre-Implementation Setup

### 1. Branch Created ✅
```bash
# Already done:
git checkout -b feature/5-quick-wins
```

### 2. Review Documentation
- [ ] Read full plan: `C:\Users\nadav\.claude\plans\sparkling-splashing-marshmallow.md`
- [ ] Review implementation prompts: `docs/quickwins/IMPLEMENTATION_PROMPTS.md`
- [ ] Understand architecture: `v0/docs/ARCHITECTURE.md` (if exists)

### 3. Set Up Environment
- [ ] Copy `.env.local.example` to `.env.local` (will be created)
- [ ] Add feature flags (all set to `false` initially):
  ```
  NEXT_PUBLIC_ENABLE_AUTO_PAUSE=false
  NEXT_PUBLIC_ENABLE_PACE_CHART=false
  NEXT_PUBLIC_ENABLE_VIBRATION_COACH=false
  NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=false
  NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=false
  ```
- [ ] Install dependencies: `cd v0 && npm install`
- [ ] Start dev server: `npm run dev`

---

## Implementation Phases (Copy Prompts from IMPLEMENTATION_PROMPTS.md)

### Phase 0: Setup ⚙️
- [ ] Run **Prompt 1** (Initialize Project)
  - Creates feature flags in `v0/lib/featureFlags.ts`
  - Creates `.env.local.example`
  - Initial commit

### Phase 1: Auto-Pause + GPS Quality 🛰️
**Day 1-2 | 6 hours**
- [ ] Run **Prompt 2A** (Auto-Pause State Machine)
- [ ] Run **Prompt 2B** (GPS Quality Score)
- [ ] Manual test with mock data
- [ ] Commit: "feat(gps): auto-pause and quality scoring"

### Phase 2: Pace Chart & Sharing 📊
**Day 3-4 | 8 hours**
- [ ] Run **Prompt 3A** (Pace Calculation Utilities)
- [ ] Run **Prompt 3B** (Continuous Pace Chart Component)
- [ ] Run **Prompt 3C** (Enhanced Run Report AI)
- [ ] Run **Prompt 3D** (HTML Snapshot Sharing)
- [ ] Manual test pace chart rendering
- [ ] Commit: "feat(pace): continuous pace chart and enhanced sharing"

### Phase 3: Vibration Alerts 📳
**Day 5 | 4 hours**
- [ ] Run **Prompt 4A** (Vibration API Wrapper)
- [ ] Run **Prompt 4B** (Interval Timer UI)
- [ ] Test on mobile device
- [ ] Commit: "feat(intervals): vibration cues and interval timer"

### Phase 4: Weekly Recap 📅
**Day 6-7 | 6 hours**
- [ ] Run **Prompt 5A** (Weekly Recap Data Model)
- [ ] Run **Prompt 5B** (Weekly Recap Widget)
- [ ] Run **Prompt 5C** (Weekly Recap Modal)
- [ ] Run **Prompt 5D** (Monday Morning Notification)
- [ ] Test widget expansion and modal
- [ ] Commit: "feat(recap): weekly recap widget and notifications"

### Phase 5: Completion Loop 🔄
**Day 8-9 | 5 hours**
- [ ] Run **Prompt 6A** (Workout Matching Logic)
- [ ] Run **Prompt 6B** (Completion Celebration Modal)
- [ ] Run **Prompt 6C** (Plan Adaptation Trigger)
- [ ] Test completion flow end-to-end
- [ ] Commit: "feat(completion): workout completion loop with adaptation"

### Phase 6: Testing 🧪
**Day 10 | 6 hours**
- [ ] Run **Prompt 7A** (Create Mock GPS Test Data)
- [ ] Run **Prompt 7B** (Integration Testing)
- [ ] Run **Prompt 7C** (Manual QA Testing)
- [ ] Fix any bugs found
- [ ] Verify all tests pass: `npm run test -- --run`
- [ ] Commit: "test: add comprehensive tests for quick wins"

### Phase 7: Deployment 🚀
- [ ] Run **Prompt 8** (Enable Feature Flags & Deploy)
- [ ] Create pull request
- [ ] Code review
- [ ] Merge to main
- [ ] Gradual rollout (10% → 25% → 50% → 100%)

---

## Quick Reference Commands

### Development
```bash
cd v0
npm run dev           # Start dev server (http://localhost:3000)
npm run build         # Build for production
npm run test          # Run tests in watch mode
npm run test -- --run # Run tests once
npm run lint          # Check code quality
```

### Git Workflow
```bash
git status                                    # Check current changes
git add .                                     # Stage all changes
git commit -m "feat: description"             # Commit with message
git push origin feature/5-quick-wins          # Push to remote
```

### Testing Specific Features
```bash
# Test auto-pause
npm run test -- record-screen.autopause

# Test pace calculations
npm run test -- pace-calculations

# Test weekly recap
npm run test -- habitAnalytics.weeklyrecap

# Test completion loop
npm run test -- run-recording.completion
```

### Feature Flag Testing
```bash
# Test with flag enabled (in .env.local)
NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true npm run dev

# Test with all flags enabled
NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true \
NEXT_PUBLIC_ENABLE_PACE_CHART=true \
NEXT_PUBLIC_ENABLE_VIBRATION_COACH=true \
NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=true \
NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=true \
npm run dev
```

---

## Verification Checklist (Before PR)

### Functionality ✅
- [ ] Auto-pause triggers and clears correctly
- [ ] GPS quality score displays in run report
- [ ] Pace chart renders smoothly (test with 100, 500, 1000 points)
- [ ] Run sharing generates HTML snapshot correctly
- [ ] Vibration cues trigger on interval transitions
- [ ] Weekly recap widget shows accurate data
- [ ] Weekly recap modal opens and displays all sections
- [ ] Monday morning notification appears (mock date)
- [ ] Workout completion modal shows after matched run
- [ ] Plan adaptation triggers when needed

### Code Quality ✅
- [ ] All TypeScript types defined (no `any`)
- [ ] ESLint passes: `npm run lint`
- [ ] All tests pass: `npm run test -- --run`
- [ ] Test coverage: 80%+ for new code
- [ ] No console errors in browser
- [ ] No unused imports or variables

### Performance ✅
- [ ] Page load: < 2s on 3G
- [ ] Pace chart rendering: < 500ms for 1000 points
- [ ] Weekly recap calculation: < 200ms for 100 runs
- [ ] Auto-pause detection: < 100ms latency
- [ ] No memory leaks (check DevTools Memory profiler)

### Analytics ✅
- [ ] All 11 new PostHog events firing correctly:
  - `auto_pause_triggered`, `auto_pause_resumed`
  - `gps_quality_score`
  - `pace_chart_viewed`, `run_report_shared`
  - `vibration_cue_triggered`, `interval_timer_viewed`
  - `weekly_recap_viewed`, `weekly_recap_notification_shown`
  - `workout_completion_confirmed`, `plan_adapted`, `next_workout_previewed`
- [ ] Event properties include required fields
- [ ] Verify in PostHog dashboard or with `window.posthog.debug()`

### Mobile Testing ✅
- [ ] Test on Chrome Android (priority 1)
- [ ] Test on Safari iOS (priority 1)
- [ ] Vibration works on supported devices
- [ ] Web Share API works on mobile
- [ ] Touch interactions smooth (no lag)

### Regression Testing ✅
- [ ] Basic run recording still works (start/pause/resume/stop)
- [ ] GPS permission flow unchanged
- [ ] Existing run report generation still works
- [ ] Workout plan display unchanged
- [ ] Chat functionality still works
- [ ] Profile/settings screens unchanged

---

## Troubleshooting

### Issue: Feature not appearing
**Solution:** Check feature flag in `.env.local` is set to `true` and restart dev server

### Issue: Tests failing
**Solution:**
1. Clear test cache: `npm run test -- --clearCache`
2. Check mock data in `v0/dev/*.json` exists
3. Verify fake-indexeddb is installed

### Issue: TypeScript errors
**Solution:**
1. Check all interfaces defined in plan
2. Verify imports are correct
3. Run `npm run build` to see full error list

### Issue: Analytics not firing
**Solution:**
1. Check PostHog initialization in `v0/lib/posthog-provider.tsx`
2. Verify `window.posthog` exists in browser console
3. Enable debug mode: `window.posthog.debug()`

### Issue: GPS auto-pause not working
**Solution:**
1. Check speed calculation is correct (m/s, not km/h)
2. Verify 5-second hysteresis timer is working
3. Test with auto-pause-test.json mock data

### Issue: Vibration not working
**Solution:**
1. Check device supports Vibration API: `'vibrate' in navigator`
2. Test on mobile device (desktop browsers often don't support)
3. Verify vibration enabled in user settings

---

## Success Metrics (Track Post-Launch)

### Week 1 (Days 1-7)
- [ ] Zero critical bugs reported
- [ ] GPS auto-pause accuracy: < 3% distance variance vs. Garmin
- [ ] Run report shares increase: baseline → +15%
- [ ] Weekly recap engagement: measure % of users who view recap on Monday
- [ ] Error rate: < 1% increase in Vercel logs

### Week 2 (Days 8-14)
- [ ] Workout completion rate: baseline → +10%
- [ ] GPS quality score: 85%+ of runs rated "Good" or better
- [ ] Retention impact: measure 7-day retention change
- [ ] User feedback: collect qualitative feedback via in-app surveys
- [ ] Performance: page load time remains < 2s on 3G

---

## Support Resources

### Documentation
- **Full Plan:** `C:\Users\nadav\.claude\plans\sparkling-splashing-marshmallow.md`
- **Implementation Prompts:** `docs/quickwins/IMPLEMENTATION_PROMPTS.md`
- **Architecture Guide:** `v0/docs/ARCHITECTURE.md` (if exists)
- **Analytics Events:** `v0/docs/analytics-events.md`

### Code References
- **GPS Tracking:** `v0/components/record-screen.tsx`, `v0/hooks/use-gps-tracking.ts`
- **Run Report:** `v0/app/api/run-report/route.ts`, `v0/components/run-report-screen.tsx`
- **Habit Analytics:** `v0/lib/habitAnalytics.ts`
- **Plan Adaptation:** `v0/app/api/plan/adapt/route.ts`
- **Feature Flags:** `v0/lib/featureFlags.ts`

### Testing
- **Vitest Config:** `v0/vitest.config.ts`
- **Test Setup:** `v0/vitest.setup.ts`
- **Mock Data:** `v0/dev/*.json` (to be created)

---

## Notes

- All prompts are designed to be copy-pasted into Codex or Claude Code
- Each prompt includes full context and expected outcomes
- Feature flags allow safe incremental testing
- Gradual rollout minimizes risk
- All features leverage existing infrastructure (no major refactors)

**Estimated Total Time:** 35-40 hours (10 days part-time or 5 days full-time)

---

Good luck with implementation! 🚀
