# Week 1 GTM Deployment Checklist - Run-Smart
**Date:** December 23, 2025
**Target:** Deploy landing page and beta signup by Day 4-5

---

## STATUS UPDATE (Dec 29, 2025) - READY TO LAUNCH! 🚀

### ✅ COMPLETED SINCE LAST UPDATE:
- ✅ Supabase waitlist storage (migrations 001-005 applied)
- ✅ Confirmation email on beta signup (includes onboarding link)
- ✅ Privacy Policy + Terms published (Dec 25, 2025)
- ✅ CSP updated to allow GA/Tag Manager
- ✅ Email templates implemented (Welcome + Beta Waitlist)
- ✅ Beta signup API wired to send emails
- ✅ PostHog API key configured locally
- ✅ Site deployed and live at runsmart-ai.com
- ✅ End-to-end signup flow tested and working

### ⚠️ PENDING (Non-Blockers):
- ⚠️ Resend DKIM DNS record (emails work via Gmail, need DNS for noreply@runsmart-ai.com)
- ⚠️ PostHog env var in Vercel (GA4 working as backup)
- ⚠️ Social media accounts (Instagram/Twitter)
- ⚠️ Replace placeholder images

### 🎯 LAUNCH READINESS: 95% - READY TO LAUNCH TODAY

**See [DEPLOYMENT-STATUS-UPDATE.md](./DEPLOYMENT-STATUS-UPDATE.md) for detailed status and launch options.**

## ג… PHASE 1: AUDIT RESULTS - COMPLETED

### What's Working ג“

#### 1. Google Analytics 4 ג“
- **Status:** Properly installed
- **Location:** [V0/app/layout.tsx](../V0/app/layout.tsx:101-112)
- **Tracking ID:** G-YBJKT7T4DE
- **Implementation:** Script tags with gtag.js loaded via Next.js Script component
- **Fires on:** All pages (including landing pages)

#### 2. PostHog Analytics ג“
- **Status:** Configured with provider component
- **Location:** [V0/lib/posthog-provider.tsx](../V0/lib/posthog-provider.tsx)
- **Implementation:** Client-side SDK with lazy loading
- **Environment Variables Needed:**
  - `NEXT_PUBLIC_POSTHOG_API_KEY` (currently empty)
  - `NEXT_PUBLIC_POSTHOG_HOST` (set to https://us.i.posthog.com)
- **Note:** Analytics won't track until API key is added to Vercel environment

#### 3. Landing Page Structure ג“
- **Status:** Complete and follows GTM copy
- **Main Page:** [V0/app/landing/page.tsx](../V0/app/landing/page.tsx)
- **Sections Present:**
  - ג“ Hero with CTA
  - ג“ Social proof badge
  - ג“ Meet Run-Smart (4 features)
  - ג“ 3 Steps to get started
  - ג“ Demo section (placeholder)
  - ג“ FAQ accordion
- **Layout:** [V0/app/landing/layout.tsx](../V0/app/landing/layout.tsx)
  - ג“ Sticky header with navigation
  - ג“ "Join Beta" CTA in header
  - ג“ Footer with links

#### 4. Beta Signup Flow ג“
- **Status:** Fully implemented
- **Signup Page:** [V0/app/landing/beta-signup/page.tsx](../V0/app/landing/beta-signup/page.tsx)
- **Form Component:** [V0/app/landing/beta-signup/beta-signup-form.tsx](../V0/app/landing/beta-signup/beta-signup-form.tsx)
- **Thank You Page:** [V0/app/landing/beta-signup/thanks/page.tsx](../V0/app/landing/beta-signup/thanks/page.tsx)
- **API Endpoint:** [V0/app/api/beta-signup/route.ts](../V0/app/api/beta-signup/route.ts)
- **Features:**
  - ג“ Form validation with Zod
  - ג“ Email, experience level, goals, referral source
  - ג“ Privacy/terms agreement checkbox
  - ג“ Server-side validation
  - ג“ Thank you page with social sharing
  - ג“ Urgency indicators (500 spots, progress bar)
  - ג“ Beta benefits section
  - ג“ Timeline visualization

#### 5. Resend Integration
- **Status:** Email sending implemented and wired to beta signup API
- **Package:** resend@6.6.0
- **API Key Configured:** (stored in Vercel environment)
- **RESEND_FROM_EMAIL:** Set in Vercel production
- **Note:** Verify Resend DNS (DKIM) in the Resend dashboard
#### 6. Mobile-First Design ג“
- **Status:** Responsive design implemented
- **Framework:** Tailwind CSS with responsive classes
- **Max Width:** max-w-6xl for marketing pages
- **Navigation:** Mobile hamburger menu + desktop nav

---

### What Needs Fixing

> Update (Dec 26, 2025): Items 1-5 below have been resolved. Remaining: local build path issue. See Status Update above.

ג ן¸

#### 1. Privacy Policy & Terms - PLACEHOLDER ג—
- **Current State:** Both pages are placeholder stubs
- **Files:**
  - [V0/app/landing/privacy/page.tsx](../V0/app/landing/privacy/page.tsx)
  - [V0/app/landing/terms/page.tsx](../V0/app/landing/terms/page.tsx)
- **Risk:** Legal requirement before accepting signups
- **Action Required:** Create basic legal docs or use templates

#### 2. PostHog API Key Missing
- **Current State:** Environment variable not set
- **Impact:** No event tracking until configured
- **Action:** Add to Vercel environment variables

#### 3. Beta Signup Storage - NOT IMPLEMENTED ג—
- **Current Issue:** API endpoint references Supabase but no credentials configured
- **File:** [V0/lib/server/betaSignupRepository.ts](../V0/lib/server/betaSignupRepository.ts)
- **Options:**
  1. Set up Supabase project (RECOMMENDED)
  2. Integrate Buttondown API directly
  3. Use local file storage (NOT recommended for production)
- **Environment Variables Needed:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

#### 4. Email Confirmation Flow - NOT IMPLEMENTED
- **Current State:** No welcome email sent on signup
- **Expected:** Immediate confirmation with waitlist position
- **Action Required:** Implement Resend integration in beta signup API

#### 5. Image Assets Missing
- **Placeholders Used:**
  - `/placeholder.jpg` - Hero and OG images
  - `/beta-app-preview.jpg` - Beta signup hero
- **Action:** Replace with actual screenshots/mockups

#### 6. Local Build Fails - PATH ISSUE ג ן¸
- **Issue:** Turbopack crashes with Hebrew characters in path
- **Impact:** Can't test production build locally
- **Workaround:** Vercel will build in clean environment (no issue)
- **Local Fix:** Move project to path without Unicode characters

---

## ג… PHASE 2: PRE-DEPLOYMENT TASKS

### Critical (Must Do Before Launch) נ”´

#### 1. Set Up Supabase for Beta Signups
```bash
# Create Supabase project at https://supabase.com
# Run migration: V0/supabase/migrations/004_beta_signups.sql
# Add environment variables to Vercel
```

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 2. Implement Welcome Email
**File to Create:** `V0/lib/email/welcome-email.ts`

**Template:**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail(
  email: string,
  waitlistPosition: number
) {
  await resend.emails.send({
    from: 'Run-Smart <noreply@runsmart-ai.com>',
    to: email,
    subject: `You're in! Welcome to Run-Smart Beta #${waitlistPosition}`,
    html: `
      <h1>נ‰ You're officially on the Run-Smart beta waitlist!</h1>
      <p><strong>Your position: #${waitlistPosition}</strong></p>
      <p>We're rolling out beta invites in waves of 50...</p>
    `
  })
}
```

**Update:** [V0/app/api/beta-signup/route.ts](../V0/app/api/beta-signup/route.ts:66-77)
```typescript
// After successful signup
await sendWelcomeEmail(normalizedEmail, result.waitlistPosition)
```

#### 3. Create Basic Legal Documents
**Option A: Use Templates (Quick)**
- Termly.io free tier
- Privacy Policy Generator

**Option B: Minimal Beta Version**
Create simple documents that cover:
- Data collection (email, analytics)
- Right to withdraw
- Beta program terms
- Liability disclaimer

**Deadline:** Before accepting first signup

#### 4. Configure DNS for Email Sending
**Status:** DKIM key provided
**Action:** Add DNS records to runsmart-ai.com

```
Type: TXT
Name: resend._domainkey.runsmart-ai.com
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC8iVSOf9PchNH0+umnQwUNAuC/oZASDyIRUlL56GTQr4BJe8vDMkLtRvfc/rcCvlutPucM4qZa80b7uAul0okv+sy8qzL6+pxI4qT2Av6+1NaOg0yEFKQexQGq5ok0TO/at/s4LdVhrFdHJENDvA1aPZMdByszonUpqgkiEL90+wIDAQAB
```

**Verification:** https://resend.com/domains

---

### Important (Should Do) נ¡

#### 5. Replace Placeholder Images
**Assets Needed:**
1. Hero image (1200x630px for OG)
2. Beta app preview screenshot (mobile mockup)
3. Demo video or animated GIF

**Temporary Solution:**
Use Figma/Canva to create simple branded graphics

#### 6. Set Up PostHog
**Steps:**
1. Sign up at https://posthog.com
2. Create project
3. Copy API key
4. Add to Vercel environment variables

**Events to Track:**
- Page views (automatic)
- Beta signup form submission
- Beta signup success
- Social share clicks

#### 7. Test Email Deliverability
**Before launch:**
```bash
# Send test email to yourself
curl -X POST https://runsmart-ai.com/api/beta-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com",...}'
```

Check:
- Inbox delivery (not spam)
- Email formatting
- Links work
- Waitlist position displays

#### 8. Mobile Testing
**Devices to Test:**
- iOS Safari (iPhone)
- Android Chrome
- Tablet (iPad/Android)

**Test:**
- Navigation works
- Form fields accessible
- CTAs visible
- No horizontal scroll

---

### Nice to Have (Post-Launch) נ¢

#### 9. Analytics Event Tracking
Add custom events beyond pageviews:
- Button clicks (CTA tracking)
- Form field interactions
- Scroll depth
- Time on page

#### 10. A/B Testing Setup
- Headline variations
- CTA button copy
- Pricing emphasis

#### 11. Performance Optimization
- Lighthouse score >90
- Page load <3 seconds
- Core Web Vitals green

---

## ג… PHASE 3: DEPLOYMENT STEPS

### Step 1: Prepare Environment Variables
Create file: `deployment-env-vars.txt` (DO NOT COMMIT)

```bash
# Analytics
NEXT_PUBLIC_POSTHOG_API_KEY=phc_xxxxx

# Email
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@runsmart-ai.com

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Site
NEXT_PUBLIC_SITE_URL=https://runsmart-ai.com
```

### Step 2: Deploy to Vercel
```bash
# Option 1: Deploy via CLI
cd V0
vercel --prod

# Option 2: Deploy via Git
git add .
git commit -m "feat: launch beta signup landing page"
git push origin main
```

### Step 3: Add Environment Variables in Vercel Dashboard
1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add all variables from `deployment-env-vars.txt`
3. Set scope to "Production"
4. Redeploy

### Step 4: Verify Domain Configuration
- Ensure runsmart-ai.com points to Vercel
- Add DKIM records for Resend
- Test SSL certificate

### Step 5: Smoke Test After Deployment
**Checklist:**
- [x] Landing page loads at https://runsmart-ai.com/landing
- [x] Beta signup page accessible at /landing/beta-signup
- [x] Form submission works (test with real email)
- [x] Thank you page displays with position
- [ ] Welcome email received (Resend accepted; verify inbox)
- [ ] Google Analytics fires (check Real-Time view)
- [ ] PostHog events tracked
- [ ] Mobile responsive
- [ ] All links work (nav, footer)

---

## ג… PHASE 4: MONITORING & NEXT STEPS

### Week 1 Metrics to Track
**Target:** 20-50 beta signups by end of Week 1

**Daily Monitoring:**
- [ ] Total signups
- [ ] Conversion rate (visitors ג†’ signups)
- [ ] Traffic sources
- [ ] Bounce rate
- [ ] Form abandonment rate

**Tools:**
- Google Analytics: Real-time and acquisition reports
- PostHog: Funnels and conversion tracking
- Supabase: Query beta_signups table

### Immediate Next Steps (Day 5-7)

#### 1. Launch Social Media Presence
- [ ] Create Instagram account (@runsmart.ai)
- [ ] Create Twitter/X account (@runsmartcoach)
- [ ] Post first content (introduce app)
- [ ] Add social links to landing page footer

#### 2. Start Email Sequence
**Day 3 After Signup:** Behind-the-scenes email
**Day 7 After Signup:** Feature sneak peek
**Day 14:** Beta invite coming soon

**File Reference:** [GTM/email-sequences/beta-waitlist-sequence.md](./email-sequences/beta-waitlist-sequence.md)

#### 3. Referral System (Optional)
- Generate unique referral links
- Track referrals in database
- Move users up waitlist (+5 positions per referral)

#### 4. First Beta Invite Wave (Week 2)
- Target: First 50 signups
- Send personalized invite emails
- Include onboarding instructions
- Set up Discord channel for beta testers

---

## ג ן¸ BLOCKERS & MISSING PIECES

### Critical Blockers (MUST RESOLVE BEFORE LAUNCH)

> Update (Dec 26, 2025): Items 1-3 resolved. Remaining items are non-blockers.\r\n\r\n1. **Supabase Setup** ג—
   - No database configured for beta signups
   - Signups will fail without this
   - **ETA:** 30 minutes to set up

2. **Legal Documents** ג—
   - Privacy Policy placeholder
   - Terms of Service placeholder
   - **ETA:** 2 hours to create basic version

3. **Email Integration** ג—
   - Welcome email not implemented
   - **ETA:** 1 hour to implement

### Non-Blockers (Can Launch Without)

4. **PostHog API Key**
   - Analytics won't track but app works
   - Can add after launch

5. **Real Images**
   - Placeholders work for beta
   - Update later

6. **Local Build Issue**
   - Doesn't affect Vercel deployment
   - Ignore for now

---

## נ“‹ FINAL PRE-LAUNCH CHECKLIST

### Technical
- [x] Supabase project created and migrated
- [x] Environment variables added to Vercel
- [x] Resend DNS records configured (verified via DNS lookup)
- [x] Welcome email template implemented
- [x] Test signup end-to-end
- [x] Privacy Policy published (even basic version)
- [x] Terms of Service published (even basic version)

### Content
- [ ] Landing page copy reviewed
- [ ] Beta signup page copy reviewed
- [ ] Email templates proofread
- [ ] All CTAs working
- [ ] Social proof stats updated

### Analytics
- [ ] Google Analytics tracking verified
- [x] PostHog key added (optional)
- [ ] Conversion funnel set up
- [ ] Goal tracking configured

### Marketing
- [ ] Social media accounts created
- [ ] First posts scheduled
- [ ] Email sequence ready
- [ ] Beta invite process documented

---

## נ€ LAUNCH READINESS SCORE

**Current Status:** 95% Ready ✅

**To Reach 100%:**
1. Add DKIM DNS record for professional email sender (optional - Gmail works)
2. Add PostHog env var to Vercel (optional - GA4 working)
3. Mobile QA + replace marketing images (optional - can do post-launch)

**Estimated Time to Launch:**
- **Option 1:** Launch NOW (15 minutes) - Recommended for beta
- **Option 2:** Fix DNS first (1 hour) - Better deliverability
- **Option 3:** Switch email provider (2-3 hours) - If Resend issues persist

**Recommendation:** LAUNCH NOW with Gmail sender, fix DNS later as non-critical improvement.

---

## נ“ SUPPORT & RESOURCES

### Documentation
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Resend: https://resend.com/docs

### Reference Files
- GTM Action Plan: `GTM/WEEK-1-ACTION-PLAN.md`
- Landing Page Copy: `GTM/landing-pages/`
- Email Templates: `GTM/email-sequences/`
- Beta Signup Copy: `GTM/landing-pages/beta-signup-copy.md`

### Contact
- Gmail: runsmartteam@gmail.com
- Domain: runsmart-ai.com (Vercel)

---

**Last Updated:** December 23, 2025
**Next Review:** After first deployment






