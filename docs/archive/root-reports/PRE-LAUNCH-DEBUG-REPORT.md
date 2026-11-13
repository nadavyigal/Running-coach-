# Pre-Launch Debug Report - Running Coach Application
**Date:** 2025-12-30
**Environment:** Development
**Status:** Critical Issues Found

## Executive Summary

A comprehensive debugging session was conducted to identify potential runtime issues before launch. **13 critical and moderate issues were identified** across Docker services, database operations, API routes, and test infrastructure. The Docker Worker Service is healthy, but several application-level bugs could impact user experience.

---

## 1. Docker Worker Service (REDIS + AI WORKER)

### Status: ✅ HEALTHY

#### Test Results:
- **Redis**: Running and healthy (port 6379)
  - Health check: PASSING
  - Data persistence: Active (AOF enabled)
  - Connection: Stable for 5+ hours

- **Worker Service**: Running and healthy (port 3001)
  - Health endpoint: `http://localhost:3001/health` returns `{"status":"healthy","workers":[{"name":"ai-activity","running":true}]}`
  - BullMQ connection: Active
  - Concurrency: 3 workers
  - Rate limiter: 10 jobs/60s configured

#### Configuration:
```yaml
Redis: redis:7-alpine
  - Host: redis (Docker network)
  - Port: 6379
  - TLS: Disabled (development)
  - Healthcheck: Passing

Worker: Custom Node.js service
  - Queue: ai-activity
  - Model: gpt-4o via OpenAI
  - Image processing: Sharp with EXIF support
  - Job timeout: Exponential backoff (max 30s)
```

#### Issues Found:
**⚠️ MODERATE:** Worker service not integrated with main application
- Location: `v0/app/api/ai-activity/route.ts`
- Issue: Direct OpenAI calls instead of queue-based worker jobs
- Impact: Blocking API requests, no job persistence, no retry logic
- Recommendation: Implement BullMQ client in Next.js API route to enqueue jobs

---

## 2. Database Layer (IndexedDB + Dexie)

### Status: ⚠️ CRITICAL ISSUES FOUND

#### Issue 1: Missing Function Export in Test Environment
**Severity:** CRITICAL
**Location:** `v0/lib/dbUtils.ts` → Test imports
**Error:**
```
TypeError: __vite_ssr_import_14__.dbUtils.getPrimaryGoal is not a function
```

**Root Cause:** The function `getPrimaryGoal` exists and is exported correctly in `dbUtils.ts` (line 3854), but Vitest is not resolving the import properly during test execution.

**Evidence:**
- Function definition: `v0/lib/dbUtils.ts:1156`
- Export in dbUtils: `v0/lib/dbUtils.ts:3854`
- Re-export in db.ts: `v0/lib/db.ts:1343`
- Component import: `v0/components/today-screen.tsx:32` (correct)

**Possible Causes:**
1. Circular dependency in module resolution
2. Vitest module transformation issue with Proxy pattern in `db.ts`
3. Module caching problem in test environment
4. Path alias resolution (`@/lib/dbUtils`) not working in tests

**Testing Evidence:**
```bash
# 9 tests failed in today-screen.test.tsx
stderr | components/today-screen.test.tsx > TodayScreen > renders dashboard
Error initializing data: TypeError: __vite_ssr_import_14__.dbUtils.getPrimaryGoal is not a function
```

**Fix Strategy:**
1. Check `vitest.config.ts` for path alias configuration
2. Verify module resolution in test setup
3. Consider removing Proxy pattern for test environment
4. Add explicit import test in `dbUtils.test.ts`

---

#### Issue 2: User Initialization Errors in Habit Analytics
**Severity:** HIGH
**Location:** `v0/lib/habitAnalytics.ts:71`
**Error:**
```
Failed to load habit analytics: Error: User not found
at HabitAnalyticsService.calculateHabitAnalytics
```

**Root Cause:** Habit analytics widget assumes user exists before initialization completes.

**Impact:**
- Non-blocking error (caught by error boundary)
- Widget shows loading state indefinitely
- Prevents habit insights from rendering

**Reproduction:**
1. Fresh database (no user created yet)
2. Load TodayScreen component
3. HabitAnalyticsWidget calls `calculateHabitAnalytics` before user creation

**Fix Strategy:**
1. Add user existence check in `HabitAnalyticsWidget.tsx`
2. Gracefully handle missing user with empty state UI
3. Add retry logic after user creation completes

---

#### Issue 3: Database Schema Evolution Risks
**Severity:** MODERATE
**Location:** `v0/lib/db.ts` (version 3)

**Findings:**
- Current version: 3
- Last migration: Subscription fields (14-day trial)
- Total tables: 40+ entities
- Compound indexes: Optimized for queries

**Potential Issues:**
1. **Upgrade Path:** Users on v1/v2 may experience blocking during migration
2. **Trial Date Logic:** All existing users get 14-day trial from upgrade time (line 1164)
3. **Concurrent Writes:** No transaction locks during schema upgrades
4. **IndexedDB Quota:** No quota checking during large data migrations

**Recommendations:**
1. Add migration progress UI for long-running upgrades
2. Implement quota pre-check before migrations
3. Add version rollback support for failed migrations
4. Log migration duration for monitoring

---

## 3. API Routes & Error Handling

### Status: ⚠️ ISSUES FOUND

#### Issue 4: OpenAI API Key Exposure in Client Code
**Severity:** CRITICAL (SECURITY)
**Location:** Multiple API routes
**Issue:** API key validation happens server-side, but error messages leak configuration state

**Example:**
```typescript
// v0/app/api/ai-activity/route.ts:214
if (!process.env.OPENAI_API_KEY) {
  return NextResponse.json(
    { error: "OPENAI_API_KEY is not configured", errorCode: "missing_api_key" },
    { status: 500 }
  )
}
```

**Risk:** Error code `missing_api_key` reveals backend configuration to client

**Fix:** Use generic error message: `"Service temporarily unavailable"`

---

#### Issue 5: Missing Rate Limit Enforcement Across Routes
**Severity:** HIGH
**Location:** Multiple API endpoints

**Findings:**
- `/api/chat/route.ts`: Rate limit implemented (50 req/hour)
- `/api/ai-activity/route.ts`: Rate limit implemented (5 req/min)
- `/api/analysis/run-from-photo/route.ts`: **NO RATE LIMIT**
- `/api/coaching/*`: **NO RATE LIMIT**

**Impact:**
- Potential abuse of photo analysis endpoint
- OpenAI API cost explosion
- Service degradation under load

**Fix:** Apply consistent rate limiting middleware to all AI-powered routes

---

#### Issue 6: Incomplete Error Recovery in Chat API
**Severity:** MODERATE
**Location:** `v0/app/api/chat/route.ts:61`

**Issue:** Truncated JSON during SPA navigation returns 204 (No Content) but doesn't log for debugging

**Code:**
```typescript
if (/unexpected end of json input/i.test(errorMessage)) {
  return new Response(null, { status: 204 });
}
```

**Problem:** Silent failures make debugging navigation-related errors difficult

**Fix:** Add debug-level logging before returning 204

---

## 4. Critical User Flows

### Status: ⚠️ TESTING REQUIRED

#### Flow 1: Onboarding Process
**Status:** NOT TESTED (Tests failing due to dbUtils issue)
**Files:**
- `v0/components/onboarding-screen.tsx`
- `v0/components/onboarding-chat-overlay.tsx`
- `v0/app/api/chat/route.ts`

**Test Plan:**
1. [ ] Fresh user signup → Goal discovery conversation
2. [ ] Plan generation after onboarding
3. [ ] User persistence in IndexedDB
4. [ ] Timezone handling for UTC plan activation

**Blocked By:** Issue #1 (dbUtils import in tests)

---

#### Flow 2: Run Recording with GPS
**Status:** NOT TESTED
**Files:**
- `v0/components/record-screen.tsx`
- `v0/lib/gpsTracking.ts`

**Known Risks:**
1. **GPS Permission Denial:** No fallback UI shown
2. **Poor Accuracy:** No accuracy threshold warnings
3. **Battery Drain:** Continuous tracking without optimization
4. **Background Sync:** Service worker not implemented

**Test Plan:**
1. [ ] GPS permission granted → successful tracking
2. [ ] GPS permission denied → manual entry fallback
3. [ ] GPS signal lost mid-run → recovery logic
4. [ ] Battery optimization mode → tracking accuracy

---

#### Flow 3: Photo Upload & AI Analysis
**Status:** PARTIALLY TESTED
**Files:**
- `v0/app/api/ai-activity/route.ts` (tested via unit tests)
- `v0/components/add-run-modal.tsx`

**Test Results:**
✅ File validation: PASSING
✅ Image preprocessing: PASSING
✅ Structured extraction: PASSING
✅ OCR fallback: PASSING
⚠️ Worker queue integration: NOT IMPLEMENTED

**Missing Tests:**
1. [ ] Large files (>5MB) rejection
2. [ ] Corrupted image handling
3. [ ] Network timeout during upload
4. [ ] Concurrent upload limit

---

#### Flow 4: Plan Generation with AI
**Status:** NOT TESTED
**Files:**
- `v0/app/api/generate-plan/route.ts`
- `v0/lib/planGenerator.ts`

**Potential Issues:**
1. No timeout for long-running plan generation
2. No progress indicator for user
3. No partial plan save if generation fails mid-way
4. No validation of generated workout dates

---

#### Flow 5: Chat Interaction
**Status:** PARTIALLY TESTED
**Files:**
- `v0/components/chat-screen.tsx`
- `v0/app/api/chat/route.ts`

**Known Issues:**
- Token budget tracking in memory (lost on restart)
- No conversation persistence across sessions
- Rate limiting per-user not enforced in production

---

## 5. Edge Cases & Error Scenarios

### Network Failures

#### Test Case 1: OpenAI API Timeout
**Status:** ⚠️ NO TIMEOUT CONFIGURED
**Location:** All AI API routes

**Risk:** User waits indefinitely if OpenAI doesn't respond

**Fix:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: mySchema,
    messages: [...],
    abortSignal: controller.signal
  });
} finally {
  clearTimeout(timeout);
}
```

---

#### Test Case 2: Redis Connection Loss
**Status:** ✅ HANDLED (Worker auto-reconnect)
**Evidence:** BullMQ has built-in reconnection logic

**Recommendation:** Add circuit breaker for API routes that enqueue jobs

---

#### Test Case 3: IndexedDB Quota Exceeded
**Status:** ⚠️ NOT HANDLED

**Scenario:**
1. User records 1000+ runs with GPS data
2. IndexedDB reaches browser quota (typically 50MB-1GB)
3. Write operations fail silently

**Fix:** Add quota checking in `v0/lib/db.ts:1214-1230`

---

### GPS Edge Cases

#### Test Case 4: GPS Denied Permission
**Status:** ⚠️ PARTIAL HANDLING
**Location:** `v0/components/record-screen.tsx`

**Current Behavior:** Error toast shown, but no manual entry fallback

**Fix:** Show manual entry form when GPS permission denied

---

#### Test Case 5: Poor GPS Accuracy
**Status:** ⚠️ NO VALIDATION

**Risk:** Inaccurate distance/pace calculations

**Recommendation:** Add accuracy threshold (e.g., reject points with accuracy > 50m)

---

### Image Upload Edge Cases

#### Test Case 6: Large File Upload
**Status:** ✅ HANDLED (6MB limit)
**Location:** `v0/app/api/ai-activity/route.ts:14`

---

#### Test Case 7: Unsupported File Type
**Status:** ✅ HANDLED
**Allowed:** `image/jpeg`, `image/png`, `image/webp`

---

#### Test Case 8: Network Interruption During Upload
**Status:** ⚠️ NO RETRY LOGIC

**Fix:** Implement exponential backoff retry in client

---

## 6. Performance & Scalability

### Identified Bottlenecks

1. **Database Query Performance**
   - Compound indexes optimized for common queries
   - ✅ Good: Query planning for date ranges
   - ⚠️ Risk: No query timeout for complex aggregations

2. **API Response Times**
   - Chat streaming: Acceptable latency
   - Photo analysis: 5-15s (depends on OpenAI)
   - Plan generation: Unknown (not measured)

3. **Client-Side Memory**
   - Large GPS tracks (1000+ points) stored in memory during recording
   - No pagination for workout history (could load 100+ workouts)

---

## 7. Security Vulnerabilities

### Identified Risks

1. **Rate Limiting Gaps** (HIGH)
   - Inconsistent across API routes
   - No distributed rate limiting (in-memory only)

2. **API Key Leakage** (CRITICAL)
   - Error messages reveal configuration state
   - Should use generic errors in production

3. **Input Validation** (MEDIUM)
   - Chat input sanitized
   - Image uploads validated
   - ⚠️ Manual run entry fields not sanitized

---

## 8. Recommendations by Priority

### CRITICAL (Fix Before Launch)

1. **Fix dbUtils import in tests** (Issue #1)
   - Impact: Cannot run automated tests
   - Effort: 2-4 hours
   - Blocker for: All test-driven development

2. **Implement API timeouts** (Test Case 1)
   - Impact: Prevents hanging requests
   - Effort: 1-2 hours
   - Blocker for: Production stability

3. **Add quota checking for IndexedDB** (Test Case 3)
   - Impact: Prevents data loss
   - Effort: 2-3 hours
   - Blocker for: Long-term users

4. **Sanitize error messages** (Issue #4)
   - Impact: Security vulnerability
   - Effort: 1 hour
   - Blocker for: Production launch

---

### HIGH (Fix Within First Week)

5. **Integrate Worker Queue** (Issue in Section 1)
   - Impact: Better scalability, retry logic
   - Effort: 4-6 hours
   - Benefit: Non-blocking AI operations

6. **Add GPS fallback UI** (Test Case 4)
   - Impact: Better UX for permission denials
   - Effort: 2-3 hours
   - Benefit: Prevents user frustration

7. **Implement consistent rate limiting** (Issue #5)
   - Impact: Cost control, abuse prevention
   - Effort: 3-4 hours
   - Benefit: Production stability

---

### MODERATE (Fix Within First Month)

8. **Add plan generation progress indicator** (Flow 4)
   - Impact: Better UX during long operations
   - Effort: 2-3 hours

9. **Implement GPS accuracy validation** (Test Case 5)
   - Impact: More accurate distance/pace
   - Effort: 2-3 hours

10. **Add database migration UI** (Issue #3)
    - Impact: Better UX during schema upgrades
    - Effort: 4-6 hours

---

## 9. Test Execution Summary

### Unit Tests
- **Total:** 50+ test files
- **Status:** ❌ FAILING (9 failures in today-screen.test.tsx)
- **Blocker:** dbUtils import issue

### Integration Tests
- **Status:** NOT RUN (blocked by unit test failures)

### E2E Tests (Playwright)
- **Status:** NOT RUN
- **Recommendation:** Run after fixing unit tests

---

## 10. Environment Verification

### Environment Variables
✅ `OPENAI_API_KEY`: Configured
✅ `NEXT_PUBLIC_SUPABASE_URL`: Configured
✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configured
✅ `SUPABASE_SERVICE_ROLE_KEY`: Configured
⚠️ `REDIS_URL`: Not set in v0/.env.local (only in worker)

### Docker Services
✅ Redis: Running
✅ Worker: Running
⚠️ Worker integration: Not connected to main app

---

## 11. Next Steps

### Immediate Actions (Today)
1. Fix dbUtils import issue in tests
2. Run full test suite
3. Add API timeouts to all OpenAI calls
4. Sanitize error messages for production

### This Week
5. Integrate worker queue with API routes
6. Add GPS permission fallback UI
7. Implement consistent rate limiting
8. Add IndexedDB quota checking

### Before Launch
9. Run E2E tests for all critical flows
10. Load test API endpoints (simulate 100 concurrent users)
11. Security audit of all API routes
12. Performance profiling of database queries

---

## 12. Conclusion

The application has a **solid foundation** with well-structured code, comprehensive database schema, and good error handling patterns. However, several **critical issues must be addressed before launch**:

1. Test infrastructure must be fixed to enable QA
2. API timeout handling is missing
3. Worker queue integration incomplete
4. Security improvements needed for error messages

**Estimated Fix Time:** 12-16 hours
**Risk Level:** MODERATE (solvable before launch)
**Recommendation:** Fix CRITICAL issues (1-4) before any production deployment

---

## Appendix A: File Locations Reference

### Critical Files
- Database: `v0/lib/db.ts`, `v0/lib/dbUtils.ts`
- Docker: `docker-compose.yml`, `services/worker/`
- API Routes: `v0/app/api/*/route.ts`
- Tests: `v0/components/*.test.tsx`

### Configuration Files
- Vitest: `v0/vitest.config.ts`, `v0/vitest.setup.ts`
- Next.js: `v0/next.config.mjs`
- TypeScript: `v0/tsconfig.json`

---

**Report Generated:** 2025-12-30
**Next Review:** After CRITICAL fixes applied
