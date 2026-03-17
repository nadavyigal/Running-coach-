# RunSmart iOS App — Implementation Plan v2

Date: 2026-03-17
Owner: Nadav
Status: Draft
Supersedes: Original iOS branch draft plan

---

## 1. Executive Summary

RunSmart has matured significantly since the original iOS plan was drafted. The PWA now includes: Supabase auth and server-side data, Garmin bi-directional sync, AI coaching with GPT-4o streaming, recovery engine with sleep/HRV/wellness, plan generation and adaptation, GPS run recording, PostHog analytics, weekly recaps, challenges, run reports with maps and pace charts, subscription gating (Paddle MoR), and a rich component library (~150 components). This plan defines how to wrap the existing Next.js PWA into a native iOS app using **Capacitor** while adding iOS-native capabilities incrementally.

---

## 2. Strategy: Capacitor Hybrid (Not Full Rewrite)

### Why Capacitor over alternatives

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Capacitor (chosen)** | Reuses 95%+ of existing code; native bridge for iOS APIs; Ionic team support; App Store compliant | Not fully native UX; some performance ceiling | Best ROI for solo founder |
| React Native rewrite | True native feel | Full rewrite of ~150 components; 3-6 month effort; dual codebase maintenance | Too expensive |
| Swift native rewrite | Best performance and UX | Complete rewrite; no code sharing; longest timeline | Not viable as solo founder |
| PWA only (no native) | Zero effort | No App Store presence; limited push notifications; no HealthKit; iOS Safari limitations | Leaves value on the table |

### Decision
Use **Capacitor v6** to wrap the existing Next.js app as a native iOS shell. This gives us:
- App Store distribution (the #1 reason to go native)
- Native push notifications (APNs)
- HealthKit integration (Apple Watch data)
- StoreKit 2 for iOS subscriptions
- Background app refresh
- Haptic feedback and native gestures
- Siri Shortcuts integration (future)

---

## 3. Current PWA Feature Inventory (What Gets Wrapped)

### Core Screens (all carry over as-is)
- **OnboardingScreen** — 5-step wizard, goal selection, watch question
- **TodayScreen** — Recovery hero, daily check-in, 14-day run list, weekly metrics, streak
- **PlanScreen** — Week accordions, workout cards, coach tips, plan adaptation
- **RecordScreen** — Live GPS tracking, pace/distance/HR, controls
- **ChatScreen** — AI coach streaming chat, suggested questions, conversation history
- **ProfileScreen** — User info, stats, achievements, settings, shoe management

### Feature Modules (all carry over)
- **Garmin Integration** — OAuth 2.0, activity sync, workout push, wellness data pull
- **Recovery Engine** — Sleep, HRV, subjective wellness, readiness scoring
- **AI Coaching** — GPT-4o via Vercel AI SDK, structured plan generation, run insights
- **Run Reports** — Post-run analysis with map, pace chart, coach debrief
- **Challenges** — Challenge engine, progress tracking, completion celebrations
- **Analytics** — PostHog event tracking, activation funnels, retention
- **Monetization** — Subscription gating, entitlements, upgrade prompts
- **Weekly Recaps** — Training load summary, coach recommendations
- **Maps** — MapLibre GL for route display and custom routes

### Backend (no changes needed)
- **Supabase** — Auth, user data, Garmin tokens, subscriptions
- **Next.js API Routes** — 40+ API route groups (AI, chat, garmin, recovery, etc.)
- **Vercel Hosting** — Continues to serve the web app and API routes

---

## 4. iOS-Native Additions (What Capacitor Unlocks)

### Phase 1 — App Store Shell (Week 1-2)
These items make the PWA feel native on iOS:

1. **Capacitor project setup**
   - Initialize Capacitor in the `v0/` directory
   - Configure `capacitor.config.ts` pointing to Vercel production URL (live deploy mode) or local build
   - Generate Xcode project

2. **Native splash screen and app icon**
   - Use existing RunSmart branding (emerald #10b981 theme)
   - Generate all required icon sizes (20pt–1024pt)
   - Animated splash → Today screen transition

3. **Status bar and safe area**
   - Configure status bar style (light/dark based on theme)
   - Ensure all screens respect safe areas (notch, home indicator)
   - Bottom navigation padding for home indicator

4. **Navigation and gestures**
   - Enable iOS swipe-back gesture
   - Haptic feedback on key interactions (run start/stop, workout complete, badge earned)
   - Disable bounce/overscroll where inappropriate

5. **Deep links and universal links**
   - Configure apple-app-site-association
   - Handle share links (run reports, challenges, weekly recaps)

### Phase 2 — Push Notifications (Week 2-3)

6. **APNs integration via Capacitor Push Notifications plugin**
   - Request notification permission during onboarding
   - Daily workout reminders (existing reminder service → native push)
   - Post-run recovery nudges
   - Weekly recap notifications
   - Plan adaptation alerts
   - Challenge milestones

7. **Server-side push delivery**
   - Store APNs device tokens in Supabase
   - Add push delivery to existing cron jobs (`v0/app/api/cron/`)
   - Badge count management

### Phase 3 — HealthKit Integration (Week 3-5)

8. **Apple HealthKit plugin**
   - Read: heart rate, resting HR, HRV (SDNN), sleep analysis, VO2max, active energy
   - Write: running workouts (distance, duration, route, heart rate samples)
   - Background delivery for overnight sleep and passive HR data
   - Maps to existing `SleepData`, `HRVMeasurement`, `RecoveryScore` interfaces in `lib/db.ts`

9. **Apple Watch companion awareness**
   - Detect Apple Watch pairing
   - Pull workout data recorded on Apple Watch
   - Enhanced recovery scoring with watch-sourced HRV and resting HR
   - Complements existing Garmin integration (user picks primary device)

10. **Data source management**
    - Extend existing `data-sources-manager.tsx` and `device-connection-screen.tsx`
    - Allow simultaneous Garmin + HealthKit (with conflict resolution via existing `conflict-resolution-center.tsx`)
    - Priority hierarchy: Garmin direct > HealthKit from watch > HealthKit from phone > manual

### Phase 4 — StoreKit 2 / iOS Billing (Week 5-6)

11. **In-App Purchases**
    - Implement StoreKit 2 via Capacitor plugin
    - Mirror existing subscription tiers: Free / Premium
    - Products: `runsmart_premium_monthly`, `runsmart_premium_annual`
    - Follows the architecture in `docs/monetization/04-ios-billing-strategy.md`

12. **Server-side receipt validation**
    - New API route: `v0/app/api/billing/apple/verify/route.ts`
    - Validate App Store Server API v2 signed transactions
    - Update `billing_subscriptions` in Supabase with `provider = 'apple'`
    - Unified entitlements: same flags (`ai_coaching_unlimited`, `wearables_sync`, etc.)

13. **Subscription management**
    - Restore purchases on reinstall/new device
    - Handle grace period and billing retry
    - Subscription status webhook from App Store Server Notifications v2
    - UI: extend existing profile subscription section

### Phase 5 — Native Polish (Week 6-8)

14. **Background app refresh**
    - Periodic Garmin sync in background
    - HealthKit background delivery processing
    - Recovery score recalculation overnight

15. **Live Activities (iOS 16.1+)**
    - Show active run on Lock Screen and Dynamic Island
    - Distance, pace, duration, heart rate in real-time
    - Requires a small Swift widget extension

16. **Haptics and native feel**
    - Taptic Engine feedback on:
      - Run start/pause/stop
      - Workout completion
      - Badge earned
      - Weekly goal achieved
      - Streak milestone
    - Native iOS keyboard handling for chat input
    - Smooth keyboard avoidance in ChatScreen

17. **Offline resilience**
    - Existing Dexie.js (IndexedDB) already provides offline-first data
    - Ensure Capacitor WebView doesn't show offline errors
    - Queue API calls when offline, replay when connected
    - Existing `backgroundSync.ts` handles most of this

---

## 5. Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 iOS App (Capacitor)              │
│  ┌───────────────────────────────────────────┐  │
│  │         WKWebView (Next.js PWA)           │  │
│  │  ┌─────────┐ ┌──────┐ ┌──────────────┐   │  │
│  │  │ Screens │ │ Chat │ │ Record (GPS) │   │  │
│  │  └─────────┘ └──────┘ └──────────────┘   │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │Recovery │ │ Garmin   │ │ Analytics│   │  │
│  │  └─────────┘ └──────────┘ └──────────┘   │  │
│  └──────────────────┬────────────────────────┘  │
│                     │ Capacitor Bridge           │
│  ┌──────────────────┴────────────────────────┐  │
│  │           Native iOS Plugins              │  │
│  │  ┌────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │  APNs  │ │HealthKit │ │ StoreKit 2 │  │  │
│  │  └────────┘ └──────────┘ └────────────┘  │  │
│  │  ┌────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │Haptics │ │Live Act. │ │ Background │  │  │
│  │  └────────┘ └──────────┘ └────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
           │                        │
           ▼                        ▼
  ┌─────────────────┐    ┌───────────────────┐
  │  Vercel (API)   │    │    Supabase       │
  │  Next.js Routes │    │  Auth / DB / RLS  │
  │  AI / Garmin    │    │  Subscriptions    │
  └─────────────────┘    └───────────────────┘
```

---

## 6. File Structure (New iOS Files)

```
v0/
├── capacitor.config.ts          # Capacitor configuration
├── ios/                         # Generated Xcode project
│   └── App/
│       ├── App/
│       │   ├── AppDelegate.swift
│       │   ├── Info.plist
│       │   └── RunSmartWidget/   # Live Activities widget extension
│       └── Podfile
├── src/
│   └── native/                  # Native bridge utilities
│       ├── healthkit.ts         # HealthKit read/write helpers
│       ├── push-notifications.ts # APNs registration and handling
│       ├── haptics.ts           # Haptic feedback helpers
│       ├── storekit.ts          # StoreKit 2 purchase flow
│       └── live-activity.ts     # Live Activity bridge
├── lib/
│   ├── capacitor-platform.ts    # Platform detection (web vs iOS)
│   ├── healthkit-sync.ts        # HealthKit → existing data models
│   └── apple-billing.ts         # StoreKit ↔ entitlements mapping
└── app/
    └── api/
        └── billing/
            └── apple/
                ├── verify/route.ts      # Receipt validation
                └── webhook/route.ts     # App Store Server Notifications
```

---

## 7. Key Technical Decisions

### 7.1 Live Deploy vs Static Export
**Decision: Live deploy mode (point Capacitor to Vercel URL)**

Rationale:
- All 40+ API routes work without modification
- No need to rebuild and resubmit for content/logic changes
- AI features require server-side API keys
- Garmin OAuth callbacks already configured for Vercel domain
- Offline fallback handled by existing service worker + Dexie

Tradeoff: Requires internet for first load. Mitigated by service worker caching.

### 7.2 HealthKit vs Garmin Priority
**Decision: Both supported, user chooses primary**

- If user has Garmin connected → Garmin is primary, HealthKit supplements (sleep if Garmin doesn't provide it)
- If user has Apple Watch only → HealthKit is primary
- Existing `conflict-resolution-center.tsx` handles data conflicts
- Recovery engine (`lib/recoveryEngine.ts`) already supports multiple data sources

### 7.3 Subscription Parity
**Decision: Same tiers, provider-specific pricing**

- Web: Paddle (MoR) — existing implementation
- iOS: StoreKit 2 — Apple's 30% cut factored into pricing
- iOS Premium Monthly: $12.99 (vs $9.99 web) to offset Apple's commission
- iOS Premium Annual: $119.99 (vs $99 web)
- Same entitlement flags, server is source of truth
- No cross-platform purchase restore (Apple policy)

### 7.4 GPS Recording on iOS
**Decision: Use existing Web Geolocation API through WKWebView**

- Capacitor's WKWebView supports the Web Geolocation API natively
- Existing `record-screen.tsx` and `lib/location-service.ts` work as-is
- Add native Capacitor Geolocation plugin as fallback for better background tracking
- Request "Always" location permission for background run recording

---

## 8. Implementation Timeline

### Week 1-2: App Store Shell
- [ ] Install Capacitor v6 in `v0/`
- [ ] Configure `capacitor.config.ts` (server URL, app ID, plugins)
- [ ] Generate Xcode project, configure signing
- [ ] App icon set (all sizes) and splash screen
- [ ] Safe area and status bar configuration
- [ ] iOS swipe-back gesture support
- [ ] Deep links / universal links setup
- [ ] First TestFlight build
- **Milestone: Internal TestFlight build running the full PWA natively**

### Week 2-3: Push Notifications
- [ ] Add `@capacitor/push-notifications` plugin
- [ ] APNs certificate setup in Apple Developer portal
- [ ] Permission request flow in onboarding
- [ ] Store device tokens in Supabase user record
- [ ] Server-side push via existing cron routes
- [ ] Workout reminder push notifications
- [ ] Weekly recap push notifications
- **Milestone: Users receive native push notifications**

### Week 3-5: HealthKit Integration
- [ ] Add `@nicejot/capacitor-healthkit` or equivalent plugin
- [ ] HealthKit entitlement in Xcode
- [ ] Permission request UI (explain what data and why)
- [ ] Read: sleep, HRV, resting HR, VO2max, active energy
- [ ] Write: completed run workouts with GPS route
- [ ] Map HealthKit data → existing `SleepData`, `HRVMeasurement` interfaces
- [ ] Background delivery for passive health data
- [ ] Extend device-connection-screen for Apple Watch
- [ ] Recovery engine updates to weight HealthKit data
- [ ] Data conflict resolution (Garmin vs HealthKit)
- **Milestone: Recovery scores incorporate Apple Watch data**

### Week 5-6: iOS Billing (StoreKit 2)
- [ ] Register app and products in App Store Connect
- [ ] Add Capacitor StoreKit plugin
- [ ] Purchase flow UI (upgrade modal → native purchase sheet)
- [ ] `POST /api/billing/apple/verify` — server-side validation
- [ ] App Store Server Notifications v2 webhook
- [ ] Subscription restoration on reinstall
- [ ] Entitlement sync (same flags as web)
- [ ] Grace period and billing retry handling
- **Milestone: Users can subscribe via iOS with full entitlement parity**

### Week 6-8: Native Polish + App Store Submission
- [ ] Haptic feedback on key interactions
- [ ] Keyboard handling optimization for chat
- [ ] Live Activities for active runs (Swift widget extension)
- [ ] Background app refresh for Garmin/HealthKit sync
- [ ] Offline error handling improvements
- [ ] Performance testing on older iPhones (iPhone 12+)
- [ ] App Store metadata (screenshots, description, keywords)
- [ ] Privacy nutrition labels
- [ ] App Review preparation (demo account, notes)
- [ ] Submit to App Store review
- **Milestone: App live on the App Store**

---

## 9. App Store Submission Checklist

### Required
- [ ] Apple Developer Program membership ($99/year)
- [ ] App ID and bundle identifier: `com.runsmart.coach`
- [ ] App icons (all sizes including 1024×1024 for App Store)
- [ ] Launch screen / splash screen
- [ ] Privacy policy URL (existing, update for HealthKit)
- [ ] App Store description, keywords, category (Health & Fitness)
- [ ] Screenshots: iPhone 15 Pro Max (6.7"), iPhone SE (4.7") minimum
- [ ] App privacy nutrition labels (data collection disclosures)
- [ ] HealthKit usage description strings
- [ ] Location usage description strings
- [ ] Push notification entitlement
- [ ] Sign in with Apple (if using social auth)

### Review Considerations
- Explain AI coaching feature clearly (not medical advice)
- HealthKit data usage must be clearly disclosed
- Subscription terms must be visible before purchase
- Background location usage must be justified (run recording)
- App must work without network (offline mode via Dexie)

---

## 10. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WKWebView performance for GPS recording | High | Low | Web Geolocation works well in WKWebView; fallback to native Capacitor plugin |
| App Store rejection for "web wrapper" | High | Medium | Add genuine native features (HealthKit, push, StoreKit, Live Activities) to differentiate from PWA |
| HealthKit data complexity | Medium | Medium | Start with read-only basics (sleep, HR); expand incrementally |
| Apple 30% commission impact on pricing | Medium | Certain | Higher iOS pricing; direct web subscribers to web checkout when possible |
| Background GPS battery drain | Medium | Medium | Use significant-change location when not actively recording; optimize polling interval |
| Capacitor plugin compatibility | Low | Low | Use official Capacitor plugins where possible; active community |

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TestFlight → App Store time | ≤ 8 weeks | Calendar |
| App Store rating | ≥ 4.5 stars | App Store Connect |
| iOS install → onboarding complete | ≥ 60% | PostHog |
| iOS D30 retention | ≥ 25% (parity with web) | PostHog cohorts |
| HealthKit opt-in rate | ≥ 50% of iOS users | PostHog |
| Push notification opt-in | ≥ 65% | PostHog |
| iOS subscription conversion | ≥ 3% of active users | App Store Connect + Supabase |
| App crashes / session | < 0.1% | Xcode Organizer |

---

## 12. Post-Launch Roadmap (Beyond Week 8)

1. **Siri Shortcuts** — "Hey Siri, start my RunSmart workout"
2. **Apple Watch companion app** — Standalone run recording on wrist
3. **Widgets** — Today widget showing next workout and recovery score
4. **CarPlay** — Audio coaching during runs (existing audio-coach.ts)
5. **App Clips** — Lightweight onboarding experience
6. **iPad optimization** — Split view for plan + today
7. **Strava Integration** — Import/export runs (community-requested)
8. **SharePlay** — Group run sessions with friends

---

## 13. Comparison: Original Plan vs This Plan

| Aspect | Original Draft | This Plan (v2) |
|--------|---------------|----------------|
| Approach | Not specified / unclear | Capacitor hybrid (explicit decision with rationale) |
| Codebase awareness | Basic PWA (6 screens, 2 API routes) | Full inventory: ~150 components, 40+ API route groups, Supabase, Garmin |
| HealthKit | Mentioned | Detailed mapping to existing data models (SleepData, HRVMeasurement, RecoveryScore) |
| Billing | Mentioned | Full StoreKit 2 plan aligned with existing Paddle billing + entitlements architecture |
| Garmin coexistence | Not addressed | Explicit conflict resolution strategy using existing components |
| Push notifications | Not addressed | Full APNs plan with server-side delivery via existing cron infrastructure |
| Live Activities | Not addressed | Dynamic Island / Lock Screen for active runs |
| App Store submission | Not addressed | Full checklist with review considerations |
| Timeline | Vague | 8-week phased plan with weekly milestones |
| Risks | Not addressed | 6 risks with mitigations |
| Metrics | Not addressed | 8 measurable success criteria |
| Post-launch | Not addressed | 8-item roadmap |

---

## 14. Quick Start (First Day)

```bash
# From the v0/ directory
cd v0

# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init RunSmart com.runsmart.coach --web-dir=out

# 2. Add iOS platform
npm install @capacitor/ios
npx cap add ios

# 3. Configure capacitor.config.ts for live deploy
# Set server.url to your Vercel production URL

# 4. Open in Xcode
npx cap open ios

# 5. Configure signing, build, and run on simulator
```

---

*End of RunSmart iOS App Plan v2*
