'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Search, Trash2, CheckSquare, Square, FlaskConical } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { CartItemRow } from '@/components/cart/cart-item-row'
import { TokenCounter } from '@/components/cart/token-counter'
import { OptimizationPanel } from '@/components/cart/optimization-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCartStore } from '@/lib/store/cart-store'
import { uid } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { SearchHit } from '@/types/rag'

/** Demo items used to preview the populated cart experience. */
function buildSampleHits(): SearchHit[] {
  return [
    {
      id: uid('hit'),
      documentId: 'doc_rag-overview',
      documentTitle: 'Retrieval-Augmented Generation: An Overview',
      chunkIndex: 0,
      content:
        '# RAG Overview\n\nRetrieval-Augmented Generation (RAG) combines a **retriever** with a **generator**. The retriever surfaces relevant passages from a vector store, and the generator conditions its answer on those passages.\n\n- *Vector retrieval* uses pgvector + cosine similarity.\n- *Keyword retrieval* uses BM25 over a tokenized inverted index.\n- *Hybrid retrieval* blends the two with an alpha weight.\n\n> A well-tuned RAG system surfaces the right context — and only the right context.',
      vectorScore: 0.92,
      keywordScore: 0.78,
      hybridScore: 0.87,
      sourceType: 'markdown',
      tags: ['rag', 'architecture', 'retrieval'],
      namespace: 'core-concepts',
      metadata: {},
    },
    {
      id: uid('hit'),
      documentId: 'doc_chunking-strategies',
      documentTitle: 'Chunking Strategies for Long Documents',
      chunkIndex: 3,
      content:
        '## Chunking Strategies\n\nChoosing the right chunk size directly affects retrieval quality.\n\n| Strategy | Pros | Cons |\n| --- | --- | --- |\n| Fixed | Simple, predictable | Can split mid-sentence |\n| Recursive | Respects structure | Slower |\n| Semantic | Coherent meaning | Model-dependent |\n\n**Recommendation:** start with `recursive` at 512 tokens and 64 overlap, then tune based on recall metrics.',
      vectorScore: 0.88,
      keywordScore: 0.71,
      hybridScore: 0.82,
      sourceType: 'pdf',
      tags: ['chunking', 'optimization', 'tokens'],
      namespace: 'engineering',
      metadata: {},
    },
    {
      id: uid('hit'),
      documentId: 'doc_prompt-engineering',
      documentTitle: 'Prompt Engineering for Structured Output',
      chunkIndex: 1,
      content:
        '### Structured Prompting\n\nWhen asking an LLM for structured output, declare the schema explicitly in the system prompt and constrain the model with `temperature: 0`.\n\n```json\n{\n  "answer": "string",\n  "citations": ["string"],\n  "confidence": "number"\n}\n```\n\nAlways validate the response with a schema parser before surfacing it to the user.',
      vectorScore: 0.84,
      keywordScore: 0.69,
      hybridScore: 0.78,
      sourceType: 'docx',
      tags: ['prompting', 'llm', 'schema'],
      namespace: 'engineering',
      metadata: {},
    },
  ]
}

export default function MemoryCartPage() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const contextLimit = useCartStore((s) => s.contextLimit)
  const toggleSelect = useCartStore((s) => s.toggleSelect)
  const clear = useCartStore((s) => s.clear)
  const clearSelected = useCartStore((s) => s.clearSelected)
  const addFromHit = useCartStore((s) => s.addFromHit)
  const getSummary = useCartStore((s) => s.getSummary)

  // Subscribe to both `items` and `contextLimit` so the summary stays reactive
  // when either changes (getSummary reads via zustand's get() internally).
  const summary = React.useMemo(
    () => getSummary(),
    [items, contextLimit, getSummary],
  )
  const allSelected = items.length > 0 && items.every((i) => i.selected)
  const someSelected = items.some((i) => i.selected)

  const handleSelectAll = () => {
    // Toggle each item so it becomes selected (idempotent for already-selected).
    if (allSelected) {
      items.forEach((i) => i.selected && toggleSelect(i.cartItemId))
    } else {
      items.forEach((i) => !i.selected && toggleSelect(i.cartItemId))
    }
  }

  const handleClearSelected = () => {
    if (!someSelected) return
    clearSelected()
  }

  const handleClearAll = () => {
    clear()
  }

  const handleLoadSample = () => {
    buildSampleHits().forEach((h) => addFromHit(h))
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col">
        <PageHeader
          title="Memory Cart"
          description="Workflow 3 — Memory Cart Temporary Storage Flow. Stage, curate and optimize knowledge chunks before assembling the prompt."
          icon={ShoppingCart}
        />
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 border-dashed py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4 pt-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Your memory cart is empty</h3>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Run a hybrid search, then add the most relevant chunks here.
                Curate, optimize and ship the final context to Structured Chat.
              </p>
            </div>
            <Button
              onClick={() => router.push('/search')}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Go to Search to add knowledge
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadSample}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Or load sample items to preview
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Memory Cart"
        description="Workflow 3 — Memory Cart Temporary Storage Flow. Stage, curate and optimize knowledge chunks before assembling the prompt."
        icon={ShoppingCart}
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}
            <span className="text-muted-foreground/70">·</span>
            <span className="tabular-nums">
              {summary.selectedTokens.toLocaleString()} tok selected
            </span>
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Main column — cart items list */}
        <section className="lg:col-span-2">
          {/* Bulk action bar */}
          <Card className="mb-4 gap-0 bg-secondary/30 py-3">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4 py-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {summary.selectedCount}
                </span>
                <span>/</span>
                <span>{summary.itemCount} selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="gap-1.5"
                    >
                      {allSelected ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <CheckSquare className="h-3.5 w-3.5" />
                      )}
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {allSelected
                      ? 'Deselect every cart item'
                      : 'Select every cart item'}
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelected}
                  disabled={!someSelected}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear selected
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scrollable items list */}
          <div
            className={cn(
              'max-h-[700px] overflow-y-auto scrollbar-thin',
              'space-y-3 pr-1',
            )}
          >
            {items.map((item) => (
              <CartItemRow key={item.cartItemId} item={item} />
            ))}

            <Separator className="my-4" />
            <p className="text-center text-[11px] text-muted-foreground">
              {summary.itemCount} item{summary.itemCount === 1 ? '' : 's'} ·{' '}
              {summary.totalTokens.toLocaleString()} total tokens ·{' '}
              {summary.selectedTokens.toLocaleString()} selected
            </p>
          </div>
        </section>

        {/* Right column — sticky summary + token counter + optimization */}
        <aside className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-6">
            {/* Mini summary card */}
            <Card className="gap-0 overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cart summary
                  </span>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Items
                    </div>
                    <div className="text-base font-bold tabular-nums">
                      {summary.itemCount}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Selected
                    </div>
                    <div className="text-base font-bold tabular-nums text-primary">
                      {summary.selectedCount}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TokenCounter summary={summary} />

            <OptimizationPanel summary={summary} />
          </div>
        </aside>
      </div>
    </div>
  )
}
