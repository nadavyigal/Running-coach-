---
name: conversational-goal-discovery
description: Guides users through clarifying goals, constraints, and weekly commitments via chat.
metadata:
  short-description: Chat-based goal classification with commitments and starter plan suggestions.
---

## When Codex should use it
- Early chat sessions or onboarding when the user’s goal is ambiguous.
- When the user asks for help choosing a plan or habit.

## Invocation guidance
1. Provide the last N `ConversationTurn` entries and any partial onboarding answers.
2. Classify goal (`habit` | `distance` | `speed` | `race`) with confidence and blockers.
3. Return a `CoachMessage` summary plus structured `GoalDiscoveryResult`.

## Input schema (JSON)
```ts
{
  "conversation": ConversationTurn[],
  "profile": UserProfile,
  "partialOnboarding"?: Record<string, unknown>
}
```

## Output schema (JSON)
```ts
{
  "goalDiscovery": {
    "goal": Goal,
    "confidence": number,
    "blockers": string[],
    "weeklyCommitment": number,
    "preferredDays"?: string[],
    "starterPlanId"?: string,
    "summaryCard": string,
    "safetyFlags"?: SafetyFlag[]
  },
  "coachMessage": CoachMessage
}
```

## Integration points
- Chat API: `v0/app/api/chat/route.ts`
- Prompt context: `v0/lib/conversationStorage.ts`, `v0/lib/onboardingPromptBuilder.ts`
- Handoff: trigger plan generation via `v0/app/api/generate-plan/route.ts` when confidence ≥0.7

## Safety & guardrails
- Avoid medical advice; if user mentions pain/injury, advise pause and professional consult.
- Keep responses concise (<120 words) and supportive.
- Emit `SafetyFlag` on harmful intents or ambiguous data.

## Telemetry
- Emit `ai_skill_invoked` with `goal`, `confidence`, and `ai_user_feedback` when user responds to suggestions.
