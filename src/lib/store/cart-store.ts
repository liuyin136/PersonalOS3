/**
 * Memory Cart store — Workflow 3.
 * Client-side cart state synced with optional server-side optimization.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, SearchHit, CartSummary } from '@/types/rag'
import { uid } from '@/lib/api/client'

interface CartState {
  items: CartItem[]
  contextLimit: number

  addFromHit: (hit: SearchHit) => void
  remove: (cartItemId: string) => void
  toggleSelect: (cartItemId: string) => void
  clear: () => void
  clearSelected: () => void
  setContextLimit: (limit: number) => void
  getSummary: () => CartSummary
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8)
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      contextLimit: 128000,

      addFromHit: (hit) =>
        set((state) => {
          if (state.items.some((i) => i.id === hit.id)) return state
          const item: CartItem = {
            id: hit.id,
            cartItemId: uid('cart'),
            documentId: hit.documentId,
            documentTitle: hit.documentTitle,
            chunkIndex: hit.chunkIndex,
            content: hit.content,
            tokenCount: estimateTokens(hit.content),
            sourceType: hit.sourceType,
            tags: hit.tags,
            addedAt: new Date().toISOString(),
            selected: true,
          }
          return { items: [...state.items, item] }
        }),

      remove: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartItemId !== cartItemId),
        })),

      toggleSelect: (cartItemId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.cartItemId === cartItemId ? { ...i, selected: !i.selected } : i,
          ),
        })),

      clear: () => set({ items: [] }),

      clearSelected: () =>
        set((state) => ({ items: state.items.filter((i) => !i.selected) })),

      setContextLimit: (limit) => set({ contextLimit: limit }),

      getSummary: () => {
        const items = get().items
        const selected = items.filter((i) => i.selected)
        return {
          itemCount: items.length,
          selectedCount: selected.length,
          totalTokens: items.reduce((s, i) => s + i.tokenCount, 0),
          selectedTokens: selected.reduce((s, i) => s + i.tokenCount, 0),
          contextLimit: get().contextLimit,
        }
      },
    }),
    { name: 'verdant-cart' },
  ),
)
