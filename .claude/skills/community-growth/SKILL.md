---
name: community-growth
description: >
  Community building and user acquisition strategies for RunSmart. Covers
  running community engagement, Strava integration, referral programs,
  content-led growth, influencer partnerships, and grassroots marketing
  in running communities. Use when planning user acquisition, community
  features, or organic growth strategies.
metadata:
  short-description: Grow RunSmart through running communities, referrals, and organic channels.
---

## When Claude should use this skill
- Planning user acquisition channels
- Building community features (challenges, leaderboards, groups)
- Designing referral or sharing mechanics
- Creating partnerships with running communities
- Content marketing for organic discovery
- User asks "how do we get users" or "growth strategy"

## Running Community Landscape

### Digital Communities (High Priority)
| Platform | Audience Size | Strategy |
|----------|--------------|----------|
| Strava | 120M+ users | Club, challenges, API integration |
| Reddit r/running | 3M+ subscribers | Value-first content, no spam |
| Reddit r/C25K | 500K+ | Beginner-focused tips, app mention in context |
| Parkrun | 9M+ globally | Local community partnerships |
| Instagram #running | 100M+ posts | Visual content, runner stories |
| Twitter/X running | Active community | Thread-based education content |
| YouTube running | Growing fast | Tutorial/review content |

### In-Person Communities
- Local running clubs
- Parkrun events
- Marathon/race expos
- Running specialty stores
- University running groups

## Growth Channels

### Channel 1: Strava Integration
- Create official RunSmart Strava Club
- Sync run data via Strava API
- Weekly challenges visible on Strava
- Auto-post RunSmart achievements to Strava

### Channel 2: Content-Led Growth (SEO)
**Pillar content strategy:**
1. "Complete Guide to Training Plans" → links to plan-generator
2. "How AI is Changing Running Coaching" → thought leadership
3. "Recovery Science for Runners" → links to recovery features
4. "From Couch to 5K: Week-by-Week Guide" → onboarding funnel
5. "Marathon Training: 16-Week Plan" → advanced funnel

### Channel 3: Referral Program
```
Mechanic: "Invite a running buddy"
- Sharer gets: Premium feature unlock (1 month)
- Invitee gets: Personalized welcome + buddy connection
- Viral coefficient target: 0.3 (each user invites 0.3 new users)
```

### Channel 4: Social Proof & UGC
- Post-run share cards (beautiful, branded)
- Achievement badges shareable to social
- "Trained with RunSmart" Strava description
- Runner transformation stories

### Channel 5: Partnerships
- **Running influencers**: Micro-influencers (5K-50K followers)
- **Coaches**: Free premium tier for certified coaches
- **Events**: Sponsor local 5K/10K events
- **Brands**: Co-marketing with running shoe/gear brands

## Community Features Roadmap

### Phase 1: Social Sharing (MVP)
- Share run summary card (image)
- Share training plan highlights
- Basic invite link with tracking

### Phase 2: In-App Community
- Running challenges (weekly distance, streak)
- Leaderboards (opt-in, supportive tone)
- Training buddy matching
- Group challenges for teams/clubs

### Phase 3: Platform
- Coach marketplace
- Community-created plans
- Race event integration
- Local running group discovery

## User Acquisition Funnel
```
Awareness (content, social, word-of-mouth)
  → Landing page visit
    → PWA install / signup
      → Onboarding complete
        → First plan generated
          → First run recorded
            → Week 2 retention (activated user)
              → Referral / share (growth loop)
```

## Retention Through Community
- **Daily**: Today's workout from AI coach
- **Weekly**: Progress summary, community challenge update
- **Monthly**: Achievement review, plan milestone
- **Social**: Running buddy accountability, group challenges

## Metrics
| Metric | Target | Timeline |
|--------|--------|----------|
| Strava Club members | 500 | 3 months |
| Referral rate | 15% of users send invite | 6 months |
| Viral coefficient | 0.3 | 6 months |
| Organic traffic | 5K visits/month | 6 months |
| Community NPS | 50+ | 3 months |

## Agent Team Pattern: Growth Sprint
```
Create an agent team for growth sprint:
- Content teammate: write 3 SEO pillar articles
- Social teammate: create 2-week social content calendar
- Product teammate: implement share card and referral link
- Analytics teammate: set up funnel tracking for all channels
```

## Integration Points
- Sharing: `V0/components/ShareCard.tsx`
- Referral: `V0/lib/referral.ts`
- Analytics: `V0/lib/analytics.ts`
- Strava: `V0/lib/strava-api.ts` (future)
- Content: `V0/app/(public)/blog/` (future)
