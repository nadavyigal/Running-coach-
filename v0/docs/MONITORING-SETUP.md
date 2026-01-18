# Monitoring & Error Tracking Setup

This guide covers setting up comprehensive monitoring and error tracking for RunSmart AI.

## Overview

Monitoring strategy includes:
- **Error Tracking**: Sentry for client and server errors
- **Analytics**: PostHog + Google Analytics (already configured)
- **Performance**: Vercel Analytics + Speed Insights
- **Logs**: Supabase logs + Vercel logs
- **Uptime**: External uptime monitoring

---

## Sentry Setup (Recommended)

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io/)
2. Sign up for free account
3. Create new project:
   - Platform: Next.js
   - Project name: running-coach-prod

### 2. Install Sentry

```bash
cd v0
npm install @sentry/nextjs
```

### 3. Initialize Sentry

```bash
npx @sentry/wizard@latest -i nextjs
```

This creates:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Updates `next.config.js`

### 4. Configure Sentry

**sentry.client.config.ts**:
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors

  // Environment
  environment: process.env.NODE_ENV,

  // Ignore known errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],

  // Breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') {
      return null // Don't send console logs
    }
    return breadcrumb
  },
})
```

**sentry.server.config.ts**:
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,

  // Server-specific config
  beforeSend(event) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
    }
    return event
  },
})
```

### 5. Add Environment Variable

```env
# .env.local and Vercel
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=running-coach-prod
```

### 6. Test Sentry

Add a test error button:
```typescript
<button onClick={() => {
  throw new Error('Sentry Test Error')
}}>
  Test Sentry
</button>
```

---

## Vercel Analytics

### 1. Enable in Vercel Dashboard

1. Go to Vercel Dashboard → Your Project
2. Navigate to **Analytics** tab
3. Click "Enable Analytics"

### 2. Install Package (Optional)

```bash
npm install @vercel/analytics
```

### 3. Add to Layout

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 4. Speed Insights

```bash
npm install @vercel/speed-insights
```

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

---

## Uptime Monitoring

### Option 1: UptimeRobot (Free)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for free account
3. Add new monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: RunSmart AI Production
   - URL: `https://your-domain.com`
   - Monitoring Interval: 5 minutes
4. Set up alerts:
   - Email notifications
   - Slack/Discord webhooks (optional)

### Option 2: Better Uptime

1. Go to [betteruptime.com](https://betteruptime.com)
2. Create free account
3. Add monitor with similar settings
4. Configure incident management

### Health Check Endpoint

Ensure you have a health check endpoint:

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const checks = {
    server: 'ok',
    database: 'unknown',
    timestamp: new Date().toISOString(),
  }

  try {
    // Check database connection
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('count').limit(1)

    if (error) {
      checks.database = 'error'
      throw error
    }

    checks.database = 'ok'

    return NextResponse.json({
      status: 'healthy',
      checks,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

Monitor: `GET https://your-domain.com/api/health`

---

## Log Aggregation

### Supabase Logs

Access via Dashboard:
1. Supabase Dashboard → Logs
2. View:
   - API logs
   - Auth logs
   - Database logs
   - Realtime logs

### Vercel Logs

Access via Dashboard or CLI:
```bash
# View logs
vercel logs

# Follow logs in real-time
vercel logs --follow

# Filter by function
vercel logs api/chat
```

### Log Drains (Enterprise)

For production, consider:
- Datadog
- Logtail
- Papertrail
- Splunk

---

## Performance Monitoring

### Core Web Vitals

Monitor these metrics:
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

Tools:
- Chrome DevTools Lighthouse
- PageSpeed Insights
- WebPageTest.org
- Vercel Speed Insights

### Custom Performance Tracking

```typescript
// Track custom performance metrics
export function trackPerformance(metric: {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}) {
  // Send to analytics
  if (window.posthog) {
    window.posthog.capture('performance_metric', metric)
  }

  // Send to Sentry
  if (window.Sentry) {
    Sentry.captureMessage('Performance Metric', {
      level: 'info',
      extra: metric,
    })
  }
}
```

---

## Alerts & Notifications

### Error Alerts (Sentry)

Configure in Sentry Dashboard:
1. Settings → Alerts
2. Create alert rule:
   - Condition: New issue created
   - Actions: Send email, Slack notification
   - Frequency: Immediate

### Uptime Alerts

Configure in uptime monitoring service:
- Email notifications
- SMS (paid plans)
- Slack/Discord webhooks
- PagerDuty integration

### Custom Alerts

Create custom monitoring:

```typescript
// Monitor sync failures
export async function monitorSyncHealth() {
  const syncService = SyncService.getInstance()
  const status = syncService.getStatus()

  if (status === 'error') {
    // Alert admin
    await fetch('/api/alert', {
      method: 'POST',
      body: JSON.stringify({
        type: 'sync_failure',
        message: syncService.getErrorMessage(),
        timestamp: new Date(),
      }),
    })
  }
}
```

---

## Monitoring Dashboard

### Metrics to Track

**User Metrics:**
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- User retention rate
- Churn rate

**Performance Metrics:**
- Page load time (p50, p95, p99)
- API response time
- Error rate
- Apdex score

**Business Metrics:**
- Signup conversion rate
- Onboarding completion rate
- Feature adoption rate
- User engagement score

**Technical Metrics:**
- Uptime percentage (target: 99.9%)
- Sync success rate
- Database query performance
- CDN cache hit rate

### Creating Custom Dashboard

Example with Grafana/Metabase:
1. Connect to Supabase as data source
2. Create visualizations:
   - User growth chart
   - Error rate over time
   - Sync performance
   - Feature usage heatmap

---

## Incident Response

### Incident Levels

**P0 - Critical:**
- Site is down
- Data loss
- Security breach
- Response time: Immediate

**P1 - High:**
- Major feature broken
- Significant performance degradation
- Response time: < 1 hour

**P2 - Medium:**
- Minor feature issues
- Moderate performance issues
- Response time: < 4 hours

**P3 - Low:**
- Cosmetic issues
- Nice-to-have features
- Response time: < 24 hours

### Incident Workflow

1. **Detect**: Alert triggered
2. **Assess**: Determine severity
3. **Respond**: Implement fix or rollback
4. **Resolve**: Verify fix works
5. **Post-mortem**: Document and prevent recurrence

### Rollback Procedure

Quick rollback in Vercel:
1. Dashboard → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

---

## Security Monitoring

### Supabase Security

Monitor:
- Failed login attempts
- Unusual API activity
- RLS policy violations

### Rate Limiting

Monitor rate limit hits:
```typescript
export async function checkRateLimits() {
  // Track rate limit hits
  if (rateLimitExceeded) {
    await Sentry.captureMessage('Rate Limit Exceeded', {
      level: 'warning',
      extra: {
        userId,
        endpoint,
        attempts,
      },
    })
  }
}
```

---

## Monitoring Checklist

Before going live:

- [ ] Sentry configured and tested
- [ ] Vercel Analytics enabled
- [ ] Uptime monitoring set up
- [ ] Health check endpoint created
- [ ] Error alerts configured
- [ ] Performance baseline established
- [ ] Log retention configured
- [ ] Incident response plan documented
- [ ] Team has access to all dashboards
- [ ] Backup monitoring (secondary service)

---

## Cost Optimization

### Sentry
- Free tier: 5,000 errors/month
- Recommended: Team plan ($26/month)

### Vercel Analytics
- Free for hobby projects
- Pro plan includes more analytics

### UptimeRobot
- Free: 50 monitors, 5-minute intervals
- Paid: More frequent checks

**Total Estimated Cost**: $0-50/month depending on scale

---

## Further Reading

- [Sentry Documentation](https://docs.sentry.io/)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [PostHog Guide](https://posthog.com/docs)
- [Web Vitals](https://web.dev/vitals/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
