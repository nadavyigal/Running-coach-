import type { ChatMessage as DexieChatMessage, User as DexieUser } from '@/lib/db'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessageCore {
  userId: number
  role: ChatRole
  content: string
  conversationId?: string
  tokenCount?: number
  aiContext?: string
}

export interface ChatMessageDTO extends ChatMessageCore {
  id: string
  timestamp: string
}

export interface ChatMessageCreateInput extends ChatMessageCore {
  id?: string
  timestamp?: string
}

export interface ChatUserProfile {
  id: number
  name?: string
  goal?: DexieUser['goal']
  experience?: DexieUser['experience']
  preferredTimes?: DexieUser['preferredTimes']
  daysPerWeek?: DexieUser['daysPerWeek']
  onboardingComplete?: boolean
  createdAt?: string
  updatedAt?: string
}

function fallbackId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function dexieChatMessageToDTO(message: DexieChatMessage): ChatMessageDTO {
  return {
    id: message.id?.toString() ?? fallbackId(),
    userId: message.userId,
    role: message.role,
    content: message.content,
    conversationId: message.conversationId,
    tokenCount: message.tokenCount,
    aiContext: message.aiContext,
    timestamp: (message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)).toISOString(),
  }
}

export function dtoToDexieChatMessage(dto: ChatMessageDTO): DexieChatMessage {
  return {
    id: Number.isNaN(Number(dto.id)) ? undefined : Number(dto.id),
    userId: dto.userId,
    role: dto.role,
    content: dto.content,
    conversationId: dto.conversationId,
    tokenCount: dto.tokenCount,
    aiContext: dto.aiContext,
    timestamp: new Date(dto.timestamp),
  }
}

export function dexieUserToChatProfile(user: DexieUser): ChatUserProfile {
  if (!user.id) {
    throw new Error('Cannot convert Dexie user without an id to chat profile')
  }

  return {
    id: user.id,
    name: user.name,
    goal: user.goal,
    experience: user.experience,
    preferredTimes: user.preferredTimes,
    daysPerWeek: user.daysPerWeek,
    onboardingComplete: user.onboardingComplete,
    createdAt: (user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt)).toISOString(),
    updatedAt: (user.updatedAt instanceof Date ? user.updatedAt : new Date(user.updatedAt)).toISOString(),
  }
}
