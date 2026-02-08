# RunSmart Skills Installation Summary

**Last Updated:** 2026-02-08
**Total Skills Installed:** 190+
**Opus 4.6 Agent Teams:** Enabled

---

## Skills Breakdown by Category

| Category | Count | Location |
|----------|-------|----------|
| Running Coach (Domain) | 12 | `.claude/skills/running-coach-*` |
| Agent Swarm & Operations | 7 | `.claude/skills/swarm-*`, `dev-swarm`, `ops-*`, `growth-*`, `pwa-*`, `community-*` |
| Solo Founder Toolkit | 7 | `.claude/skills/solo-founder/` |
| Marketing & Growth | 25 | `.claude/skills/marketing/` |
| Development Agents | 101 | `.claude/skills/development/` |
| Product & Design | 19 | `.claude/skills/product/` |
| Creative & Documents | 16 | `.claude/skills/creative/` |
| **Total** | **187+** | |

---

## NEW: Agent Teams (Swarm) Skills — Opus 4.6

These skills leverage Claude Code's experimental Agent Teams feature for parallel
multi-agent workflows. Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

### Swarm Orchestration (7 skills)

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **swarm-orchestrator** | Master coordination patterns | Any multi-agent task |
| **dev-swarm** | Parallel dev (architect/frontend/backend/QA) | Multi-file features, epics |
| **marketing-swarm** | Multi-channel campaigns | Product launches, content pushes |
| **ops-deploy** | Deployment & production operations | Releases, incidents |
| **growth-analytics** | Metrics, funnels, experiments | Analytics setup, growth optimization |
| **pwa-distribution** | App store optimization & distribution | PWA install, Play Store, ASO |
| **community-growth** | User acquisition & community | Growth strategy, referrals, Strava |

### How Agent Teams Work
1. **Team lead** (Opus 4.6): Plans, coordinates, synthesizes
2. **Teammates** (Sonnet or Opus): Execute specialized tasks in parallel
3. **Shared task list**: Tracks work with dependencies and status
4. **Inter-agent messaging**: Teammates communicate directly

### Quick Start
```
# Feature build with parallel agents
"Create an agent team with architect, frontend, backend, and QA
teammates to implement [feature]. Use dev-swarm patterns."

# Marketing launch
"Create an agent team for RunSmart launch campaign.
Use marketing-swarm patterns with copy, SEO, social, and email specialists."

# Bug investigation with competing hypotheses
"Create an agent team to investigate [bug] from 3 different angles.
Have them challenge each other's theories."
```

---

## Running Coach Skills (12)
**Purpose:** Domain-specific AI skills for running coaching

- running-coach-index (master catalog + shared contracts)
- plan-generator, plan-adjuster
- conversational-goal-discovery
- readiness-check, workout-explainer
- post-run-debrief, run-insights-recovery
- load-anomaly-guard, adherence-coach
- race-strategy-builder, route-builder

**Usage:** Automatically invoked based on user context and requests

---

## Solo Founder Toolkit (7)
**Purpose:** Rapid decision-making and validation for solo founders

**Commands:**
- `/solo-feature-ideas` - LIC scoring prioritization
- `/solo-validate-idea` - SFRI calculator
- `/solo-build-in-public-tweet` - Marketing content from commits

**Skills:**
- solo-decision-framework
- solo-founder-anti-patterns
- solo-landing-page (6 Conversion Pillars)

**Source:** https://github.com/ericvtheg/solo-founder-toolkit

---

## Marketing & Growth (25)
**Purpose:** CRO, SEO, content, and growth marketing

**Conversion (6):**
- page-cro, signup-flow-cro, onboarding-cro
- form-cro, popup-cro, paywall-upgrade-cro

**Content (4):**
- copywriting, copy-editing
- email-sequence, social-content

**SEO (4):**
- seo-audit, programmatic-seo
- competitor-alternatives, schema-markup

**Growth (11):**
- paid-ads, analytics-tracking, ab-test-setup
- free-tool-strategy, referral-program
- marketing-ideas, marketing-psychology
- launch-strategy, pricing-strategy
- product-marketing-context, content-strategy

**Source:** https://github.com/coreyhaines31/marketingskills

---

## Development Agents (101)
**Purpose:** Specialized agents for all major technologies

**Frontend:**
- react-wizard, nextjs-architect, angular-authority
- vue-virtuoso, svelte-specialist
- flutter-expert, react-native-master

**Backend:**
- nodejs-expert, python-expert, golang-master
- django-master, fastapi-expert, flask-artisan
- express-engineer, ruby-wizard

**Database:**
- database-wizard, supabase-specialist
- postgresql-guru, mongodb-master
- elasticsearch-expert, redis-commander

**Cloud & DevOps:**
- aws-architect, azure-specialist, gcp-architect
- docker-captain, kubernetes-commander
- terraform-expert, ansible-automation

**Specialized:**
- accessibility-guardian, security-sentinel
- performance-optimizer, api-archaeologist
- data-detective, ml-engineer

**Source:** https://github.com/lodetomasi/agents-claude-code

---

## Product & Design (19)
**Purpose:** Product management, UX research, project management

**Product Team:**
- product-manager-toolkit, product-strategist
- agile-product-owner, ux-researcher-designer
- ui-design-system

**C-Level:**
- ceo-advisor (2 variations), cto-advisor

**Project Management:**
- Senior PM Expert, Scrum Master Expert
- Jira Expert, Confluence Expert
- Atlassian Administrator, Template Creator Expert

**Source:** https://github.com/alirezarezvani/claude-skills

---

## Creative & Documents (16)
**Purpose:** Official Anthropic skills for document creation and design

**Documents:**
- docx (Word), pdf, pptx (PowerPoint), xlsx (Excel)
- doc-coauthoring

**Design:**
- canvas-design, algorithmic-art
- frontend-design, theme-factory
- brand-guidelines, slack-gif-creator

**Development:**
- web-artifacts-builder
- webapp-testing (Playwright)
- mcp-builder

**Meta:**
- skill-creator, internal-comms

**Source:** https://github.com/anthropics/skills

---

## Swarm Patterns Quick Reference

### When to Use Agent Teams vs Single Session

| Scenario | Use | Why |
|----------|-----|-----|
| Fix a typo | Single session | No coordination benefit |
| Add a component | Single session | One file, sequential |
| Full feature (5+ files) | **dev-swarm** | Parallel specialists |
| Multi-channel campaign | **marketing-swarm** | Independent channels |
| Bug with unclear cause | **swarm-orchestrator** | Competing hypotheses |
| Code review (thorough) | **swarm-orchestrator** | Multiple perspectives |
| Production release | **ops-deploy** | Parallel verification |
| Growth experiment | **growth-analytics** | Multiple channels |

### Cost Awareness
- Agent teams use 3-5x tokens vs single session
- Use Sonnet for implementation teammates (cost-efficient)
- Reserve Opus 4.6 for lead + review roles
- Single session is better for simple/sequential tasks

---

## Configuration

### Settings (`.claude/settings.local.json`)
- Agent Teams: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Playwright browser automation enabled
- Supabase MCP server enabled
- Full git, npm, and build permissions

### Model Strategy
| Role | Recommended Model |
|------|-------------------|
| Team lead / architect | Opus 4.6 |
| Code implementation | Sonnet |
| Code review / QA | Opus 4.6 |
| Research / exploration | Sonnet |
| Marketing copy | Sonnet |

---

## Installation Sources

All skills were installed from verified sources:

1. **Running Coach (Custom):** Project-specific domain skills
2. **Swarm & Ops (Custom):** Opus 4.6 agent team patterns
3. **Solo Founder:** ericvtheg/solo-founder-toolkit
4. **Marketing:** coreyhaines31/marketingskills
5. **Development:** lodetomasi/agents-claude-code
6. **Product:** alirezarezvani/claude-skills
7. **Creative:** anthropics/skills (Official)

---

## Version History

- **v3.0** (2026-02-08): Added 7 swarm/ops skills, enabled Agent Teams for Opus 4.6
- **v2.0** (2026-01-29): Major expansion to 180+ skills
- **v1.0** (2026-01-23): Initial 12 running coach skills
