# E2E Test Suite - Onboarding to First Adaptive Update

## Overview
This E2E test suite validates the complete user journey from initial onboarding through the first adaptive plan update, ensuring seamless user experience and data flow integrity.

## Test Scenarios

### 1. Beginner Runner - Conservative Adjustment
- **User Profile**: Complete beginner, 3 days/week, habit goal
- **First Run**: 2km easy run, 15:00 pace
- **Expected Outcome**: Slight volume increase, maintain easy pace focus

### 2. Intermediate Runner - Moderate Adjustment
- **User Profile**: Some experience, 4 days/week, performance goal
- **First Run**: 5km tempo run, 12:00 pace
- **Expected Outcome**: Increase intensity, add structured workouts

### 3. Advanced Runner - Aggressive Adjustment
- **User Profile**: Experienced runner, 5 days/week, race goal
- **First Run**: 8km long run, 10:30 pace
- **Expected Outcome**: Significant volume/intensity increase, race-specific training

### 4. Edge Cases
- **Very Slow Run**: Test system's ability to adjust for struggling users
- **Data Integrity**: Verify no data loss during adaptive updates
- **Performance**: Ensure response time < 30 seconds

## Running Tests

### Prerequisites
- Node.js 18+
- npm or yarn
- Playwright browsers installed

### Installation
```bash
npm install
npx playwright install
```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test
```bash
npx playwright test onboarding-adaptive-update.spec.ts
```

### Run with UI Mode
```bash
npx playwright test --ui
```

### Run in Debug Mode
```bash
npx playwright test --debug
```

## Test Structure

```
e2e/
├── onboarding-adaptive-update.spec.ts  # Main test file
├── utils/
│   ├── test-data-factory.ts           # Test data generation
│   └── test-helpers.ts                # Helper functions
├── setup/
│   └── global-setup.ts                # Global test setup
└── README.md                          # This file
```

## Test Data

The test suite uses realistic data sets for different user profiles:

- **Beginner**: 2km runs, 10-15 min/km pace
- **Intermediate**: 5km runs, 6-8 min/km pace  
- **Advanced**: 8km+ runs, 4-6 min/km pace

## Success Metrics

- ✅ 100% test pass rate for all scenarios
- ✅ <30 seconds total execution time per test scenario
- ✅ Zero data corruption or loss
- ✅ All user interactions complete successfully
- ✅ Adaptive updates trigger within 5 minutes of run completion

## Debugging

### View Test Reports
```bash
npx playwright show-report
```

### View Traces
```bash
npx playwright show-trace trace.zip
```

### Common Issues

1. **Test Timeouts**: Increase timeout values in test files
2. **Element Not Found**: Check data-testid attributes in components
3. **Database Issues**: Ensure IndexedDB is properly cleared between tests

## CI/CD Integration

The tests are configured to run in CI/CD environments with:
- Parallel execution disabled
- Retry logic for flaky tests
- HTML report generation
- Screenshot capture on failure

## Maintenance

- Update test data when user profiles change
- Add new scenarios as features evolve
- Monitor test performance and adjust timeouts
- Keep test utilities synchronized with component changes 