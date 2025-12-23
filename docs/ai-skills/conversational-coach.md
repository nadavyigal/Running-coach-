# AI Skill: Conversational Goal Discovery Coach

Guides users through clarifying goals, uncovering constraints, and committing to near-term habits via chat.

## What it delivers
- Structured dialogue to classify user intent (habit, distance, speed) with confidence scores.
- Micro-commitments (e.g., 3 runs/week, time-of-day preference) and blockers.
- Suggested plan presets and a summary card to seed onboarding or plan generation.

## Inputs & context
- **Recent chat history**: last N turns stored via `v0/lib/conversationStorage.ts`.
- **Onboarding cues**: partial wizard answers if available (`v0/lib/onboardingPromptBuilder.ts`, `v0/lib/onboardingManager.ts`).
- **Catalogs**: goal archetypes and workout templates (`v0/lib/goalDiscoveryEngine.ts`, `v0/lib/plan-templates.ts`).
- **User profile (if existing)**: timezone, schedule, units (Dexie `User`).

## Output contract (suggested)
```ts
interface GoalDiscoveryResult {
  goal: 'habit' | 'distance' | 'speed';
  confidence: number; // 0-1
  blockers: string[];
  weeklyCommitment: number; // sessions/week
  preferredDays?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  starterPlanId?: string; // template key
  summaryCard: string; // <=60 words
}
```

## Prompting scaffold
```
You are a concise running coach helping a user clarify goals.
Conversation so far: {{recent_messages}}
Known profile: {{profile_snapshot}}
If goal is ambiguous, ask one clarifying question; otherwise return a summary.
Respond with JSON matching GoalDiscoveryResult and a short user-facing question or confirmation if needed.
```

## Execution flow
1. Load recent messages from `v0/lib/conversationStorage.ts` and trim to budget.
2. Add any partial onboarding answers via `v0/lib/onboardingPromptBuilder.ts` for added context.
3. Call OpenAI via `v0/app/api/chat/route.ts` with a goal-discovery system prompt.
4. Validate JSON; if missing required fields, retry with higher structure penalties.
5. Save the `GoalDiscoveryResult` to Dexie and mirror a summary message into the chat thread.
6. Optionally hand off to plan generation (`v0/app/api/generate-plan/route.ts`) if confidence ≥0.7.

## Integration points
- **UI**: Chat screen suggested prompts; after summary, display a summary card with a CTA to start onboarding or generate a plan.
- **Analytics**: log `goal_discovered`, `goal_discovery_retry`, `goal_discovery_confidence` via `v0/lib/analytics.ts`.
- **Security**: sanitize user text with `v0/lib/security.middleware.ts`; redact PII in traces.

## Evaluation & success metrics
- Conversion to completed onboarding after goal discovery.
- Confidence distribution (aim for most users at ≥0.6 while avoiding overconfidence).
- Drop-off rate during clarifying questions.

## Observability
- Trace prompt/model pairs with `v0/lib/backendMonitoring.ts`.
- Add guardrail checks for banned content via `v0/lib/security.monitoring.ts`.
- Record latency (goal: p95 ≤1s) using `v0/lib/performance.monitoring.ts`.

## Failure & mitigation
- **Ambiguous intent** → Ask one targeted clarifying question; store pending state.
- **Toxic or off-topic content** → Invoke safety filters and return a neutral redirect to goals.
- **Model structure drift** → Enforce schema validation and log to `backendMonitoring` for prompt tuning.

## Extensions
- Multi-language support with lightweight translation before/after the prompt.
- Memory of past commitments to surface streak reminders in future chats.
- A/B test coaching tone using `v0/lib/abTestFramework.ts`.
