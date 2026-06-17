'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  Hash,
  Clock,
  FileText,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SourceTypeBadge } from '@/components/common/source-type-badge'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'
import type { CartItem } from '@/types/rag'

interface CartItemRowProps {
  item: CartItem
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export function CartItemRow({ item }: CartItemRowProps) {
  const toggleSelect = useCartStore((s) => s.toggleSelect)
  const remove = useCartStore((s) => s.remove)
  const [open, setOpen] = React.useState(false)

  const preview = React.useMemo(() => {
    const text = item.content.replace(/[#*`>_~\-]/g, '').trim()
    return text.length > 240 ? `${text.slice(0, 240)}…` : text
  }, [item.content])

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden py-0 transition-colors',
        item.selected
          ? 'border-primary/40 bg-primary/[0.03]'
          : 'border-border bg-card hover:bg-accent/30',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
        <div className="pt-0.5">
          <Checkbox
            checked={item.selected}
            onCheckedChange={() => toggleSelect(item.cartItemId)}
            aria-label={`Toggle selection for ${item.documentTitle}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'truncate text-sm font-semibold',
                item.selected ? 'text-foreground' : 'text-foreground/80',
              )}
              title={item.documentTitle}
            >
              {item.documentTitle}
            </h3>
            <SourceTypeBadge type={item.sourceType} />
            <Badge
              variant="outline"
              className="gap-1 bg-secondary/50 text-[10px] font-medium text-muted-foreground"
            >
              <Hash className="h-2.5 w-2.5" />
              chunk {item.chunkIndex}
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 bg-primary/10 text-[10px] font-semibold text-primary"
            >
              {item.tokenCount.toLocaleString()} tok
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {formatRelative(item.addedAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(item.addedAt).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </div>

          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-secondary/60 text-[10px] font-normal text-secondary-foreground"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {preview}
            </p>
            <CollapsibleContent className="mt-3 overflow-hidden rounded-lg border border-border bg-secondary/30">
              <div className="border-b border-border bg-secondary/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Full content
              </div>
              <div className="prose-rag max-h-80 overflow-y-auto scrollbar-thin px-3 py-2 text-xs">
                <ReactMarkdown>{item.content}</ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={open ? 'Collapse content' : 'Expand content'}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {open ? 'Collapse' : 'View full'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {open ? 'Hide full content' : 'Show full markdown content'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(item.cartItemId)}
                aria-label={`Remove ${item.documentTitle} from cart`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from cart</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Subtle selected indicator strip */}
      {item.selected && (
        <div className="h-0.5 w-full gradient-green" aria-hidden />
      )}
    </Card>
  )
}

/** Lightweight placeholder/skeleton row used during loading states. */
export function CartItemRowSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground/50" />
            <div className="h-3.5 w-40 rounded bg-muted" />
            <div className="h-4 w-12 rounded-full bg-muted" />
          </div>
          <div className="h-3 w-full rounded bg-muted/70" />
          <div className="h-3 w-2/3 rounded bg-muted/70" />
        </div>
      </div>
    </Card>
  )
}
