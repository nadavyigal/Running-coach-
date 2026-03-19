# RunSmart iOS App — Implementation Plan v3

Date: 2026-03-18
Owner: Nadav
Status: Active
Supersedes: v1 (SwiftUI native, Feb 2026) and v2 (Capacitor draft, Mar 17 2026)

---

## 1. Executive Summary

RunSmart is a mature Next.js 14 PWA with ~160 components, 45+ API route groups, Supabase auth/DB, Garmin bi-directional sync, AI coaching (GPT-4o), GPS run recording, recovery engine (sleep/HRV/wellness), PostHog analytics, subscription gating, weekly recaps with sharing, challenges, advanced Garmin dashboards, zone-based coaching, running dynamics, and plan customization.

**Strategy: Capacitor hybrid, shipped in phases.** Reuse the existing web product inside a native iOS shell, then add native capabilities only where they create real App Store, health, billing, or retention value.

**Important correction from earlier drafts:** the repo already contains iOS-oriented assets under `apps/ios/` plus shared models in `packages/shared/`, but the actual Xcode project/workspace is not present yet. The first milestone is therefore not "feature work"; it is establishing one canonical native project layout and one set of build commands that actually work locally.

**Recommended topology for this repo:**
- `v0/` remains the web product and Capacitor bridge source.
- `apps/ios/` becomes the canonical committed native iOS container used by Xcode, fastlane, and GitHub Actions.
- `packages/shared/` continues to hold shared contracts and generated Swift models.

If Capacitor bootstrap initially creates native files elsewhere, reconcile paths immediately before proceeding. The repo must not support both `v0/ios` and `apps/ios` in parallel.

---

## 2. Strategy: Capacitor Hybrid

### Why Capacitor

| Option | Verdict |
|--------|---------|
| **Capacitor (chosen)** | Reuses most of the existing product, preserves server-backed Next.js flows, and gives a pragmatic App Store path |
| React Native rewrite | Full rewrite, dual surface area, materially slower time to market |
| SwiftUI native (v1 plan) | Strong long-term option only if traction justifies a rewrite later |
| PWA only | No App Store distribution, limited push, no HealthKit or StoreKit path |

### What Capacitor Gives Us
- App Store distribution
- APNs push notifications
- HealthKit integration
- StoreKit-based iOS subscriptions
- Native deep links and share sheet
- Haptics and platform polish
- Live Activities
- Background refresh hooks

### Explicit v1 Non-Goals
- No Apple Watch companion app in v1
- No full SwiftUI rewrite in v1
- No iPad-specific redesign in v1
- No Siri Shortcuts in v1
- No native Garmin implementation; existing Garmin web/server flows remain the source

---

## 3. Current PWA Feature Inventory (Wrapped by Capacitor)

### Core Screens
- **OnboardingScreen** — 5-step wizard, goal selection, watch pairing question
- **TodayScreen** — Recovery hero, daily check-in, 14-day run list, weekly metrics, streak, coaching insights widget
- **PlanScreen** — Week accordions, workout cards, plan customization dashboard, plan complexity indicator, coach tips, plan adaptation, workout compliance panel
- **RecordScreen** — Live GPS tracking, pace/distance/HR, interval manager, audio coaching, haptics, post-run RPE modal
- **ChatScreen** — AI coach streaming chat, user memory, suggested questions, conversation history
- **ProfileScreen** — User info, stats, achievements, shoe management, privacy dashboard, device settings

### Garmin Integration
- OAuth 2.0, activity sync, workout push, wellness data pull
- Dashboards: ACWR, body battery, HRV, SpO2, stress, sleep, wellness, readiness
- Garmin sync panel, sync status bar, manual export modal
- Auto-sync pipeline, incremental sync

### Recovery & Health
- Recovery engine (sleep 25% + HRV 25% + resting HR 15% + wellness 20% + load 10% + stress 5%)
- Recovery dashboard, recommendations, wellness input modal
- Data fusion dashboard, conflict resolution center
- Data sources manager, device connection screen
- Zone analysis dashboard, zone-based coaching
- Realtime heart rate monitor, running dynamics visualization

### AI & Coaching
- GPT-4o via Vercel AI SDK, streaming SSE
- Enhanced AI coach, coaching feedback modal, coaching preferences settings
- Run report with AI analysis, map, pace chart
- Goal analytics insights, advanced metrics dashboard, performance trends

### Social & Sharing
- Weekly share CTA loop and recap cards
- Share run modal, share badge modal
- Community comparison, community stats widget
- Challenges engine, challenge completion, daily challenge prompt, challenge picker

### Plan & Training
- AI-powered plan generation and customization
- Race goal modal and race goals screen
- Training load analyzer, personal records
- Workout details, phases, reschedule, date workout modal

### Monetization
- Subscription gating in web app
- Paddle for web today
- iOS billing strategy documented separately in `docs/monetization/04-ios-billing-strategy.md`

### Infrastructure
- Supabase auth + RLS
- Vercel-hosted API routes
- PostHog analytics
- Dexie-based offline data
- Service worker and PWA manifest

### Backend
- 45+ API route groups in `v0/app/api/`
- Vercel hosting
- Supabase DB

---

## 4. Delivery Principles

### Principle 1: One canonical native project
All native automation must point to a single checked-in Xcode project or workspace under `apps/ios/`.

### Principle 2: Build locally before automating
Do not treat fastlane or GitHub Actions as "done" until local `xcodebuild` commands succeed on:
- simulator build
- simulator tests
- signed device build
- release archive

### Principle 3: Server remains source of truth
Subscriptions, entitlements, sync cursors, and device registrations must live in Supabase/server state, not only in Dexie/local storage.

### Principle 4: Native-only scope must earn its keep
Use native code for:
- capabilities the web app cannot reliably provide
- App Review compliance
- performance-critical run/session features
- user-facing retention features like notifications and Live Activities

### Principle 5: Validate risky assumptions early
The highest-risk areas are:
- background GPS recording from a web-first shell
- HealthKit plugin maturity for write + background delivery
- StoreKit/server entitlement parity
- App Review acceptance of a web-heavy shell

Each of those needs an early proof point, not just a later checklist item.

---

## 5. Phased iOS Additions

### Phase 0 — Bootstrap and Repo Alignment (Week 0-1)
1. Establish canonical native project location under `apps/ios/`
2. Generate and commit the real Xcode project/workspace, schemes, bundle IDs, and entitlements scaffolding
3. Record exact working local commands for build, test, archive, and export
4. Standardize path usage across:
   - `packages/shared/scripts/generate-swift-types.ts`
   - `apps/ios/fastlane/*`
   - `.github/workflows/ios-build.yml`
   - `.github/workflows/ios-testflight.yml`
5. Fix monorepo assumptions before relying on CI:
   - correct `pnpm-workspace.yaml` package paths
   - decide whether `v0/` stays npm-managed or is intentionally migrated
6. Define environment matrix:
   - bundle ID(s)
   - Vercel production URL
   - staging URL if used
   - Supabase project refs
   - App Store Connect app identifiers

### Phase 1 — App Store Shell (Week 1-2)
1. Add Capacitor config and sync flow
2. App icon, splash, launch assets
3. Safe areas, status bar, home indicator, keyboard handling
4. Universal links and deep links
5. Native share sheet bridge
6. Signed device build
7. First internal TestFlight build

### Phase 2 — Push Notifications (Week 2-3)
1. APNs registration with `@capacitor/push-notifications`
2. Dedicated device registration model in Supabase
3. Notification permission UX tied to actual value moments
4. Workout reminders, weekly recap, streak, challenge, and plan alerts
5. Server-side delivery via existing cron and notification routes

### Phase 3 — HealthKit (Week 3-5)
1. Two-day spike to validate plugin or custom bridge viability
2. Read HealthKit recovery inputs
3. Write completed workouts and routes if supported reliably
4. Background delivery and sync cursor persistence
5. Apple Health as a first-class data source in existing data-fusion UI

### Phase 4 — iOS Billing (Week 5-6)
1. Shared entitlements layer on server
2. StoreKit purchase flow in app
3. App Store Server API validation route
4. App Store Server Notifications v2 webhook
5. Restore purchases and entitlement refresh

### Phase 5 — Native Polish and Submission (Week 6-8)
1. Background refresh
2. Live Activities
3. Haptics
4. Offline failure-state polish
5. Crash and release-health instrumentation
6. App Store metadata, privacy, review notes, submission

---

## 6. Architecture

```text
┌──────────────────────────────────────────────────────┐
│              iOS App (Capacitor Shell)              │
│  ┌────────────────────────────────────────────────┐  │
│  │         WKWebView / Next.js product           │  │
│  │  Screens, Garmin flows, chat, plans, UI       │  │
│  │  Existing API routes and Supabase-backed data │  │
│  └───────────────────────┬────────────────────────┘  │
│                          │ Capacitor bridge          │
│  ┌───────────────────────┴────────────────────────┐  │
│  │ Native iOS capabilities                        │  │
│  │ Push │ HealthKit │ StoreKit │ Share │ Haptics │  │
│  │ Live Activities │ Background refresh │ Deep link│ │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐      ┌────────────────────────────┐
│ Vercel / Next.js APIs  │      │ Supabase                   │
│ Auth, AI, Garmin, cron │      │ Profiles, subscriptions,   │
│ Billing verification   │      │ push devices, sync state   │
└────────────────────────┘      └────────────────────────────┘
```

### Server-side data additions required for iOS
- `push_devices`
  - `id`, `profile_id`, `platform`, `environment`, `token`, `enabled`, `last_seen_at`
- `billing_subscriptions`
  - source of truth for provider status and entitlement mapping
- optional `healthkit_sync_state`
  - last sync anchor/cursor per user and data type if needed

Do not store push tokens in the `users` row directly. Users can have multiple devices, tokens can rotate, and sandbox/production tokens must be separated.

---

## 7. Canonical File Structure

```text
apps/
└── ios/
    ├── App/
    │   ├── App.xcodeproj                           # Canonical native container for SPM bootstrap
    │   ├── CapApp-SPM/
    │   └── App/
    │       ├── AppDelegate.swift
    │       ├── Info.plist
    │       ├── Entitlements/
    │       ├── Extensions/
    │       │   └── RunSmartWidget/                  # Live Activities extension
    │       └── Generated/
    │           └── SharedModels.swift
    └── fastlane/
        ├── Appfile
        ├── Fastfile
        └── Matchfile

packages/
└── shared/
    ├── src/
    └── scripts/generate-swift-types.ts

v0/
├── capacitor.config.ts
├── lib/
│   ├── capacitor-platform.ts
│   ├── native/
│   │   ├── healthkit.ts
│   │   ├── push-notifications.ts
│   │   ├── haptics.ts
│   │   ├── storekit.ts
│   │   ├── share.ts
│   │   └── live-activity.ts
│   ├── healthkit-sync.ts
│   ├── entitlements.ts
│   └── apple-billing.ts
└── app/api/billing/apple/
    ├── verify/route.ts
    ├── webhook/route.ts
    └── status/route.ts
```

Notes:
- If Capacitor generates a workspace instead of a plain project, prefer the workspace everywhere.
- The exact workspace/project name must be recorded once bootstrap is complete and reused in fastlane + CI without divergence.

---

## 8. Key Technical Decisions

### Native project topology
Use `apps/ios/` as the canonical native app path because the repo already points shared model generation, fastlane, and GitHub Actions there. Do not continue with split assumptions between `apps/ios/` and `v0/ios/`.

### Live deploy mode, not static export
Point Capacitor at the production or staging Vercel URL. The app depends on server-rendered Next.js routes, Supabase auth, AI routes, Garmin callbacks, billing verification, and sharing endpoints.

`webDir=out` is not the primary mode for this project and should not be treated as the bootstrap path. If a placeholder `webDir` is required by Capacitor tooling, document it as fallback-only and keep `server.url` as the actual runtime mode.

### HealthKit + Garmin coexistence
Both sources are supported. Existing conflict resolution UI remains the user-facing control point. Source priority stays:
- Garmin direct
- HealthKit data originating from Apple Watch
- HealthKit data originating from iPhone
- manual input

Apple Watch is not a separate v1 app target. In v1, watch-originated data arrives via HealthKit on iPhone.

### GPS recording and background behavior
Do not assume WKWebView geolocation is sufficient for locked-screen or background run recording. Existing web GPS logic is the starting point, but this plan includes an explicit on-device validation gate.

Permission strategy:
- start with `When In Use` for initial recording validation
- request `Always` only if background run recording proves necessary and is implemented with an approved native approach
- include precise App Review notes justifying background location

### Push token storage
Use a dedicated `push_devices` table with one row per device/token/environment. Tokens must be refreshed on app start, login, reinstall, and notification permission changes.

### Billing and pricing
iOS subscriptions use StoreKit. Web subscriptions continue to use the existing web provider strategy outside the app.

Same entitlement flags across web and iOS; server is source of truth. Keep provider-specific logic out of the UI.

### Weekly share on iOS
Use a native bridge such as the Capacitor Share plugin instead of assuming `navigator.share()` behavior inside WKWebView. Shared content should deep-link back to public recap surfaces using universal links.

### Observability
Ship release-health instrumentation for both:
- JavaScript/webview failures
- native shell / widget extension failures

The success metric of 99.9%+ crash-free sessions is not credible without explicit instrumentation in scope.

---

## 9. Implementation Timeline

### Week 0-1: Bootstrap and Alignment
- [ ] Confirm canonical native app path is `apps/ios/`
- [ ] Generate and commit the real Xcode project/workspace and schemes
- [ ] Record exact working commands for:
  - `xcodebuild -list`
  - simulator build
  - simulator tests
  - release archive
- [ ] Reconcile `packages/shared` output path with the real iOS target
- [ ] Update fastlane and GitHub Actions to the real project/workspace path
- [ ] Fix workspace/package-manager inconsistencies before relying on CI
- [ ] Produce first successful local simulator build
- **Milestone: local native shell builds successfully and paths are no longer ambiguous**

### Week 1-2: App Store Shell
- [ ] Install Capacitor core iOS dependencies
- [ ] Add `v0/capacitor.config.ts` using live URL mode
- [ ] Add iOS platform and commit generated native files to `apps/ios/`
- [ ] Configure bundle ID, team, signing, Associated Domains, background modes scaffold
- [ ] App icon set and splash/launch assets
- [ ] Safe area, status bar, notch, keyboard, and home indicator polish
- [ ] Implement deep links / universal links for run shares, weekly recap, challenges, badges
- [ ] Add native share bridge
- [ ] Produce signed device build
- [ ] Ship first internal TestFlight build
- **Milestone: full product accessible in internal TestFlight**

### Week 2-3: Push Notifications
- [ ] Configure APNs auth key and App Store Connect / Apple Developer setup
- [ ] Install and wire `@capacitor/push-notifications`
- [ ] Register device tokens into `push_devices`
- [ ] Differentiate sandbox vs production environments
- [ ] Add permission prompt at a value moment, not blindly on first launch
- [ ] Connect workout reminders to existing reminder flows
- [ ] Add weekly recap, streak, challenge, and plan-alert payload types
- [ ] Add token refresh / revoke handling on login, logout, reinstall, disabled notifications
- [ ] Wire server-side push delivery from existing cron jobs or dedicated routes
- **Milestone: internal testers receive reliable native pushes**

### Week 3-5: HealthKit
- [ ] Run a two-day spike: choose plugin or custom native bridge based on read/write/background support
- [ ] Add HealthKit entitlement and all required usage strings
- [ ] Read: heart rate, HRV, resting HR, sleep analysis, VO2max, active energy
- [ ] Optional if supported cleanly in v1: running power, cadence-adjacent metrics, stride length
- [ ] Write completed running workouts; add route writing only if route persistence is verified end to end
- [ ] Persist sync cursor/anchor state on server or native side as needed
- [ ] Add background delivery for overnight health inputs where supported
- [ ] Map HealthKit data into existing `SleepData`, `HRVMeasurement`, and recovery flows
- [ ] Extend `data-sources-manager.tsx`, `device-connection-screen.tsx`, and conflict-resolution surfaces
- [ ] Verify on real hardware with screen locked and after overnight delivery
- **Milestone: recovery inputs can include HealthKit data automatically**

### Week 5-6: iOS Billing
- [ ] Register products in App Store Connect
- [ ] Create `v0/lib/entitlements.ts` as the shared server-side entitlement source
- [ ] Add `GET /api/billing/status` for a single client read path
- [ ] Add StoreKit purchase flow in native bridge / web UI integration
- [ ] Implement `POST /api/billing/apple/verify`
- [ ] Implement App Store Server Notifications v2 webhook
- [ ] Persist Apple subscription state into `billing_subscriptions`
- [ ] Support restore purchases and entitlement refresh on reinstall/login
- [ ] Verify parity between iOS and web entitlement flags
- **Milestone: iOS users can subscribe and unlock premium features reliably**

### Week 6-8: Native Polish and Submission
- [ ] Validate background refresh for Garmin sync and recovery updates
- [ ] Add Live Activities for an active run
- [ ] Add haptics for run controls, goals, badges, streaks, and challenge completion
- [ ] Ensure offline state shows an intentional in-app fallback, not a raw webview failure
- [ ] Add release-health / crash reporting for native + web layers
- [ ] Performance test on iPhone 12-class hardware and newer
- [ ] Produce App Store screenshots, description, keywords, review notes
- [ ] Complete privacy nutrition labels and export compliance answers
- [ ] Submit to App Review
- **Milestone: production-ready App Store submission**

---

## 10. App Store Submission Checklist

- [ ] Apple Developer Program membership active
- [ ] App Store Connect app created for `com.runsmart.coach` or final shipping bundle ID
- [ ] App icons including 1024x1024 App Store asset
- [ ] Launch assets configured
- [ ] Associated Domains configured for universal links
- [ ] Push Notifications capability
- [ ] HealthKit capability
- [ ] Background Modes configured only for features actually shipped
- [ ] Privacy policy updated for HealthKit, location, analytics, and notifications
- [ ] Health usage description strings
- [ ] Location usage description strings
- [ ] Privacy nutrition labels completed
- [ ] Export compliance answered
- [ ] Screenshots prepared for required device sizes
- [ ] Review notes include:
  - demo/test credentials if needed
  - HealthKit explanation
  - background location justification if shipped
  - explanation of any web-heavy flows that depend on server APIs
- [ ] Sign in with Apple added if iOS app offers another third-party sign-in option

---

## 11. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| App Store rejection as a thin wrapper | High | Medium | Add clear native value early: push, HealthKit, share, haptics, Live Activities, polished deep links |
| Native project path drift (`apps/ios` vs `v0/ios`) | High | High | Freeze one canonical path in Week 0 and update all automation immediately |
| CI/fastlane reference nonexistent project/workspace | High | High | Do not trust existing workflows until local `xcodebuild` commands are recorded and copied verbatim |
| Background run recording unreliable in WKWebView | High | Medium | Treat as a validation gate; add native location approach if web-only behavior is insufficient |
| HealthKit plugin lacks write or background support | Medium | Medium | Run early spike; fall back to custom bridge if plugin falls short |
| Billing parity drift between Paddle/web and Apple/iOS | High | Medium | Centralize entitlements on server and force both clients through one status endpoint |
| Push token lifecycle bugs | Medium | Medium | Dedicated `push_devices` table with environment separation and token refresh handling |
| Missing crash visibility in production | Medium | Medium | Add explicit release-health instrumentation before App Store submission |

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Local simulator build to first TestFlight | <= 2 weeks |
| TestFlight to App Store submission | <= 8 weeks |
| App Store rating | >= 4.5 |
| Onboarding completion | >= 60% |
| HealthKit opt-in rate | >= 50% |
| Push opt-in rate | >= 65% |
| iOS D30 retention | >= 25% |
| iOS subscription conversion | >= 3% of active users |
| Crash-free sessions | > 99.9% |

---

## 13. Working Commands To Record During Bootstrap

Replace placeholders with the real workspace/project and scheme after bootstrap. These commands are deliverables, not suggestions.

```bash
# Discover schemes
xcodebuild -list -project apps/ios/App/App.xcodeproj

# Simulator build
xcodebuild build \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.3'

# Simulator tests
xcodebuild test \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.3'

# Release archive
xcodebuild archive \
  -project apps/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath apps/ios/build/RunSmart.xcarchive
```

The repo should standardize on the generated SPM project form above and stop referencing a top-level `apps/ios/RunSmart.xcodeproj`.

---

## 14. Existing Repo Assets And Current Reality

Already present in this branch:

| Asset | Location | Status |
|-------|----------|--------|
| Shared TypeScript models | `packages/shared/src/models/` | Present |
| API endpoint contracts | `packages/shared/src/api/` | Present |
| Swift type generation script | `packages/shared/scripts/generate-swift-types.ts` | Present |
| Generated Swift models | `apps/ios/App/App/Generated/SharedModels.swift` | Present |
| Fastlane scaffold | `apps/ios/fastlane/` | Present |
| GitHub Actions for iOS | `.github/workflows/ios-build.yml`, `.github/workflows/ios-testflight.yml` | Present |
| `pnpm-workspace.yaml` and `turbo.json` | repo root | Present |

Not yet present or not yet trustworthy:

| Asset | Status |
|-------|--------|
| Real Xcode project/workspace under `apps/ios/` | Present at `apps/ios/App/App.xcodeproj` |
| Verified project/scheme names | Present: project `App.xcodeproj`, scheme `App` |
| Proven local `xcodebuild` commands | Recorded in `docs/ios/LOCAL_BUILD_COMMANDS.md`; full build validation still pending |
| Signed archive/export validation | Missing |
| StoreKit implementation | Missing |
| HealthKit bridge | Missing |
| Push device registration model | Missing |
| Shared server-side entitlements layer | Missing |

Treat the iOS workflows and fastlane lanes as aligned to the generated SPM project, but do not call them done until local `xcodebuild` commands and archive validation succeed end to end.

---

## 15. Post-Launch Roadmap

After App Store launch, consider incremental native upgrades:

1. WidgetKit home/lock-screen widgets
2. Apple Watch companion app
3. Siri Shortcuts
4. iPad optimization
5. Deeper native run experience
6. Long-term SwiftUI rewrite only if product traction justifies it

---

*End of RunSmart iOS App Plan v3*
