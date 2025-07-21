# PRD Shard 2: Success Metrics, Scope & User Personas

> **Source**: PRD v1.0 §§4-6  
> **Prepared by**: PM Agent · Date: 2025-07-07

---

## 4 · Success Metrics (North-Star & Guardrail)

### North-Star Metrics

| Metric                         | Target   | Source                                                            | Rationale |
| ------------------------------ | -------- | ----------------------------------------------------------------- | --------- |
| Weekly Plan-Completion (W1→W4) | ≥ 55%    | PostHog event `plan_session_completed` / `plan_session_scheduled` | Core value prop - habit formation |
| Day-30 Retention               | ≥ 40%    | PostHog cohort retention                                          | Sustainable user base |
| Avg. Daily Active Minutes      | ≥ 12 min | PostHog `$active_time`                                            | Engagement depth |
| Crash-free Sessions            | ≥ 99.6%  | Sentry                                                            | Technical reliability |

### Guardrail Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| App Store Rating | < 4.0 stars | Immediate UX review |
| Crash Rate | > 0.4% | Hotfix deployment |
| API Response Time | > 2s p95 | Performance optimization |
| OpenAI Cost | > $100/mo | Token usage review |

### Leading Indicators

| Indicator | Target | Frequency |
|-----------|--------|-----------|
| Onboarding Completion | ≥ 85% | Daily |
| First Run Within 7 Days | ≥ 75% | Weekly |
| Coach Interaction Rate | ≥ 60% | Weekly |
| Plan Adherence | ≥ 70% | Weekly |

---

## 5 · Scope (MVP)

### ✅ In Scope

#### **Core Screens (5)**
1. **Today Dashboard** - Main entry point, today's session, quick actions
2. **Plan Overview** - Weekly training plan, progress tracking
3. **Record Run** - GPS tracking, run logging, route exploration
4. **AI Coach Chat** - Adaptive coaching conversations
5. **Runner Onboarding** - 5-step wizard, goal setting, preferences

#### **Core Services**
- **Authentication** - User registration and profile management
- **Plan Generation** - AI-powered training plan creation
- **Run Logging** - GPS tracking and activity recording
- **Adaptive Coaching** - Personalized AI coaching engine
- **Chat Coach** - OpenAI GPT-4o integration
- **Route Explorer** - Beta feature for route discovery

#### **Key Features**
- **21-Day Rookie Challenge** - Seeded at onboarding for habit formation
- **Analytics** - PostHog cloud with autocapture + custom events
- **Privacy Compliance** - GDPR & US-CHD delete/export capabilities

#### **Technical Stack**
- **Frontend**: React Native with dark-first design
- **Backend**: Node.js/Express with PostgreSQL
- **AI**: OpenAI GPT-4o with $50/mo token budget
- **Analytics**: PostHog cloud with autocapture
- **Monitoring**: Sentry for crash reporting

### ❌ Out of Scope (Backlog)

#### **Monetization**
- Stripe paywall integration
- Premium feature gating
- Subscription management

#### **Hardware Integration**
- BLE sensor support
- Wearable device integration
- Heart rate monitoring

#### **Social Features**
- Community feed
- Friend connections
- Social sharing

#### **Advanced Features**
- Race prediction algorithms
- Advanced analytics dashboard
- Multi-sport support

---

## 6 · User Personas & JTBD

### Primary Personas

#### **Morning-Routine Rookie**
- **Demographics**: 25-35, urban, busy professional
- **Running Experience**: Beginner (0-6 months)
- **Motivation**: Health improvement, stress relief, routine building
- **Pain Points**: Time constraints, uncertainty about proper form, injury fear

**Jobs to be Done:**
- "Help me start & stick to a simple morning run without overthinking."
- "Give me confidence that I'm not going to hurt myself."
- "Make running feel like a natural part of my morning routine."
- "Show me progress without overwhelming me with data."

**Behavioral Patterns:**
- Prefers early morning runs (6-8 AM)
- Values simplicity and clear guidance
- Responds well to habit formation cues
- Limited time for complex planning

#### **Self-Improver Striver**
- **Demographics**: 30-45, suburban, goal-oriented
- **Running Experience**: Intermediate (6 months - 2 years)
- **Motivation**: Performance improvement, personal records, structured training
- **Pain Points**: Plateau periods, injury prevention, balancing intensity

**Jobs to be Done:**
- "Guide me to beat my 10K PB while avoiding injury and boredom."
- "Help me understand when to push and when to rest."
- "Provide structured training that adapts to my progress."
- "Keep me motivated during training plateaus."

**Behavioral Patterns:**
- Prefers structured training plans
- Values data and progress tracking
- Responds to performance-based motivation
- Has specific time-based goals

### Secondary Personas

#### **Comeback Runner**
- **Experience**: Returning after injury or long break
- **Primary Need**: Safe return to running
- **Key JTBD**: "Help me get back to running safely after my injury."

#### **Social Runner**
- **Experience**: Beginner to intermediate
- **Primary Need**: Community and accountability
- **Key JTBD**: "Help me stay motivated through group challenges and support."

### Persona Validation

| Persona | Validation Method | Success Criteria |
|---------|------------------|------------------|
| Morning-Routine Rookie | User interviews (n=20) | ≥80% identify with pain points |
| Self-Improver Striver | Survey (n=100) | ≥70% find JTBD relevant |
| Comeback Runner | Focus group (n=10) | ≥90% feel understood |
| Social Runner | Beta testing | ≥60% engage with social features |

---

## Assumptions & Constraints

### Technical Constraints
- **Mobile**: Bare React Native, dark-first design
- **LLM**: OpenAI GPT-4o, token budget of $50/mo (<5k MAU)
- **Performance**: App cold start < 1.5s; map FPS ≥ 50
- **Reliability**: 99.9% uptime; graceful degrade if OpenAI timeout

### Business Constraints
- **Team Velocity**: 24 story points / 2-week sprint
- **Beta Cohort**: 100 runners (70 EN, 30 HE) recruited via local clubs & Instagram ads
- **Budget**: $300 for Instagram ad recruitment
- **Timeline**: 10 sprints (20 weeks)

### Market Constraints
- **Competition**: Established apps with large user bases
- **Regulation**: GDPR compliance required
- **Platform**: iOS/Android app store requirements

---

*This shard covers what we're building (scope), who we're building for (personas), and how we'll measure success. See other shards for detailed requirements and implementation plans.* 