import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock OpenAI
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({
    streamText: vi.fn()
  }))
}))

// Mock the AI SDK
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    text: Promise.resolve("That's great! Let's explore your goals further.")
  }))
}))

describe('goalWizard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for invalid request format', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({})
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request format')
  })

  it('processes motivation phase correctly', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to get healthier' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'motivation',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'motivation'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.response).toBeDefined()
    expect(data.nextPhase).toBe('motivation') // Should stay in motivation phase for short conversation
    expect(data.goals).toEqual([])
    expect(data.userProfile).toEqual({})
  })

  it('advances to assessment phase after sufficient messages', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to get healthier' },
          { role: 'assistant', content: 'That\'s great! What specific health goals do you have?' },
          { role: 'user', content: 'I want to have more energy and maybe lose some weight' },
          { role: 'assistant', content: 'I love that! Have you tried running before?' },
          { role: 'user', content: 'No, this would be my first time' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'motivation',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'motivation'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.nextPhase).toBe('assessment')
  })

  it('generates goals in creation phase', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to build a consistent running habit' },
          { role: 'assistant', content: 'That\'s great! What specific goals do you have?' },
          { role: 'user', content: 'I want to run 3 times per week consistently' },
          { role: 'assistant', content: 'Perfect! Let\'s create some specific goals.' },
          { role: 'user', content: 'I want to run 3 times per week' },
          { role: 'assistant', content: 'Great! Let\'s make this more specific.' },
          { role: 'user', content: 'I want to run 3 times per week for 4 weeks' },
          { role: 'assistant', content: 'Excellent! Let\'s refine this goal.' },
          { role: 'user', content: 'I want to run 3 times per week for 4 weeks consistently' },
          { role: 'assistant', content: 'Perfect! Let\'s add some milestones.' },
          { role: 'user', content: 'I want to run 3 times per week for 4 weeks with weekly milestones' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'creation',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'creation'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.nextPhase).toBe('refinement')
    expect(data.goals).toHaveLength(1)
    expect(data.goals[0].type).toBe('habit')
    expect(data.goals[0].description).toBe('Build a Consistent Running Habit')
  })

  it('completes onboarding with user profile', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to run a 5K' },
          { role: 'assistant', content: 'That\'s great! Let\'s assess your experience.' },
          { role: 'user', content: 'I\'m a beginner' },
          { role: 'assistant', content: 'Perfect! Let\'s create your goals.' },
          { role: 'user', content: 'I want to complete a 5K' },
          { role: 'assistant', content: 'Great! Let\'s make this specific.' },
          { role: 'user', content: 'I want to complete a 5K in 3 months' },
          { role: 'assistant', content: 'Excellent! Let\'s refine this.' },
          { role: 'user', content: 'I want to complete a 5K without walking in 3 months' },
          { role: 'assistant', content: 'Perfect! Let\'s finalize your goals.' },
          { role: 'user', content: 'Yes, that sounds perfect' },
          { role: 'assistant', content: 'Great! Let\'s confirm everything.' },
          { role: 'user', content: 'I\'m ready to start' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'refinement',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'refinement'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.nextPhase).toBe('complete')
    expect(data.goals).toHaveLength(1)
    expect(data.goals[0].type).toBe('distance')
    expect(data.userProfile).toBeDefined()
    expect(data.userProfile.goal).toBe('distance')
    expect(data.userProfile.coachingStyle).toBe('supportive')
  })

  it('detects coaching style from user messages', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to be competitive and challenge myself' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'motivation',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'motivation'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.coachingStyle).toBe('challenging')
  })

  it('handles API errors gracefully', async () => {
    // Mock the AI SDK to throw an error
    const { streamText } = require('ai')
    streamText.mockImplementation(() => {
      throw new Error('API Error')
    })

    const req = new NextRequest('http://localhost:3000/api/onboarding/goalWizard', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hi! What made you decide to start running?' },
          { role: 'user', content: 'I want to get healthier' }
        ],
        session: {
          conversationId: 'test-123',
          goalDiscoveryPhase: 'motivation',
          discoveredGoals: [],
          coachingStyle: 'supportive'
        },
        currentPhase: 'motivation'
      })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('An unexpected error occurred. Please try again.')
  })
}) 