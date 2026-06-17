'use client'

import * as React from 'react'
import { FileText, PackageOpen, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SourceTypeBadge } from '@/components/common/source-type-badge'
import { useCartStore } from '@/lib/store/cart-store'
import { useChatStore } from '@/lib/store/chat-store'
import { cn } from '@/lib/utils'

/**
 * Context selector — picks which Memory Cart items become the structured
 * chat context (`selectedContextIds` in chat store). Shows live token count.
 */
export function ContextSelector() {
  const items = useCartStore((s) => s.items)
  const contextLimit = useCartStore((s) => s.contextLimit)
  const selectedContextIds = useChatStore((s) => s.selectedContextIds)
  const setContextIds = useChatStore((s) => s.setContextIds)

  // Sync selection with cart items: keep only ids that still exist, and
  // default-select all when first opening (matches cart's selected flag).
  React.useEffect(() => {
    const validIds = items.map((i) => i.id)
    const filtered = selectedContextIds.filter((id) => validIds.includes(id))
    if (filtered.length !== selectedContextIds.length) {
      setContextIds(filtered)
    }
  }, [items, selectedContextIds, setContextIds])

  const selectedItems = items.filter((i) => selectedContextIds.includes(i.id))
  const selectedTokens = selectedItems.reduce((s, i) => s + i.tokenCount, 0)
  const pct = Math.min(100, (selectedTokens / contextLimit) * 100)
  const overLimit = selectedTokens > contextLimit

  const toggle = (id: string) => {
    if (selectedContextIds.includes(id)) {
      setContextIds(selectedContextIds.filter((x) => x !== id))
    } else {
      setContextIds([...selectedContextIds, id])
    }
  }

  const selectAll = () => setContextIds(items.map((i) => i.id))
  const selectNone = () => setContextIds([])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <PackageOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Memory cart is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a hybrid search and add chunks to the cart — they will appear
            here as selectable context.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Token meter */}
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            {selectedItems.length} / {items.length} chunks
          </span>
          <span
            className={cn(
              'font-mono font-medium',
              overLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {selectedTokens.toLocaleString()} tok
          </span>
        </div>
        <Progress
          value={pct}
          className={cn('h-1.5', overLimit && '[&>div]:bg-destructive')}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Limit {contextLimit.toLocaleString()} tok
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={selectAll}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={selectNone}
            >
              None
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="max-h-72 rounded-lg">
        <ul className="flex flex-col gap-2 pr-2">
          {items.map((item) => {
            const checked = selectedContextIds.includes(item.id)
            return (
              <li
                key={item.cartItemId}
                className={cn(
                  'group rounded-lg border bg-card p-2.5 transition-colors',
                  checked
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(item.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{item.documentTitle}</span>
                      </p>
                      <SourceTypeBadge type={item.sourceType} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {item.content}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="bg-secondary/80 px-1.5 py-0 text-[10px]"
                      >
                        #{item.chunkIndex}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {item.tokenCount} tok
                      </span>
                    </div>
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
