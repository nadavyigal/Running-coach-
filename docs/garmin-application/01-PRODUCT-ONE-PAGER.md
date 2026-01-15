# RunSmart (Run-Smart) - Product One-Pager for Garmin Review

CRITICAL: Do not invent facts. Replace any `[[FILL: ...]]` placeholders before sharing externally.

---

## What RunSmart Is

RunSmart is a Progressive Web App (PWA) that acts as an AI running coach. It helps runners build a consistent habit through adaptive training plans, run logging, and coaching insights that adjust to real life.

## Problem

Runners often:
- Lose consistency when life disrupts a rigid plan
- Struggle to interpret training data into actionable decisions
- Have run history split across devices/apps

## Solution

RunSmart provides:
- Adaptive 14–21 day training plans that can reshuffle when workouts are missed
- A “today” view of the next best session
- A coaching experience designed to keep runners consistent (without guilt spirals)
- Offline-first behavior typical of a PWA

Positioning language in the repo marketing site:
- "Your Personal AI Running Coach That Adapts to Your Life"
- "Recovery-focused coaching"
- "Works offline - privacy-first and local-first by default"
(`V0/app/landing/page.tsx`)

## Target Users

- Beginner to intermediate runners building consistency
- Runners who want structured guidance without overtraining
- Garmin users who want their runs to drive coaching insights inside RunSmart

## Why Garmin Integration Matters

Garmin users already capture high-quality activity data during runs. Importing completed run activities into RunSmart:
- Reduces manual logging
- Improves coaching context (distance, duration, pace, HR, elevation)
- Enables better progress tracking and plan adjustments based on real activity history

## Garmin Integration (requested scope)

We are applying for access to the Garmin Connect Activity API to import completed running activities into RunSmart.

We will:
- Import completed run activity data into the user's RunSmart history after explicit OAuth consent
- Restrict collection to the minimum data needed for coaching and training analytics

We will not:
- Collect Garmin passwords
- Scrape Garmin Connect
- Resell Garmin data or share it with third parties for advertising

## High-Level User Flow (text)

1. User opens RunSmart -> Profile/Devices -> "Connect Garmin"
2. User completes Garmin OAuth authorization and is redirected back to RunSmart
3. RunSmart imports completed runs (initial import + ongoing sync)
4. Imported runs appear in run history and influence insights and plan adjustments
5. User can disconnect Garmin and request deletion of imported data

## Credibility / Evidence (from repo)

- Next.js App Router app with security headers and API routes (`V0/app/*`, `V0/next.config.mjs`)
- Supabase integration for auth and beta signup storage (`V0/lib/supabase/*`, `V0/lib/server/betaSignupRepository.ts`)
- Garmin OAuth + activity import endpoints present (`V0/app/api/devices/garmin/*`)

## Links (fill/verify)

- Website: [[FILL: canonical website URL]]
- Privacy: [[FILL: privacy URL]]
- Terms: [[FILL: terms URL]]
- Support: [[FILL: support email or URL]]
