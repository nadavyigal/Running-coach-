# RunSmart iOS App — Implementation Plan v3

Date: 2026-03-18
Owner: Nadav
Status: Active
Supersedes: v1 (SwiftUI native, Feb 2026) and v2 (Capacitor draft, Mar 17 2026)

---

## 1. Executive Summary

RunSmart is a mature Next.js 14 PWA with ~160 components, 45+ API route groups, Supabase auth/DB, Garmin bi-directional sync, AI coaching (GPT-4o), GPS run recording, recovery engine (sleep/HRV/wellness), PostHog analytics, subscription gating (Paddle), weekly recaps with sharing, challenges, advanced Garmin dashboards (ACWR, body battery, HRV, spo2, stress, wellness), zone-based coaching, running dynamics, and plan customization.

**Strategy: Capacitor v6 Hybrid** — wrap the existing Next.js PWA in a native iOS shell, then add iOS-native capabilities incrementally. This reuses 95%+ of existing code and gets to the App Store in 8 weeks.

The monorepo infrastructure (Phase 0 from v1) is already built: `packages/shared/`, `pnpm-workspace.yaml`, `turbo.json`, CI/CD workflows, Swift type generation.

---

## 2. Strategy: Capacitor Hybrid

### Why Capacitor

| Option | Verdict |
|--------|---------|
| **Capacitor v6 (chosen)** | Reuses 95%+ of ~160 existing components; App Store compliant; best ROI for solo founder |
| React Native rewrite | Full rewrite, 3-6 months, dual codebase — not viable |
| SwiftUI native (v1 plan) | Complete rewrite, 12 weeks minimum — too expensive as sole founder |
| PWA only | No App Store; limited push; no HealthKit; iOS Safari limitations |

### What Capacitor Gives Us
- App Store distribution (#1 goal)
- Native push notifications (APNs)
- HealthKit / Apple Watch data
- StoreKit 2 for iOS subscriptions
- Background app refresh
- Haptic feedback and native gestures
- Live Activities (Dynamic Island)
- Siri Shortcuts (future)

---

## 3. Current PWA Feature Inventory (Everything Capacitor Wraps)

### Core Screens
- **OnboardingScreen** — 5-step wizard, goal selection, watch pairing question
- **TodayScreen** — Recovery hero, daily check-in, 14-day run list, weekly metrics, streak, coaching insights widget
- **PlanScreen** — Week accordions, workout cards, plan customization dashboard, plan complexity indicator, coach tips, plan adaptation, workout compliance panel
- **RecordScreen** — Live GPS tracking, pace/distance/HR, interval manager, audio coaching, haptics, post-run RPE modal
- **ChatScreen** — AI coach streaming chat, user memory, suggested questions, conversation history
- **ProfileScreen** — User info, stats, achievements, shoe management, privacy dashboard, device settings

### Garmin Integration (extensive)
- OAuth 2.0, activity sync, workout push, wellness data pull
- Dashboards: ACWR chart, body battery, HRV chart, spo2, stress chart, wellness dashboard, sleep analytics, readiness card
- Garmin sync panel, sync status bar, manual export modal
- Auto-sync pipeline, incremental sync
- `garmin-dark-report` with map and pace chart

### Recovery & Health
- Recovery engine (sleep 25% + HRV 25% + resting HR 15% + wellness 20% + load 10% + stress 5%)
- Recovery dashboard, recommendations, wellness input modal
- Data fusion dashboard (multi-source), conflict resolution center
- Data sources manager, device connection screen
- Zone analysis dashboard, zone-based coaching
- Realtime heart rate monitor, running dynamics visualization

### AI & Coaching
- GPT-4o via Vercel AI SDK, streaming SSE
- Enhanced AI coach, coaching feedback modal, coaching preferences settings
- Run report with AI analysis, map, pace chart
- Goal analytics insights, advanced metrics dashboard, performance trends

### Social & Sharing
- **Weekly share** — CTA loop, shareable weekly recap cards (new in sprint-9.3.26+)
- Share run modal, share badge modal
- Community comparison, community stats widget
- Challenges engine, challenge completion, daily challenge prompt, challenge picker

### Plan & Training
- Plan generation (AI-powered), plan setup wizard, plan template flow
- Race goal modal, race goals screen
- Training load analyzer, personal records card
- Workout details/breakdown/phases, reschedule modal, date workout modal

### Monetization
- Subscription gating, subscription activation (sprint-9.4 quality gate)
- Paddle MoR for web; StoreKit 2 for iOS

### Infrastructure
- Supabase auth + RLS, server-side data
- PostHog analytics, activation funnel dashboard
- Background sync, offline-first (Dexie.js/IndexedDB)
- Weekly recap notification banner and widget
- Engagement optimization
- Service worker, PWA manifest

### Backend (unchanged — same for iOS and web)
- 45+ API route groups in `v0/app/api/`: ai, chat, garmin, recovery, plan, run-report, metrics, devices, workouts, goals, challenges, user-memory, share-run, share-badge, analytics, cron, sync, etc.
- Vercel hosting, Supabase DB

---

## 4. iOS-Native Additions (What Capacitor Unlocks)

### Phase 1 — App Store Shell (Week 1-2)
1. **Capacitor v6 setup** in `v0/` — `capacitor.config.ts` pointing to Vercel production URL
2. **Native splash screen and app icon** — emerald #10b981 branding, all sizes (20pt–1024pt)
3. **Status bar and safe area** — light/dark, notch/home indicator padding
4. **Navigation and gestures** — iOS swipe-back, haptic feedback on key interactions
5. **Deep links / universal links** — share links for run reports, weekly recaps, challenges, badges
6. **First TestFlight build**

### Phase 2 — Push Notifications (Week 2-3)
7. **APNs** via `@capacitor/push-notifications`
   - Permission request during onboarding
   - Workout reminders → existing `lib/reminderService.ts`
   - Post-run recovery nudges
   - Weekly recap push (hooks into weekly share CTA loop)
   - Plan adaptation alerts
   - Challenge milestones and streak warnings
8. **Server-side delivery** — store device tokens in Supabase, send via existing `v0/app/api/cron/` jobs

### Phase 3 — HealthKit Integration (Week 3-5)
9. **Apple HealthKit plugin**
   - Read: heart rate, HRV (SDNN), resting HR, sleep analysis, VO2max, active energy, running power, ground contact time, stride length
   - Write: running workouts (distance, duration, GPS route)
   - Background delivery for overnight sleep and passive HR
   - Maps to existing `SleepData`, `HRVMeasurement`, `RecoveryScore` interfaces in `v0/lib/db.ts`
   - Extend existing `data-sources-manager.tsx` and `device-connection-screen.tsx` for Apple Watch
10. **Data source priority**: Garmin direct > HealthKit from Watch > HealthKit from phone > manual
    - Existing `conflict-resolution-center.tsx` handles conflicts
    - Recovery engine (`lib/recoveryEngine.ts`) already supports multiple sources

### Phase 4 — StoreKit 2 / iOS Billing (Week 5-6)
11. **In-App Purchases** via Capacitor StoreKit plugin
    - Products: `runsmart_premium_monthly` ($12.99), `runsmart_premium_annual` ($119.99)
    - Mirrors existing subscription tiers from `docs/monetization/04-ios-billing-strategy.md`
12. **Server-side validation** — new `v0/app/api/billing/apple/verify/route.ts`
    - App Store Server API v2 signed transactions
    - Updates `billing_subscriptions` in Supabase with `provider = 'apple'`
    - Same entitlement flags as web (`ai_coaching_unlimited`, `wearables_sync`, etc.)
13. **Subscription management** — restore on reinstall, grace period, App Store Server Notifications v2 webhook

### Phase 5 — Native Polish (Week 6-8)
14. **Background app refresh** — Garmin sync, HealthKit delivery, overnight recovery recalculation
15. **Live Activities (iOS 16.1+)** — active run on Lock Screen and Dynamic Island (distance, pace, HR zone)
16. **Haptics** — run start/pause/stop, workout complete, badge earned, weekly goal, streak milestone, challenge completion
17. **Offline resilience** — existing Dexie.js + service worker; ensure Capacitor WebView never shows offline error
18. **Weekly share deep links** — native share sheet for weekly recap cards (hooking into `share-run-modal` and `share-badge-modal`)

---

## 5. Architecture

```
┌─────────────────────────────────────────────────┐
│                 iOS App (Capacitor)              │
│  ┌───────────────────────────────────────────┐  │
│  │         WKWebView (Next.js PWA)           │  │
│  │  ~160 components, all screens, all APIs  │  │
│  │  Garmin dashboards, recovery, chat, GPS  │  │
│  │  Weekly share, challenges, plan tools    │  │
│  └──────────────────┬────────────────────────┘  │
│                     │ Capacitor Bridge           │
│  ┌──────────────────┴────────────────────────┐  │
│  │           Native iOS Plugins              │  │
│  │  APNs │ HealthKit │ StoreKit 2 │ Haptics  │  │
│  │  Live Activities │ Background Refresh     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
┌──────────────────┐    ┌───────────────────────┐
│  Vercel (API)    │    │       Supabase        │
│  45+ API routes  │    │  Auth / DB / RLS      │
│  AI / Garmin     │    │  Subscriptions        │
│  Share / Cron    │    │  Device tokens (APNs) │
└──────────────────┘    └───────────────────────┘
```

---

## 6. File Structure (New Files in v0/)

```
v0/
├── capacitor.config.ts              # Capacitor: appId, serverUrl, plugins
├── ios/                             # Generated Xcode project (npx cap add ios)
│   └── App/
│       ├── App/
│       │   ├── AppDelegate.swift
│       │   ├── Info.plist           # HealthKit, location, push entitlements
│       │   └── RunSmartWidget/      # Live Activities widget extension
│       └── Podfile
├── src/native/                      # Capacitor bridge utilities
│   ├── healthkit.ts                 # HealthKit read/write → existing data models
│   ├── push-notifications.ts        # APNs token registration, handlers
│   ├── haptics.ts                   # Haptic feedback for key interactions
│   ├── storekit.ts                  # StoreKit 2 purchase flow
│   └── live-activity.ts             # Live Activity updates during runs
├── lib/
│   ├── capacitor-platform.ts        # Platform detection (web vs iOS vs Android)
│   ├── healthkit-sync.ts            # HealthKit → SleepData, HRVMeasurement, RecoveryScore
│   └── apple-billing.ts             # StoreKit ↔ entitlements mapping
└── app/api/billing/apple/
    ├── verify/route.ts              # App Store receipt validation
    └── webhook/route.ts             # App Store Server Notifications v2
```

Also in repo root (already built — from Phase 0 of v1 plan):
```
packages/shared/                     # Shared TypeScript models (10 modules, 50+ types)
pnpm-workspace.yaml
turbo.json
apps/ios/fastlane/                   # Fastlane: test, beta, release lanes
.github/workflows/ios-build.yml
.github/workflows/ios-testflight.yml
```

---

## 7. Key Technical Decisions

### Live Deploy Mode (not static export)
Point Capacitor to the Vercel production URL. All 45+ API routes work unmodified. AI features, Garmin OAuth callbacks, and weekly share all require server-side infrastructure — static export not viable.

### HealthKit + Garmin Coexistence
Both supported. User picks primary device. Existing `conflict-resolution-center.tsx` handles conflicts. Priority: Garmin direct > Apple Watch HealthKit > iPhone HealthKit > manual.

### GPS Recording
Web Geolocation API works natively in WKWebView. Existing `record-screen.tsx` and `lib/location-service.ts` work as-is. Add Capacitor Geolocation plugin as fallback for better background tracking. Request "Always" permission.

### Subscription Pricing
iOS prices are higher to offset Apple's 30% cut:
- Monthly: $12.99 iOS vs $9.99 web
- Annual: $119.99 iOS vs $99.99 web
- Same entitlement flags; Supabase is source of truth.

### Weekly Share on iOS
The `bbaf143 Add weekly share CTA loop` feature works via the web layer. iOS adds native share sheet integration (`navigator.share()` → native iOS share sheet via WKWebView bridge). Deep links to shared recap cards handled by universal links.

---

## 8. Implementation Timeline

### Week 1-2: App Store Shell
- [ ] `npm install @capacitor/core @capacitor/cli @capacitor/ios`
- [ ] `npx cap init RunSmart com.runsmart.coach --web-dir=out`
- [ ] Configure `capacitor.config.ts` (server.url → Vercel prod, plugins config)
- [ ] `npx cap add ios` → generate Xcode project
- [ ] App icon set (all sizes, emerald theme) and splash screen
- [ ] Configure signing, bundle ID, capabilities in Xcode
- [ ] Safe area, status bar, swipe-back gesture
- [ ] Universal links / deep links (run shares, weekly recaps, challenges)
- [ ] First TestFlight internal build
- **Milestone: Full PWA running natively in TestFlight**

### Week 2-3: Push Notifications
- [ ] `npm install @capacitor/push-notifications`
- [ ] APNs certificate in Apple Developer portal
- [ ] Permission request in onboarding step
- [ ] Store device token in Supabase `users` table
- [ ] Wire up existing cron jobs to send APNs
- [ ] Workout reminders, weekly recap, streak warnings
- **Milestone: Users receive native push notifications**

### Week 3-5: HealthKit
- [ ] Add HealthKit entitlement + NSHealthShareUsageDescription strings
- [ ] HealthKit Capacitor plugin (evaluate: `@perfood/capacitor-healthkit` or custom)
- [ ] Permission request UI (explain what data and why)
- [ ] Read: sleep, HRV, resting HR, VO2max, active energy
- [ ] Write: running workouts + GPS route
- [ ] Map to `SleepData`, `HRVMeasurement`, `RecoveryScore` in `v0/lib/db.ts`
- [ ] Background delivery (passive overnight collection)
- [ ] Extend `device-connection-screen.tsx` for Apple Watch
- [ ] Update recovery engine weighting for HealthKit-sourced data
- **Milestone: Recovery scores use Apple Watch data automatically**

### Week 5-6: iOS Billing (StoreKit 2)
- [ ] Register products in App Store Connect
- [ ] Capacitor StoreKit plugin
- [ ] Purchase flow: upgrade modal → native purchase sheet
- [ ] `POST /api/billing/apple/verify` (server-side validation)
- [ ] App Store Server Notifications v2 webhook
- [ ] Subscription restore on reinstall
- [ ] Entitlement parity (same flags as Paddle/web)
- **Milestone: Users can subscribe and access premium features via iOS**

### Week 6-8: Native Polish + Submission
- [ ] Haptic feedback: run controls, badge earned, streak, challenge complete, weekly goal
- [ ] Live Activities for active run (Swift widget extension — small native addition)
- [ ] Background refresh for Garmin sync and HealthKit
- [ ] Native share sheet for weekly recap sharing
- [ ] Chat keyboard avoidance polish
- [ ] Performance test on iPhone 12+ (older devices)
- [ ] App Store metadata: screenshots (6.7", 4.7"), description, keywords
- [ ] Privacy nutrition labels (HealthKit, location, usage data)
- [ ] App Review notes (demo account, HealthKit explanation, background location justification)
- [ ] Submit to App Review
- **Milestone: App live on App Store**

---

## 9. App Store Submission Checklist

- [ ] Apple Developer Program ($99/year)
- [ ] Bundle ID: `com.runsmart.coach`
- [ ] App icons (all sizes + 1024×1024 for App Store)
- [ ] Launch screen / splash
- [ ] Privacy policy (update for HealthKit data)
- [ ] App Store description, keywords, category: Health & Fitness
- [ ] Screenshots: iPhone 15 Pro Max (6.7") and iPhone SE (4.7") minimum
- [ ] Privacy nutrition labels: Health & Fitness, Location, Usage Data
- [ ] HealthKit usage description strings
- [ ] Location usage description (background: active run recording)
- [ ] Push notification entitlement
- [ ] Sign In with Apple (if applicable — Supabase supports it)

---

## 10. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| App Store rejection as "web wrapper" | High | Medium | Live Activities, HealthKit, StoreKit, native haptics make it substantially native |
| WKWebView GPS background tracking | High | Low | Web Geolocation works; Capacitor Geolocation plugin as fallback |
| HealthKit plugin maturity | Medium | Medium | Evaluate 2-3 plugins; custom native bridge if needed |
| Apple 30% cut | Medium | Certain | Higher iOS pricing; nudge web users to web checkout |
| Weekly share deep links on iOS | Low | Low | `navigator.share()` maps to native share sheet automatically |
| Capacitor plugin conflicts | Low | Low | Use official/well-maintained plugins; test early |

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| TestFlight → App Store | ≤ 8 weeks |
| App Store rating | ≥ 4.5 stars |
| iOS install → onboarding complete | ≥ 60% |
| iOS D30 retention | ≥ 25% |
| HealthKit opt-in rate | ≥ 50% |
| Push notification opt-in | ≥ 65% |
| iOS subscription conversion | ≥ 3% of active users |
| Crash-free sessions | > 99.9% |

---

## 12. Quick Start

```bash
# Prerequisites: Xcode 16+, Apple Developer account, Node 20+

# From v0/ directory
cd v0

# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/push-notifications

# 2. Initialize (if not done)
npx cap init RunSmart com.runsmart.coach --web-dir=out

# 3. Build the Next.js app for static export (or use live URL mode)
# For live URL mode (recommended), set server.url in capacitor.config.ts

# 4. Add iOS platform
npx cap add ios

# 5. Open in Xcode
npx cap open ios

# 6. In Xcode: configure signing team, bundle ID, capabilities (HealthKit, Push, Background Modes)
# 7. Build and run on simulator or device
# 8. For device: need provisioning profile with your UDID registered
```

---

## 13. Post-Launch Roadmap (Phase 2 Native Upgrade)

After App Store launch, consider incremental native upgrades from the v1 SwiftUI plan:

1. **Widgets** (WidgetKit) — Today's workout, recovery score, streak on home/lock screen
2. **Apple Watch companion** — Start/stop/stats from wrist, HealthKit workout session
3. **Siri Shortcuts** — "Start my RunSmart workout", "What's my recovery?"
4. **CarPlay** — Audio coaching during runs (existing `audio-coach.ts`)
5. **iPad optimization** — Split view plan + today
6. **Full SwiftUI rewrite** (long-term) — If traction justifies investment

---

## 14. Infrastructure Already Built (from v1 Phase 0)

The following are already in this branch and do NOT need to be recreated:

| Asset | Location | Status |
|-------|----------|--------|
| Shared TypeScript models (50+ types) | `packages/shared/src/models/` | ✅ Built |
| API endpoint contracts | `packages/shared/src/api/` | ✅ Built |
| Swift type generator script | `packages/shared/scripts/generate-swift-types.ts` | ✅ Built |
| Auto-generated Swift models | `apps/ios/RunSmart/Generated/SharedModels.swift` | ✅ Built |
| iOS CI/CD build workflow | `.github/workflows/ios-build.yml` | ✅ Built |
| TestFlight auto-deploy workflow | `.github/workflows/ios-testflight.yml` | ✅ Built |
| Fastlane config (test/beta/release) | `apps/ios/fastlane/` | ✅ Built |
| Monorepo workspace | `pnpm-workspace.yaml`, `turbo.json` | ✅ Built |
| iOS expert agent | `.claude/agents/ios-expert.md` | ✅ Built |
| iOS expert skill | `.claude/skills/ios-expert/SKILL.md` | ✅ Built |

---

*End of RunSmart iOS App Plan v3*
