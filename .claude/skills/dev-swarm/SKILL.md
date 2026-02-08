---
name: dev-swarm
description: >
  Parallel development workflow using agent teams for RunSmart features.
  Spawns specialized teammates (architect, frontend, backend, QA) that coordinate
  via shared task lists. Use for multi-file features, epic implementation,
  or any development task benefiting from parallel execution.
metadata:
  short-description: Multi-agent development with architect, frontend, backend, and QA specialists.
---

## When Claude should use this skill
- Implementing a full epic or multi-story feature
- Building features that span components, API routes, database, and tests
- Refactoring across multiple modules simultaneously
- When user says "build this feature" and it touches 4+ files

## Team Composition

### Standard Feature Team (4 agents)
| Role | Model | Scope | Files Owned |
|------|-------|-------|-------------|
| Architect (lead) | Opus 4.6 | Design, coordinate, review | docs/, schemas |
| Frontend | Sonnet | Components, pages, styles | components/, app/(screens) |
| Backend | Sonnet | API routes, lib utilities | app/api/, lib/ |
| QA | Sonnet | Tests, validation | *.test.tsx, *.test.ts |

### Lightweight Feature Team (2 agents)
| Role | Model | Scope |
|------|-------|-------|
| Implementer (lead) | Opus 4.6 | Build feature end-to-end |
| Reviewer | Opus 4.6 | Review, test, verify |

## Workflow

### Phase 1: Planning (Lead only)
1. Load running-coach-index contracts
2. Read relevant epic/story from `docs/`
3. Break feature into 5-8 tasks with dependencies
4. Create shared task list

### Phase 2: Parallel Implementation
1. Spawn teammates with specific file ownership
2. Each teammate claims and completes tasks
3. Teammates message lead when blocked or need clarification
4. Lead monitors progress, redirects as needed

### Phase 3: Integration & Verification
1. QA teammate runs `npm run test -- --run`
2. QA teammate runs `npm run lint && npx tsc --noEmit`
3. Lead reviews all changes holistically
4. Lead synthesizes into commit message

## RunSmart-Specific Patterns

### Database + UI Feature
```
Tasks:
1. [Backend] Add interface to lib/db.ts, utility to lib/dbUtils.ts
2. [Backend] Create API route in app/api/
3. [Frontend] Build screen component (blocked by task 1)
4. [Frontend] Add navigation and state management (blocked by task 3)
5. [QA] Write unit tests for utility (blocked by task 2)
6. [QA] Write component tests (blocked by task 4)
```

### AI Integration Feature
```
Tasks:
1. [Backend] Define Zod schema for structured AI output
2. [Backend] Create API route with rate limiting (blocked by task 1)
3. [Frontend] Build UI for AI interaction (parallel with task 2)
4. [Backend] Add fallback for AI service unavailability
5. [QA] Test with mock AI responses (blocked by tasks 2, 3)
```

## Quality Gates
- All tests must pass before marking feature complete
- TypeScript strict mode — zero type errors
- ESLint clean — zero warnings
- No teammate verifies its own code

## Integration Points
- Database: `V0/lib/db.ts`, `V0/lib/dbUtils.ts`
- API routes: `V0/app/api/`
- Components: `V0/components/`
- Tests: co-located `*.test.tsx` files
- Config: `V0/vitest.config.ts`, `V0/next.config.ts`
