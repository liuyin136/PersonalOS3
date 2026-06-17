/**
 * Memory Cart API — Workflow 3: Memory Cart Temporary Storage Flow
 * Endpoints: /api/cart
 *
 * NOTE: Cart is primarily client-managed via Zustand (lib/store/cart-store).
 * These API endpoints handle server-side token counting & optimization.
 */
import { request } from './client'
import type {
  CartOptimizeRequest,
  CartOptimizeResponse,
} from '@/types/rag'

export const cartApi = {
  /** Count tokens for arbitrary text using the backend tokenizer. */
  async countTokens(text: string): Promise<number> {
    return request<number>(
      '/cart/tokens',
      { method: 'POST', body: { text }, mockDelay: 200 },
      () => Math.ceil(text.length / 3.8),
    )
  },

  /** Optimize selected cart items via a chosen strategy. */
  async optimize(payload: CartOptimizeRequest): Promise<CartOptimizeResponse> {
    return request<CartOptimizeResponse>(
      '/cart/optimize',
      { method: 'POST', body: payload, mockDelay: 700 },
      () => ({
        items: [],
        originalTokens: payload.targetTokens ?? 0,
        optimizedTokens: Math.round((payload.targetTokens ?? 0) * 0.7),
        removedCount: 0,
      }),
    )
  },
}
