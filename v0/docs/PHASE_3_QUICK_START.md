# Phase 3 Quick Start Guide

## What's New

Phase 3 adds **advanced data-driven decision-making** capabilities to RunSmart Analytics:

### ✨ 4 Major Systems

1. **A/B Testing Framework** - Run statistically-significant experiments
2. **Feature Flags System** - Gradual rollouts and user-based feature access
3. **Cohort Analysis** - Group and track user cohorts
4. **Retention Analysis** - Identify at-risk users and track churn

---

## 🚀 Quick API Examples

### A/B Testing

```bash
# Create experiment
curl -X POST http://localhost:3000/api/analytics/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "id": "exp_001",
    "name": "Simplified Onboarding",
    "variants": [
      {"id": "control", "name": "Current (5 steps)", "features": {}, "trafficAllocation": 0.5},
      {"id": "variant_a", "name": "New (3 steps)", "features": {}, "trafficAllocation": 0.5}
    ],
    "primaryMetric": "onboarding_completion_rate",
    "hypothesis": "Reducing steps increases completion"
  }'

# Start experiment
curl -X POST http://localhost:3000/api/analytics/ab-tests \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "experimentId": "exp_001"}'

# Assign user
curl -X POST http://localhost:3000/api/analytics/ab-tests \
  -H "Content-Type: application/json" \
  -d '{"action": "assign", "experimentId": "exp_001", "userId": 123}'
```

### Feature Flags

```bash
# Create feature flag
curl -X POST http://localhost:3000/api/analytics/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dark_mode",
    "name": "Dark Mode",
    "enabled": true,
    "rolloutType": "percentage",
    "rolloutPercentage": 25
  }'

# Check if enabled
curl "http://localhost:3000/api/analytics/feature-flags?flagId=dark_mode&userId=123&checkEnabled=true"

# Expand rollout to 50%
curl -X POST http://localhost:3000/api/analytics/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enable_percentage",
    "flagId": "dark_mode",
    "rolloutPercentage": 50
  }'
```

### Cohorts

```bash
# Create cohort
curl -X POST http://localhost:3000/api/analytics/cohorts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cohort_feb_2026",
    "name": "February 2026 Cohort",
    "type": "date_based",
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2026-02-28T23:59:59Z"
  }'

# Add user
curl -X POST http://localhost:3000/api/analytics/cohorts \
  -H "Content-Type: application/json" \
  -d '{
    "action": "manage_member",
    "cohortId": "cohort_feb_2026",
    "userId": 123,
    "action": "add"
  }'
```

### Retention

```bash
# Record retention
curl -X POST http://localhost:3000/api/analytics/retention \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 123,
    "signupDate": "2026-01-15T00:00:00Z",
    "lastActiveDate": "2026-02-10T00:00:00Z",
    "daysSinceSignup": 26,
    "daysSinceActive": 0,
    "daysBetweenSessions": 3.5,
    "totalSessions": 8,
    "totalRuns": 12,
    "totalDistanceKm": 65.4
  }'

# Get summary
curl "http://localhost:3000/api/analytics/retention?action=summary"

# Get at-risk users
curl "http://localhost:3000/api/analytics/retention?action=at_risk&riskThreshold=60"
```

---

## 📊 Integration with Phases 1 & 2

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Funnel tracking | ✅ Complete |
| 2 | Analytics dashboard | ✅ Complete |
| **3** | **A/B testing** | ✅ **New** |
| **3** | **Feature flags** | ✅ **New** |
| **3** | **Cohort analysis** | ✅ **New** |
| **3** | **Retention tracking** | ✅ **New** |
| 4 | Production dashboard | ⏳ Next |

---

## 📁 Files Added

**Core Libraries:**
- `lib/ab-testing.ts` - A/B testing framework (380 LOC)
- `lib/feature-flags.ts` - Feature flags system (300 LOC)
- `lib/cohort-analysis.ts` - Cohort grouping & analysis (380 LOC)
- `lib/retention-analysis.ts` - Retention & churn tracking (340 LOC)

**API Routes:**
- `app/api/analytics/ab-tests/route.ts`
- `app/api/analytics/feature-flags/route.ts`
- `app/api/analytics/cohorts/route.ts`
- `app/api/analytics/retention/route.ts`

**Documentation:**
- `docs/PHASE_3_IMPLEMENTATION_SUMMARY.md` - Complete reference (350+ lines)
- `docs/PHASE_3_QUICK_START.md` - This file

**Total:** 1,630+ lines of new functionality

---

## 🧪 Testing

Run the Phase 3 test suite:

```bash
bash /tmp/test_phase3.sh
```

Expected output:
```
✅ Test 1: A/B Testing Framework
✓ Experiment created

✅ Test 2: Feature Flags System
✓ Feature flag created
✓ Feature flag retrieved

✅ Test 3: Cohort Analysis
✓ Cohort created

✅ Test 4: Retention Analysis
✓ Retention recorded
✓ Retention summary retrieved

✅ Phase 3 Deployment Complete!
```

---

## 💡 Use Cases

### Use Case 1: Safe Feature Launch

```typescript
// Day 1: Create feature flag (disabled)
await upsertFeatureFlag({
  id: 'new_dashboard',
  name: 'New Dashboard',
  enabled: false
})

// Day 2: Internal testing (5%)
await enableFeaturePercentage('new_dashboard', 5)
// ✓ 0 critical errors → proceed

// Day 3: Expand to 25%
await enableFeaturePercentage('new_dashboard', 25)
// ✓ 0.5% error rate → proceed

// Day 7: Full launch (100%)
await launchFeature('new_dashboard')
```

### Use Case 2: Run A/B Test

```typescript
// Create experiment
const exp = await createExperiment({
  id: 'exp_ui_test',
  name: 'UI Redesign Test',
  variants: [
    { id: 'control', name: 'Current UI', features: {}, trafficAllocation: 0.5 },
    { id: 'new_ui', name: 'New UI', features: {}, trafficAllocation: 0.5 }
  ],
  primaryMetric: 'completion_rate',
  expectedLift: 15
})

// Start and run for 14 days
await startExperiment(exp.id)

// ... after 14 days ...

// Get results
const results = await endExperiment(exp.id)
if (results.isSignificant) {
  console.log(`Winner: ${results.winner}`)
  console.log(`Confidence: ${results.confidence}%`)
  console.log(`P-value: ${results.statisticalSignificance}`)
}
```

### Use Case 3: Target At-Risk Users

```typescript
// Get users at churn risk
const atRiskUsers = getUsersAtRisk(70)

// Send reactivation campaign
for (const user of atRiskUsers) {
  if (user.status === 'at_risk') {
    await sendReactivationOffer(user.userId)
  }
}

// Track reactivation
await trackReactivation(userId)
```

### Use Case 4: Analyze Cohort Performance

```typescript
// Compare February vs March cohorts
const comparison = await compareCohorts('cohort_feb_2026', 'cohort_mar_2026')

console.log(`Day 7 Retention Difference: ${comparison.retention_day_7_diff}pp`)
console.log(`Plan Adherence Difference: ${comparison.planAdherence_diff}pp`)

// If significant improvement, apply Feb learnings to Mar cohort
if (comparison.retention_day_30_diff > 10) {
  console.log('March cohort shows better retention!')
}
```

---

## 🎯 Success Criteria (Met ✅)

- ✅ A/B testing framework operational
- ✅ Statistical significance calculation working
- ✅ Feature flags enable/disable features
- ✅ Percentage-based rollouts functional
- ✅ Cohort analysis tracking working
- ✅ Retention curves calculated
- ✅ Churn risk scoring implemented
- ✅ All API routes tested and working
- ✅ Zero console errors
- ✅ Code passes linting

---

## 📚 Documentation

For complete details, see:

1. **PHASE_3_IMPLEMENTATION_SUMMARY.md** - Full technical reference
2. **ANALYTICS_QUICK_REFERENCE.md** - Phase 1 & 2 reference
3. **ANALYTICS_TRACKING_GUIDE.md** - Phase 1 tracking details

---

## 🚀 Next Steps

Phase 4 (Production Dashboard):
- Real-time metrics streaming
- PostgreSQL backend for events
- Advanced segmentation
- User journey replay
- Anomaly detection
- ML-based churn prediction

---

**Status:** ✅ Phase 3 Complete
**Commit:** 60b17f7
**Branch:** main
**Date:** February 10, 2026

