# Cursor Agent Skills for Run-Smart

This directory contains specialized AI skills for the Run-Smart running coach application. Each skill provides structured, safe, and domain-specific AI capabilities.

## Overview

Skills are organized as individual directories, each containing:
- `SKILL.md` - Main skill definition and guidance
- `references/` - Supporting materials (schemas, examples, edge cases)

## Quick Start

1. **Read the index first**: Start with `running-coach-index/SKILL.md` to understand shared contracts and safety patterns
2. **Select appropriate skill**: Choose based on user need or development task
3. **Follow invocation guidance**: Each skill has specific input/output requirements
4. **Log telemetry**: All skills should emit standard events via `v0/lib/analytics.ts`

## Available Skills

**Total: 160+ Skills across 7 Categories**

### 1. Running Coach Domain Skills (12 skills)

#### Core Index
- **running-coach-index** - Catalog of all skills, shared contracts, telemetry, and safety guardrails

#### Planning & Generation (3 skills)
- **plan-generator** - Generates 14-21 day personalized training plans with safe load progression
- **plan-adjuster** - Recomputes upcoming workouts based on recent runs and feedback
- **conversational-goal-discovery** - Chat-based goal classification with constraint clarification

#### Pre-Run Assessment (2 skills)
- **readiness-check** - Pre-run safety gate evaluating readiness (proceed/modify/skip decisions)
- **workout-explainer** - Translates planned workouts into execution cues and purpose explanations

#### Post-Run Analysis (2 skills)
- **post-run-debrief** - Converts run telemetry into structured reflections with confidence scores
- **run-insights-recovery** - Analyzes completed runs for effort assessment and recovery recommendations

#### Safety & Monitoring (2 skills)
- **load-anomaly-guard** - Detects unsafe training load spikes (>20-30% week-over-week)
- **adherence-coach** - Identifies missed sessions and proposes plan reshuffles with motivational support

#### Advanced Features (2 skills)
- **race-strategy-builder** - Generates race-day pacing and fueling strategies
- **route-builder** - Generates route specifications with distance and elevation constraints

---

### 2. Solo Founder Toolkit (6 skills)
**Location:** `.cursor/skills/solo-founder/`

#### Commands
- **solo-feature-ideas** - LIC scoring for feature prioritization
- **solo-validate-idea** - Solo Founder Risk Index calculator
- **solo-build-in-public-tweet** - Convert commits to marketing tweets

#### Background Skills
- **solo-decision-framework** - Rapid prioritization methodology
- **solo-founder-anti-patterns** - Recognize common startup pitfalls
- **solo-landing-page** - 6 Conversion Pillars optimization

#### Agents
- **Landing Page Reviewer** - Analyzes landing pages for conversions

---

### 3. Marketing & Growth (25 skills)
**Location:** `.cursor/skills/marketing/`

#### Conversion Optimization (6)
- page-cro, signup-flow-cro, onboarding-cro, form-cro, popup-cro, paywall-upgrade-cro

#### Content & Copy (4)
- copywriting, copy-editing, email-sequence, social-content

#### SEO & Discovery (4)
- seo-audit, programmatic-seo, competitor-alternatives, schema-markup

#### Paid & Distribution (2)
- paid-ads, social-content

#### Measurement (2)
- analytics-tracking, ab-test-setup

#### Growth Engineering (2)
- free-tool-strategy, referral-program

#### Strategy (5)
- marketing-ideas, marketing-psychology, launch-strategy, pricing-strategy, product-marketing-context

---

### 4. Development Agents (100+ agents)
**Location:** `.cursor/skills/development/`

**Notable agents include:**
- react-wizard, nextjs-architect, supabase-specialist, database-wizard
- aws-architect, azure-specialist, gcp-architect
- docker-captain, kubernetes-commander, devops-maestro
- python-expert, typescript-guru, golang-master
- security-sentinel, accessibility-guardian, performance-optimizer

Full list: 100+ specialized technology agents for all major frameworks, languages, and platforms.

---

### 5. Product & Design (16 skills)
**Location:** `.cursor/skills/product/`

#### Product Team
- **product-manager-toolkit** - Feature prioritization, PRDs, discovery
- **product-strategist** - OKR cascading, vision frameworks
- **agile-product-owner** - Sprint execution, backlog management
- **ux-researcher-designer** - User research, personas, journey mapping
- **ui-design-system** - Design tokens, component architecture

#### C-Level Advisory (2)
- **ceo-advisor** - Strategic decision-making, stakeholder management
- **cto-advisor** - Technical leadership, architecture decisions

#### Project Management (6+)
- Senior PM, Scrum Master, Jira Expert, Confluence Expert, Atlassian Admin, Template Creator

---

### 6. Creative & Document Skills (16 skills)
**Location:** `.cursor/skills/creative/`

**Official Anthropic Skills:**
- **docx** - Word document creation & editing
- **pdf** - PDF manipulation
- **pptx** - PowerPoint presentations
- **xlsx** - Excel spreadsheets
- **canvas-design** - Visual art in PNG/PDF
- **algorithmic-art** - Generative art with p5.js
- **frontend-design** - UI/UX development
- **brand-guidelines** - Anthropic branding
- **theme-factory** - Professional themes
- **slack-gif-creator** - Animated GIFs
- **web-artifacts-builder** - Complex HTML artifacts
- **webapp-testing** - Playwright testing
- **mcp-builder** - MCP server creation
- **doc-coauthoring** - Collaborative documents
- **internal-comms** - Status reports, newsletters
- **skill-creator** - Skill creation guide

---

### 7. Analytics & DevOps
**Location:** `.cursor/skills/analytics/` & `.cursor/skills/devops/`

Currently empty - can be populated with:
- Tinybird skills for analytics pipelines
- Sentry skills for code review, commits, PRs
- Vercel deployment skills
- PostHog analytics configurations

## Skill Selection Guide

### User asks for training plan
→ Use **plan-generator**

### User completed a run
→ Use **run-insights-recovery** or **post-run-debrief**

### User asks "should I run today?"
→ Use **readiness-check**

### User asks about a workout
→ Use **workout-explainer**

### User missed multiple sessions
→ Use **adherence-coach**

### User wants race strategy
→ Use **race-strategy-builder**

### User needs route suggestions
→ Use **route-builder**

### Background load monitoring
→ Use **load-anomaly-guard**

### Plan needs adjustment
→ Use **plan-adjuster**

### User setting goals in chat
→ Use **conversational-goal-discovery**

## Universal Safety Rules

1. **No Medical Diagnosis**: Never provide medical advice or diagnosis
2. **Conservative Defaults**: Under uncertainty, prefer safer, more conservative options
3. **SafetyFlags**: Emit structured safety flags when thresholds are crossed
4. **Pain/Injury Signals**: If user reports pain, dizziness, or severe symptoms, advise stopping and consulting a professional
5. **Load Management**: Enforce hard caps on weekly volume changes (typically <20-30%)

## Shared Resources

All skills use standardized contracts and telemetry defined in:
- `running-coach-index/references/contracts.md` - TypeScript interfaces
- `running-coach-index/references/telemetry.md` - Event logging patterns
- `running-coach-index/references/conventions.md` - Design patterns
- `running-coach-index/references/smoke-tests.md` - Validation scenarios

## Integration Points

Skills integrate with:
- **Chat API**: `v0/app/api/chat/route.ts`
- **Plan Generation**: `v0/app/api/generate-plan/route.ts`
- **Enhanced AI Coach**: `v0/lib/enhanced-ai-coach.ts`
- **Database**: `v0/lib/db.ts` (Dexie IndexedDB)
- **Analytics**: `v0/lib/analytics.ts` (PostHog)
- **Monitoring**: `v0/lib/backendMonitoring.ts`

## Development Guidelines

### Adding a New Skill
1. Create directory: `.cursor/skills/skill-name/`
2. Write `SKILL.md` with metadata and guidance
3. Create `references/` with schemas and examples
4. Update `running-coach-index/SKILL.md`
5. Update `CURSOR.md` root file
6. Add integration code in relevant APIs
7. Add tests
8. Document in this README

### Testing Skills
- Use smoke tests from `running-coach-index/references/smoke-tests.md`
- Verify safety guardrails with edge case inputs
- Test fallback behavior when data is missing
- Validate telemetry event emission
- Check SafetyFlag generation for risky scenarios

## File Structure

```
.cursor/skills/
├── README.md (this file)
├── running-coach-index/
│   ├── SKILL.md
│   └── references/
│       ├── contracts.md
│       ├── telemetry.md
│       ├── conventions.md
│       └── smoke-tests.md
├── plan-generator/
│   ├── SKILL.md
│   └── references/
├── plan-adjuster/
│   ├── SKILL.md
│   └── references/
├── conversational-goal-discovery/
│   ├── SKILL.md
│   └── references/
├── readiness-check/
│   ├── SKILL.md
│   └── references/
├── workout-explainer/
│   ├── SKILL.md
│   └── references/
├── post-run-debrief/
│   ├── SKILL.md
│   └── references/
├── run-insights-recovery/
│   ├── SKILL.md
│   └── references/
├── load-anomaly-guard/
│   ├── SKILL.md
│   └── references/
├── adherence-coach/
│   ├── SKILL.md
│   └── references/
├── race-strategy-builder/
│   ├── SKILL.md
│   └── references/
└── route-builder/
    ├── SKILL.md
    └── references/
```

## How to Use New Skills

### Solo Founder Skills
```bash
# Feature prioritization
/solo-feature-ideas

# Validate new ideas
/solo-validate-idea

# Generate build-in-public content
/solo-build-in-public-tweet

# Review landing pages (provide URL)
review my landing page at https://runsmartcoach.com
```

### Marketing Skills
```bash
# Optimize landing page
/page-cro index.html

# Improve signup flow
/signup-flow-cro

# Write marketing copy
/copywriting "running coach app for beginners"

# SEO audit
/seo-audit

# Create email sequence
/email-sequence onboarding
```

### Development Agents
Agents are automatically invoked when working on relevant technologies:
- Editing Next.js files → `nextjs-architect` agent
- React components → `react-wizard` agent
- Supabase queries → `supabase-specialist` agent
- Database schema → `database-wizard` agent

### Product Skills
```bash
# Product management
Use product-manager-toolkit for PRDs and feature prioritization

# UX research
Leverage ux-researcher-designer for user personas and journey maps
```

### Creative Skills
```bash
# Create documents
/docx - Word documents
/pdf - PDF files
/pptx - Presentations
/xlsx - Spreadsheets

# Design work
/canvas-design - Visual art
/frontend-design - UI/UX components
```

## Skills Discovery

To see all available skills:
```bash
/skills
```

To search for specific skills:
```bash
# In your conversation with Claude
"What skills are available for marketing?"
"Show me all SEO-related skills"
"Which skills help with startup growth?"
```

## Version History

- **v1.0** (2026-01-23): Initial Cursor Agent skills system with 12 core running coach skills
- **v2.0** (2026-01-29): Major expansion with 160+ skills across 7 categories:
  - Solo Founder Toolkit (6 skills)
  - Marketing & Growth (25 skills)
  - Development Agents (100+ skills)
  - Product & Design (16 skills)
  - Creative & Document (16 skills)
  - Analytics & DevOps (ready for expansion)

## Additional Documentation

- **Main guidance**: See `CURSOR.md` in repository root
- **Architecture**: See `CLAUDE.md` and `AGENTS.md` for technical details
- **Project setup**: See `README.md` in `V0/` directory
- **Skills Plan**: See plan file for detailed installation steps and skill descriptions
