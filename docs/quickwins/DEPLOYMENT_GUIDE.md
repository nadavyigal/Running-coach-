# Deployment Guide: 5 Quick Wins Features

## Overview

This guide covers the deployment and monitoring process for the 5 Quick Wins features. All features are behind feature flags for safe gradual rollout.

---

## Pre-Deployment Checklist

- [x] All 5 features implemented and tested
- [x] Feature flags configured in `.env.local`
- [x] All tests passing (181 tests)
- [x] Pull request created: https://github.com/nadavyigal/Running-coach-/pull/71
- [ ] PR reviewed and approved
- [ ] Merged to main branch

---

## Feature Flags

All features are controlled via environment variables:

```bash
NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true
NEXT_PUBLIC_ENABLE_PACE_CHART=true
NEXT_PUBLIC_ENABLE_VIBRATION_COACH=true
NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=true
NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=true
```

---

## Deployment Process

### Phase 1: Initial Deployment (All Flags OFF)

1. **Merge PR to main**
   ```bash
   # After approval, merge via GitHub UI or:
   gh pr merge 71 --squash
   ```

2. **Verify Vercel Environment Variables**
   - Go to: https://vercel.com/dashboard → Project Settings → Environment Variables
   - Ensure all 5 flags are set to `false` for Production
   - If not present, add them:
     ```
     NEXT_PUBLIC_ENABLE_AUTO_PAUSE=false
     NEXT_PUBLIC_ENABLE_PACE_CHART=false
     NEXT_PUBLIC_ENABLE_VIBRATION_COACH=false
     NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=false
     NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=false
     ```

3. **Deploy to Production**
   - Vercel will auto-deploy on merge to main
   - Monitor deployment logs: https://vercel.com/dashboard → Deployments
   - Wait for deployment to complete (2-3 minutes)

4. **Smoke Test Production**
   - Visit production URL
   - Verify app loads without errors
   - Check browser console for errors
   - Verify no Quick Wins features are visible (flags are OFF)

### Phase 2: Gradual Rollout

**Day 1: Enable Auto-Pause (10%)**

1. Edit Vercel env var: `NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true`
2. Add Vercel percentage rollout:
   - Go to Environment Variables → Edit `NEXT_PUBLIC_ENABLE_AUTO_PAUSE`
   - Set rollout: 10% of traffic
3. Redeploy (Vercel auto-redeploys on env change)
4. Monitor for 24 hours:
   - Check PostHog: `auto_pause_triggered`, `auto_resume_triggered` events
   - Sentry/error logs: should be < 1% increase
   - User feedback channels

**Day 2: Increase to 25%**

1. Edit Vercel rollout: 25% of traffic
2. Monitor for 24 hours
3. If error rate > 1%, rollback to 10%

**Day 3: Enable All Features (50%)**

1. Set all 5 flags to `true` for 50% of traffic:
   ```
   NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true (50%)
   NEXT_PUBLIC_ENABLE_PACE_CHART=true (50%)
   NEXT_PUBLIC_ENABLE_VIBRATION_COACH=true (50%)
   NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=true (50%)
   NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=true (50%)
   ```
2. Monitor for 24 hours
3. Check all 11 PostHog events are firing

**Day 4: Full Rollout (100%)**

1. Set all flags to 100% of traffic
2. Monitor for 48 hours
3. Declare success! 🎉

---

## Monitoring Checklist

### Error Monitoring

**Sentry/Console Errors**
- Baseline error rate: [Record before deployment]
- Target: < 1% increase
- Critical errors to watch:
  - GPS permission denied
  - Vibration API not supported
  - IndexedDB failures
  - Service worker registration failures

**Vercel Deployment Logs**
- Check for build errors
- Check for runtime errors
- Monitor function execution times

### Analytics (PostHog)

**Expected Events (11 total):**

1. **Auto-Pause:**
   - `auto_pause_triggered` - When run auto-pauses
   - `auto_resume_triggered` - When run auto-resumes

2. **Pace Chart:**
   - `pace_chart_viewed` - When pace chart is displayed

3. **Vibration Coach:**
   - `vibration_feedback_delivered` - Any vibration feedback
   - `vibration_pace_too_slow` - Too slow feedback
   - `vibration_pace_too_fast` - Too fast feedback
   - `vibration_pace_on_target` - On target feedback

4. **Weekly Recap:**
   - `weekly_recap_viewed` - Recap modal opened
   - `weekly_recap_reflection_submitted` - User submitted reflection

5. **Completion Loop:**
   - `completion_loop_opened` - Modal opened
   - `completion_loop_reflection_submitted` - User submitted reflection

**PostHog Dashboard Queries:**
```javascript
// Check event counts by day
events where event in [
  'auto_pause_triggered',
  'auto_resume_triggered',
  'pace_chart_viewed',
  'vibration_feedback_delivered',
  'vibration_pace_too_slow',
  'vibration_pace_too_fast',
  'vibration_pace_on_target',
  'weekly_recap_viewed',
  'weekly_recap_reflection_submitted',
  'completion_loop_opened',
  'completion_loop_reflection_submitted'
]
```

### User Feedback

**Channels to Monitor:**
- GitHub issues
- App reviews (if published)
- Support email
- Community forum (if exists)

**Key Questions:**
- Are users noticing auto-pause?
- Are vibration patterns helpful or annoying?
- Is weekly recap engaging?
- Is completion loop celebratory enough?

---

## Rollback Plan

### Instant Rollback (Disable Flags)

**If Critical Issue Detected:**

1. **Identify problematic feature**
   - Check Sentry for error patterns
   - Check PostHog for anomalies

2. **Disable specific feature flag**
   - Go to Vercel → Environment Variables
   - Set flag to `false`:
     ```
     NEXT_PUBLIC_ENABLE_[FEATURE]=false
     ```
   - Vercel auto-redeploys (2-3 minutes)

3. **Verify rollback**
   - Feature should disappear from production
   - Errors should stop

4. **Investigate and fix**
   - Create hotfix branch
   - Fix issue
   - Deploy fix
   - Re-enable flag

### Full Rollback (Revert Deployment)

**If Multiple Issues:**

1. **Revert to previous deployment**
   ```bash
   # Via Vercel dashboard
   Deployments → Previous deployment → Promote to Production
   ```

2. **Or revert git commit**
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## Success Metrics

### Week 1 Goals

- **Deployment:** 100% rollout with < 1% error rate increase
- **Adoption:**
  - Auto-pause: Used by 50%+ of active runners
  - Pace chart: Viewed during 60%+ of runs
  - Vibration: Enabled by 30%+ of users
  - Weekly recap: Viewed by 40%+ of active users
  - Completion loop: Completed by 70%+ of finished runs

### Month 1 Goals

- **Engagement:**
  - 20% increase in run completion rate
  - 15% increase in weekly active users
  - 10% increase in weekly run frequency

- **Feedback:**
  - Net Promoter Score (NPS) increase
  - Positive user reviews mentioning features
  - Low uninstall rate

---

## Troubleshooting

### Issue: Auto-pause triggering too frequently

**Symptoms:** Users report pauses during runs
**Diagnosis:** Check GPS accuracy, speed threshold
**Fix:** Adjust speed threshold in `run-recording.ts`:
```typescript
const AUTO_PAUSE_SPEED_THRESHOLD = 1.0; // Increase to 1.5 or 2.0
```

### Issue: Vibration not working

**Symptoms:** No haptic feedback
**Diagnosis:** Browser/device doesn't support Vibration API
**Fix:** Already handled - feature gracefully degrades
**Note:** iOS Safari doesn't support Vibration API (expected)

### Issue: Weekly recap not showing

**Symptoms:** Sunday arrives, no recap notification
**Diagnosis:** Service worker not registered, or date logic issue
**Fix:** Check service worker registration, test date utilities

### Issue: Pace chart performance

**Symptoms:** UI lag during runs
**Diagnosis:** Too many data points, re-renders
**Fix:** Throttle chart updates, limit data points to 100

---

## Post-Deployment Tasks

### Week 1

- [ ] Monitor error rates daily
- [ ] Check PostHog events daily
- [ ] Review user feedback daily
- [ ] Document any issues in GitHub

### Month 1

- [ ] Analyze adoption metrics
- [ ] Collect user feedback via in-app survey
- [ ] Plan feature improvements based on data
- [ ] Write blog post about features (optional)

### Ongoing

- [ ] Quarterly review of feature usage
- [ ] A/B test feature variations
- [ ] Consider removing flags if stable

---

## Contact

**For deployment issues:**
- GitHub: https://github.com/nadavyigal/Running-coach-/issues
- Email: [Your email]

**For monitoring access:**
- Vercel: [Dashboard URL]
- PostHog: [Dashboard URL]
- Sentry: [Dashboard URL]

---

## Appendix: Vercel Environment Variables Setup

### Step-by-Step

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Click "Settings"
4. Click "Environment Variables"
5. Add each variable:
   - Key: `NEXT_PUBLIC_ENABLE_AUTO_PAUSE`
   - Value: `false` (initially)
   - Environment: Production, Preview, Development (all)
   - Click "Save"
6. Repeat for all 5 flags
7. Redeploy if needed

### Percentage Rollout (Vercel Teams plan only)

If you don't have Teams plan, use alternative:
- Deploy to separate "preview" branch for testing
- Use PostHog feature flags for percentage rollout
- Use custom logic in code:
  ```typescript
  const isEnabled = Math.random() < 0.10; // 10% rollout
  ```

---

**Last Updated:** 2026-01-21
**Status:** ✅ Ready for deployment
**PR:** https://github.com/nadavyigal/Running-coach-/pull/71
