# Onboarding Reset & Training Plan Guide

**Last Updated:** November 24, 2025

---

## Quick Start: Reset Onboarding

If you can't see the onboarding screen or need to start fresh, use one of these methods:

### Method 1: URL Parameter (Easiest) ✅

Simply add `?reset=1` to your production URL:

```
https://running-coach-puce.vercel.app/?reset=1
```

**What it does:**
- ✅ Clears all localStorage data
- ✅ Deletes IndexedDB database
- ✅ Automatically reloads the page
- ✅ Shows onboarding screen immediately

**Steps:**
1. Open your production URL
2. Add `?reset=1` to the end
3. Press Enter
4. Page will automatically clear data and reload
5. You'll see the onboarding screen

### Method 2: Debug Panel

Press `Ctrl+Shift+D` anywhere in the app to open the debug panel, then click "Reset All Data".

**Steps:**
1. Open the app
2. Press `Ctrl+Shift+D`
3. Click "Reset All Data" button
4. Refresh the page (F5 or Ctrl+R)
5. You'll see the onboarding screen

### Method 3: Browser DevTools

Open browser console (F12) and run:

```javascript
// Clear all data
localStorage.clear();
indexedDB.deleteDatabase('running-coach-db');
location.reload();
```

---

## What You Should See After Onboarding

### 1. Onboarding Flow

**Step 1: Welcome Screen**
- Message: "Welcome to Run-Smart" or similar
- Form fields for:
  - Name
  - Experience Level (beginner, intermediate, advanced)
  - Goal (habit, performance, race)
  - Days per Week (3-6 days)

**Step 2: AI Goal Wizard (Chat-based)**
- Conversational onboarding with AI coach
- Personalized questions based on your answers
- Goal setting and motivation discussion

**Step 3: Completion**
- Message: "Welcome to your personalized training plan"
- Confirmation: "Your initial plan is ready"
- Button: "Finish Setup" or "Get Started"

### 2. After Onboarding: Today Screen

Once you complete onboarding, you should see:

**Header:**
- Your name (top right)
- Date indicator
- Streak counter (if applicable)

**Today's Workout Card:**
- Workout type (e.g., "Easy Run", "Tempo Run", "Long Run")
- Distance (e.g., "5km")
- Duration (e.g., "30 minutes")
- Pace guidance (e.g., "6:00 min/km")
- Workout details/breakdown (expandable)

**Weekly Overview:**
- 7-day calendar showing workouts
- Visual indicators for:
  - ✅ Completed workouts (green checkmark)
  - 📅 Scheduled workouts (workout type)
  - ⬜ Rest days (gray/empty)

**Daily Tip:**
- Motivational or training tip
- Refresh button to cycle through tips

**Community Stats:**
- Cohort information
- Group statistics

**Recovery Recommendations:**
- HRV data (if available)
- Sleep quality
- Recovery score
- Suggestions for today's training

### 3. Training Plan Screen (Tab: Plan)

Navigate to the "Plan" tab to see:

**Plan Overview:**
- Plan name (e.g., "8-Week 5K Training Plan")
- Goal distance and target date
- Current week (e.g., "Week 2 of 8")
- Completion percentage

**Weekly Breakdown:**
- All workouts for the current week
- Workout types with descriptions
- Distance, duration, pace for each workout
- Ability to reschedule or skip workouts

**Plan Details:**
- Training philosophy
- Progressive overload schedule
- Recovery weeks
- Peak weeks
- Taper period (if race plan)

---

## Testing the Full Flow

### Test Scenario 1: Beginner Runner

**Expected Onboarding:**
1. Visit: https://running-coach-puce.vercel.app/?reset=1
2. Fill onboarding:
   - Name: "Test User"
   - Experience: "Beginner"
   - Goal: "Build a habit"
   - Days per Week: 3
3. Complete AI chat onboarding
4. Click "Finish Setup"

**Expected Result:**
- Navigate to Today screen
- See first workout: "Easy Run" (conservative distance/pace)
- See 3 workouts scheduled for the week
- Plan focuses on easy runs and recovery

### Test Scenario 2: Intermediate Runner

**Expected Onboarding:**
1. Visit: https://running-coach-puce.vercel.app/?reset=1
2. Fill onboarding:
   - Name: "Intermediate Runner"
   - Experience: "Intermediate"
   - Goal: "Improve performance"
   - Days per Week: 4
3. Complete AI chat onboarding
4. Click "Finish Setup"

**Expected Result:**
- Navigate to Today screen
- See workout: "Tempo Run" or "Interval Training"
- See 4 workouts scheduled for the week
- Plan includes variety: Easy, Tempo, Long runs

### Test Scenario 3: Advanced Runner

**Expected Onboarding:**
1. Visit: https://running-coach-puce.vercel.app/?reset=1
2. Fill onboarding:
   - Name: "Advanced Runner"
   - Experience: "Advanced"
   - Goal: "Race preparation"
   - Days per Week: 5
3. Complete AI chat onboarding
4. Click "Finish Setup"

**Expected Result:**
- Navigate to Today screen
- See workout: "Intervals" or "Race Pace Run"
- See 5 workouts scheduled for the week
- Plan includes: Intervals, Tempo, Long Run, Recovery, Race Pace

---

## Troubleshooting

### Issue: Can't See Onboarding

**Symptoms:**
- App goes directly to Today screen
- No option to start onboarding
- Empty or outdated training plan

**Solutions:**
1. **Use reset URL:** https://running-coach-puce.vercel.app/?reset=1
2. **Check localStorage:**
   - Open DevTools (F12)
   - Go to Application → Local Storage
   - Look for `onboarding-complete` key
   - If it says "true", delete it or use reset URL
3. **Clear browser cache:**
   - Ctrl+Shift+Delete
   - Clear "Cached images and files"
   - Clear "Cookies and other site data"
   - Refresh page

### Issue: Training Plan Not Showing

**Symptoms:**
- Today screen shows "No workout scheduled"
- Plan screen is empty
- Message: "No active plan found"

**Solutions:**
1. **Force plan regeneration:**
   - Press `Ctrl+Shift+D` (debug panel)
   - Click "Run Diagnosis"
   - Look for "hasPlan: No"
   - Click "Auto Fix"
2. **Manual reset and re-onboard:**
   - Use reset URL: https://running-coach-puce.vercel.app/?reset=1
   - Complete onboarding again
   - Plan should generate automatically
3. **Check database:**
   - Open DevTools (F12)
   - Go to Application → IndexedDB → running-coach-db
   - Check "plans" table
   - Should have at least one entry

### Issue: Onboarding Stuck/Frozen

**Symptoms:**
- Onboarding screen not progressing
- "Finish Setup" button doesn't work
- AI chat not responding

**Solutions:**
1. **Check browser console:**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Common errors: OpenAI API key issues, database errors
2. **Reload page:**
   - Press F5 or Ctrl+R
   - Try again from current step
3. **Full reset:**
   - Use reset URL: https://running-coach-puce.vercel.app/?reset=1
   - Start fresh

---

## Expected E2E Test Behavior

Based on `onboarding-adaptive-update.spec.ts`:

### Scenario 1: Beginner Runner - Conservative Adjustment

**Flow:**
1. Complete onboarding (beginner, habit, 3 days/week)
2. See initial plan: "Easy Run"
3. Record first run (slow pace)
4. Get notification: "Your plan has been updated"
5. View updated plan: Gentle adjustments, focus on easy runs and recovery
6. Plan should NOT include Tempo or Intervals yet

**Expected Plan Characteristics:**
- Mostly Easy Runs
- 1-2 Recovery days
- No high-intensity workouts
- Conservative distance increases

### Scenario 2: Intermediate Runner - Moderate Adjustment

**Flow:**
1. Complete onboarding (intermediate, performance, 4 days/week)
2. See initial plan: Mix of Easy, Tempo, Long runs
3. Record first run (moderate pace)
4. Get notification: "Your plan has been updated"
5. View updated plan: Balanced adjustments with variety

**Expected Plan Characteristics:**
- Easy Runs (60%)
- Tempo Runs (20%)
- Long Runs (15%)
- Recovery (5%)

### Scenario 3: Advanced Runner - Aggressive Adjustment

**Flow:**
1. Complete onboarding (advanced, race prep, 5 days/week)
2. See initial plan: High-intensity workouts included
3. Record first run (fast pace)
4. Get notification: "Your plan has been updated"
5. View updated plan: Aggressive training with variety

**Expected Plan Characteristics:**
- Interval Training included
- Tempo Runs included
- Long Runs included
- Race Pace workouts included
- Recovery strategically placed

---

## Production URLs

**Primary:**
https://running-coach-puce.vercel.app

**With Reset:**
https://running-coach-puce.vercel.app/?reset=1

**Alternative Domains:**
- https://running-coach-nadavyigal-gmailcoms-projects.vercel.app
- https://running-coach-nadavyigal-7990-nadavyigal-gmailcoms-projects.vercel.app

---

## Developer Notes

### Database Schema

**User Table:**
```typescript
{
  id: number
  name: string
  email?: string
  onboardingComplete: boolean
  experience: 'beginner' | 'intermediate' | 'advanced'
  goal: 'habit' | 'performance' | 'race'
  daysPerWeek: number
  createdAt: Date
  updatedAt: Date
}
```

**Plan Table:**
```typescript
{
  id: number
  userId: number
  name: string
  goal: string
  targetDistance: number
  targetDate: Date
  currentWeek: number
  totalWeeks: number
  status: 'active' | 'completed' | 'paused'
  createdAt: Date
  updatedAt: Date
}
```

**Workout Table:**
```typescript
{
  id: number
  planId: number
  userId: number
  scheduledDate: Date
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'recovery'
  targetDistance: number
  targetDuration: number
  targetPace: number
  completed: boolean
  createdAt: Date
  updatedAt: Date
}
```

### LocalStorage Keys

```
- onboarding-complete: "true" | "false"
- user-data: JSON stringified user object
- current-user-id: number
```

### IndexedDB Databases

```
- running-coach-db (main database)
  - users
  - plans
  - workouts
  - runs
  - shoes
  - chatMessages
  - badges
  - cohorts
  - sleepData
  - hrvMeasurements
  - recoveryScores
  - subjectiveWellness
```

---

## Quick Reference Commands

**Reset via URL:**
```
https://running-coach-puce.vercel.app/?reset=1
```

**Reset via Console:**
```javascript
localStorage.clear();
indexedDB.deleteDatabase('running-coach-db');
location.reload();
```

**Open Debug Panel:**
```
Ctrl+Shift+D
```

**Check Onboarding Status:**
```javascript
console.log('Onboarding:', localStorage.getItem('onboarding-complete'));
```

**Check Database:**
```javascript
// In browser console
const request = indexedDB.open('running-coach-db');
request.onsuccess = (e) => {
  const db = e.target.result;
  console.log('Database version:', db.version);
  console.log('Object stores:', Array.from(db.objectStoreNames));
};
```

---

## Support

If you continue experiencing issues:

1. **Check browser compatibility:**
   - Chrome 90+ (recommended)
   - Firefox 88+
   - Safari 14+
   - Edge 90+

2. **Verify IndexedDB support:**
   - Open DevTools (F12)
   - Run: `console.log('IndexedDB supported:', !!window.indexedDB)`
   - Should return: `true`

3. **Contact developer:**
   - Include browser console logs (F12 → Console)
   - Include screenshots of the issue
   - Mention which production URL you're using

---

**Last Updated:** November 24, 2025
**Version:** 1.0.0
**Status:** Production Ready ✅
