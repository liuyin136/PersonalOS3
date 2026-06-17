'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ShoppingCart,
  Pencil,
  Copy,
  Hash,
  FileText,
  SearchX,
  Trophy,
  Search as SearchIcon,
  Check,
} from 'lucide-react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceTypeBadge } from '@/components/common/source-type-badge'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { SearchHit } from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SearchResultsProps {
  hits: SearchHit[]
  isLoading: boolean
  hasSearched: boolean
  onEdit: (hit: SearchHit) => void
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SearchResults({
  hits,
  isLoading,
  hasSearched,
  onEdit,
}: SearchResultsProps) {
  const addFromHit = useCartStore((s) => s.addFromHit)
  const cartItems = useCartStore((s) => s.items)

  const isAdded = (hitId: string) =>
    cartItems.some((i) => i.id === hitId)

  const handleAddToCart = (hit: SearchHit) => {
    addFromHit(hit)
    toast.success('Added to Memory Cart', {
      description: `${hit.documentTitle} · chunk ${hit.chunkIndex}`,
    })
  }

  const handleCopy = async (hit: SearchHit) => {
    try {
      await navigator.clipboard.writeText(hit.content)
      toast.success('Copied to clipboard', {
        description: `${hit.documentTitle} · chunk ${hit.chunkIndex}`,
      })
    } catch {
      toast.error('Failed to copy', {
        description: 'Clipboard access was denied.',
      })
    }
  }

  /* ---------------- Loading state ---------------- */
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-4 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  /* ---------------- Empty: not searched yet ---------------- */
  if (!hasSearched) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="Start a search to retrieve knowledge"
        description="Adjust the parameters on the right and hit Search to query your indexed chunks via hybrid vector + keyword retrieval."
      />
    )
  }

  /* ---------------- Empty: no results ---------------- */
  if (hits.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results found"
        description="Try a different query, change the search mode, or expand your filters."
      />
    )
  }

  /* ---------------- Results ---------------- */
  return (
    <div className="space-y-4">
      {hits.map((hit, idx) => {
        const added = isAdded(hit.id)
        const isTop = idx === 0
        return (
          <Card
            key={hit.id}
            className={cn(
              'gap-4 p-5 transition-all hover:shadow-md',
              isTop &&
                'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20',
            )}
          >
            {/* Header: rank + title + meta + score badges */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold',
                    isTop
                      ? 'gradient-green text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground',
                  )}
                  aria-label={`Rank ${idx + 1}`}
                >
                  {isTop ? (
                    <Trophy className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-tight">
                    {hit.documentTitle}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      chunk {hit.chunkIndex}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {hit.namespace}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <SourceTypeBadge type={hit.sourceType} />
                <ScoreBadge
                  label="hybrid"
                  value={hit.hybridScore}
                  prominent
                />
                <ScoreBadge label="vec" value={hit.vectorScore} />
                <ScoreBadge label="kw" value={hit.keywordScore} />
              </div>
            </div>

            {/* Tags */}
            {hit.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hit.tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="bg-secondary/60 text-[10px]"
                  >
                    #{t}
                  </Badge>
                ))}
              </div>
            )}

            {/* Content as Markdown */}
            <CardContent className="prose-rag max-w-none px-0 text-sm">
              <ReactMarkdown>
                {hit.markdown || hit.content}
              </ReactMarkdown>
            </CardContent>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant={added ? 'secondary' : 'default'}
                onClick={() => handleAddToCart(hit)}
                disabled={added}
                className={cn(
                  !added && 'gradient-green text-primary-foreground',
                )}
              >
                {added ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    In Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to Cart
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(hit)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(hit)}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ScoreBadge({
  label,
  value,
  prominent,
}: {
  label: string
  value: number
  prominent?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 py-0.5 text-[10px] font-semibold',
        prominent
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'bg-secondary/60 text-muted-foreground',
      )}
      title={`${label} score`}
    >
      <span className="opacity-70">{label}</span>
      <span>{value.toFixed(3)}</span>
    </Badge>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </Card>
  )
}
