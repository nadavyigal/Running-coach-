import { describe, beforeEach, it, expect } from 'vitest'
import { chatRepository, __resetChatRepositoryForTests } from '@/lib/server/chatRepository'
import type { ChatUserProfile } from '@/lib/models/chat'

describe('chatRepository chat flow', () => {
  const baseProfile: ChatUserProfile = {
    id: 42,
    name: 'Test Runner',
    goal: 'habit',
    experience: 'beginner',
    preferredTimes: ['morning'],
    daysPerWeek: 3,
    onboardingComplete: true,
  }

  beforeEach(async () => {
    await __resetChatRepositoryForTests()
    await chatRepository.saveUserProfile(baseProfile)
  })

  it('stores and retrieves consecutive chat turns', async () => {
    const firstUserMessage = await chatRepository.createChatMessage({
      userId: baseProfile.id,
      role: 'user',
      content: 'Hey coach, can you help me plan a 5k?',
      conversationId: 'default',
    })

    expect(firstUserMessage.role).toBe('user')

    const firstAssistantMessage = await chatRepository.createChatMessage({
      userId: baseProfile.id,
      role: 'assistant',
      content: 'Absolutely! Tell me about your current running routine.',
      conversationId: 'default',
    })

    expect(firstAssistantMessage.role).toBe('assistant')

    let history = await chatRepository.getChatHistory(baseProfile.id, 'default')
    expect(history).toHaveLength(2)
    expect(history[0].content).toContain('5k')
    expect(history[1].content).toContain('Absolutely')

    await chatRepository.createChatMessage({
      userId: baseProfile.id,
      role: 'user',
      content: 'I run twice a week for about 20 minutes.',
      conversationId: 'default',
    })

    await chatRepository.createChatMessage({
      userId: baseProfile.id,
      role: 'assistant',
      content: 'Great! We can build from that foundation over the next four weeks.',
      conversationId: 'default',
    })

    history = await chatRepository.getChatHistory(baseProfile.id, 'default')
    expect(history).toHaveLength(4)
    expect(history[3].content).toContain('next four weeks')
  })
})
