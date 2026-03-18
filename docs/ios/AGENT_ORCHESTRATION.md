# RunSmart iOS - Agent Orchestration Guide

## How to Use This Document

Each phase has numbered **tasks** with ready-to-paste **prompts** for your coding agents. Each prompt specifies:
- **Agent**: Which tool to use (Claude Code, Cursor, Codex)
- **Skills/Mode**: Which skills or agent modes to activate
- **Parallel?**: Whether it can run alongside other tasks
- **Depends on**: What must complete first
- **Verify**: How to confirm the task succeeded

Copy the prompt block into the agent, wait for completion, verify, then move to the next task.

---

## Agent Capabilities & Best Assignments

| Agent | Best For | Strengths | Limitations |
|-------|----------|-----------|-------------|
| **Claude Code** | Architecture, complex logic, multi-file features | Deep reasoning, full repo context, agent teams, skills system | Slower for bulk file creation |
| **Cursor** | SwiftUI views, rapid iteration, single-file work | Fast edits, inline preview, good Swift support | Less context across many files |
| **Codex** | Bulk scaffolding, tests, type generation | Parallel execution, good at boilerplate | Less architectural reasoning |

### Claude Code Skills to Activate
Reference these skills in Claude Code prompts for domain expertise:
- `ios-expert` - Composite agent with all iOS skills
- `ios-swiftui-patterns` - SwiftUI views and state management
- `architecture-patterns` - MVVM, @Observable, protocol DI
- `swift-health-kit` - HealthKit authorization, queries, workouts
- `mobile-ios-design` - Apple HIG compliance
- `asc-release-flow` - TestFlight and App Store submission
- `monorepo-management` - pnpm workspaces, Turborepo

---

## Parallel Execution Rules

### What CAN run in parallel
- Tasks in different directories (web vs iOS vs shared)
- Independent feature modules (e.g., Chat screen + Profile screen)
- Tests for completed features while building new features
- Documentation + code generation
- Design system components + networking layer

### What MUST run sequentially
- Foundation (Phase 1) before any feature (Phase 2+)
- Schema/models before ViewModels that use them
- Networking layer before any screen that calls APIs
- Auth before any authenticated screen
- Each phase's "verify" step before next phase begins

### Recommended Agent Topology
```
Phase 0-1: Sequential (1 agent at a time - foundation must be solid)
Phase 2:   2-3 agents parallel (different screens)
Phase 3:   2 agents parallel (HealthKit + Notifications || Widgets + Haptics)
Phase 4:   2 agents parallel (Sync + Recovery || Metrics + Routes)
Phase 5:   Sequential (stabilization needs whole-app view)
```

---

## Phase 0: Monorepo & Shared Infrastructure

### Task 0.1 - Monorepo Setup
- **Agent**: Claude Code
- **Skills**: `monorepo-management`
- **Parallel**: No (foundation task)
- **Depends on**: Nothing

```
PROMPT:
You are setting up a monorepo for the RunSmart project. The web app lives in V0/.
Use the monorepo-management skill for best practices.

Create the following monorepo structure:

1. Create `pnpm-workspace.yaml` at repo root:
   - packages: ['packages/*', 'V0']

2. Create `turbo.json` at repo root with build/lint/typecheck pipelines

3. Create `packages/shared/` with:
   - package.json (name: @runsmart/shared, main: src/index.ts)
   - tsconfig.json
   - src/index.ts (barrel export)

4. Extract TypeScript interfaces from V0/lib/db.ts into packages/shared/src/models/:
   - user.ts (User, PlanSetupPreferences, OnboardingSession, ConversationMessage)
   - plan.ts (Plan, Workout, WorkoutTemplate, PeriodizationPhase)
   - run.ts (Run, ActiveRecordingSession, GPSPoint)
   - recovery.ts (SleepData, HRVMeasurement, RecoveryScore, SubjectiveWellness)
   - goal.ts (Goal, GoalMilestone, GoalProgressHistory, GoalRecommendation, SmartGoal)
   - coaching.ts (CoachingProfile, CoachingFeedback, CoachingInteraction)
   - device.ts (WearableDevice, HeartRateData, HeartRateZone, HeartRateZoneSettings)
   - challenge.ts (ChallengeTemplate, ChallengeProgress)
   - route.ts (Route, RouteRecommendation, UserRoutePreferences)
   - metrics.ts (PerformanceMetrics, PersonalRecord, AdvancedMetrics, RunningDynamicsData)

5. Create packages/shared/src/api/:
   - endpoints.ts (enum of all API route paths)
   - types.ts (request/response DTOs for key endpoints)

6. Do NOT modify V0/ imports yet - that's a separate task.

After creating files, run: cd packages/shared && npx tsc --noEmit
```

**Verify**: `cd packages/shared && npx tsc --noEmit` passes with no errors.

---

### Task 0.2 - Swift Type Generation Script
- **Agent**: Codex or Claude Code
- **Skills**: None specific
- **Parallel**: Yes (can run alongside 0.3)
- **Depends on**: Task 0.1

```
PROMPT:
Create a script at packages/shared/scripts/generate-swift-types.ts that:

1. Reads all TypeScript interfaces from packages/shared/src/models/*.ts
2. Generates Swift Codable structs that mirror the TypeScript interfaces
3. Output to: apps/ios/RunSmart/Generated/SharedModels.swift

Mapping rules:
- string -> String
- number -> Double (or Int where clearly integer like id, count)
- boolean -> Bool
- Date -> Date
- optional fields (?) -> Optional
- string enums -> Swift enum: String, Codable
- arrays -> [Type]
- nested interfaces -> nested Codable structs
- id?: number -> var id: UUID = UUID() (SwiftData will use UUID)

Add a package.json script: "generate:swift": "npx tsx scripts/generate-swift-types.ts"

Also create the output directory: apps/ios/RunSmart/Generated/
```

**Verify**: `cd packages/shared && npm run generate:swift` produces a valid `.swift` file.

---

### Task 0.3 - CI/CD for iOS
- **Agent**: Cursor or Codex
- **Parallel**: Yes (can run alongside 0.2)
- **Depends on**: Nothing

```
PROMPT:
Create GitHub Actions workflows for iOS CI/CD:

1. .github/workflows/ios-build.yml:
   - Trigger: push/PR to iOS-application branch, paths: apps/ios/**
   - Runner: macos-14
   - Steps: checkout, setup Xcode 16, resolve SPM, build (xcodebuild), run tests
   - Cache SPM packages

2. .github/workflows/ios-testflight.yml:
   - Trigger: manual workflow_dispatch + push to tag v*-ios
   - Runner: macos-14
   - Steps: checkout, setup Xcode, build archive, upload to TestFlight via xcrun altool
   - Uses repository secrets: APP_STORE_CONNECT_API_KEY, TEAM_ID

3. Create apps/ios/fastlane/Fastfile with lanes:
   - test: run unit tests
   - beta: build and upload to TestFlight
   - release: build and upload to App Store

4. Create apps/ios/fastlane/Appfile:
   - app_identifier: "com.runsmart.ios"
   - team_id: (placeholder)

Note: Use placeholder values for secrets/IDs. Mark them with TODO comments.
```

**Verify**: YAML is valid (use `actionlint` if available). Fastlane syntax is correct.

---

## Phase 1: iOS Foundation

### Task 1.1 - Xcode Project Scaffolding
- **Agent**: Claude Code
- **Skills**: `ios-expert`, `architecture-patterns`
- **Parallel**: No (everything in Phase 1 builds on this)
- **Depends on**: Phase 0 complete

```
PROMPT:
Use the ios-expert agent to create the iOS project scaffolding.
Follow the architecture decisions in .claude/agents/ios-expert.md:
- iOS 17+ minimum, Swift 6, strict concurrency
- MVVM with @Observable
- SwiftData for persistence

Create the Xcode project structure at apps/ios/:

apps/ios/RunSmart/
  App/
    RunSmartApp.swift         - @main entry with WindowGroup
                              - Inject ModelContainer, AppState, APIClient as environment
    AppState.swift            - @Observable class:
                              - isAuthenticated: Bool
                              - isOnboardingComplete: Bool
                              - currentUser: UserProfile?
                              - activePlan: TrainingPlan?
    ContentView.swift         - if !onboardingComplete: OnboardingView
                              - else: MainTabView
    MainTabView.swift         - TabView with 5 tabs:
                              - Today (house icon)
                              - Plan (calendar icon)
                              - Record (circle.fill, prominent center)
                              - Coach (message icon)
                              - Profile (person icon)

  Core/
    Storage/
      LocalStore.swift        - ModelContainer factory with schema version
      ModelContainerConfig.swift - Migration plans
    Networking/
      (placeholder files for Task 1.3)

  Features/
    Today/       (empty, placeholder)
    Training/    (empty, placeholder)
    Recording/   (empty, placeholder)
    Coach/       (empty, placeholder)
    Profile/     (empty, placeholder)
    Onboarding/  (empty, placeholder)

  Design/
    (placeholder for Task 1.4)

Also create:
- apps/ios/RunSmart/Info.plist with:
  - NSLocationWhenInUseUsageDescription
  - NSLocationAlwaysAndWhenInUseUsageDescription
  - NSHealthShareUsageDescription
  - NSHealthUpdateUsageDescription
- apps/ios/RunSmart/RunSmart.entitlements:
  - com.apple.developer.healthkit
  - aps-environment (development)
- apps/ios/RunSmart.xcodeproj/project.pbxproj (or use SPM Package.swift)
- apps/ios/Package.swift with SPM dependencies:
  - supabase-swift ~> 2.0.0
  - swift-collections ~> 1.0.0

The app should compile and show the TabView when launched.
Target: iOS 17.0, Swift 6 language mode.
```

**Verify**: `xcodebuild -scheme RunSmart -destination 'platform=iOS Simulator,name=iPhone 16'` builds successfully.

---

### Task 1.2 - SwiftData Models
- **Agent**: Claude Code or Codex
- **Skills**: `ios-swiftui-patterns`
- **Parallel**: Yes (after 1.1, can parallel with 1.3 and 1.4)
- **Depends on**: Task 1.1, Task 0.2 (generated types as reference)

```
PROMPT:
Create SwiftData @Model classes for the RunSmart iOS app.
Reference the web data models in V0/lib/db.ts for field-by-field parity.
Reference the generated Swift types in apps/ios/RunSmart/Generated/SharedModels.swift.

Create these priority models at apps/ios/RunSmart/Core/Storage/Models/:

1. UserModel.swift - Maps to User interface (db.ts). Key fields:
   - id: UUID, name, email, age, experienceLevel, weeklyGoal
   - fitnessLevel, goal, currentWeeklyDistance
   - preferredRunDays: [String], longRunDay
   - vo2Max, lactatePaceThreshold, maxHeartRate, restingHeartRate
   - streakCount, lastRunDate
   - coachingStyle, onboardingComplete

2. PlanModel.swift - Maps to Plan interface. Key fields:
   - id, name, goal, startDate, endDate, status
   - periodization, complexity, currentPhase
   - Relationship: workouts -> [WorkoutModel]

3. WorkoutModel.swift - Maps to Workout interface. Key fields:
   - id, planId, day, type, distance, duration
   - targetPace, intensity, description, completed
   - Relationship: plan -> PlanModel

4. RunModel.swift - Maps to Run interface. Key fields:
   - id, date, distance, duration, avgPace
   - calories, heartRateAvg, gpsPath (as Data, encoded [GPSPoint])
   - notes, perceivedEffort, shoeId
   - gpsAccuracyData (embedded Codable struct)

5. GoalModel.swift - Maps to Goal interface. Key fields:
   - id, type, status, specific, measurable
   - achievable, timeBound, targetDate
   - currentValue, targetValue, progressPercentage

6. RecoveryScoreModel.swift - Maps to RecoveryScore. Key fields:
   - id, date, overallScore
   - sleepScore, hrvScore, restingHRScore
   - wellnessScore, trainingLoadScore
   - recommendations: [String]

7. ChatMessageModel.swift - Key fields:
   - id, role (user/assistant/system), content
   - timestamp, context (optional metadata)

8. ShoeModel.swift, BadgeModel.swift, ChallengeProgressModel.swift

Use @Attribute(.unique) for id fields.
Use @Relationship for Plan<->Workout connections.
Use Codable structs for embedded complex types (GPS data, etc.).
All models must be @MainActor safe with Swift 6 concurrency.

Update LocalStore.swift to include all models in the ModelContainer schema.
```

**Verify**: App compiles with SwiftData models. Insert and query a test UserModel in a SwiftUI preview.

---

### Task 1.3 - Networking Layer
- **Agent**: Claude Code
- **Skills**: `architecture-patterns`
- **Parallel**: Yes (after 1.1, can parallel with 1.2 and 1.4)
- **Depends on**: Task 1.1

```
PROMPT:
Create the networking layer for RunSmart iOS at apps/ios/RunSmart/Core/Networking/.
This layer calls the SAME API backend as the web app (V0/app/api/ routes).

1. APIClient.swift:
   - Protocol: APIClientProtocol (for testing with mocks)
   - @Observable class APIClient: APIClientProtocol
   - Generic request<T: Decodable>(_ endpoint: Endpoint) async throws -> T
   - Uses URLSession with async/await
   - Injects auth token from AuthManager
   - Adds headers: X-Client-Platform: ios, X-Client-Version: 1.0.0
   - Error handling: maps HTTP status codes to typed APIError

2. APIError.swift:
   - enum APIError: Error - unauthorized, notFound, serverError, networkError, decodingError, rateLimited

3. Endpoints.swift:
   - struct Endpoint: path, method, body, queryItems
   - Static factory methods for key routes:
     - .chat(messages:) -> POST /api/chat
     - .generatePlan(request:) -> POST /api/generate-plan
     - .runReport(runData:) -> POST /api/run-report
     - .login(email:password:) -> POST /api/auth/login
     - .signup(email:password:name:) -> POST /api/auth/signup
     - .goals() -> GET /api/goals
     - .updateGoal(id:data:) -> PUT /api/goals/[id]
     - .recovery() -> GET /api/recovery
     - .coaching() -> GET /api/coaching/adaptive-recommendations

4. AuthManager.swift:
   - @Observable class, stores Supabase session
   - Uses Supabase Swift SDK for auth (email/password)
   - Stores tokens in Keychain (not UserDefaults)
   - signIn(email:password:) async throws
   - signUp(email:password:name:) async throws
   - signOut()
   - currentSession: Session?
   - isAuthenticated: Bool (computed)

5. StreamingParser.swift:
   - Parses Server-Sent Events (SSE) from /api/chat
   - Returns AsyncThrowingStream<String, Error>
   - Handles: data:, event:, retry: fields
   - Handles [DONE] sentinel

6. OfflineQueue.swift:
   - Stores failed requests in SwiftData
   - Retries when network becomes available (NWPathMonitor)
   - Exponential backoff

Read V0/app/api/chat/route.ts to understand the exact SSE format.
Read V0/lib/supabase/client.ts to understand the auth pattern.
```

**Verify**: Unit test that mocks URLSession, calls `APIClient.request`, decodes response. Test SSE parser with sample chat stream data.

---

### Task 1.4 - Design System
- **Agent**: Cursor (fast iteration on visual code)
- **Skills**: `mobile-ios-design`, `ios-swiftui-patterns`
- **Parallel**: Yes (after 1.1, can parallel with 1.2 and 1.3)
- **Depends on**: Task 1.1

```
PROMPT:
Create the RunSmart design system for iOS SwiftUI.
Reference the web design: V0/tailwind.config.ts and V0/app/globals.css
Design language: "Bold Athletic Minimalism"

Create at apps/ios/RunSmart/Design/:

1. Colors.swift - Color extension with:
   - Neon accents: .neonCyan (#00FFFF), .neonYellow (#FFD93D), .neonPink (#FF0080)
   - Athletic neutrals: .athleticBlack (#0A0A0A), .gray900, .gray800, .gray700, .gray100
   - Workout types: .workoutEasy (green), .workoutTempo (orange), .workoutIntervals (pink),
     .workoutLong (blue), .workoutTimeTrial (red), .workoutHill (purple), .workoutRest (gray)
   - Semantic: .recoveryExcellent (emerald), .recoveryGood (amber), .recoveryLow (rose)

2. Gradients.swift - LinearGradient presets:
   - .energy: #FF6B6B -> #FF8E53 -> #FFD93D
   - .focus: #6366F1 -> #8B5CF6 -> #D946EF
   - .recovery: #06B6D4 -> #3B82F6 -> #6366F1
   - .success: #10B981 -> #059669

3. Typography.swift:
   - Custom font registration for DM Serif Display (headers)
   - System SF Pro for body (native feel)
   - Font styles: .displayLarge, .displayMedium, .headline, .body, .caption
   - All support Dynamic Type

4. Spacing.swift:
   - CGFloat constants: .xs(4), .sm(8), .md(16), .lg(24), .xl(32), .xxl(48)

5. Animations.swift:
   - .pulseGlow - infinite scaling pulse for START button
   - .slideInRight - entry animation
   - .morph - border radius transition
   - ViewModifier for staggered delays

6. Components/:
   - RunSmartButton.swift - Primary (gradient bg), Secondary (outline), variants
   - RunSmartCard.swift - Card with shadow, rounded corners, optional gradient border
   - MetricDisplay.swift - Large number + unit + label (for pace, distance, etc.)
   - ProgressRing.swift - Circular progress indicator with color theming
   - StreakBadge.swift - Flame icon + count with glow

Include SwiftUI Previews for every component.
Use Apple HIG spacing and hit target sizes (44pt minimum).
```

**Verify**: All previews render in Xcode Canvas. Colors match web screenshots.

---

## Phase 2: Core User Journey

### Task 2.1 - Onboarding Flow
- **Agent**: Claude Code (complex logic + AI integration)
- **Skills**: `ios-expert`, `ios-swiftui-patterns`
- **Parallel**: No (first feature to build, validates foundation)
- **Depends on**: Phase 1 complete

```
PROMPT:
Build the complete onboarding flow for RunSmart iOS.
Reference: V0/components/onboarding-screen.tsx for exact steps and logic.
Use the ios-expert agent for SwiftUI patterns and architecture.

Create at apps/ios/RunSmart/Features/Onboarding/:

OnboardingView.swift - Container with:
- TabView(.page) for swiping between steps
- Progress bar at top (current step / total steps)
- Back button on non-first steps
- "Next" / "Get Started" button

OnboardingViewModel.swift - @Observable class:
- currentStep: Int
- Collected data: goal, experienceLevel, age, raceTime, weeklyDays, longRunDay, coachingStyle
- func completeOnboarding() - saves UserModel to SwiftData, calls /api/generate-plan
- Error handling with retry

Steps/ (one view per step):
1. WelcomeStep.swift - Brand intro, "Let's build your running journey"
2. GoalSelectionStep.swift - 3 cards: Build Habit, Increase Distance, Get Faster
3. ExperienceStep.swift - 3 levels: Beginner, Occasional, Regular runner
4. AgeStep.swift - Number picker (18-80)
5. PaceAssessmentStep.swift - Race distance picker + time wheel (HH:MM:SS)
6. ScheduleStep.swift - Day picker (2-6 days/week) + preferred long run day
7. CoachingStyleStep.swift - 4 options: Supportive, Challenging, Analytical, Motivational
8. PrivacyConsentStep.swift - Data usage explanation + toggle + "Get Started" button

On completion:
- Save UserModel to SwiftData
- Call /api/generate-plan with user preferences
- Generate initial plan, save PlanModel + WorkoutModels
- Set appState.isOnboardingComplete = true
- Transition to MainTabView

Handle errors: show retry button if plan generation fails.
Use the design system colors, typography, and components from Design/.
All text should be in English (Hebrew is web-only for TherapistOS, not RunSmart).
```

**Verify**: Complete onboarding in Simulator. User appears in SwiftData. Plan is generated and stored.

---

### Task 2.2 - Today Dashboard
- **Agent**: Cursor (UI-heavy, fast iteration)
- **Skills**: `ios-swiftui-patterns`
- **Parallel**: Yes (after 2.1, can parallel with 2.3)
- **Depends on**: Task 2.1 (needs UserModel + PlanModel populated)

```
PROMPT:
Build the Today dashboard for RunSmart iOS.
Reference: V0/components/today-screen.tsx

Create at apps/ios/RunSmart/Features/Today/:

TodayView.swift - ScrollView with sections:
1. Header: greeting + date
2. Stats row: streak (flame icon), weekly runs, consistency %
3. Recovery score card: ProgressRing (0-100), color-coded, recommendations
4. Today's workout card: type-colored gradient, workout details, large START button with pulse animation
5. 7-day timeline: horizontal scroll of day dots with workout indicators
6. Coach's tip: rotating daily tip card

TodayViewModel.swift - @Observable:
- Load today's workout from SwiftData (PlanModel -> today's WorkoutModel)
- Calculate streak from RunModel history
- Get recovery score from RecoveryScoreModel (latest)
- Weekly stats (runs completed, distance, consistency)

Components/:
- WorkoutCard.swift - Split design: gradient left side (workout type color), details right
- StreakIndicator.swift - Flame icon with count, orange glow
- RecoveryScoreCard.swift - ProgressRing + score + trend arrow + recommendation text
- WeeklyTimelineView.swift - HStack of 7 DayNode views
- DayNode.swift - Circle with workout type dot, today highlighted

The START button should navigate to RecordRunView (via NavigationStack).
Use workout type colors from Design/Colors.swift.
Use gradients from Design/Gradients.swift.
```

**Verify**: Dashboard shows with mock data. Workout card displays correct type. START button navigates.

---

### Task 2.3 - Plan Calendar
- **Agent**: Cursor
- **Parallel**: Yes (can run alongside 2.2 and 2.4)
- **Depends on**: Task 2.1

```
PROMPT:
Build the Plan calendar view for RunSmart iOS.
Reference: V0/components/plan-screen.tsx

Create at apps/ios/RunSmart/Features/Training/:

PlanView.swift - Two view modes via Picker:
1. Calendar mode: monthly grid, days have colored workout-type dots
2. List mode: grouped by week, each workout as a card

PlanViewModel.swift - @Observable:
- Load active PlanModel + all WorkoutModels from SwiftData
- Group workouts by week
- Calculate weekly volume (total distance, total duration)
- Track completed vs remaining workouts

WorkoutDetailView.swift - Sheet presented on workout tap:
- Workout type, distance, duration, target pace
- Description/instructions
- Phase breakdown (warmup, main, cooldown) if interval workout
- "Mark Complete" button (manual entry) or "Start Run" button
- Color-coded header by workout type

Components/:
- CalendarGridView.swift - LazyVGrid 7-column, workout dots per day
- WeekCard.swift - Week header + workout list + volume summary
- WorkoutRow.swift - Compact: type icon + name + distance + duration
- WorkoutTypeIcon.swift - SF Symbol + color per type (run=figure.run, intervals=repeat, rest=bed)

Use workout colors consistently. Current week highlighted.
```

**Verify**: Calendar shows plan workouts. Tap a workout shows detail sheet. Week volumes are correct.

---

### Task 2.4 - Chat Screen with Streaming
- **Agent**: Claude Code (SSE streaming complexity)
- **Skills**: `ios-expert`
- **Parallel**: Yes (can run alongside 2.2 and 2.3)
- **Depends on**: Task 1.3 (StreamingParser)

```
PROMPT:
Build the AI chat coach screen for RunSmart iOS.
Reference: V0/components/chat-screen.tsx and V0/app/api/chat/route.ts

Create at apps/ios/RunSmart/Features/Coach/:

ChatView.swift:
- ScrollView of message bubbles (user right-aligned, assistant left-aligned)
- Auto-scroll to latest message
- Input bar at bottom: TextField + send button
- Suggested quick actions above input (e.g., "How should I warm up?", "Am I overtraining?")
- Typing indicator while streaming

ChatViewModel.swift - @Observable:
- messages: [ChatMessageModel] loaded from SwiftData
- isStreaming: Bool
- func sendMessage(_ text: String):
  1. Append user message to SwiftData
  2. Call StreamingParser with /api/chat endpoint
  3. Build assistant message incrementally as SSE chunks arrive
  4. Save complete assistant message to SwiftData
  5. Handle <user_data_update> JSON blocks (parse and update UserModel)
- System context: include recent runs, current plan, recovery score in first message

Components/:
- MessageBubble.swift - User (gradient bg, white text) vs Assistant (gray bg, dark text)
- StreamingDots.swift - Animated typing indicator (3 bouncing dots)
- ChatInputBar.swift - HStack: TextField + send Button, keyboard avoiding
- QuickActionChips.swift - Horizontal scroll of tappable suggestion pills

The chat must:
- Send user context (last 3 runs, current plan week, recovery) with first message
- Support streaming (text appears word-by-word)
- Persist all messages in SwiftData
- Handle network errors gracefully (show retry button)

Read V0/app/api/chat/route.ts to understand:
- The system prompt format
- How user context is included
- The SSE response format
- The <user_data_update> protocol for in-chat profile updates
```

**Verify**: Send a message, see streaming response. Messages persist across app restarts. Quick actions work.

---

### Task 2.5 - Profile Screen
- **Agent**: Cursor (UI layout work)
- **Parallel**: Yes (after 2.1)
- **Depends on**: Task 2.1

```
PROMPT:
Build the Profile screen for RunSmart iOS.
Reference: V0/components/profile-screen.tsx

Create at apps/ios/RunSmart/Features/Profile/:

ProfileView.swift - NavigationStack with List/Form sections:

Section "Stats":
- Total runs, total distance, total time
- Current streak
- Average pace
- Personal records (fastest 5K, 10K, longest run)

Section "Goals":
- Active goals list with progress bars
- "Add Goal" button

Section "Shoes":
- List of shoes with mileage
- "Add Shoe" button -> sheet

Section "Devices":
- Connected wearables status
- "Connect Device" button

Section "Preferences":
- Coaching style picker
- Units (km/mi) toggle
- Notification preferences

Section "Account":
- Email display
- "Sign Out" button
- "Delete All Data" button (with confirmation alert)
- App version

ProfileViewModel.swift - @Observable:
- Load user stats from RunModel aggregates
- Load goals from GoalModel
- Load shoes from ShoeModel
- Handle sign out via AuthManager
- Handle data deletion (clear all SwiftData)
```

**Verify**: Profile shows user stats. Sign out works. Data deletion clears SwiftData.

---

### Task 2.6 - Run Recording (MOST COMPLEX - dedicated week)
- **Agent**: Claude Code (complex state machine + GPS + background)
- **Skills**: `ios-expert`, `ios-swiftui-patterns`, `swift-health-kit`
- **Parallel**: No (needs full attention, most complex feature)
- **Depends on**: Tasks 2.1-2.5 complete (full foundation validated)

```
PROMPT:
Build the run recording screen for RunSmart iOS. This is the most complex feature.
Reference: V0/components/record-screen.tsx (135KB) and V0/hooks/use-gps-tracking.ts

Use the ios-expert agent. This needs CoreLocation background tracking,
which is the #1 native advantage over the PWA.

Create at apps/ios/RunSmart/Features/Recording/:

LocationManager.swift - @Observable:
- CLLocationManager with requestAlwaysAuthorization
- allowsBackgroundLocationUpdates = true (CRITICAL)
- desiredAccuracy = kCLLocationAccuracyBest
- distanceFilter = 5.0 (meters)
- GPS quality filtering (port from V0/hooks/use-gps-tracking.ts):
  - Reject points with horizontalAccuracy > 20m
  - Reject duplicate points (same lat/lng within threshold)
  - Reject stale points (timestamp > 10s old)
  - Reject speed anomalies (> 30 m/s)
- Publishes: currentLocation, gpsAccuracy, isTracking

RecordRunViewModel.swift - @Observable (main orchestrator):
- State machine: .idle -> .countdown -> .running -> .paused -> .stopped -> .saving
- Timer: elapsed seconds (updated every second)
- Metrics: distance (from GPS points), currentPace, avgPace, calories
- gpsPoints: [GPSPoint] collected during run
- Auto-pause: detect speed < 0.5 m/s for > 10 seconds
- Interval management: if workout has phases (warmup/intervals/cooldown), track current phase
- Checkpoint recovery: save state to SwiftData every 30 seconds
- func startRun(), pauseRun(), resumeRun(), stopRun(), saveRun()
- On save: create RunModel, call /api/run-report for AI analysis

RunMetricsCalculator.swift:
- calculateDistance(from: [CLLocation]) -> Double (Haversine formula)
- calculatePace(distance:duration:) -> Double (min/km)
- calculateCalories(distance:weight:) -> Double
- calculateSplits(points: [GPSPoint]) -> [Split] (per km splits)

CheckpointRecovery.swift:
- Save ActiveRecordingSession to SwiftData periodically
- On app launch, check for incomplete sessions
- Present recovery dialog: "Resume previous run?" with distance/duration

RecordRunView.swift:
- Pre-run: workout info card + "Start" button (pulse animation)
- 3-2-1 countdown overlay
- During run: large metrics display (duration center, distance + pace below)
- GPS accuracy badge (green/yellow/red)
- Pause/Stop buttons at bottom
- If interval workout: current phase banner + countdown to next phase
- Map view (optional toggle) showing route in real-time

PostRunSummaryView.swift:
- Summary: distance, duration, avg pace, calories
- Split table (per km)
- Route map replay
- RPE slider (1-10)
- Notes text field
- "Save & Get Report" button -> calls /api/run-report
- Shows AI insights when report returns

The screen must:
- Keep GPS running when app is backgrounded (CLBackgroundActivitySession on iOS 17+)
- Prevent screen dimming: UIApplication.shared.isIdleTimerDisabled = true during run
- Handle phone calls gracefully (auto-pause)
- Save to HealthKit as HKWorkout + HKWorkoutRoute
```

**Verify**: Record a run in Simulator with simulated GPS (City Run). Background the app - GPS continues. Stop run, see summary. AI report returns. Run appears in SwiftData. Check Health app for HKWorkout.

---

### Task 2.7 - Run Report
- **Agent**: Cursor
- **Parallel**: Yes (after 2.6 provides run data)
- **Depends on**: Task 2.6

```
PROMPT:
Build the run report screen for RunSmart iOS.
Reference: V0/components/run-report-screen.tsx and V0/app/api/run-report/route.ts

Create at apps/ios/RunSmart/Features/RunReport/:

RunReportView.swift - ScrollView with:
- Header: date, distance, duration, avg pace
- AI Summary card: bullet points from AI analysis
- Pacing Analysis: consistent/fading/negative-split/erratic with explanation
- Effort Level: easy/moderate/hard badge
- Safety Flags: if any (load spike, injury signal, heat risk) - prominent warning cards
- Split Table: per-km pace with color coding (faster=green, slower=red vs average)
- Route Map: MapKit view with colored polyline (pace-based coloring)
- Recovery Recommendations: action cards
- "Share" button: generate share image

RunReportViewModel.swift - @Observable:
- Load from RunModel.runReport (stored JSON)
- Or fetch from /api/run-report if not yet generated
- Parse structured response: summary, effort, pacing, safetyFlags, recommendations

Use workout type colors and gradients from Design system.
```

**Verify**: View report for a completed run. AI insights display correctly. Safety flags show when present.

---

## Phase 3: Mobile-Specific Enhancements

### Task 3.1 - HealthKit Integration
- **Agent**: Claude Code
- **Skills**: `swift-health-kit`
- **Parallel**: Yes (can run alongside 3.2)
- **Depends on**: Phase 2 complete

```
PROMPT:
Implement comprehensive HealthKit integration for RunSmart iOS.
Use the swift-health-kit skill for authorization patterns and best practices.

Create at apps/ios/RunSmart/Core/Health/:

HealthKitManager.swift - @Observable singleton:
- Request authorization for read types:
  HKQuantityType: heartRate, heartRateVariabilitySDNN, restingHeartRate,
  stepCount, activeEnergyBurned, vo2Max, runningSpeed, runningPower,
  runningStrideLength, runningGroundContactTime, runningVerticalOscillation
  HKCategoryType: sleepAnalysis
  HKWorkoutType: workout
- Request authorization for write types:
  HKWorkoutType: workout
  HKSeriesType: workoutRoute
- isAuthorized: Bool

SleepDataFetcher.swift:
- fetchLatestSleep() async -> SleepData?
- Query HKCategorySample for sleepAnalysis
- Map sleep stages: inBed, asleepCore, asleepDeep, asleepREM, awake
- Calculate: totalDuration, efficiency, deepSleepPercentage, remPercentage

HRVFetcher.swift:
- fetchLatestHRV() async -> HRVMeasurement?
- Query HKQuantitySample for heartRateVariabilitySDNN
- Return RMSSD value with timestamp

RestingHeartRateFetcher.swift:
- fetchLatestRestingHR() async -> Double?
- Query HKQuantitySample for restingHeartRate

HeartRateFetcher.swift:
- fetchHeartRateDuringRun(start:end:) async -> [HeartRateDataPoint]
- Real-time HR during active workout via HKAnchoredObjectQuery

WorkoutRecorder.swift:
- saveWorkout(run: RunModel, gpsPoints: [GPSPoint]) async throws
- Create HKWorkout (activityType: .running)
- Attach HKWorkoutRoute from GPS points
- Save heart rate samples if available
- Save distance, energy burned

RunningDynamicsFetcher.swift:
- Fetch cadence, ground contact time, stride length, vertical oscillation
- Map to RunningDynamicsData model

BackgroundDelivery.swift:
- Register HKObserverQuery for sleep, HRV, resting HR
- enableBackgroundDelivery for automatic updates
- When new data arrives, update recovery score in SwiftData

Update RecordRunViewModel to:
- Start HKWorkoutSession when recording begins
- Collect real-time heart rate during run
- Save HKWorkout on run completion

Update RecoveryEngine (when built in Phase 4) to source from HealthKit.
```

**Verify**: Request HealthKit permissions in Simulator. Read mock health data. After a recorded run, check HKWorkout appears in Health app.

---

### Task 3.2 - Push Notifications
- **Agent**: Cursor or Codex
- **Parallel**: Yes (can run alongside 3.1)
- **Depends on**: Phase 2 complete

```
PROMPT:
Implement push notifications for RunSmart iOS.

Create at apps/ios/RunSmart/Core/Notifications/:

NotificationManager.swift:
- Request UNUserNotificationCenter authorization (.alert, .sound, .badge)
- Schedule local notifications for:
  1. Workout reminders: "Your [type] run is scheduled for today" - morning of workout day
  2. Streak warnings: "Don't break your [N]-day streak!" - evening if no run logged
  3. Recovery alerts: "Recovery score is [X]%, consider rest" - after low recovery
  4. Weekly recap: Sunday evening summary
  5. Challenge prompts: daily motivation for active challenges
- Cancel outdated notifications when plan changes
- Manage notification categories and actions

WorkoutReminderScheduler.swift:
- Schedule notifications for all upcoming workouts in current plan
- Reschedule when plan is regenerated or workout is rescheduled
- User-configurable reminder time (default: 8 AM)

StreakReminderScheduler.swift:
- Check at 7 PM if today's workout is complete
- If not, send reminder at 8 PM
- Don't send on rest days

Update AppState to request notification permission during onboarding.
Update PlanViewModel to reschedule notifications when plan changes.
```

**Verify**: Notifications fire in Simulator. Workout reminders appear at correct times. Streak warning fires when no run logged.

---

### Task 3.3 - Widgets & Live Activities
- **Agent**: Claude Code
- **Skills**: `ios-swiftui-patterns`
- **Parallel**: Yes (after 3.1 and 3.2, or alongside)
- **Depends on**: Phase 2 complete

```
PROMPT:
Create home screen widgets and Live Activities for RunSmart iOS.

WIDGETS - Create widget extension at apps/ios/RunSmartWidgets/:

RunSmartWidgets.swift - WidgetBundle with all widgets

TodayWorkoutWidget.swift:
- Small: workout type icon + name + distance
- Medium: workout type icon + name + distance + duration + description snippet
- Timeline: updates daily at midnight + when plan changes
- Intent: tap opens app to Today screen

StreakWidget.swift:
- Small: flame icon + streak count + "days" label
- Uses orange gradient background
- Updates after each run save

RecoveryWidget.swift:
- Small: circular recovery score ring + score number
- Color: emerald(>80), amber(60-80), rose(<60)
- Updates when new health data arrives

LIVE ACTIVITIES - Create at apps/ios/RunSmart/Features/Recording/LiveActivity/:

RunActivityAttributes.swift:
- ContentState: elapsedTime (TimeInterval), distance (Double), currentPace (String), heartRate (Int?)
- Static: workoutType (String), workoutName (String)

RunActivityView.swift:
- Lock screen: elapsed time (large), distance + pace (row below)
- Dynamic Island compact: timer + distance
- Dynamic Island expanded: timer, distance, pace, HR zone color bar
- Use workout type color for accents

Update RecordRunViewModel to:
- Start Live Activity when run begins
- Update every 5 seconds with new metrics
- End Live Activity when run stops (show summary briefly)
```

**Verify**: Add widgets to home screen in Simulator. Start a run - Live Activity appears on lock screen. Metrics update in real-time.

---

### Task 3.4 - Haptics + Siri + Audio (bundle)
- **Agent**: Codex or Cursor
- **Parallel**: Yes (independent features)
- **Depends on**: Task 2.6 (Recording screen)

```
PROMPT:
Add haptic feedback, Siri Shortcuts, and audio coaching to RunSmart iOS.

HAPTICS at apps/ios/RunSmart/Core/Feedback/:
HapticEngine.swift:
- Use UIImpactFeedbackGenerator and UINotificationFeedbackGenerator
- Patterns:
  - .mileMarker: three strong taps (UIImpactFeedbackGenerator(.heavy) x3 with delays)
  - .intervalChange: notification success
  - .paceAlert: notification warning
  - .autoPause: light tap
  - .autoResume: medium tap
  - .achievement: notification success
  - .buttonTap: light impact
Update RecordRunViewModel to trigger haptics at: km markers, interval phase changes, auto-pause.

SIRI SHORTCUTS at apps/ios/RunSmart/Core/Intents/:
RunSmartShortcuts.swift - AppShortcutsProvider:
- "Start my run" -> opens app to Record screen
- "What's my recovery score?" -> returns current score via Siri response
- "How far did I run this week?" -> returns weekly distance

Use App Intents framework (iOS 16+).
Register shortcuts in RunSmartApp.swift.

AUDIO COACHING at apps/ios/RunSmart/Core/Audio/:
AudioCoachEngine.swift:
- AVSpeechSynthesizer for spoken cues
- AVAudioSession category: .playback with .mixWithOthers (speaks over music)
- Cue types:
  - Mile/km marker: "One kilometer. Pace: five minutes thirty seconds."
  - Interval change: "Interval complete. Recovery phase. Slow to easy pace."
  - Halfway point: "Halfway there. You've covered two point five K."
  - Final push: "Last kilometer! Finish strong!"
- User can enable/disable in settings
- Works in background (requires audio background mode)
Update RecordRunViewModel to trigger audio cues at appropriate points.
```

**Verify**: Start run - feel haptic at 1km. Hear audio cue at km markers. Siri shortcut opens app.

---

## Phase 4: Advanced Features

### Task 4.1 - Recovery Engine
- **Agent**: Claude Code
- **Skills**: `swift-health-kit`
- **Parallel**: Yes (can run alongside 4.2)
- **Depends on**: Task 3.1 (HealthKit)

```
PROMPT:
Port the RunSmart recovery engine to iOS Swift.
Reference: V0/lib/recoveryEngine.ts for the exact algorithm.

Create at apps/ios/RunSmart/Features/Recovery/:

RecoveryEngine.swift:
- Port the scoring algorithm exactly:
  - Sleep quality: 25% weight (duration vs 8h target, efficiency vs 85%, deep sleep vs 20%)
  - HRV score: 25% weight (RMSSD vs personal baseline, tiered: +10%=90, at=80, -10%=70)
  - Resting HR: 15% weight (compared to baseline)
  - Subjective wellness: 20% weight (energy, mood, soreness inverted, stress inverted, motivation)
  - Training load: 10% weight (negative impact if load > 80)
  - Stress: 5% weight (from sleep efficiency, HRV, subjective)
- Phone-only mode weights: subjective 40%, training load 25%, sleep 25%, behavior 10%
- Baseline calculation from rolling averages

RecoveryBaseline.swift:
- Calculate personal baselines from historical data
- Rolling 14-day averages for HR, HRV, sleep
- Update baselines weekly

RecoveryViewModel.swift - @Observable:
- Source inputs from HealthKit (via HealthKitManager):
  - Sleep -> SleepDataFetcher
  - HRV -> HRVFetcher
  - Resting HR -> RestingHeartRateFetcher
- Source training load from RunModel history
- Source subjective wellness from manual input
- Calculate and store RecoveryScoreModel daily
- Generate personalized recommendations

RecoveryView.swift:
- Large recovery score ring (animated, color-coded)
- Factor breakdown bars (sleep, HRV, HR, wellness, load)
- Trend chart: last 7/30 days
- Recommendations cards
- "Log Wellness" button for subjective input

SubjectiveWellnessSheet.swift:
- Sliders for: energy, mood, soreness, stress, motivation (1-10)
- Quick presets: "Feeling great", "Average", "Tired"

Key advantage over web: HealthKit provides sleep, HRV, and resting HR
AUTOMATICALLY - no manual device sync needed.
```

**Verify**: Recovery score calculates from HealthKit data. Score matches web algorithm for same inputs. Trend chart renders.

---

### Task 4.2 - Data Sync
- **Agent**: Claude Code
- **Skills**: `architecture-patterns`
- **Parallel**: Yes (can run alongside 4.1)
- **Depends on**: Phase 2 complete

```
PROMPT:
Build cross-platform data sync for RunSmart iOS.
Users must see the same data on web and iOS.

Create at apps/ios/RunSmart/Core/Storage/:

SyncManager.swift - @Observable:
- Orchestrates SwiftData <-> Supabase sync
- Architecture: local-first (SwiftData is source of truth)
- On save: write to SwiftData immediately + queue sync to server
- On launch: pull latest from server, merge into SwiftData
- Sync entities: User, Plan, Workout, Run, Goal, ChatMessage

SyncQueue.swift:
- Persisted queue of pending operations (create/update/delete)
- Each entry: entityType, entityId, operation, payload, timestamp, retryCount
- Process queue when network available
- Exponential backoff on failure (1s, 2s, 4s, 8s, max 5 retries)

ConflictResolver.swift:
- Strategy per entity:
  - Run: last-write-wins by timestamp (runs can't be edited on both platforms)
  - Plan: server wins (plan generation happens on server)
  - User: field-level merge (merge non-conflicting field changes)
  - ChatMessage: append-only (no conflicts possible)
  - Goal: last-write-wins by timestamp
- Log all conflicts for debugging

BackgroundSyncTask.swift:
- Register BGProcessingTask for periodic sync
- Run every 15 minutes when app is backgrounded
- Sync pending queue + pull new data

NetworkMonitor.swift:
- NWPathMonitor to detect connectivity changes
- When network restored: flush SyncQueue

Update all ViewModels to save through SyncManager instead of directly to SwiftData.
```

**Verify**: Create a run on iOS - appears on web (via Supabase). Create a plan on web - appears on iOS after sync. Offline changes sync when back online.

---

### Task 4.3 - Advanced Metrics + Routes
- **Agent**: Cursor (UI-focused)
- **Parallel**: Yes (after 4.1 provides data)
- **Depends on**: Task 4.1

```
PROMPT:
Build advanced metrics display and route integration for RunSmart iOS.

METRICS at apps/ios/RunSmart/Features/Metrics/:
AdvancedMetricsView.swift - Dashboard with:
- VO2 Max card (from HealthKit or estimated)
- Lactate threshold (pace + HR)
- Training Stress Score (weekly)
- Performance condition trend

HeartRateZonesView.swift:
- 5 zones displayed as colored bars with % time in each
- Zone config: calculation method picker (max HR, LT, HRR)
- Per-run zone distribution chart

RunningDynamicsView.swift:
- Cadence, ground contact time, stride length, vertical oscillation
- Sourced from HealthKit running dynamics or Apple Watch

PerformanceTrendsView.swift:
- SwiftUI Charts: pace trend (30/90 days), distance trend, consistency
- Personal records list with dates

ROUTES at apps/ios/RunSmart/Features/Routes/:
RouteMapView.swift:
- MapKit view with saved routes as polylines
- Tap a route to see details (distance, elevation, surface)

RouteListView.swift:
- List of saved/recommended routes
- Filter by distance, difficulty, surface type

Use SwiftUI Charts (built-in) for all charts.
Use MapKit for all map views.
```

**Verify**: Metrics display with real or mock data. Charts render correctly. Routes show on map.

---

## Phase 5: Stabilization & Release

### Task 5.1 - Analytics + Crash Reporting
- **Agent**: Codex
- **Parallel**: Yes (can run alongside 5.2)
- **Depends on**: Phase 4 complete

```
PROMPT:
Add analytics and crash reporting to RunSmart iOS.

Create at apps/ios/RunSmart/Core/Analytics/:

AnalyticsManager.swift:
- PostHog iOS SDK integration (matches web's PostHog)
- Track events: onboarding_complete, run_started, run_completed, chat_message_sent,
  plan_generated, goal_created, recovery_checked, widget_viewed
- User properties: experienceLevel, planComplexity, streakCount
- Screen views: track each tab view

CrashReporter.swift:
- Sentry iOS SDK integration
- Capture crashes, ANRs, HTTP errors
- Breadcrumbs for user actions
- Performance monitoring: app launch, screen renders

Add SPM dependencies: posthog-ios, sentry-cocoa
Initialize both in RunSmartApp.swift
```

---

### Task 5.2 - Accessibility Pass
- **Agent**: Claude Code
- **Parallel**: Yes (alongside 5.1)
- **Depends on**: All features complete

```
PROMPT:
Perform an accessibility audit on the entire RunSmart iOS app.

For EVERY view in Features/:
1. Add .accessibilityLabel() to all interactive elements
2. Add .accessibilityHint() for non-obvious actions
3. Add .accessibilityValue() for metrics and scores
4. Use @ScaledMetric for all custom spacing
5. Ensure Dynamic Type works (no fixed font sizes)
6. Add .accessibilityElement(children:) to group related elements
7. Test with Reduce Motion: replace all animations with simple fades
8. Verify color contrast meets WCAG AA (4.5:1 ratio)
9. Add .accessibilityAddTraits(.isButton) where needed
10. During-run screen: add VoiceOver announcements for km markers, pace changes

Focus on the most critical paths:
- Onboarding (first-time experience)
- Record run (safety-critical - runners may use VoiceOver)
- Recovery score (health information)
```

---

### Task 5.3 - TestFlight + App Store
- **Agent**: Claude Code
- **Skills**: `asc-release-flow`
- **Parallel**: No (final sequential task)
- **Depends on**: All previous tasks

```
PROMPT:
Prepare RunSmart iOS for TestFlight beta and App Store submission.
Use the asc-release-flow skill for the submission process.

1. Create App Store metadata:
   - apps/ios/fastlane/metadata/en-US/name.txt: "RunSmart - AI Running Coach"
   - apps/ios/fastlane/metadata/en-US/subtitle.txt: "Personalized Training Plans"
   - apps/ios/fastlane/metadata/en-US/description.txt: Full description
   - apps/ios/fastlane/metadata/en-US/keywords.txt: running,training,coach,AI,fitness,...
   - apps/ios/fastlane/metadata/en-US/privacy_url.txt
   - apps/ios/fastlane/metadata/en-US/release_notes.txt

2. Privacy nutrition labels for App Store Connect:
   - Health & Fitness: HealthKit data (linked to user)
   - Location: precise location during runs (linked to user)
   - Usage Data: analytics events (not linked to user)
   - Diagnostics: crash logs (not linked to user)

3. App Review notes explaining:
   - Why we need Always location (background GPS during runs)
   - Why we need HealthKit (recovery scoring, workout recording)
   - Demo account credentials for reviewer

4. Create Fastlane beta lane:
   - Increment build number
   - Build archive
   - Upload to TestFlight
   - Notify testers

5. Create screenshot generation:
   - apps/ios/fastlane/Snapfile for automated screenshots
   - 6.7" (iPhone 15 Pro Max) and 6.1" (iPhone 15 Pro)
```

**Verify**: Fastlane beta lane uploads to TestFlight. App installs from TestFlight. All features work on physical device.

---

## Execution Order Summary

```
Week 1:  [Sequential]  0.1 -> then parallel: 0.2 + 0.3
Week 2:  [Sequential]  1.1 -> then parallel: 1.2 + 1.3 + 1.4
Week 3:  [Continue]    Complete 1.2, 1.3, 1.4
Week 4:  [Sequential]  2.1 (onboarding) -> then parallel: 2.2 + 2.3 + 2.4 + 2.5
Week 5:  [Continue]    Complete 2.2-2.5
Week 6:  [Sequential]  2.6 (recording - full week) -> 2.7
Week 7:  [Parallel]    3.1 (HealthKit) + 3.2 (Notifications)
Week 8:  [Parallel]    3.3 (Widgets/LiveActivities) + 3.4 (Haptics/Siri/Audio)
Week 9:  [Parallel]    4.1 (Recovery) + 4.2 (Sync)
Week 10: [Parallel]    4.3 (Metrics/Routes) + 4.5 (Watch - stretch)
Week 11: [Parallel]    5.1 (Analytics) + 5.2 (Accessibility)
Week 12: [Sequential]  5.3 (TestFlight + App Store)
```

## Multi-Agent Parallel Execution Guide

### Can I run Claude Code + Cursor + Codex simultaneously?
**YES** - as long as they work on **different files/directories**:

| Time | Agent 1 (Claude Code) | Agent 2 (Cursor) | Agent 3 (Codex) |
|------|----------------------|-------------------|------------------|
| Week 4 | 2.1 Onboarding (complex logic) | 2.2 Today (UI) | 2.5 Profile (forms) |
| Week 5 | 2.4 Chat+Streaming | 2.3 Plan Calendar | - |
| Week 7 | 3.1 HealthKit | 3.2 Notifications | Tests for Phase 2 |
| Week 8 | 3.3 Widgets/Live | 3.4 Haptics/Siri/Audio | - |
| Week 9 | 4.1 Recovery Engine | 4.2 Sync Engine | 4.3 Metrics UI |

### Rules for safe parallel execution:
1. **Never** have two agents edit the same file simultaneously
2. Assign each agent a distinct `Features/` subdirectory
3. One agent owns `Core/` infrastructure changes at a time
4. Run `git pull` before each agent starts a session
5. Commit frequently from each agent to avoid merge conflicts
6. After parallel work, one agent does an integration pass

### Claude Code Agent Teams (bonus)
If using Claude Code with agent teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`):
- Use Opus 4.6 as lead/architect
- Spawn Sonnet teammates for parallel SwiftUI views
- Each teammate owns a `Features/` subdirectory
- Lead reviews and integrates
- See `.claude/skills/dev-swarm/SKILL.md` for coordination patterns

---

## Progress Tracking

After completing each task, update this section:

| Task | Status | Agent Used | Date | Notes |
|------|--------|-----------|------|-------|
| 0.1 Monorepo | - | | | |
| 0.2 Swift types | - | | | |
| 0.3 CI/CD | - | | | |
| 1.1 Xcode scaffold | - | | | |
| 1.2 SwiftData models | - | | | |
| 1.3 Networking | - | | | |
| 1.4 Design system | - | | | |
| 2.1 Onboarding | - | | | |
| 2.2 Today dashboard | - | | | |
| 2.3 Plan calendar | - | | | |
| 2.4 Chat streaming | - | | | |
| 2.5 Profile | - | | | |
| 2.6 Run recording | - | | | |
| 2.7 Run report | - | | | |
| 3.1 HealthKit | - | | | |
| 3.2 Notifications | - | | | |
| 3.3 Widgets/Live | - | | | |
| 3.4 Haptics/Siri/Audio | - | | | |
| 4.1 Recovery engine | - | | | |
| 4.2 Data sync | - | | | |
| 4.3 Metrics/Routes | - | | | |
| 4.5 Apple Watch | - | | | |
| 5.1 Analytics/Crash | - | | | |
| 5.2 Accessibility | - | | | |
| 5.3 TestFlight/Store | - | | | |
