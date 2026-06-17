/**
 * Structured Chat store — Workflow 4.
 * Holds selected template, variable values, chat parameters and message history.
 */
import { create } from 'zustand'
import type {
  PromptTemplate,
  ChatParameters,
  ChatMessage,
} from '@/types/rag'

interface ChatState {
  template: PromptTemplate | null
  variables: Record<string, string>
  parameters: ChatParameters
  messages: ChatMessage[]
  selectedContextIds: string[]

  setTemplate: (t: PromptTemplate | null) => void
  setVariable: (key: string, value: string) => void
  setParameters: (p: Partial<ChatParameters>) => void
  setContextIds: (ids: string[]) => void
  addMessage: (m: ChatMessage) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  clearMessages: () => void
}

const defaultParameters: ChatParameters = {
  model: 'gpt-4o',
  temperature: 0.3,
  maxTokens: 2048,
  topP: 1,
  stream: true,
  useContext: true,
}

export const useChatStore = create<ChatState>((set) => ({
  template: null,
  variables: {},
  parameters: defaultParameters,
  messages: [],
  selectedContextIds: [],

  setTemplate: (t) =>
    set(() => ({
      template: t,
      variables: t
        ? Object.fromEntries(t.variables.map((v) => [v.key, v.defaultValue ?? '']))
        : {},
    })),

  setVariable: (key, value) =>
    set((state) => ({ variables: { ...state.variables, [key]: value } })),

  setParameters: (p) =>
    set((state) => ({ parameters: { ...state.parameters, ...p } })),

  setContextIds: (ids) => set({ selectedContextIds: ids }),

  addMessage: (m) =>
    set((state) => ({ messages: [...state.messages, m] })),

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    })),

  clearMessages: () => set({ messages: [] }),
}))
