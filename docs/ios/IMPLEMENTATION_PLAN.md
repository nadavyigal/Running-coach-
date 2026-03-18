# RunSmart iOS App - Implementation Plan

## Context

RunSmart is a Next.js 14 PWA running coach app (in `V0/`) with 50+ data models, 86 API routes, 10+ screens, AI coaching (GPT-4o), GPS tracking, recovery scoring, device sync, and offline-first storage (Dexie.js/IndexedDB). Users currently access it as a mobile web app, but the PWA has critical limitations: GPS stops when backgrounded, no native HealthKit access, no widgets/Live Activities, no push notifications, and no Apple Watch support.

This plan creates a **native SwiftUI iOS app** at `apps/ios/` that shares the same API backend, achieves feature parity, and adds substantial mobile-specific enhancements. The iOS expert agent (`.claude/agents/ios-expert.md`) and 6 installed skills provide the technical foundation.

**Timeline:** ~12 weeks across 6 phases
**Stack:** SwiftUI, Swift 6, iOS 17+, MVVM (@Observable), SwiftData, HealthKit, CoreLocation
**Repo structure:** Monorepo with `V0/` (web), `apps/ios/` (iOS), `packages/shared/` (shared types)

---

## Phase 0: Monorepo & Shared Infrastructure (Week 1)

### Goal
Restructure repo to support both web and iOS with shared type contracts and CI.

### Tasks

**0.1 - Monorepo setup**
- Create `pnpm-workspace.yaml` at repo root
- Create `turbo.json` for Turborepo pipeline
- Create `packages/shared/` with `package.json`, `tsconfig.json`
- Extract core TypeScript interfaces from `V0/lib/db.ts` (lines 4-1413) into `packages/shared/src/models/`:
  - `user.ts`, `plan.ts`, `run.ts`, `recovery.ts`, `goal.ts`, `coaching.ts`, `device.ts`, `challenge.ts`, `route.ts`
- Create `packages/shared/src/api/` with endpoint contracts, request/response DTOs
- Update `V0/` to import from `@runsmart/shared` instead of local types

**0.2 - TypeScript-to-Swift type generation**
- Create `packages/shared/scripts/generate-swift-types.ts` using `quicktype`
- Output: `apps/ios/RunSmart/Generated/Models.swift` (auto-generated Codable structs)
- Manual Swift refinements kept separate so regeneration is safe

**0.3 - iOS CI/CD**
- `.github/workflows/ios-build.yml` - Build + test on GitHub Actions
- `.github/workflows/ios-testflight.yml` - Automated TestFlight deploy
- `apps/ios/fastlane/Fastfile` + `Appfile` + `Matchfile` for code signing

**Cost:** Apple Developer Program $99/year, GitHub Actions macOS runners ~$50-100/month

### Definition of Done
`pnpm build` builds web; `xcodebuild` builds iOS; shared types compile for both; CI passes.

---

## Phase 1: iOS Foundation (Weeks 2-3)

### Goal
Working app shell with navigation, auth, persistence, networking, and design system.

### Tasks

**1.1 - Xcode project scaffolding** (`apps/ios/RunSmart/`)
```
App/
  RunSmartApp.swift           -- @main, WindowGroup, environment injection
  AppState.swift              -- @Observable: auth, onboarding status, active user
  ContentView.swift           -- if onboardingComplete -> MainTabView else -> OnboardingFlow
  MainTabView.swift           -- TabView: Today, Plan, Record, Chat, Profile
Info.plist                    -- Capabilities: location, healthkit, background modes
RunSmart.entitlements         -- HealthKit, push, background modes
```

**1.2 - SwiftData schema** (`Core/Storage/Models/`)
- Priority entities: UserModel, PlanModel, WorkoutModel, RunModel, ChatMessageModel, GoalModel, RecoveryModel, ShoeModel, BadgeModel
- Mapping: Dexie `id?: number` -> SwiftData `@Attribute(.unique) var id: UUID`
- JSON-stringified fields (gpsPath, runReport) -> native Swift types
- `LocalStore.swift` for ModelContainer setup and schema versioning

**1.3 - Networking layer** (`Core/Networking/`)
- `APIClient.swift` - Generic async/await URLSession client
- `Endpoints.swift` - All API routes as typed endpoints (calls same `V0/app/api/` backend)
- `AuthManager.swift` - Supabase Swift SDK auth + Keychain token storage
- `StreamingParser.swift` - SSE parser for AI chat streaming
- `OfflineQueue.swift` - Queue failed requests for retry when back online
- Headers: `X-Client-Platform: ios`, `X-Client-Version: 1.0.0`

**1.4 - Design system** (`Design/`)
- `Colors.swift` - Neon cyan/yellow/pink, athletic neutrals (from `V0/tailwind.config.ts`)
- `Typography.swift` - DM Serif Display for headers, SF Pro for body (native feel)
- `Gradients.swift` - Energy (orange-yellow), Focus (purple), Recovery (cyan-blue), Success (emerald)
- `WorkoutColors.swift` - green=easy, orange=tempo, pink=intervals, blue=long, red=trial, purple=hill
- `Animations.swift` - Pulse-glow, slide-in, morph (ported from CSS)
- Reusable components: `RunSmartButton`, `RunSmartCard`, `MetricDisplay`, `ProgressRing`

**SPM Dependencies:**
- `supabase-swift` (auth + realtime)

### Definition of Done
App launches, shows TabView with 5 tabs, authenticates with Supabase, SwiftData container initialized, design tokens applied.

---

## Phase 2: Core User Journey (Weeks 4-6)

### Goal
Full feature parity for the primary flow: onboard -> see today -> view plan -> record run -> chat -> profile.

### 2.1 - Onboarding (Week 4)
**Reference:** `V0/components/onboarding-screen.tsx` (8-step flow)

`Features/Onboarding/`
- `OnboardingView.swift` - Paged container with progress bar
- `OnboardingViewModel.swift` - @Observable, step state, API calls
- Steps: Welcome, GoalSelection, Experience, Schedule, PaceAssessment, AIGoalDiscovery, CoachingStyle, Consent
- AI goal discovery calls `/api/onboarding` + `/api/chat` (same as web)
- Completes by generating initial training plan via `/api/generate-plan`

### 2.2 - Today Dashboard (Week 4)
**Reference:** `V0/components/today-screen.tsx`

`Features/Today/`
- `TodayView.swift` + `TodayViewModel.swift`
- Components: WorkoutCard (type-colored), StreakIndicator (flame), RecoveryScoreCard (ring), WeeklyTimelineView (7-day dots), WeeklyStatsCard, ChallengeProgressCard
- Data from `@Observable DataStore` injected via `@Environment`

### 2.3 - Plan Calendar (Week 5)
**Reference:** `V0/components/plan-screen.tsx`

`Features/Training/`
- `PlanView.swift` - Monthly grid + biweekly list views
- `WorkoutDetailView.swift` - Sheet with workout breakdown
- Components: CalendarGridView, WeekStripView, WorkoutTypeIndicator, PeriodizationBanner

### 2.4 - Chat with Streaming (Week 5)
**Reference:** `V0/components/chat-screen.tsx`, `V0/app/api/chat/route.ts`

`Features/Coach/`
- `ChatView.swift` - Message list + input bar
- `ChatViewModel.swift` - Streaming via SSE, message persistence in SwiftData
- Same system prompt as web: expert AI endurance running coach
- Supports `<user_data_update>` JSON blocks for in-chat profile updates

### 2.5 - Profile (Week 5)
**Reference:** `V0/components/profile-screen.tsx`

`Features/Profile/`
- Sections: PersonalStats, Goals, ShoeTracking, DeviceConnection, Privacy, AppSettings, Account

### 2.6 - Run Recording (Week 6) -- MOST COMPLEX
**Reference:** `V0/components/record-screen.tsx` (135KB)

`Features/Recording/`
- `RecordRunView.swift` + `RecordRunViewModel.swift`
- `LocationManager.swift` - CLLocationManager with `allowsBackgroundLocationUpdates = true`
- `RunMetricsCalculator.swift` - Distance, pace, calories
- `IntervalManager.swift` - Warmup/interval/recovery/cooldown phases
- `CheckpointRecovery.swift` - SwiftData persistence for crash recovery
- Components: LiveStatsPanel, RunControlButtons, GPSAccuracyBadge, IntervalPhaseIndicator, RouteMapView (MapKit)
- Post-run: RPE input -> calls `/api/run-report` for AI analysis
- GPS filtering: accuracy, duplicate, stale, speed, jitter rejection (ported from `use-gps-tracking.ts`)

### 2.7 - Run Report (Week 6)
**Reference:** `V0/components/run-report-screen.tsx`

`Features/RunReport/`
- AI insights, safety flags, pacing analysis, split table, route map replay

**SPM Dependencies:** `swift-collections`, `swift-algorithms`

### Definition of Done
User can: complete onboarding, see today's workout, browse plan, record GPS run (with background tracking), get AI run report, chat with coach, manage profile. All using same API backend as web.

---

## Phase 3: Mobile-Specific Enhancements (Weeks 7-8)

### Goal
Native iOS capabilities that the PWA cannot achieve.

### 3.1 - HealthKit Integration (Week 7)
`Core/Health/`
- `HealthKitManager.swift` - Authorization and central queries
- Read: heartRate, heartRateVariabilitySDNN, restingHeartRate, sleepAnalysis, vo2Max, runningSpeed, runningPower, runningStrideLength, runningGroundContactTime, stepCount
- Write: HKWorkout (running) + HKWorkoutRoute (GPS path)
- `BackgroundDelivery.swift` - HKObserverQuery for new health data
- **Key advantage:** Recovery engine gets sleep/HRV/HR directly from HealthKit instead of manual entry

### 3.2 - Push Notifications (Week 7)
`Core/Notifications/`
- `NotificationManager.swift` - UNUserNotificationCenter
- Types: workout reminders, streak warnings, recovery alerts, weekly recaps, challenge prompts
- Maps to web's `V0/lib/reminderService.ts`

### 3.3 - Widgets (Week 8)
`RunSmartWidgets/` (separate target)
- `TodayWorkoutWidget.swift` - Today's workout type + details
- `StreakWidget.swift` - Current streak with fire icon
- `RecoveryWidget.swift` - Recovery score ring
- `WeeklyProgressWidget.swift` - Mini weekly chart

### 3.4 - Live Activities (Week 8)
`RunSmartWidgets/LiveActivity/`
- `RunActivityAttributes.swift` - Data: time, distance, pace, HR zone
- `RunActivityView.swift` - Lock screen + Dynamic Island display
- Updated from RecordRunViewModel during active runs
- **Major native advantage** for mid-run glances

### 3.5 - Haptic Feedback (Week 8)
`Core/Feedback/`
- `HapticEngine.swift` - CHHapticEngine wrapper
- Events: mile marker (triple tap), pace alerts, interval transitions, auto-pause, achievements
- Maps to web's `V0/lib/vibration-coach.ts`

### 3.6 - Siri Shortcuts (Week 8)
`Core/Intents/`
- "Start my run", "Log a run", "What's my recovery score?"
- App Intents framework

### 3.7 - Audio Coaching (Week 8)
`Core/Audio/`
- `AudioCoachEngine.swift` - AVSpeechSynthesizer for spoken cues
- Speaks over music, works in background via AVAudioSession
- Maps to web's `V0/lib/audio-coach.ts`

### Definition of Done
HealthKit reads natively; background GPS persists; push notifications fire; widgets on home screen; Live Activity during runs; haptics at mile markers; Siri shortcuts work; audio cues speak over music.

---

## Phase 4: Advanced Features (Weeks 9-10)

### Goal
Recovery engine parity, cross-platform sync, advanced metrics, routes.

### 4.1 - Recovery Engine (Week 9)
`Features/Recovery/`
- Port `V0/lib/recoveryEngine.ts` to Swift
- Weights: sleep 25% + HRV 25% + resting HR 15% + wellness 20% + training load 10% + stress 5%
- **Enhancement:** HealthKit-sourced inputs are more accurate and automatic than web's device-sync pipeline
- Components: RecoveryScoreRing, FactorsBreakdown, Recommendations, TrendChart

### 4.2 - Data Sync & Conflict Resolution (Week 9)
`Core/Storage/`
- `SyncManager.swift` - Orchestrates SwiftData <-> API sync
- `SyncQueue.swift` - Pending operations queue
- `ConflictResolver.swift` - Last-write-wins with timestamps; per-entity merge rules
- `BackgroundSyncTask.swift` - BGProcessingTask for periodic sync
- Architecture: writes -> SwiftData -> SyncQueue -> API -> Supabase DB <- web app
- Both platforms read/write locally first, Supabase is cross-platform truth

### 4.3 - Route Integration (Week 9)
`Features/Routes/`
- MapKit-based route display and creation (replaces web's MapLibre GL)
- Route recommendations engine (port from `V0/lib/route-recommendations.ts`)

### 4.4 - Advanced Metrics Display (Week 10)
`Features/Metrics/`
- VO2 max, lactate threshold, TSS, performance condition
- Heart rate zones (5-zone system with config)
- Running dynamics (cadence, ground contact, stride length)
- Performance trends (SwiftUI Charts)
- Personal records list

### 4.5 - Apple Watch Companion (Week 10 - STRETCH)
`RunSmartWatch/` (separate target)
- Minimal: start/pause/stop run from wrist, see live stats
- `HKWorkoutSession` on Watch
- `WCSession` for phone-watch sync
- Full Watch app is a future phase

### Definition of Done
Recovery scores from HealthKit; web/iOS data syncs seamlessly; routes on MapKit; advanced metrics display; (stretch) Watch app records runs.

---

## Phase 5: Stabilization & Release (Weeks 11-12)

### 5.1 - Crash Reporting & Analytics (Week 11)
- Sentry (`sentry-cocoa`) for crash reporting
- PostHog (`posthog-ios`) for analytics (matches web's PostHog)
- Performance monitoring: app launch, screen renders

### 5.2 - Accessibility Pass (Week 11)
- VoiceOver labels on all interactive elements
- Dynamic Type (no fixed font sizes, use `@ScaledMetric`)
- Color contrast WCAG AA
- Reduce Motion support
- Bold Text support

### 5.3 - Performance Optimization (Week 11)
- Instruments profiling (Time Profiler, Allocations, Energy)
- SwiftData query optimization with `#Predicate` and fetch limits
- Lazy loading for lists
- View body recomputation reduction

### 5.4 - TestFlight Beta (Week 12)
- Internal testing (10 users) -> external beta via TestFlight link
- Collect crash reports, fix critical issues
- Fastlane automation for builds

### 5.5 - App Store Submission (Week 12)
- App icon (1024x1024), screenshots (6.7", 6.1", iPad Pro)
- Privacy nutrition labels: Health & Fitness, Location, Usage Data
- App Review notes explaining HealthKit + background location usage
- ASO: keywords, description, screenshots

**SPM Dependencies (Phase 5):** `sentry-cocoa`, `posthog-ios`

### Definition of Done
App passes App Review; available on App Store; crash-free rate >99%; TestFlight feedback addressed.

---

## Complete SPM Dependencies

```swift
dependencies: [
    .package(url: "https://github.com/supabase-community/supabase-swift", from: "2.0.0"),
    .package(url: "https://github.com/getsentry/sentry-cocoa", from: "8.0.0"),
    .package(url: "https://github.com/PostHog/posthog-ios", from: "3.0.0"),
    .package(url: "https://github.com/apple/swift-collections", from: "1.0.0"),
    .package(url: "https://github.com/apple/swift-algorithms", from: "1.0.0"),
]
```

Everything else uses Apple frameworks: SwiftData, HealthKit, CoreLocation, MapKit, ActivityKit, WidgetKit, AppIntents, AVFoundation, CoreHaptics.

---

## File Count Summary

| Phase | Files | Est. Lines |
|-------|-------|-----------|
| 0: Monorepo | ~20 | ~2,000 |
| 1: Foundation | ~25 | ~4,000 |
| 2: Core Journey | ~55 | ~15,000 |
| 3: Mobile Enhancements | ~25 | ~5,000 |
| 4: Advanced Features | ~20 | ~6,000 |
| 5: Stabilization | ~10 | ~2,000 |
| **Total** | **~155** | **~34,000** |

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| HealthKit auth rejected by user | Recovery features degraded | Graceful fallback to manual entry (web's current approach) |
| Chat SSE streaming parsing errors | Broken AI chat | Test SSE parser thoroughly; fallback to non-streaming |
| Sync conflicts cause data loss | User frustration | SwiftData always source of truth; server secondary; audit log |
| App Store rejection for background location | Can't release | Clear usage description; only enable during active runs |
| Monorepo restructure breaks web CI | Web app broken | Keep `V0/` unchanged initially; add shared as new dependency |
| RecordScreen complexity (135KB web) | Longest dev time | Dedicate full week; break into sub-components; port incrementally |

---

## Verification Plan

1. **Unit tests:** Every ViewModel with mocked APIClient and SwiftData container
2. **Integration tests:** Auth flow, sync pipeline, HealthKit read/write
3. **UI tests:** Onboarding happy path, run recording start-to-finish
4. **Device tests:** GPS on physical device (simulator GPS is unreliable)
5. **Cross-platform:** Record run on iOS -> verify appears on web (and vice versa)
6. **Performance:** Instruments profiling for each phase
7. **Beta testing:** 2-week TestFlight with 10+ real runners

---

## Critical Reference Files

| File | Why |
|------|-----|
| [V0/lib/db.ts](V0/lib/db.ts) | All 50+ data model interfaces - the schema bible |
| [V0/components/record-screen.tsx](V0/components/record-screen.tsx) | Most complex screen to port (135KB) |
| [V0/lib/recoveryEngine.ts](V0/lib/recoveryEngine.ts) | Recovery algorithm to port + enhance with HealthKit |
| [V0/app/api/chat/route.ts](V0/app/api/chat/route.ts) | Chat streaming pattern iOS must consume |
| [V0/app/api/generate-plan/route.ts](V0/app/api/generate-plan/route.ts) | Plan generation API contract |
| [V0/hooks/use-gps-tracking.ts](V0/hooks/use-gps-tracking.ts) | GPS filtering logic to port to CoreLocation |
| [.claude/agents/ios-expert.md](.claude/agents/ios-expert.md) | iOS agent config with architecture decisions |
