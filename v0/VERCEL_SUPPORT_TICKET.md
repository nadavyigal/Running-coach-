# Vercel Support Ticket: CSS Purging Not Working

**Subject:** Tailwind CSS Purging Not Working on Vercel (Works Locally)

**Priority:** High
**Project:** running-coach
**Account:** nadavyigal-gmailcoms-projects

---

## Problem Summary

Tailwind CSS purging works correctly in local builds (93KB) but fails on Vercel builds (540KB), causing significant performance degradation. The CSS bundle is 5.8x larger on Vercel than locally, resulting in a 20-point Lighthouse performance score reduction.

---

## Impact

- **Performance Score:** 67/100 (could be 82-87 with proper CSS purging)
- **CSS Bundle Size:** 540KB on Vercel vs 93KB locally
- **Page Load:** 540KB CSS is the largest resource, blocking FCP/LCP
- **User Experience:** Slower initial page load
- **Business Impact:** Can't achieve target 85+ performance score for launch

---

## Evidence

### Local Build (Working)
```bash
# Local build output
CSS file: .next/static/css/e66acdaff0db40d4.css
Size: 93KB ✅

# Command used
NODE_ENV=production npm run build
```

### Vercel Build (Not Working)
```bash
# Production deployment
CSS file: _next/static/chunks/e7450191cd6e1c22.css
Size: 540KB ❌ (5.8x larger)

# Production URL
https://running-coach-fhmqamnqd-nadavyigal-gmailcoms-projects.vercel.app

# Latest deployment
Deployment ID: 9aCSNDBdXHx99kkB31M1BBfcsKRs
Inspect: https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/9aCSNDBdXHx99kkB31M1BBfcsKRs
```

### Lighthouse Comparison
```
Metric          Local    Vercel   Difference
CSS Size        93KB     540KB    +447KB
Performance     ~89      67       -22 points
LCP             2.1s     3.4s     +1.3s
```

---

## Configuration Files

### 1. tailwind.config.ts
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // ... theme config
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 2. postcss.config.mjs
```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

### 3. package.json (relevant versions)
```json
{
  "dependencies": {
    "next": "14.2.30",
    "react": "18.3.1",
    "tailwindcss": "3.4.17"
  },
  "devDependencies": {
    "autoprefixer": "10.4.21",
    "postcss": "8.5.6",
    "cssnano": "7.0.6"
  }
}
```

### 4. next.config.mjs
```javascript
const nextConfig = {
  experimental: {
    turbo: {},
  },
  // Standard Next.js config
  // No custom webpack or CSS config that would interfere
};
```

---

## What We've Tried

### ✅ Verified Working Locally
1. Tailwind content paths correctly specified
2. PostCSS config correct
3. NODE_ENV=production set
4. Build produces 93KB CSS locally

### ❌ Attempted Fixes on Vercel
1. Added explicit `purge` config (deprecated warning appeared)
2. Added `cssnano` for additional minification
3. Set `NODE_ENV=production` in vercel.json build env
4. Removed `vercel.json` to use default build
5. Deployed to production (not just preview)
6. Force deployment with `--force` flag

### Warning Seen During Build
```
warn - The `purge`/`content` options have changed in Tailwind CSS v3.0.
warn - Update your configuration file to eliminate this warning.
warn - https://tailwindcss.com/docs/upgrade-guide#configure-content-sources
```

This warning appears even though we're using Tailwind v3 syntax (`content`, not `purge`).

---

## Debugging Information Needed

1. **Build Logs:** Can you provide detailed PostCSS/Tailwind execution logs from the Vercel build?
   - Is Tailwind's purge process running?
   - What content files is it scanning?
   - Are there any errors in the CSS generation process?

2. **Environment Differences:**
   - What Node.js version is Vercel using?
   - What PostCSS/Tailwind versions are being resolved?
   - Are there any Vercel-specific overrides affecting CSS processing?

3. **Comparison:**
   - Can you explain why local build produces 93KB but Vercel produces 540KB?
   - Is Vercel caching an old build without purging?
   - Is there a different PostCSS plugin order or configuration?

---

## Reproduction Steps

1. Clone repository or deploy our project:
   - Project: `nadavyigal-gmailcoms-projects/running-coach`
   - Latest commit: includes all optimizations

2. Build locally:
   ```bash
   cd V0
   NODE_ENV=production npm run build
   # Result: CSS = 93KB
   ```

3. Deploy to Vercel:
   ```bash
   vercel --prod
   # Result: CSS = 540KB
   ```

4. Compare:
   - Local: `.next/static/css/*.css` = 93KB
   - Vercel: `_next/static/chunks/*.css` = 540KB

---

## Expected Behavior

- Vercel should apply Tailwind CSS purging the same way as local builds
- Production CSS bundle should be ~93KB (±10KB)
- Unused Tailwind classes should be removed
- Performance score should be 82-87 (not 67)

---

## Actual Behavior

- Vercel builds include full unpurged Tailwind CSS
- Production CSS bundle is 540KB (5.8x too large)
- All Tailwind utility classes included (even unused ones)
- Performance score stuck at 67

---

## System Information

### Local Environment
- **OS:** Windows 11
- **Node:** v22.19.0
- **npm:** 10.9.0
- **Next.js:** 14.2.30
- **Tailwind:** 3.4.17
- **PostCSS:** 8.5.6

### Vercel Environment
- **Framework:** Next.js 14.2.30
- **Build Command:** `npm run build` (default)
- **Node Version:** (Please confirm from logs)
- **Deployment Type:** Production

---

## Additional Context

### Project Structure
```
V0/
├── app/              # Next.js 14 App Router
├── components/       # React components (TSX)
├── lib/              # Utility functions
├── public/           # Static assets
├── tailwind.config.ts
├── postcss.config.mjs
└── next.config.mjs
```

### Content File Examples
All component files use standard Tailwind classes:
```tsx
// Example from components/today-screen.tsx
<div className="flex items-center justify-center min-h-screen">
  <div className="max-w-md mx-auto p-4">
    // ... more Tailwind classes
  </div>
</div>
```

### PostCSS Plugin Order
Locally, PostCSS processes in this order:
1. tailwindcss (includes purging)
2. autoprefixer

We've verified this works correctly locally.

---

## Questions for Vercel Team

1. Why does Tailwind CSS purging work locally but not on Vercel?
2. Is there a Vercel-specific configuration needed for Tailwind v3 purging?
3. Can you provide the full build logs showing PostCSS/Tailwind execution?
4. Are there any known issues with Tailwind CSS v3.4.17 on Vercel?
5. Is Vercel caching the CSS bundle incorrectly?

---

## Files to Review

If you need access to any configuration files, please let me know. Key files:
- `tailwind.config.ts`
- `postcss.config.mjs`
- `next.config.mjs`
- `package.json`
- Any component files for content scanning verification

---

## Urgency

**High Priority** - This is blocking our production launch performance targets. We have:
- ✅ Application deployed and working
- ✅ All other optimizations complete
- ✅ 61% TBT reduction achieved
- ❌ CSS purging preventing 85+ performance score

A fix would immediately improve our Lighthouse score from 67 to 82-87.

---

## Contact Information

**Project Owner:** nadavyigal-7990
**Email:** (your email)
**Project URL:** https://vercel.com/nadavyigal-gmailcoms-projects/running-coach
**Production URL:** https://running-coach-fhmqamnqd-nadavyigal-gmailcoms-projects.vercel.app

**Preferred Response Method:** Email + Vercel Dashboard
**Availability:** Available for live debugging session if needed

---

## Thank You

We appreciate your help resolving this issue. Vercel has been excellent otherwise - this is the only blocking issue we're experiencing.
