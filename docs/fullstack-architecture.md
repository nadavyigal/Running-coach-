# Fullstack Architecture – Run‑Smart V0

> Prepared by: Architect Agent · Date: 2025‑07‑07

---

## 1. Overview
Run‑Smart V0 is a Next.js 14, React 18, and Tailwind CSS application with modular screens, Radix UI primitives, and Dexie.js for local data. The architecture is designed for rapid MVP delivery, accessibility, and future extensibility.

---

## 2. Screens & UI Components
- **Main Screens:**
  - `today-screen.tsx` – Today dashboard, calendar strip, workout card, quick actions
  - `plan-screen.tsx` – Plan overview, week accordions, progress, coach tips
  - `onboarding-screen.tsx` – 5-step wizard, goal selection, consent
  - `record-screen.tsx` – Live GPS run tracking, metrics, controls
  - `profile-screen.tsx` – User info, stats, achievements, settings
  - `chat-screen.tsx` – AI coach chat, suggested questions, thread UI
- **Modals:**
  - `add-run-modal.tsx`, `add-activity-modal.tsx`, `add-shoes-modal.tsx`, `date-workout-modal.tsx`, `reschedule-modal.tsx`, `route-selector-modal.tsx`, `workout-breakdown-modal.tsx`, `workout-details-modal.tsx`
- **Navigation:**
  - `bottom-navigation.tsx` – Tab bar navigation
- **UI Primitives:**
  - `components/ui/` – Card, Button, Badge, Dialog, etc. (Radix UI + Tailwind)

---

## 3. Logic & Data Models
- **Plan Generation:**
  - `lib/planGenerator.ts` – Functions to generate and adjust training plans based on user profile
- **Data Models & Persistence:**
  - `lib/db.ts` – Dexie.js schema for User, Plan, Workout, Run, Shoe
    ```ts
    export interface User { id?: number; name?: string; goal: 'habit' | 'distance' | 'speed'; ... }
    export interface Plan { id?: number; userId: number; ... }
    export interface Workout { id?: number; planId: number; week: number; ... }
    export interface Run { id?: number; workoutId: number; ... }
    export interface Shoe { id?: number; userId: number; ... }
    ```
- **Utilities:**
  - `lib/utils.ts` – Helper functions
- **Custom Hooks:**
  - `hooks/use-toast.ts` – Toast notification logic
  - `hooks/use-mobile.tsx` – Mobile detection

---

## 4. API Routes
- **Plan Generation API:**
  - `app/api/generate-plan/route.ts` – Handles POST requests to generate a plan for a user
- **Chat API:**
  - `app/api/chat/route.ts` – Handles chat requests to OpenAI GPT-4o

---

## 5. Config & Design Tokens
- **Dependencies:**
  - `package.json` – Next.js 14, React 18, Radix UI, Tailwind, Dexie, OpenAI, etc.
- **Tailwind Config:**
  - `tailwind.config.ts` – Custom color palette, border radius, animation tokens, dark mode
    ```ts
    theme: {
      extend: {
        colors: {
          background: 'hsl(var(--background))',
          primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
          ...
        },
        borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
        ...
      }
    }
    ```
- **Other Config:**
  - `tsconfig.json`, `.eslintrc.json`, `postcss.config.mjs`, `next.config.mjs`

---

## 6. Notes for BMAD Reverse Engineering
- All core flows, data models, and UI patterns are represented in the above files.
- Use this doc as a reference for generating BMAD prompts for PM and Architect agents to refine requirements and architecture.

---

*End of Fullstack Architecture Doc – V0 Export* 