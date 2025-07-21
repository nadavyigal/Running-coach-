# Change Brief: AI Coach-Guided Onboarding with Goal Setting

## Executive Summary

**Proposal**: Transform the current static onboarding flow into an interactive, AI coach-guided conversation that assists users in setting personalized running goals based on their individual circumstances, motivations, and capabilities.

**Current State**: Static 8-step form-based onboarding
**Proposed State**: Dynamic AI coach conversation with intelligent goal setting assistance

---

## Current State Analysis

### Existing Onboarding Flow
1. **Welcome Screen** - Static introduction
2. **Goal Selection** - 3 predefined categories (habit/distance/speed)
3. **Experience Level** - Basic categorization (beginner/occasional/regular)
4. **RPE Assessment** - Optional fitness self-assessment
5. **Age Collection** - Simple number input
6. **Schedule Preferences** - Time slots and frequency
7. **Privacy Consents** - Legal requirements
8. **Summary & Confirmation** - Review and complete

### Current Limitations
- **Rigid Goal Categories**: Limited to 3 broad goal types
- **No Context Understanding**: Doesn't explore WHY users want to run
- **Missed Opportunities**: No exploration of barriers, motivations, or specific circumstances
- **Generic Output**: Same goal categories produce similar plans regardless of individual nuances
- **No Guidance**: Users make choices without expert input or consideration of realistic expectations

---

## Proposed Solution: AI Coach-Guided Onboarding

### Vision Statement
*"An empathetic AI running coach that guides users through a conversational goal-setting process, helping them discover and articulate meaningful, achievable running objectives tailored to their unique life circumstances."*

### Core Components

#### 1. **Conversational Interface**
- Replace static forms with dynamic chat interface
- Adaptive questioning based on user responses
- Natural language processing for nuanced understanding
- Real-time clarification and follow-up questions

#### 2. **Intelligent Goal Discovery**
Instead of choosing from 3 categories, users engage in guided exploration:
- **Motivation Exploration**: "What draws you to running?"
- **Lifestyle Assessment**: "Tell me about your current schedule and constraints"
- **Experience Mining**: "Have you tried running before? What worked/didn't work?"
- **Aspiration Mapping**: "If you could achieve anything with running, what would it be?"
- **Barrier Identification**: "What might make it challenging for you to stick with running?"

#### 3. **SMART Goal Co-Creation**
The AI coach helps users develop:
- **Specific**: Clear, well-defined objectives
- **Measurable**: Quantifiable success criteria  
- **Achievable**: Realistic based on their starting point
- **Relevant**: Aligned with their personal motivations
- **Time-bound**: Clear timelines and milestones

#### 4. **Personalized Coaching Tone**
Based on user responses, establish coaching style:
- **Supportive** for anxious beginners
- **Challenging** for competitive personalities
- **Analytical** for data-driven users
- **Encouraging** for those lacking confidence

---

## Technical Impact Analysis

### Architecture Changes

#### **High Impact Changes**
1. **New Onboarding Chat Component**
   - Build conversation UI similar to existing ChatScreen
   - Implement state management for progressive conversation
   - Create onboarding-specific conversation flows

2. **Enhanced Goal System**
   - Extend current Goal interfaces to support SMART criteria
   - Add goal templates and guided creation
   - Implement goal validation and refinement logic

3. **AI Coaching Integration**
   - Extend adaptiveCoachingEngine for onboarding contexts
   - Create specialized prompts for goal-setting conversations
   - Implement conversation state management

#### **Medium Impact Changes**
1. **Database Schema Extensions**
   ```typescript
   interface EnhancedUser {
     // Existing fields...
     motivations: string[];
     barriers: string[];
     personalityProfile: CoachingPersonality;
     goalSettingSession: OnboardingSession;
   }
   
   interface OnboardingSession {
     conversationId: string;
     goalDiscoveryPhase: 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete';
     discoveredGoals: SmartGoal[];
     coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
   }
   ```

2. **API Route Enhancements**
   - Extend `/api/chat` for onboarding-specific conversations
   - Create `/api/onboarding/goals` for goal creation assistance
   - Add `/api/onboarding/assessment` for dynamic questioning

#### **Low Impact Changes**
1. **UI/UX Adaptations**
   - Modify navigation flow to accommodate variable-length onboarding
   - Add progress indicators for conversation phases
   - Implement conversation history and ability to revisit decisions

### Dependencies

#### **Existing Systems Leveraged**
✅ **adaptiveCoachingEngine** - Already implemented for personalized coaching
✅ **OpenAI Integration** - Existing chat infrastructure
✅ **Goal System** - Foundation exists in goal-creation-wizard
✅ **Database Architecture** - Extensible schema with Dexie.js

#### **New Dependencies Required**
- **Conversation State Management** - Track multi-turn goal discovery
- **Goal Template System** - Predefined SMART goal frameworks
- **Progressive Disclosure Logic** - Dynamic question selection
- **Session Persistence** - Save partial onboarding sessions

---

## User Experience Design

### Conversation Flow Example

```
🤖 Coach: "Hi! I'm excited to help you start your running journey. Before we dive into creating a plan, I'd love to understand what brought you here today. What made you decide to start running?"

👤 User: "I want to get healthier and maybe lose some weight"

🤖 Coach: "That's a great motivation! Health and wellness are fantastic reasons to start running. When you think about being healthier, what would that look like for you in 3-6 months? Are there specific changes you're hoping to see?"

👤 User: "I'd like to have more energy and maybe run a 5K without stopping"

🤖 Coach: "I love that! Having more energy for daily life AND being able to complete a 5K - those are both achievable and meaningful goals. Let's explore this a bit more. Have you tried running before, or would this be your first time establishing a regular running routine?"

... [conversation continues, building towards SMART goals]

🤖 Coach: "Based on our conversation, I think we can create some really exciting goals for you:

**Primary Goal**: Complete a 5K run without walking by [3 months from now]
**Supporting Goal**: Run 3 times per week consistently for energy improvement
**Health Goal**: Track how your energy levels improve over the next 12 weeks

Does this feel exciting and achievable to you? Should we adjust anything?"
```

### Progressive Goal Refinement

#### Phase 1: Motivation Discovery (2-3 exchanges)
- Explore WHY they want to run
- Understand current lifestyle and constraints
- Identify personality indicators for coaching style

#### Phase 2: Experience Assessment (2-4 exchanges)  
- Previous running/fitness experience
- What worked/didn't work in the past
- Current physical activity level
- Time availability and schedule constraints

#### Phase 3: Goal Co-Creation (3-5 exchanges)
- Transform motivations into specific objectives
- Set realistic timelines based on experience
- Create accountability measures
- Identify potential obstacles and solutions

#### Phase 4: Plan Preview & Commitment (1-2 exchanges)
- Show preview of personalized training plan
- Confirm goal commitment and excitement level
- Establish coaching relationship and communication preferences

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)
**Priority: Critical**
- [ ] Create OnboardingChatComponent with conversation UI
- [ ] Implement basic conversation state management
- [ ] Extend User model with motivation/barrier fields
- [ ] Build goal discovery conversation prompts

**Deliverables:**
- Functional onboarding chat interface
- Basic conversation flow (motivation → goals)
- Enhanced user profile creation

### Phase 2: Intelligence Layer (2-3 weeks)
**Priority: High**
- [ ] Implement SMART goal creation logic
- [ ] Build adaptive questioning system
- [ ] Create coaching personality detection
- [ ] Add goal validation and refinement

**Deliverables:**
- AI-powered goal suggestions
- Personalized coaching tone adaptation
- Goal quality assessment and improvement

### Phase 3: Integration & Polish (1-2 weeks)
**Priority: Medium**
- [ ] Connect to existing training plan generation
- [ ] Implement conversation history and resume capability
- [ ] Add progress visualization for onboarding
- [ ] Create fallback flows for AI unavailability

**Deliverables:**
- Seamless integration with existing plan generation
- Robust error handling and fallbacks
- Polished user experience

### Phase 4: Optimization (1-2 weeks)
**Priority: Low**
- [ ] A/B testing framework for conversation effectiveness
- [ ] Analytics tracking for goal achievement correlation
- [ ] Advanced goal templates and industry best practices
- [ ] Integration with performance tracking for goal updates

**Deliverables:**
- Data-driven conversation optimization
- Goal achievement tracking and analysis
- Continuous improvement capabilities

---

## Risk Assessment & Mitigation

### High-Risk Areas

#### **AI Dependency Risk**
- **Risk**: OpenAI API failures during critical onboarding
- **Mitigation**: Intelligent fallback to guided form-based onboarding
- **Fallback Strategy**: Maintain existing onboarding as backup option

#### **Conversation Length Risk**  
- **Risk**: Users abandon due to lengthy onboarding conversations
- **Mitigation**: 
  - Implement save/resume functionality
  - Set maximum conversation length (10-12 exchanges)
  - Provide "quick start" option for impatient users

#### **Goal Quality Risk**
- **Risk**: AI suggests unrealistic or inappropriate goals
- **Mitigation**:
  - Implement goal validation logic
  - Create safety guardrails based on user experience level
  - Allow easy goal modification post-onboarding

### Medium-Risk Areas

#### **User Confusion Risk**
- **Risk**: Users don't understand the conversation format
- **Mitigation**: Clear onboarding intro explaining the process

#### **Technical Complexity Risk**
- **Risk**: Conversation state management becomes complex
- **Mitigation**: Use existing chat infrastructure as foundation

---

## Success Metrics

### Primary KPIs
1. **Goal Achievement Rate**: % of users who achieve their onboarding goals within timeline
2. **Plan Adherence**: Improved training plan completion rates vs. current onboarding
3. **User Satisfaction**: NPS/satisfaction scores for onboarding experience
4. **Goal Quality**: SMART goal criteria completion rate

### Secondary KPIs
1. **Onboarding Completion Rate**: % who complete the new guided process
2. **Time to First Run**: Days from onboarding completion to first recorded run
3. **Long-term Retention**: 30/60/90-day active user retention
4. **Conversation Efficiency**: Average number of exchanges to goal creation

### Analytics Implementation
```typescript
// New tracking events
trackOnboardingEvent('conversation_started', { userId, timestamp });
trackOnboardingEvent('goal_discovered', { userId, goalType, confidence });
trackOnboardingEvent('goal_refined', { userId, iterations, finalGoal });
trackOnboardingEvent('onboarding_completed', { userId, conversationLength, goalsCreated });
```

---

## Resource Requirements

### Development Resources
- **Frontend Developer**: 3-4 weeks (conversation UI, state management)
- **Backend Developer**: 2-3 weeks (AI integration, goal system extensions)
- **UX Designer**: 1-2 weeks (conversation flow design, progress indicators)

### Infrastructure
- **OpenAI API Costs**: Estimated $0.10-0.30 per onboarding session
- **Storage**: Minimal additional database storage for conversation history

### Testing Requirements
- **User Testing**: 20-30 beta users for conversation flow validation
- **A/B Testing**: Compare new vs. old onboarding completion and outcomes
- **Performance Testing**: Conversation responsiveness and AI reliability

---

## Alternative Approaches Considered

### Option A: Hybrid Approach
**Description**: AI coach appears in specific steps of existing onboarding
**Pros**: Lower risk, easier implementation
**Cons**: Less transformative impact, fragmented experience

### Option B: Wizard-Style Guided Questions
**Description**: Dynamic questioning without full conversation
**Pros**: Middle ground between static and conversational
**Cons**: Still feels like a form, misses conversational benefits

### Option C: Post-Onboarding Goal Setting
**Description**: Complete standard onboarding, then AI goal session
**Pros**: Doesn't disrupt existing flow
**Cons**: Misses opportunity to tailor entire experience to discovered goals

**Selected Approach**: Full conversational onboarding for maximum personalization impact

---

## Conclusion

This change brief proposes a significant enhancement to the user onboarding experience that leverages existing technical infrastructure while providing transformative value. The AI coach-guided goal setting addresses key limitations in the current system and aligns with the application's vision of providing personalized, intelligent running coaching.

The phased implementation approach allows for incremental delivery and risk mitigation while building toward a more engaging and effective onboarding experience that should improve both user satisfaction and long-term goal achievement rates.

**Recommendation**: Proceed with Phase 1 implementation to validate the core concept while building foundation for subsequent enhancements.