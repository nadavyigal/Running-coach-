---
name: ops-deploy
description: >
  Deployment, CI/CD, monitoring, and production operations for RunSmart PWA.
  Covers Vercel deployment, environment management, performance monitoring,
  error tracking, and production incident response. Use when deploying,
  configuring infrastructure, or troubleshooting production issues.
metadata:
  short-description: Deploy, monitor, and operate RunSmart in production on Vercel.
---

## When Claude should use this skill
- Deploying RunSmart to production or preview environments
- Setting up or debugging CI/CD pipelines
- Configuring environment variables across environments
- Monitoring performance, errors, or uptime
- Responding to production incidents
- Optimizing build times or bundle size

## Deployment Stack
| Layer | Service | Purpose |
|-------|---------|---------|
| Hosting | Vercel | Next.js deployment, edge functions |
| Database | IndexedDB (client) | Local-first data persistence |
| AI API | OpenAI via Vercel AI SDK | Chat, plan generation |
| Analytics | Vercel Analytics / Web Vitals | Performance monitoring |
| Error Tracking | Console + Vercel Logs | Error reporting |
| PWA | next-pwa / Service Worker | Offline support, install prompt |

## Deployment Checklist

### Pre-Deploy
1. `npm run lint` — zero warnings
2. `npx tsc --noEmit` — zero type errors
3. `npm run test -- --run` — all tests pass
4. `npm run build` — clean production build
5. Verify environment variables are set in Vercel dashboard
6. Check bundle size: `npx next build --analyze` (if configured)

### Deploy
```bash
# Preview deployment (PR-based)
git push origin feature/branch-name
# Vercel auto-deploys preview

# Production deployment
git push origin main
# Vercel auto-deploys to production
```

### Post-Deploy
1. Verify production URL loads correctly
2. Test PWA install flow on mobile
3. Check API routes respond (health check)
4. Verify AI features work (chat, plan generation)
5. Monitor error logs for 30 minutes

## Environment Variables
```
# Required for production
OPENAI_API_KEY=sk-...          # AI features
NEXT_PUBLIC_APP_URL=https://runsmart.app

# Optional
VERCEL_ANALYTICS_ID=...        # Vercel Analytics
SENTRY_DSN=...                 # Error tracking (if added)
```

## PWA Configuration
- Service Worker: caches app shell, static assets, API responses
- Manifest: `public/manifest.json` with app name, icons, theme
- Offline: Core features work offline via IndexedDB
- Update: Background SW update with user prompt to refresh

## Performance Targets
| Metric | Target | Tool |
|--------|--------|------|
| LCP | < 2.5s | Lighthouse |
| FID | < 100ms | Web Vitals |
| CLS | < 0.1 | Web Vitals |
| TTI | < 3.5s | Lighthouse |
| Bundle (JS) | < 200KB gzip | next build |
| PWA Score | 100 | Lighthouse |

## Incident Response
1. **Detect**: Vercel logs, user reports, monitoring alerts
2. **Triage**: Classify severity (P0-critical to P3-cosmetic)
3. **Mitigate**: Rollback via Vercel instant rollback if needed
4. **Fix**: Hot-fix branch → PR → merge → auto-deploy
5. **Review**: Post-incident review, update monitoring

## Agent Team Pattern: Release Swarm
```
Create an agent team for production release:
- Build agent: full production build, fix any errors
- Test agent: run all test suites, report failures
- Deploy agent: verify Vercel config, environment vars, deploy
- Monitor agent: check post-deploy health, logs, performance
```

## Integration Points
- Build: `V0/next.config.ts`, `V0/package.json`
- PWA: `V0/public/manifest.json`, service worker config
- Env: `.env.local`, Vercel dashboard
- CI: GitHub Actions (if configured), Vercel build hooks
