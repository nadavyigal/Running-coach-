# RunSmart Skills Installation Summary

**Installation Date:** 2026-01-29
**Total Skills Installed:** 180+

---

## Skills Breakdown by Category

| Category | Count | Location |
|----------|-------|----------|
| Running Coach (Domain) | 12 | `.claude/skills/running-coach-*` |
| Solo Founder Toolkit | 7 | `.claude/skills/solo-founder/` |
| Marketing & Growth | 25 | `.claude/skills/marketing/` |
| Development Agents | 101 | `.claude/skills/development/` |
| Product & Design | 19 | `.claude/skills/product/` |
| Creative & Documents | 16 | `.claude/skills/creative/` |
| **Total** | **180** | |

---

## Detailed Category Breakdown

### 1. Running Coach Skills (12)
**Purpose:** Domain-specific AI skills for running coaching

- running-coach-index
- plan-generator, plan-adjuster
- conversational-goal-discovery
- readiness-check, workout-explainer
- post-run-debrief, run-insights-recovery
- load-anomaly-guard, adherence-coach
- race-strategy-builder, route-builder

**Usage:** Automatically invoked based on user context and requests

---

### 2. Solo Founder Toolkit (7)
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

### 3. Marketing & Growth (25)
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

### 4. Development Agents (101)
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

### 5. Product & Design (19)
**Purpose:** Product management, UX research, project management

**Product Team:**
- product-manager-toolkit
- product-strategist
- agile-product-owner
- ux-researcher-designer
- ui-design-system

**C-Level:**
- ceo-advisor (2 variations)
- cto-advisor

**Project Management:**
- Senior PM Expert
- Scrum Master Expert
- Jira Expert
- Confluence Expert
- Atlassian Administrator
- Template Creator Expert

**Source:** https://github.com/alirezarezvani/claude-skills

---

### 6. Creative & Documents (16)
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

## Quick Start Guide

### Testing Skills

```bash
# List all available skills
/skills

# Test solo founder skills
/solo-feature-ideas

# Test marketing skills
/page-cro

# Ask Claude to use skills
"What marketing skills do I have?"
"Help me prioritize features using the solo founder framework"
"Create a landing page for RunSmart"
```

### Common Use Cases for RunSmart

#### 1. Feature Prioritization
```
/solo-feature-ideas
```
Gets you LIC-scored feature suggestions based on codebase analysis.

#### 2. Landing Page Optimization
```
review my landing page at https://runsmartcoach.com
```
6 Conversion Pillars analysis with specific improvements.

#### 3. Marketing Content
```
/copywriting "running coach app homepage"
/email-sequence onboarding
/social-content LinkedIn
```

#### 4. Product Planning
```
Use product-manager-toolkit to create PRD
Use ux-researcher-designer for user personas
```

#### 5. Development
```
# Agents auto-invoke based on file context
# Editing Next.js → nextjs-architect
# React components → react-wizard
# Supabase → supabase-specialist
```

---

## Installation Sources

All skills were installed from verified GitHub repositories:

1. **Solo Founder:** ericvtheg/solo-founder-toolkit
2. **Marketing:** coreyhaines31/marketingskills
3. **Development:** lodetomasi/agents-claude-code
4. **Product:** alirezarezvani/claude-skills
5. **Creative:** anthropics/skills (Official)

---

## Next Steps

### Recommended Actions

1. **Test Key Skills**
   - Run `/solo-feature-ideas` to see feature prioritization
   - Try `/page-cro` on RunSmart landing page
   - Use `/copywriting` for marketing copy

2. **Integrate into Workflow**
   - Add `/solo-build-in-public-tweet` to git hooks
   - Use marketing skills for beta signup campaigns
   - Leverage product skills for roadmap planning

3. **Expand Analytics & DevOps**
   - Install Tinybird skills for analytics
   - Add Sentry skills for git workflow
   - Set up Vercel deployment skills

### Documentation

- **Full Catalog:** See `.claude/skills/README.md`
- **Installation Plan:** See plan file
- **Individual Skills:** Each skill has SKILL.md with detailed usage

---

## Version History

- **v2.0** (2026-01-29): Major expansion to 180+ skills
- **v1.0** (2026-01-23): Initial 12 running coach skills

---

## Resources

- [Awesome Claude Skills](https://github.com/VoltAgent/awesome-claude-skills) - 172+ curated skills
- [Agent Skills Standard](https://agentskills.io) - Open standard specification
- [Claude Code Docs](https://code.claude.com/docs/en/skills) - Official documentation
- [Skills Marketplace](https://www.aitmpl.com/skills) - Professional templates

---

**🎉 You now have a comprehensive AI cowork tailored for RunSmart development, marketing, and growth!**
