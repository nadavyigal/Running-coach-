# Epic 3: Habit Streaks & Gamification

**Epic Number:** 3

**Title:** Habit Streaks & Gamification

**Description:** Provide users with visual streak tracking and badge achievements to boost daily engagement and retention by 15%. This brownfield enhancement extends the existing dashboard with gamification elements while maintaining system integrity.

**Epic Goal**

Enable users to visualize daily activity streaks, earn badges for milestones, and stay motivated through gamified progress tracking that increases daily retention by 15%.

**Existing System Context:**

- Current relevant functionality: Core dashboard and daily tasks completed (Epics 1-2), with /today screen and user activity tracking
- Technology stack: Next.js 15 + TypeScript + Dexie.js local database + existing achievement tracking
- Integration points: Extends /today dashboard, user profile system, and activity recording workflows

**Enhancement Details:**

- What's being added/changed: Daily streak counter persistence, visual streak indicators, milestone-based badge system
- How it integrates: Builds on existing activity tracking, adds UI widgets to /today screen, extends local database schema
- Success criteria: Users see real-time streak numbers, badges unlock and persist after refresh, 15% increase in daily retention

**Stories:**

*   **3.1: Persist Streak Counter:** Store and update daily streak field per user in local database with rollover logic
*   **3.2: Render Streak Progress Indicator:** Display 🔥 icon + count on /today dashboard with visual feedback
*   **3.3: Award Badges on Milestones:** Unlock bronze/silver/gold badges at 3, 7, 30-day streaks with badge cabinet display

**Compatibility Requirements**

- [ ] Existing /today dashboard loads without breaking
- [ ] Database schema changes are backward compatible with Dexie.js
- [ ] UI changes follow existing dark-first design patterns
- [ ] Performance impact is minimal on dashboard load time

**Risk Mitigation**

- **Primary Risk:** Incorrect streak reset causing user frustration and engagement loss
- **Mitigation:** Comprehensive unit tests around date rollovers, 24-hour grace window for late activity recording
- **Rollback Plan:** Drop new database columns and hide streak UI widgets if issues arise

**Definition of Done**

- [ ] All stories completed with acceptance criteria met
- [ ] Existing /today dashboard functionality verified through testing
- [ ] Streak calculation accuracy validated across timezone changes
- [ ] Badge system integrates properly with user profile
- [ ] No regression in existing dashboard performance
- [ ] Local database migrations work correctly 