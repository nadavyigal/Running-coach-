# RunSmart Skills Installation Summary

**Last Updated:** 2026-06-20
**Opus 4.6 Agent Teams:** Enabled

---

## Skills Breakdown by Category

| Category | Count | Location |
|----------|-------|----------|
| Running Coach (Domain) | 12 | `.claude/skills/running-coach-*` and siblings |
| Agent Swarm & Operations | 7 | `.claude/skills/swarm-*`, `dev-swarm`, `ops-*`, `growth-*`, `pwa-*`, `community-*` |
| Solo Founder Toolkit | 3 | `.claude/skills/solo-founder/` |

> **2026-06-20 cleanup:** The imported **Marketing (25)**, **Creative (16)**, and **Product (7)** packs were removed from `.claude/skills/` — they duplicated capabilities available elsewhere and were flagged by SkillSpector (scores 80/100/100). See "Where those capabilities live now" below. The **same three packs were also removed from `.codex/skills/` and `.cursor/skills/`** so Codex and Cursor behave identically to Claude Code; those mirrors otherwise remain for running-domain and dev skills (and `solo-founder/`).

---

## Where those capabilities live now

| Removed pack | Use instead |
|---|---|
| Marketing | Agentic OS `.agents/skills/marketing/` (curated 12, scanned 0/100); full set archived at `Agentic OS/archive/marketingskills/skills/` |
| Product | Agentic OS `.agents/skills/product-management/` (8, scanned 0/100) |
| Creative (docx/pdf/pptx/xlsx/canvas/frontend-design) | `anthropic-skills` + `frontend-design` plugins (globally available, official) |

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

> Note: `marketing-swarm` is a swarm *orchestration pattern*, not part of the removed marketing pack — it is retained.

### How Agent Teams Work
1. **Team lead** (Opus 4.6): Plans, coordinates, synthesizes
2. **Teammates** (Sonnet or Opus): Execute specialized tasks in parallel
3. **Shared task list**: Tracks work with dependencies and status
4. **Inter-agent messaging**: Teammates communicate directly

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
**SkillSpector:** scanned SAFE (0/100)

---

## Solo Founder Toolkit (3)
**Purpose:** Rapid decision-making and validation for solo founders

**Skills:**
- solo-decision-framework
- solo-founder-anti-patterns
- solo-landing-page (6 Conversion Pillars)

**Source:** https://github.com/ericvtheg/solo-founder-toolkit
**SkillSpector:** 45/100 (CAUTION — mostly LOW findings + supply-chain links; retained, review before heavy use)

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
| Production release | **ops-deploy** | Parallel verification |
| Growth experiment | **growth-analytics** | Multiple channels |

### Cost Awareness
- Agent teams use 3-5x tokens vs single session
- Use Sonnet for implementation teammates (cost-efficient)
- Reserve Opus for lead + review roles
- Single session is better for simple/sequential tasks

---

## Configuration

### Settings (`.claude/settings.local.json`)
- Agent Teams: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Playwright browser automation enabled
- Supabase MCP server enabled

### Model Strategy
| Role | Recommended Model |
|------|-------------------|
| Team lead / architect | Opus |
| Code implementation | Sonnet |
| Code review / QA | Opus |
| Research / exploration | Sonnet |

---

## Installation Sources

1. **Running Coach (Custom):** Project-specific domain skills
2. **Swarm & Ops (Custom):** Opus agent team patterns
3. **Solo Founder:** ericvtheg/solo-founder-toolkit

Marketing / Product / Creative packs removed 2026-06-20 — see "Where those capabilities live now".

---

## Version History

- **v4.0** (2026-06-20): Removed imported Marketing/Creative/Product packs from `.claude/`, `.codex/`, and `.cursor/` (redundant + SkillSpector-flagged); capabilities relocated to Agentic OS skills + official plugins. Solo-founder trimmed to 3.
- **v3.0** (2026-02-08): Added 7 swarm/ops skills, enabled Agent Teams.
- **v2.0** (2026-01-29): Major expansion.
- **v1.0** (2026-01-23): Initial 12 running coach skills.
