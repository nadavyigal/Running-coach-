# Deployment Guide - RunSmart AI

This guide covers deploying RunSmart AI to production, including prerequisites, configuration, and post-deployment verification.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Supabase Configuration](#supabase-configuration)
- [Vercel Deployment](#vercel-deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- [ ] **GitHub Account** - For repository hosting
- [ ] **Vercel Account** - For application hosting
- [ ] **Supabase Account** - For database and authentication
- [ ] **OpenAI Account** - For AI features
- [ ] **PostHog Account** - For analytics (optional)
- [ ] **Google Analytics** - For tracking (optional)

### Required Tools

```bash
# Node.js (v18 or higher)
node --version

# npm (v9 or higher)
npm --version

# Git
git --version

# Supabase CLI (optional, for migrations)
npx supabase --version
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/running-coach-app.git
cd running-coach-app/v0
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

### 4. Configure Environment Variables

Edit `.env.local` with your actual values:

```env
# =============================================================================
# Site Configuration
# =============================================================================
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# =============================================================================
# Supabase Configuration
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# =============================================================================
# OpenAI Configuration
# =============================================================================
OPENAI_API_KEY=sk-proj-your-key

# Optional: Chat runtime tuning
CHAT_DEFAULT_MODEL=gpt-4o-mini
CHAT_MAX_TOKENS=1000
CHAT_TIMEOUT_MS=15000

# =============================================================================
# Analytics Configuration
# =============================================================================
# PostHog
NEXT_PUBLIC_POSTHOG_API_KEY=phc_your-key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Google Analytics
NEXT_PUBLIC_GA_ID=G-YOUR-ID

# =============================================================================
# Admin Configuration
# =============================================================================
ADMIN_EMAILS=admin@your-domain.com,another-admin@your-domain.com

# =============================================================================
# Map Configuration (Optional)
# =============================================================================
NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_URL_DARK=https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_TOKEN=your-maptiler-token

# =============================================================================
# Email Configuration (Optional)
# =============================================================================
RESEND_API_KEY=re_your-key
RESEND_FROM_EMAIL=noreply@your-domain.com

# =============================================================================
# Feature Flags
# =============================================================================
NEXT_PUBLIC_ENABLE_PLAN_TEMPLATE_FLOW=false
```

---

## Supabase Configuration

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - Project name: `running-coach-prod`
   - Database password: (generate strong password)
   - Region: Choose closest to your users
4. Wait for project initialization (~2 minutes)

### 2. Get API Keys

1. Navigate to **Settings → API**
2. Copy values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 3. Apply Database Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push
```

#### Option B: Manual SQL Execution

1. Navigate to **SQL Editor** in Supabase Dashboard
2. Open each migration file in `v0/supabase/migrations/`
3. Execute them in order:
   ```
   001_initial_schema.sql
   002_user_memory.sql
   (and any additional migrations)
   ```

### 4. Verify Migrations

Check that all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- profiles
- runs
- goals
- shoes
- sleep_data
- hrv_measurements
- recovery_scores
- personal_records
- heart_rate_zones

### 5. Verify RLS Policies

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Each table should have:
- SELECT policy (users can view own data)
- INSERT policy (users can insert own data)
- UPDATE policy (users can update own data)

### 6. Configure Authentication

1. Navigate to **Authentication → Providers**
2. Enable **Email** provider
3. Configure **Email Templates** (optional):
   - Confirmation email
   - Magic link email
   - Change email address
   - Reset password

4. Configure **URL Configuration**:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/**`

### 7. Configure Storage (Optional)

If using Supabase Storage for images/files:

1. Navigate to **Storage**
2. Create buckets as needed
3. Set RLS policies on buckets

---

## Vercel Deployment

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `v0`
   - **Build Command**: `npm run build`
   - **Output Directory**: (leave default)

### 3. Configure Environment Variables

In Vercel project settings:

1. Navigate to **Settings → Environment Variables**
2. Add ALL variables from `.env.local`
3. Set environment: **Production**
4. ⚠️ **Important**: Never commit `.env.local` to git!

**Quick add via Vercel CLI:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... (add all variables)
```

### 4. Configure Build Settings

Ensure these settings in Vercel:

- **Framework**: Next.js
- **Node Version**: 18.x or higher
- **Install Command**: `npm install`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 5. Deploy

Click **Deploy** button or:

```bash
vercel --prod
```

Deployment takes ~3-5 minutes.

### 6. Configure Custom Domain (Optional)

1. Navigate to **Settings → Domains**
2. Add your domain: `your-domain.com`
3. Configure DNS:
   - Type: `CNAME`
   - Name: `@` or `www`
   - Value: `cname.vercel-dns.com`
4. Wait for DNS propagation (~5 minutes to 48 hours)

---

## Post-Deployment

### 1. Verify Deployment

Visit your deployed URL and check:

- [ ] Site loads without errors
- [ ] PWA manifest is accessible: `/manifest.json`
- [ ] Service worker registers (check DevTools)
- [ ] Database connection works (check browser console)

### 2. Test Critical Flows

#### Authentication
```
1. Sign up with new account
2. Verify email (check email inbox)
3. Log in with credentials
4. Log out
5. Log back in
```

#### Data Sync
```
1. Record a test run
2. Check Supabase database for new record
3. Verify data matches local record
4. Check sync status indicator shows success
```

#### Admin Dashboard
```
1. Log in with admin email
2. Navigate to /admin/dashboard
3. Verify metrics display correctly
4. Verify user list loads
5. Check external analytics links work
```

### 3. Configure Analytics

#### PostHog Setup
1. Verify PostHog key is set in environment
2. Navigate to [PostHog Dashboard](https://app.posthog.com)
3. Check that events are being received
4. Test critical events:
   - Page views
   - User signup
   - Run recorded
   - Sync completed

#### Google Analytics Setup
1. Verify GA ID is set in environment
2. Navigate to [Google Analytics](https://analytics.google.com)
3. Check Real-Time report for active users
4. Verify page views are tracking

### 4. Set Up Monitoring

#### Error Tracking (Recommended: Sentry)
```bash
# Install Sentry
npm install @sentry/nextjs

# Initialize
npx @sentry/wizard@latest -i nextjs
```

Configure in `sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
})
```

#### Uptime Monitoring
Use services like:
- [UptimeRobot](https://uptimerobot.com) (Free)
- [Pingdom](https://www.pingdom.com)
- [Better Uptime](https://betteruptime.com)

Configure:
- Monitor URL: `https://your-domain.com`
- Check interval: 5 minutes
- Notifications: Email, SMS, Slack

### 5. Performance Optimization

#### Enable Vercel Analytics
1. Navigate to **Analytics** tab in Vercel
2. Enable **Web Analytics**
3. Enable **Speed Insights**

#### Configure Caching
Verify caching headers in `next.config.js`:
```javascript
async headers() {
  return [
    {
      source: '/manifest.json',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ]
}
```

#### Image Optimization
Ensure Next.js Image component is used:
```tsx
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority={true}
/>
```

---

## Monitoring

### Health Checks

Create a health check endpoint:

**`v0/app/api/health/route.ts`**:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Check Supabase connection
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('count').single()

    if (error) throw error

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        auth: 'operational',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

Monitor: `GET https://your-domain.com/api/health`

### Key Metrics to Monitor

1. **Application Metrics**
   - Response time (p50, p95, p99)
   - Error rate
   - Request rate
   - Uptime percentage

2. **User Metrics**
   - Daily Active Users (DAU)
   - Weekly Active Users (WAU)
   - Monthly Active Users (MAU)
   - Signup conversion rate

3. **Sync Metrics**
   - Sync success rate
   - Average sync duration
   - Sync failure reasons
   - Data volume per sync

4. **Performance Metrics**
   - Time to First Byte (TTFB)
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Cumulative Layout Shift (CLS)

---

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: ./v0

      - name: Run linter
        run: npm run lint
        working-directory: ./v0

      - name: Run tests
        run: npm run test -- --run
        working-directory: ./v0

      - name: Build
        run: npm run build
        working-directory: ./v0

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./v0
```

### Required Secrets

Add to **GitHub → Settings → Secrets**:
- `VERCEL_TOKEN` - From Vercel account settings
- `VERCEL_ORG_ID` - From `.vercel/project.json`
- `VERCEL_PROJECT_ID` - From `.vercel/project.json`

---

## Rollback Procedure

### Instant Rollback (Vercel)

1. Go to Vercel Dashboard
2. Navigate to **Deployments**
3. Find previous working deployment
4. Click "⋯" → "Promote to Production"

### Manual Rollback (Git)

```bash
# Find previous working commit
git log --oneline

# Revert to previous commit
git revert HEAD

# Or reset to specific commit (destructive)
git reset --hard <commit-hash>

# Force push
git push origin main --force

# Redeploy
vercel --prod
```

---

## Backup & Recovery

### Database Backups

Supabase automatically backs up your database daily.

**Manual Backup:**
```bash
# Using Supabase CLI
npx supabase db dump > backup-$(date +%Y%m%d).sql

# Or via pg_dump (if direct access)
pg_dump -h your-db-host -U postgres -d postgres > backup.sql
```

**Restore from Backup:**
```bash
# Using psql
psql -h your-db-host -U postgres -d postgres < backup.sql
```

### Code Backups

- GitHub provides automatic backups
- Download repository archive periodically
- Tag major releases: `git tag v1.0.0 && git push --tags`

---

## Security Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Service role key kept secret (never in client code)
- [ ] RLS policies tested and verified
- [ ] Admin emails configured properly
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled on API routes
- [ ] SQL injection protection verified (use parameterized queries)
- [ ] XSS protection enabled (React default)
- [ ] CSP headers configured (optional)
- [ ] Security headers configured

### Security Headers

Add to `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ]
}
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common deployment issues and solutions.

### Quick Fixes

**Build fails on Vercel:**
```bash
# Check build locally
npm run build

# Check node version
node --version  # Should be 18+

# Clear cache and rebuild
vercel --force
```

**Database connection fails:**
```bash
# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Test connection
curl https://your-project.supabase.co/rest/v1/
```

**Auth not working:**
- Verify Site URL in Supabase Auth settings
- Check Redirect URLs include your domain
- Verify email templates are configured

---

## Support

For deployment support:
- **Vercel**: https://vercel.com/support
- **Supabase**: https://supabase.com/support
- **Documentation**: See other docs in `/v0/docs/`

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
