/**
 * Settings API — model selection for chat / embedding / reranker
 * Endpoints: /settings, /settings/catalog
 */
import { request } from './client'
import type { ModelSettings, ModelCatalog, ModelOption } from '@/types/rag'

function mapSettings(s: Record<string, unknown>): ModelSettings {
  return {
    chatModel: String(s.chat_model ?? s.chatModel ?? ''),
    embeddingModel: String(s.embedding_model ?? s.embeddingModel ?? ''),
    rerankerModel: String(s.reranker_model ?? s.rerankerModel ?? ''),
    chatTemperature: Number(s.chat_temperature ?? s.chatTemperature ?? 0.3),
    chatMaxTokens: Number(s.chat_max_tokens ?? s.chatMaxTokens ?? 2048),
    contextLimit: Number(s.context_limit ?? s.contextLimit ?? 128000),
  }
}

export const settingsApi = {
  async getCatalog(): Promise<ModelCatalog> {
    const data = await request<Record<string, unknown>>('/api/settings/catalog')
    const map = (arr: unknown): ModelOption[] =>
      ((arr as Record<string, unknown>[]) ?? []).map((o) => ({
        value: String(o.value),
        label: String(o.label),
        description: String(o.description ?? ''),
      }))
    return {
      chatModels: map(data.chat_models ?? data.chatModels),
      embeddingModels: map(data.embedding_models ?? data.embeddingModels),
      rerankerModels: map(data.reranker_models ?? data.rerankerModels),
    }
  },

  async getSettings(): Promise<ModelSettings> {
    const data = await request<Record<string, unknown>>('/api/settings')
    return mapSettings(data)
  },

  async updateSettings(payload: ModelSettings): Promise<ModelSettings> {
    const body = {
      chat_model: payload.chatModel,
      embedding_model: payload.embeddingModel,
      reranker_model: payload.rerankerModel,
      chat_temperature: payload.chatTemperature,
      chat_max_tokens: payload.chatMaxTokens,
      context_limit: payload.contextLimit,
    }
    const data = await request<Record<string, unknown>>('/api/settings', {
      method: 'PUT',
      body,
    })
    return mapSettings(data)
  },
}
