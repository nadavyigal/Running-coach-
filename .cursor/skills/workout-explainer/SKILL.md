---
name: workout-explainer
description: Translates planned workouts into execution cues, purpose explanations, and common mistakes to avoid. Use before workouts when user asks "what should I do?" or "how do I run this session?" with beginner-friendly guidance.
metadata:
  short-description: Explains workouts with cues, intent, and safe substitutions.
  agent: cursor
---

## When Cursor should use this skill
- When the user opens a workout detail modal or asks "how do I do this workout?"
- During chat if the user needs clarifications or substitutions
- When user wants to understand workout purpose or execution details
- When implementing workout guidance features or debugging workout explanations

## Invocation guidance
1. Provide the `Workout` object and user capability context (experience, recent runs).
2. Return execution cues, purpose, common mistakes, and two substitutions.
3. Keep guidance concise (<120 words) and beginner-friendly when experience is low.
4. Include specific pace/HR targets if available.
5. Tailor complexity to user experience level.

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Integration points
- **UI**: 
  - Workout detail modal
  - Plan screen tooltips
  - Pre-run guidance screen
- **Chat**: Served through `v0/app/api/chat/route.ts` with `workout-explainer` intent
- **Database**: Workout details from `workouts` table

## Safety & guardrails
- If workout intensity mismatches user level, propose easier substitution and emit `SafetyFlag`.
- No medical advice; advise stopping on pain/dizziness.
- If weather is extreme, suggest indoor or modified alternatives.
- Always provide at least one easier substitution option.
- Emphasize form over speed for beginners.

## Workout type patterns

### Easy Run
**Purpose**: Build aerobic base, recovery, fat adaptation
**Execution**: Conversational pace, relaxed form, low HR (60-75% max)
**Cues**:
- "Should be able to chat comfortably"
- "Nose breathing if possible"
- "Slow is the goal"
**Mistakes to avoid**:
- Starting too fast
- Trying to keep up with faster runners
- Skipping recovery runs
**Substitutions**:
- Shorten duration by 20-30%
- Walk/run intervals
- Indoor treadmill at controlled pace

### Tempo Run
**Purpose**: Lactate threshold training, race pace simulation
**Execution**: Comfortably hard, controlled breathing, HR 75-85% max
**Cues**:
- "Can speak short sentences"
- "Controlled breathing rhythm"
- "Sustainable effort"
**Mistakes to avoid**:
- Going too hard too early
- Poor pacing (uneven splits)
- Not warming up properly
**Substitutions**:
- Fartlek with tempo segments
- Cruise intervals (5min tempo, 2min easy, repeat)
- Sustained hill repeats

### Interval Workout
**Purpose**: VO2max improvement, speed development, running economy
**Execution**: Hard effort with recovery periods, HR 85-95% max
**Cues**:
- "Focus on smooth acceleration"
- "Full recovery between reps"
- "Maintain form even when tired"
**Mistakes to avoid**:
- Inadequate warm-up
- Too fast on first intervals
- Skipping recovery periods
**Substitutions**:
- Reduce interval count by 30-50%
- Extend recovery periods
- Hill repeats (lower impact)

### Long Run
**Purpose**: Endurance building, mental toughness, fat adaptation
**Execution**: Easy-moderate pace, sustained effort, HR 65-80% max
**Cues**:
- "Start conservatively"
- "Fuel every 45-60 minutes"
- "Stay relaxed and efficient"
**Mistakes to avoid**:
- Starting too fast
- Skipping nutrition/hydration
- Running too hard (should be easy-moderate)
**Substitutions**:
- Break into two shorter runs
- Walk breaks every 10 minutes
- Reduce distance by 20-30%

### Rest Day
**Purpose**: Physical recovery, adaptation, injury prevention
**Execution**: No running, active recovery optional
**Cues**:
- "Rest is training too"
- "Light stretching or yoga okay"
- "Focus on sleep and nutrition"
**Mistakes to avoid**:
- "Making up" missed runs
- Intense cross-training
- Feeling guilty about resting
**Substitutions**:
- Gentle walk (20-30 minutes)
- Swimming or cycling (very easy)
- Yoga or stretching routine

## Experience-level adaptations

### Beginner
- Simpler language, fewer technical terms
- More encouragement and reassurance
- Focus on completion over performance
- Emphasize safety and form
- Suggest walk breaks as normal, not failure

### Intermediate
- Include pace/HR targets
- Technical cues for efficiency
- Connection to goal race pace
- Progressive challenge suggestions

### Advanced
- Detailed physiological explanations
- Advanced pacing strategies
- Race-specific adaptations
- Performance optimization tips

## Telemetry
- Emit `ai_skill_invoked` with:
  - `workout_type`
  - `experience`
  - `safety_flags`
  - `substitution_provided` (boolean)
  - `latency_ms`

## Common edge cases
- **Bad weather**: Provide indoor alternatives
- **Injury recovery**: Suggest modified versions
- **No equipment**: Alternatives without treadmill/track
- **Time constraints**: Shortened versions that maintain workout intent
- **Confidence issues**: Extra encouragement, break into smaller chunks

## Testing considerations
- Test with each workout type
- Verify beginner vs advanced language differences
- Test substitution appropriateness
- Validate cue clarity and actionability
- Test SafetyFlag emission for mismatch scenarios
- Verify purpose explanation accuracy
