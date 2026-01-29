# GEMINI.md

This file provides guidance to Gemini/Antigravity when working with code in this repository.

## Essential Commands

**Development:**
- `cd V0` - Navigate to the main application directory (all commands below should be run from V0/)
- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run test` - Run all tests with Vitest

**Testing:**
- `npm run test -- --run` - Run tests once without watch mode
- `npm run test -- --coverage` - Run tests with coverage report
- `npm run test -- ComponentName` - Run specific test file
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:e2e:ui` - Run Playwright tests with UI
- `npm run test:e2e:debug` - Debug Playwright tests
- `npm run test:e2e:report` - Show Playwright test report

## Architecture Overview

This is a **Next.js 14 PWA** designed as a mobile-first running coach application. The app uses a **single-page application pattern** with screen-based navigation managed by state in the main component.

### Key Architectural Patterns

**Database & Data:**
- **Dexie.js** (IndexedDB) for client-side persistence - all data is stored locally
- Database schema in `lib/db.ts` with entities: User, Plan, Workout, Run, Shoe, ChatMessage, Badge, Cohort, SleepData, HRVMeasurement, RecoveryScore, SubjectiveWellness
- Database utilities in `lib/dbUtils.ts` for common operations
- **Recovery Engine** in `lib/recoveryEngine.ts` for advanced metrics and recovery score calculations

**Component Structure:**
- **Screen Components:** OnboardingScreen, TodayScreen, PlanScreen, RecordScreen, ChatScreen, ProfileScreen
- **UI Components:** Radix UI primitives in `components/ui/`
- **Modal Components:** Feature-specific modals for actions and details

**AI Integration:**
- **OpenAI GPT-4o** via Vercel AI SDK for chat and plan generation
- **Structured generation** using Zod schemas for training plans
- **Streaming responses** for real-time chat interaction
- API routes in `app/api/` handle AI requests with rate limiting

**State Management:**
- **React state** for UI and screen navigation
- **Local database** for persistent data
- **No external state management** library (Redux, Zustand, etc.)

### Development Workflow

**File Organization:**
- Main app logic in `V0/` directory
- Components follow feature-based organization
- Database operations centralized in `lib/` utilities
- Tests co-located with components (`.test.tsx` files)

**Epic-Based Development:**
- Features organized by Epics (1-5) documented in `docs/`
- Current branch naming: `feature/epic-X`
- PRs merge to `main` branch

**Database Schema Pattern:**
```typescript
// All entities extend this pattern
export interface EntityName {
  id?: number;           // Auto-increment primary key
  createdAt: Date;       // Timestamp
  updatedAt: Date;       // Timestamp
  // ... entity-specific fields
}
```

**Component Testing:**
- Use `@testing-library/react` for component tests
- `fake-indexeddb` for mocking database operations
- Test files use `.test.tsx` extension
- Global test setup in `vitest.setup.ts`
- Vitest configuration in `vitest.config.ts` with jsdom environment
- Path aliases configured: `@/` for root, `@/lib`, `@/components`, `@/components/ui`
- Test timeout set to 60 seconds for complex operations

### Important Technical Details

**Mobile-First Design:**
- Container max-width: `max-w-md` for mobile simulation
- Bottom navigation with prominent record button
- Touch-friendly interfaces with proper spacing

**Database Migrations:**
- Dexie handles schema versioning automatically
- Add new fields to interfaces and increment version in db.ts
- Migrations run automatically on app start

**AI Cost Management:**
- Rate limiting on API routes
- Structured generation for predictable token usage
- Fallback mechanisms when AI services unavailable

**GPS and Location:**
- RecordScreen uses Web Geolocation API
- Real-time tracking during runs
- Distance/pace calculations in client-side utilities

**Recovery & Health Metrics:**
- Advanced recovery scoring using sleep, HRV, and subjective wellness data
- Integration with device APIs (Apple Watch, Garmin) for health data
- Heart rate zones and training load calculations
- Background sync functionality for continuous data collection

### Common Development Tasks

**Adding New Screen:**
1. Create screen component in `components/`
2. Add screen to navigation in main `page.tsx`
3. Add tests with database mocking
4. Update navigation logic

**Database Changes:**
1. Update interface in `lib/db.ts`
2. Add utility functions to `lib/dbUtils.ts`
3. Update relevant components
4. Add migration if needed

**AI Integration:**
1. Create API route in `app/api/`
2. Define Zod schema for structured data
3. Add rate limiting and error handling
4. Implement streaming if needed

**Testing Database Operations:**
- Always mock database with `fake-indexeddb`
- Use `beforeEach` to reset database state
- Test both success and error cases
- Verify data persistence and retrieval
- ResizeObserver and scrollIntoView are mocked in setup
