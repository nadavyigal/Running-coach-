# PRD Shard 3: Functional Requirements & User Flows

> **Source**: PRD v1.0 §§8.1, 9  
> **Prepared by**: PM Agent · Date: 2025-07-07

---

## 8.1 · Functional Requirements

### Core Features

#### **1. Onboarding (ONB-001)**
**Purpose**: Capture user goals, preferences, and set up personalized experience

**Requirements:**
- 5-step wizard with progress indicator
- Goal selection (habit/distance/speed) with AI guidance option
- Experience level assessment (beginner/intermediate/advanced)
- RPE slider (optional) for fitness self-assessment
- Age collection for personalization
- Schedule preferences (time slots and frequency)
- Privacy consents (GDPR compliant)
- Summary & confirmation step

**Acceptance Criteria:**
- [ ] User can complete onboarding in <3 minutes
- [ ] AI chat option available for goal discovery
- [ ] All required fields validated before proceeding
- [ ] Privacy consents clearly explained
- [ ] User profile created in database
- [ ] 21-Day Rookie Challenge plan generated

#### **2. Plan Generation (PGN-001)**
**Purpose**: Create personalized training plans based on user profile

**Requirements:**
- AI-powered plan generation using user goals and experience
- 14-day training plan with progressive difficulty
- Flag `rookie_challenge=true` for new users
- Adaptive plan adjustments based on performance
- Rest day scheduling and recovery recommendations
- Plan visualization with weekly overview

**Acceptance Criteria:**
- [ ] Plan generated within 30 seconds
- [ ] Plan matches user's experience level
- [ ] Rest days properly distributed
- [ ] Plan can be adjusted based on feedback
- [ ] Plan exported to calendar (optional)

#### **3. Today Dashboard (TDB-001)**
**Purpose**: Main entry point showing today's session and quick actions

**Requirements:**
- Display today's scheduled session or rest day
- Quick action buttons (Record Run, Add Activity)
- Progress indicators for current week
- Streak counter and motivation messages
- Coach tips and recommendations
- Weather integration for run planning

**Acceptance Criteria:**
- [ ] Dashboard loads in <1 second
- [ ] Today's session clearly displayed
- [ ] Quick actions easily accessible
- [ ] Progress indicators accurate
- [ ] Coach tips relevant to user

#### **4. Record Run (RUN-001)**
**Purpose**: GPS tracking and run logging with detailed metrics

**Requirements:**
- GPS tracking with pause/resume functionality
- Real-time metrics (distance, pace, duration)
- Route visualization on map
- Save `gpx` blob to S3 and summary to database
- Post-run analysis and insights
- Integration with planned workouts

**Acceptance Criteria:**
- [ ] GPS accuracy within 5 meters
- [ ] Pause/resume works reliably
- [ ] Data saved even if app crashes
- [ ] Route displayed on map
- [ ] Post-run insights generated
- [ ] Plan updated based on completed run

#### **5. Adaptive Adjust (ADA-001)**
**Purpose**: Recompute future sessions based on performance and feedback

**Requirements:**
- Nightly plan recalculation based on completed runs
- Post-run plan adjustments
- Injury prevention recommendations
- Performance trend analysis
- Goal progress tracking

**Acceptance Criteria:**
- [ ] Plans adjust within 24 hours of run completion
- [ ] Adjustments consider user feedback
- [ ] Injury prevention alerts triggered appropriately
- [ ] Performance trends calculated accurately
- [ ] Goal progress updated in real-time

#### **6. AI Chat (CHT-001)**
**Purpose**: Adaptive coaching conversations with personalized responses

**Requirements:**
- GPT-4o integration with user profile context
- Response time ≤1.5s p95
- Context from last 3 runs and user preferences
- Suggested questions and quick responses
- Conversation history and continuity
- Coaching style adaptation

**Acceptance Criteria:**
- [ ] Responses generated within 1.5 seconds
- [ ] Context includes recent runs and preferences
- [ ] Suggested questions relevant to user
- [ ] Conversation history maintained
- [ ] Coaching style matches user preferences

#### **7. Route Explorer (RTE-001)**
**Purpose**: Discover and recommend running routes

**Requirements:**
- Return 3 nearby routes matching distance and elevation
- Route safety scoring and recommendations
- Integration with Record Run feature
- Route sharing and favorites
- Elevation and difficulty indicators

**Acceptance Criteria:**
- [ ] Routes found within 5 seconds
- [ ] Routes match user's distance preferences
- [ ] Safety information provided
- [ ] Routes can be selected for recording
- [ ] Favorites saved locally

#### **8. Habit Reminders (HAB-001)**
**Purpose**: Push notifications at user-set cue times

**Requirements:**
- Customizable reminder times
- Snooze and disable functionality
- Context-aware messaging
- Integration with weather conditions
- Reminder effectiveness tracking

**Acceptance Criteria:**
- [ ] Reminders sent at user-specified times
- [ ] Snooze functionality works
- [ ] Messages consider weather and context
- [ ] Reminder effectiveness tracked
- [ ] Users can disable reminders

---

## 9 · User Flows

### Primary User Flows

#### **Flow 1: Happy Path Onboarding → First Run**

```
1. Splash Screen
   ↓
2. Onboarding Wizard
   ├─ Goal Selection (with AI chat option)
   ├─ Experience Assessment
   ├─ Schedule Preferences
   ├─ Privacy Consents
   └─ Summary & Confirmation
   ↓
3. Today Dashboard
   ├─ Welcome message
   ├─ Today's session display
   └─ Quick action buttons
   ↓
4. Record Run
   ├─ GPS permission request
   ├─ Route selection
   ├─ Run tracking
   └─ Save run
   ↓
5. Adaptive Plan Update
   ├─ Performance analysis
   ├─ Plan recalculation
   └─ Next session preview
```

**Success Criteria:**
- User completes onboarding in <3 minutes
- First run recorded within 48 hours
- Plan adjusts based on first run performance

#### **Flow 2: Ask Coach**

```
1. Today Dashboard
   ↓
2. Chat Screen
   ├─ Coach greeting
   ├─ Suggested questions
   └─ User input
   ↓
3. AI Response
   ├─ Personalized advice
   ├─ Context from recent runs
   └─ Suggested follow-up questions
   ↓
4. User Follow-up
   ├─ Additional questions
   ├─ Feedback on advice
   └─ Plan adjustments
```

**Success Criteria:**
- Response generated within 1.5 seconds
- Advice relevant to user's situation
- User engages with follow-up questions

#### **Flow 3: Import Activity**

```
1. Today Dashboard
   ↓
2. Add Activity Modal
   ├─ Manual entry option
   ├─ Strava import option
   └─ File upload option
   ↓
3. Activity Processing
   ├─ Data validation
   ├─ Route mapping
   └─ Performance analysis
   ↓
4. Plan Recalculation
   ├─ Performance impact assessment
   ├─ Plan adjustments
   └─ Next session updates
```

**Success Criteria:**
- Activity imported within 30 seconds
- Data accurately mapped to app format
- Plan adjusts appropriately

### Secondary User Flows

#### **Flow 4: Plan Adjustment**

```
1. Plan Overview Screen
   ↓
2. Session Details
   ├─ Workout description
   ├─ Difficulty indicators
   └─ Modification options
   ↓
3. User Feedback
   ├─ Too easy/too hard
   ├─ Time constraints
   └─ Injury concerns
   ↓
4. Plan Update
   ├─ Immediate adjustments
   ├─ Future session updates
   └─ Goal recalibration
```

#### **Flow 5: Route Discovery**

```
1. Record Run Screen
   ↓
2. Route Explorer
   ├─ Location-based search
   ├─ Distance filters
   └─ Safety indicators
   ↓
3. Route Selection
   ├─ Route preview
   ├─ Elevation profile
   └─ Safety information
   ↓
4. Start Recording
   ├─ Route guidance
   ├─ Turn-by-turn directions
   └─ Progress tracking
```

### Error Flows

#### **Flow 6: GPS Failure**

```
1. Record Run Attempt
   ↓
2. GPS Error Detection
   ├─ Permission denied
   ├─ Signal weak
   └─ Hardware failure
   ↓
3. Fallback Options
   ├─ Manual distance entry
   ├─ Route-based estimation
   └─ Retry GPS connection
   ↓
4. Data Recovery
   ├─ Partial data saved
   ├─ User notification
   └─ Manual completion option
```

#### **Flow 7: AI Service Unavailable**

```
1. Chat Request
   ↓
2. Service Check
   ├─ OpenAI API status
   ├─ Network connectivity
   └─ Rate limit check
   ↓
3. Fallback Response
   ├─ Cached responses
   ├─ Pre-written tips
   └─ Offline mode
   ↓
4. Service Recovery
   ├─ Automatic retry
   ├─ User notification
   └─ Feature degradation
```

---

## User Flow Validation

### Testing Approach
- **Usability Testing**: 10 users per flow
- **A/B Testing**: Onboarding variations
- **Analytics Tracking**: Conversion rates at each step
- **Performance Monitoring**: Response times and error rates

### Success Metrics
- **Flow Completion Rate**: ≥85% for primary flows
- **Error Recovery Rate**: ≥90% for error flows
- **User Satisfaction**: ≥4.0/5 for flow experience
- **Performance**: <2s response time for all interactions

---

*This shard covers the detailed functional requirements and user flows. See other shards for technical specifications, analytics, and implementation details.* 