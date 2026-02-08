---
name: swarm-orchestrator
description: >
  Master multi-agent orchestration for RunSmart using Claude Code Agent Teams.
  Coordinates parallel specialists across development, marketing, QA, and operations.
  Use when tasks benefit from divide-and-conquer: feature builds, marketing campaigns,
  bug investigations, code reviews, or any work spanning multiple domains.
metadata:
  short-description: Orchestrate agent teams for parallel RunSmart development, marketing, and ops.
---

## Purpose
Provides patterns and instructions for running Claude Code Agent Teams (swarms)
optimized for the RunSmart running coach PWA. Leverages Opus 4.6 native agent
teams with shared task lists, inter-agent messaging, and coordinated workflows.

## When Claude should use this skill
- User requests parallel work across multiple files or domains
- Complex features spanning frontend, backend, AI, and tests
- Marketing campaign launches requiring copy, SEO, social, and analytics simultaneously
- Bug investigations benefiting from competing hypotheses
- Code reviews needing security, performance, and UX perspectives
- Any task where coordination overhead is justified by parallel speedup

## Prerequisites
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings (already configured)
- Opus 4.6 model for team lead (maximizes planning quality)
- Sonnet for teammates when speed > depth (cost optimization)

## Swarm Patterns for RunSmart

### Pattern 1: Feature Build Swarm
Best for new features (epics, stories) that span multiple layers.

```
Create an agent team for [feature name]:
- Architect teammate: design data schema, API routes, component structure
- Frontend teammate: implement React components and screens
- Backend teammate: implement API routes and database operations
- QA teammate: write tests and verify integration
Require plan approval from architect before frontend/backend proceed.
```

**Task dependencies:** Architect → (Frontend | Backend) → QA

### Pattern 2: Marketing Launch Swarm
Best for coordinated marketing pushes across channels.

```
Create an agent team for RunSmart marketing launch:
- Copywriter teammate: homepage copy, app store description, email sequences
- SEO teammate: schema markup, meta tags, programmatic SEO pages
- Social teammate: Twitter/X threads, LinkedIn posts, Reddit content
- Analytics teammate: tracking setup, conversion funnels, A/B test config
Each teammate works independently, lead synthesizes into launch checklist.
```

### Pattern 3: Bug Investigation Swarm
Best when root cause is unclear and multiple hypotheses exist.

```
Create an agent team to investigate [bug description]:
- Hypothesis A teammate: investigate [theory 1]
- Hypothesis B teammate: investigate [theory 2]
- Hypothesis C teammate: investigate [theory 3]
Have them challenge each other's theories. Update findings doc with consensus.
```

### Pattern 4: Code Review Swarm
Best for thorough PR review across multiple dimensions.

```
Create an agent team to review the changes in [branch/PR]:
- Security reviewer: auth, input validation, XSS, injection
- Performance reviewer: bundle size, render cycles, database queries
- UX reviewer: mobile-first, PWA patterns, offline support
- Domain reviewer: running coach logic, safety guardrails, AI integration
```

### Pattern 5: Release Preparation Swarm
Best for coordinating a production release.

```
Create an agent team for release preparation:
- Build teammate: run full build, fix errors, verify bundle
- Test teammate: run all test suites, fix failures
- Deploy teammate: prepare Vercel config, environment variables
- Docs teammate: update changelog, API docs, user-facing help
```

## Effort Budgeting
- **Team lead**: Always Opus 4.6, maximum effort (strategic planning)
- **Architecture/research teammates**: Opus 4.6 or Sonnet (depends on complexity)
- **Implementation teammates**: Sonnet (speed-optimized execution)
- **Review/QA teammates**: Opus 4.6 (thoroughness matters)

## File Conflict Prevention
- Each teammate should own distinct file sets
- Frontend teammate: `components/`, `app/` pages
- Backend teammate: `app/api/`, `lib/` utilities
- Test teammate: `*.test.tsx`, `*.test.ts` files
- Never assign same file to multiple teammates

## Coordination Rules
1. Lead creates shared task list before spawning teammates
2. Tasks have explicit dependencies (blocked-by relationships)
3. No teammate verifies its own work — separate verification agent required
4. Lead synthesizes results after all teammates complete
5. Clean up team resources when done

## Integration with RunSmart Skills
All teammates inherit project skills (running-coach-index, plan-generator, etc.)
via CLAUDE.md and .claude/skills/. Domain-specific teammates should reference
relevant skills:
- Feature teammates → running-coach-index contracts
- Marketing teammates → marketing/* skills
- Product teammates → product/* skills
- Solo decisions → solo-founder/* skills

## Safety
- Never run agent teams for trivial single-file changes
- Monitor token usage — teams cost 3-5x a single session
- Always verify teammate outputs before merging
- Use plan approval mode for high-risk changes (database schema, auth)
