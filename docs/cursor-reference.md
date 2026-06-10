# CURSOR.md

This file provides guidance to Cursor AI Agent when working with code in this repository.

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

## AI Skills System

Cursor Agent has access to specialized AI skills for the Run-Smart running coach application. These skills provide structured, safe, and domain-specific AI capabilities.

### Available Skills

Skills are organized in `.cursor/skills/` with the following structure:

#### Core Index
- **running-coach-index** - Catalog of all skills, shared contracts, telemetry, and safety guardrails

#### Planning & Generation Skills
- **plan-generator** - Generates 14-21 day personalized training plans with safe load progression
- **plan-adjuster** - Recomputes upcoming workouts based on recent runs and feedback
- **conversational-goal-discovery** - Chat-based goal classification with constraint clarification

#### Pre-Run Skills
- **readiness-check** - Pre-run safety gate evaluating readiness and recommending proceed/modify/skip decisions
- **workout-explainer** - Translates planned workouts into execution cues and purpose explanations

#### Post-Run Skills
- **post-run-debrief** - Converts run telemetry into structured reflections with confidence scores
- **run-insights-recovery** - Analyzes completed runs for effort assessment and recovery recommendations

#### Safety & Monitoring Skills
- **load-anomaly-guard** - Detects unsafe training load spikes (>20-30% week-over-week)
- **adherence-coach** - Identifies missed sessions and proposes plan reshuffles with motivational support

#### Advanced Features
- **race-strategy-builder** - Generates race-day pacing and fueling strategies with contingency plans
- **route-builder** - Generates route specifications with distance and elevation constraints

### Using Skills

When working with running coach features:
1. Reference `.cursor/skills/running-coach-index/SKILL.md` first to understand shared contracts and safety patterns
2. Load the specific skill's SKILL.md file for detailed guidance
3. Review `references/` subdirectories for schemas, examples, and edge cases
4. Follow safety guardrails: no medical diagnosis, conservative adjustments, emit SafetyFlags
5. Log telemetry events via `v0/lib/analytics.ts`

### Skill Structure

Each skill directory contains:
```
skill-name/
├── SKILL.md                 # Main skill definition and guidance
└── references/              # Supporting materials
    ├── input-schema.json    # Request schema
    ├── output-schema.json   # Response schema
    ├── examples.md          # Sample inputs/outputs
    └── edge-cases.md        # Handling edge cases
```

### Safety Guardrails (All Skills)

1. **No Medical Diagnosis**: Never provide medical advice or diagnosis
2. **Conservative Defaults**: Under uncertainty, prefer safer, more conservative recommendations
3. **SafetyFlags**: Emit structured safety flags when thresholds are crossed
4. **Pain/Injury Signals**: If user reports pain, dizziness, or severe symptoms, advise stopping and consulting a professional
5. **Load Management**: Enforce hard caps on weekly volume changes (typically <20-30%)
6. **Data Validation**: Emit `missing_data` flags when critical information is unavailable

### Shared Contracts

All skills use standardized TypeScript interfaces defined in `.cursor/skills/running-coach-index/references/contracts.md`:

- `UserProfile` - User identity, goals, experience, preferences
- `TrainingHistory` - Recent runs, weekly volume, consistency
- `RecentRunTelemetry` - Run data with GPS, HR, RPE, notes
- `Plan` - Training plan with workouts and rationale
- `Workout` - Individual session specification
- `Adjustment` - Plan modifications with reasoning
- `Insight` - Post-run analysis and recommendations
- `SafetyFlag` - Structured safety warnings

### Telemetry Events

Standard events logged via `v0/lib/analytics.ts`:

- `ai_skill_invoked` - Skill usage with context and latency
- `ai_plan_generated` - Plan creation with version and safety flags
- `ai_adjustment_applied` - Plan modifications with confidence
- `ai_insight_created` - Run analysis with effort and flags
- `ai_safety_flag_raised` - Safety warnings with severity
- `ai_user_feedback` - User ratings and comments

### Integration Points

Skills integrate with:
- **Chat API**: `v0/app/api/chat/route.ts` - Conversational interactions
- **Plan Generation**: `v0/app/api/generate-plan/route.ts` - Training plan creation
- **Enhanced AI Coach**: `v0/lib/enhanced-ai-coach.ts` - Skill orchestration
- **Database**: `v0/lib/db.ts` - Dexie IndexedDB persistence
- **Analytics**: `v0/lib/analytics.ts` - PostHog event tracking
- **Monitoring**: `v0/lib/backendMonitoring.ts` - Performance and errors

## Platform-Specific Notes

**Windows 11 Development:**
- Use PowerShell syntax for commands
- Use `;` instead of `&&` for command chaining
- Use `New-Item` instead of `touch`
- File paths use backslashes `\` but work with forward slashes `/` in most tools

**Git Operations:**
- Repository root: `C:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/Running coach/Running-coach--2`
- Hebrew characters in path are handled correctly
- Use conventional commit messages: `feat(scope): description`

**IDE Integration:**
- Workspace root: Same as git root
- Terminals folder: `C:\Users\nadav\.cursor\projects\c-Users-nadav-OneDrive-AI-cursor-cursor-playground-Running-coach-Running-coach-2/terminals`
- Skills are auto-discovered from `.cursor/skills/` directory

## Quality Standards

**Before Committing:**
1. Run `npm run quality:check` from V0/ directory
2. Run `npm run ci:full` to verify all checks pass
3. Ensure no linter errors in modified files
4. Verify tests pass for affected components
5. Update documentation if APIs or schemas changed

**Code Style:**
- 2-space indentation
- Prettier formatting
- Prefer `const` over `let`
- No `console` except `warn`/`error`
- Remove unused variables and imports
- Use path aliases: `@/components`, `@/lib`

**Testing:**
- Unit tests with Vitest for logic and components
- E2E tests with Playwright for user flows
- Mock IndexedDB with `fake-indexeddb`
- Test both happy and error paths
- Verify data persistence and retrieval

## Additional Resources

- **Documentation**: `docs/` directory contains user stories and PRDs
- **Troubleshooting**: Various `*-FIX.md` and `*-GUIDE.md` files in root
- **Examples**: See `v0/e2e/` for end-to-end test examples
- **Scripts**: Helper scripts in `v0/scripts/` for common tasks
