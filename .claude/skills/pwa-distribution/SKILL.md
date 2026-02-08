---
name: pwa-distribution
description: >
  PWA distribution strategy for RunSmart including app store optimization,
  web install prompts, TWA (Trusted Web Activity) for Google Play, Apple
  Add-to-Home-Screen optimization, and cross-platform distribution channels.
  Use when planning app distribution, optimizing install rates, or expanding
  to new platforms.
metadata:
  short-description: Distribute RunSmart PWA across web, Google Play, and Apple platforms.
---

## When Claude should use this skill
- Setting up PWA install flow and prompts
- Publishing to Google Play via TWA
- Optimizing Apple Add-to-Home-Screen experience
- Planning distribution across app stores and web
- Improving install conversion rates
- User asks about "app store" or "distribution"

## Distribution Channels

### 1. Web (Primary)
- Direct URL access with smart install banner
- Custom `beforeinstallprompt` handling
- Deferred prompt after value demonstration (post-onboarding)

```typescript
// Install prompt strategy
// Don't show immediately — wait until user completes onboarding
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Show after onboarding completion
async function showInstallPrompt() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    // Track: install_prompt_shown, install_accepted/declined
  }
}
```

### 2. Google Play Store (TWA)
- Wrap PWA as Trusted Web Activity using Bubblewrap
- Digital Asset Links verification
- Play Store listing optimization

```bash
# Generate TWA with Bubblewrap
npx @nicolo-ribaudo/bubblewrap init \
  --manifest https://runsmart.app/manifest.json
npx @nicolo-ribaudo/bubblewrap build
```

**Play Store Listing:**
- Title: "RunSmart - AI Running Coach" (30 chars)
- Short desc: "Personalized AI training plans that adapt to your progress" (80 chars)
- Category: Health & Fitness
- Keywords: running coach, training plan, AI coach, run tracker, 5K training

### 3. Apple (Add to Home Screen)
- Custom install instructions overlay for Safari
- iOS-specific meta tags in `<head>`
- Splash screens for all iOS device sizes

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="RunSmart">
<link rel="apple-touch-icon" href="/icons/apple-icon-180.png">
```

### 4. Microsoft Store (Optional)
- PWA auto-indexed by Bing crawler
- Manual submission via PWABuilder
- Windows-specific app packaging

### 5. PWA Directories
- [PWABuilder](https://www.pwabuilder.com/) — publish and score
- [Appscope](https://appsco.pe/) — PWA directory
- [Progressive Web Apps](https://pwa-directory.appspot.com/) — Google directory

## App Store Optimization (ASO)

### Keyword Strategy
| Priority | Keywords | Monthly Searches |
|----------|----------|-----------------|
| P0 | running coach app | 12K |
| P0 | AI running coach | 3K |
| P0 | personalized training plan | 5K |
| P1 | couch to 5k | 40K |
| P1 | run tracker | 20K |
| P1 | marathon training plan | 8K |
| P2 | running app free | 15K |
| P2 | GPS run tracker | 10K |

### Screenshot Strategy (5 screenshots)
1. Today screen with personalized workout
2. AI chat coaching conversation
3. Run recording with GPS map
4. Training plan calendar view
5. Progress/insights dashboard

### Rating & Review Strategy
- Prompt for review after 3rd completed run (positive moment)
- Never prompt after failed/abandoned runs
- In-app feedback form before store review prompt
- Respond to all store reviews within 48 hours

## Install Rate Optimization
- Show install prompt after onboarding (not on first visit)
- A/B test prompt timing: post-onboarding vs post-first-run
- Add "Install for offline access" value prop
- Show social proof: "Join X runners using RunSmart"
- Target: 15% of mobile visitors install

## Manifest Configuration
```json
{
  "name": "RunSmart - AI Running Coach",
  "short_name": "RunSmart",
  "description": "Personalized AI training plans that adapt to your progress",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "categories": ["health", "fitness", "sports"],
  "screenshots": [...],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## Integration Points
- Manifest: `V0/public/manifest.json`
- Service Worker: `V0/public/sw.js` or next-pwa config
- Install UI: `V0/components/InstallPrompt.tsx`
- Analytics: Track install events in `V0/lib/analytics.ts`
