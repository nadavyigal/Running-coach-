import { randomUUID } from 'node:crypto'
import { ChatMessageCreateInput, ChatMessageDTO, ChatUserProfile } from '@/lib/models/chat'

interface ConversationKey {
  userId: number
  conversationId: string
}

interface ChatRepositoryStore {
  users: Map<number, ChatUserProfile>
  conversations: Map<string, ChatMessageDTO[]>
}

type GlobalWithChatStore = typeof globalThis & {
  __chatRepositoryStore?: ChatRepositoryStore
}

function getStore(): ChatRepositoryStore {
  const globalWithStore = globalThis as GlobalWithChatStore
  if (!globalWithStore.__chatRepositoryStore) {
    globalWithStore.__chatRepositoryStore = {
      users: new Map(),
      conversations: new Map(),
    }
  }
  return globalWithStore.__chatRepositoryStore
}

function toConversationKey({ userId, conversationId }: ConversationKey): string {
  return `${userId}:${conversationId}`
}

function cloneMessage(message: ChatMessageDTO): ChatMessageDTO {
  return { ...message }
}

function cloneUser(user: ChatUserProfile): ChatUserProfile {
  return { ...user }
}

async function saveUserProfile(profile: ChatUserProfile): Promise<void> {
  const store = getStore()
  store.users.set(profile.id, {
    ...profile,
    createdAt: profile.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

async function getUserById(userId: number): Promise<ChatUserProfile | null> {
  const store = getStore()
  const user = store.users.get(userId)
  return user ? cloneUser(user) : null
}

async function getChatHistory(userId: number, conversationId: string = 'default'): Promise<ChatMessageDTO[]> {
  const store = getStore()
  const key = toConversationKey({ userId, conversationId })
  const messages = store.conversations.get(key) ?? []
  return messages
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(cloneMessage)
}

async function createChatMessage(input: ChatMessageCreateInput): Promise<ChatMessageDTO> {
  const store = getStore()
  const conversationId = input.conversationId ?? 'default'
  const key = toConversationKey({ userId: input.userId, conversationId })
  const timestamp = input.timestamp ?? new Date().toISOString()
  const message: ChatMessageDTO = {
    id: input.id ?? randomUUID(),
    userId: input.userId,
    role: input.role,
    content: input.content,
    conversationId,
    ...(typeof input.tokenCount === 'number' && Number.isFinite(input.tokenCount) ? { tokenCount: input.tokenCount } : {}),
    ...(typeof input.aiContext === 'string' ? { aiContext: input.aiContext } : {}),
    timestamp,
  }

  const messages = store.conversations.get(key) ?? []
  messages.push(message)
  store.conversations.set(key, messages)

  return cloneMessage(message)
}

async function clearStore(): Promise<void> {
  const store = getStore()
  store.users.clear()
  store.conversations.clear()
}

export const chatRepository = {
  saveUserProfile,
  getUserById,
  getChatHistory,
  createChatMessage,
  clearStore,
}

export type ChatRepository = typeof chatRepository

export async function __resetChatRepositoryForTests(): Promise<void> {
  await clearStore()
}
