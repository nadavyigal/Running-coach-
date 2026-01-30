---
name: adherence-coach
description: Identifies missed training sessions and proposes plan reshuffles with motivational support. Use for weekly check-ins, when multiple sessions are skipped, or when user asks for help getting back on track.
metadata:
  short-description: Weekly adherence check with reshuffle suggestions and supportive messaging.
  agent: cursor
---

## When Cursor should use this skill
- Weekly digest (e.g., Sunday evening) or when multiple sessions are skipped
- When the user asks for help getting back on track
- When analyzing training consistency or adherence patterns
- When implementing adherence tracking features or debugging consistency issues

## Invocation guidance
1. Provide `Plan`, completed vs. missed workouts, and user preferences (available days, constraints).
2. Calculate adherence rate (completed / planned) for past 1-4 weeks.
3. Output reshuffle suggestions, prioritized focus areas, and motivational `CoachMessage`.
4. Keep volume conservative after lapses; bias toward habit re-entry.
5. Identify patterns (always missing Mondays, skipping long runs, etc.).

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Adherence analysis

### Adherence categories
- **Excellent**: >90% completion
- **Good**: 75-90% completion
- **Fair**: 50-75% completion
- **Poor**: <50% completion

### Pattern detection
- **Specific day issues**: Always missing same day of week
- **Session type avoidance**: Skipping long runs or intervals
- **Consecutive misses**: Multiple sessions in a row
- **Weekend warrior**: Only completing weekend runs
- **Random gaps**: No clear pattern

## Reshuffle strategies

### After 1-2 missed sessions
- **Action**: Minimal adjustment, continue with plan
- **Message**: "Life happens! Let's keep moving forward."
- **Focus**: Next easy run to rebuild momentum

### After 3-4 missed sessions (1 week gap)
- **Action**: Skip to next week's plan, reduce volume 20%
- **Message**: "Welcome back! Let's ease into it."
- **Focus**: 2-3 easy runs this week, rebuild routine

### After 5-10 missed sessions (2 weeks gap)
- **Action**: Restart from easier week, focus on consistency
- **Message**: "Fresh start time. Let's rebuild habits first."
- **Focus**: 3 runs per week, all easy pace, establish routine

### After 10+ missed sessions (3+ weeks gap)
- **Action**: Generate new beginner-friendly plan
- **Message**: "New chapter begins now. You've got this!"
- **Focus**: Walk/run intervals, 2-3 sessions per week

## Integration points
- **UI**: 
  - Weekly digest card
  - Chat prompt suggestions
  - Today screen adherence badge
- **API**: `v0/app/api/plan/adherence` (to add)
- **Notifications**: Email/push via `v0/lib/email.ts`
- **Background**: Weekly cron job (Sunday evening)
- **Database**: 
  - Calculate from `runs` and `workouts` tables
  - Store adherence metrics in `adherence_history` (if added)

## Safety & guardrails
- If repeated missed sessions due to pain → suggest rest and professional consult, NOT catch-up volume.
- Limit catch-up to 1 session per week; avoid stacking intensity.
- Emit `SafetyFlag` for risky catch-up proposals.
- Never shame or guilt user for missed sessions.
- If adherence consistently poor, suggest goal reassessment.
- If illness/injury mentioned, prioritize recovery over catching up.

## Motivational messaging patterns

### Supportive (primary tone)
- "Welcome back! Every run is a fresh start."
- "Consistency builds over time - you're doing great."
- "One run at a time - that's how we build habits."

### Celebratory (when improved)
- "Three runs this week - momentum is building!"
- "Your dedication is showing - keep it up!"
- "You're back in the groove - well done!"

### Reality-check (when needed, gently)
- "Running fits into life, not the other way around."
- "Quality over quantity - let's focus on what you CAN do."
- "Maybe it's time to adjust the plan to match your schedule?"

### Never use these
- ❌ "You missed X runs" (shaming)
- ❌ "You need to try harder" (guilt)
- ❌ "You're falling behind" (discouragement)
- ❌ "Other runners are..." (comparison)

## Reshuffle principles

1. **Preserve rest days**: Never reduce rest to catch up
2. **Maintain intensity distribution**: Don't stack hard sessions
3. **Prioritize consistency**: Better to do fewer runs consistently than catch up once
4. **Simplify complexity**: Remove variety, focus on easy runs after gaps
5. **Rebuild confidence**: Early success is more important than volume

## Telemetry
- Emit `ai_skill_invoked`, `ai_adjustment_applied` (if reshuffle applied), and `ai_user_feedback` on user rating with:
  - `adherence_rate`
  - `missed_sessions_count`
  - `pattern_detected`
  - `reshuffle_applied` (boolean)
  - `safety_flags`

## Common edge cases
- **Perfect adherence**: Celebrate, no changes needed
- **Sick/injured**: Focus on recovery, don't count against adherence
- **Travel/vacation**: Acknowledge life events, gentle return
- **Burnout signs**: Suggest lighter plan, more rest
- **Overtraining**: Reduce volume even if adherence is good
- **First week**: No adherence check yet, establish baseline

## Testing considerations
- Test all adherence categories (excellent to poor)
- Verify pattern detection accuracy
- Test reshuffle suggestions appropriateness
- Validate motivational message tone
- Test SafetyFlag emission for risky catch-ups
- Verify no shaming/guilting language
