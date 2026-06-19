/**
 * Memory Cart API — Workflow 3
 * Endpoints: /cart/tokens
 *
 * NOTE: Cart state is primarily client-managed via Zustand (lib/store/cart-store).
 * The backend provides token counting (real tokenizer) and optimization.
 */
import { request } from './client'
import type { CartOptimizeRequest, CartOptimizeResponse } from '@/types/rag'

export const cartApi = {
  /** Count tokens for arbitrary text using the backend tokenizer. */
  async countTokens(text: string): Promise<number> {
    const data = await request<{ token_count: number } | number>(
      '/api/cart/tokens',
      { method: 'POST', body: { text } },
    )
    return typeof data === 'number' ? data : Number(data.token_count ?? 0)
  },

  /** Optimize selected cart items via a chosen strategy. */
  async optimize(payload: CartOptimizeRequest): Promise<CartOptimizeResponse> {
    const data = await request<Record<string, unknown>>('/api/cart/optimize', {
      method: 'POST',
      body: payload,
    })
    return {
      items: (data.items as CartOptimizeResponse['items']) ?? [],
      originalTokens: Number(data.original_tokens ?? data.originalTokens ?? 0),
      optimizedTokens: Number(data.optimized_tokens ?? data.optimizedTokens ?? 0),
      removedCount: Number(data.removed_count ?? data.removedCount ?? 0),
    }
  },
}
