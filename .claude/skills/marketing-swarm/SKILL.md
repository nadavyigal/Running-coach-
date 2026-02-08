---
name: marketing-swarm
description: >
  Coordinated multi-agent marketing campaigns for RunSmart. Spawns specialist
  teammates for copywriting, SEO, social media, email sequences, and analytics.
  Use for product launches, content campaigns, growth experiments, or any
  marketing effort requiring parallel channel execution.
metadata:
  short-description: Multi-agent marketing with copy, SEO, social, email, and analytics specialists.
---

## When Claude should use this skill
- Launching RunSmart to a new market or audience
- Creating coordinated multi-channel marketing campaigns
- Preparing app store listings, landing pages, and social presence
- Running growth experiments across multiple channels
- User asks for "marketing plan" or "launch strategy"

## Team Compositions

### Full Launch Swarm (5 agents)
| Role | Focus | Outputs |
|------|-------|---------|
| Strategist (lead) | Campaign strategy, messaging, positioning | Campaign brief, timeline |
| Copywriter | Headlines, body copy, CTAs | Landing page copy, app descriptions |
| SEO Specialist | Keywords, schema, meta tags | SEO audit, keyword map, structured data |
| Social & Community | Platform-specific content | Post calendar, thread scripts, community plan |
| Email & Retention | Sequences, triggers, segmentation | Welcome series, re-engagement flows |

### Content Sprint Swarm (3 agents)
| Role | Focus | Outputs |
|------|-------|---------|
| Strategist (lead) | Content calendar, topics | Editorial calendar |
| Writer | Blog posts, guides | Long-form content drafts |
| Distributor | Repurpose, schedule | Social snippets, email digests |

## RunSmart Campaign Templates

### Template 1: App Launch
```
Campaign: RunSmart PWA Launch
Target: Beginner runners, ages 25-45, mobile-first
Channels: App Store (PWA), Social (Twitter, Instagram, Strava), SEO, Email

Tasks:
1. [Strategist] Define positioning: "AI running coach in your pocket"
2. [Copywriter] Homepage hero copy + 3 feature sections (blocked by 1)
3. [Copywriter] App store/PWA description + screenshots plan (blocked by 1)
4. [SEO] Keyword research: running coach, training plan, couch to 5k
5. [SEO] Schema markup for app, FAQ, how-to (blocked by 4)
6. [Social] Launch thread for Twitter/X (blocked by 2)
7. [Social] Strava club setup + community guidelines
8. [Email] Welcome sequence: onboarding → first plan → first run (blocked by 2)
```

### Template 2: Feature Announcement
```
Campaign: [New Feature] Announcement
Tasks:
1. [Strategist] Value prop for feature, target segment
2. [Copywriter] In-app announcement + changelog entry
3. [Social] Announcement posts per platform
4. [Email] Feature highlight email to existing users
```

### Template 3: Content-Led Growth
```
Campaign: SEO + Content for organic growth
Tasks:
1. [SEO] Keyword gap analysis vs competitors (Nike Run Club, Strava, Runkeeper)
2. [Writer] 5 pillar articles: training plans, recovery, GPS tracking, coaching, motivation
3. [SEO] Internal linking strategy + meta optimization (blocked by 2)
4. [Distributor] Social snippets from each article (blocked by 2)
5. [Email] Content digest for subscribers (blocked by 2)
```

## Channel-Specific Guidelines

### PWA Distribution
- Web install prompt optimization (beforeinstallprompt)
- Google Play Store via TWA (Trusted Web Activity)
- Apple "Add to Home Screen" guidance
- PWA listing on stores.pwabuilder.com

### Running Community Channels
- **Strava**: Club, segments, challenges
- **Reddit**: r/running, r/C25K, r/AdvancedRunning
- **Parkrun**: Local community partnerships
- **Running forums**: LetsRun, Fellrnr

### SEO for Running Coach Apps
- Target long-tail: "free AI running coach app", "personalized training plan"
- Programmatic SEO: city-specific pages ("running coach [city]")
- FAQ schema for common questions
- How-to schema for training guides

## Messaging Framework
```
Primary: "Your AI running coach — personalized plans that adapt to you"
Secondary: "Train smarter, not harder"
Proof points:
- AI-powered personalized training plans
- Adapts to your progress and recovery
- Works offline as a PWA
- Free to start, no equipment needed
```

## Metrics & Success Criteria
- Landing page → install conversion: target 15%+
- Email open rates: target 35%+
- Social engagement rate: target 3%+
- Organic traffic growth: 20% month-over-month
- App installs: 200/month from organic

## Integration with Existing Skills
- Use `copywriting` skill for headline/CTA generation
- Use `seo-audit` skill for technical SEO checks
- Use `email-sequence` skill for drip campaign design
- Use `social-content` skill for platform-specific posts
- Use `pricing-strategy` skill for monetization planning
- Use `launch-strategy` skill for go-to-market timeline
