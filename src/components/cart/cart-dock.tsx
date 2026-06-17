'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, X, Trash2, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'
import { SourceTypeBadge } from '@/components/common/source-type-badge'

export function CartDock() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const contextLimit = useCartStore((s) => s.contextLimit)

  const selectedTokens = items
    .filter((i) => i.selected)
    .reduce((s, i) => s + i.tokenCount, 0)
  const pct = Math.min(100, (selectedTokens / contextLimit) * 100)
  const overLimit = selectedTokens > contextLimit

  if (items.length === 0) return null

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full gradient-green text-primary-foreground shadow-lg transition-transform hover:scale-105',
          open && 'rotate-90',
        )}
        aria-label="Toggle memory cart"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">
          {items.length}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex max-h-[70vh] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Memory Cart</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {items.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Token meter */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Context tokens</span>
              <span
                className={cn(
                  'font-medium',
                  overLimit ? 'text-destructive' : 'text-foreground',
                )}
              >
                {selectedTokens.toLocaleString()} / {contextLimit.toLocaleString()}
              </span>
            </div>
            <Progress
              value={pct}
              className={cn('h-2', overLimit && '[&>div]:bg-destructive')}
            />
            {overLimit && (
              <p className="mt-1.5 text-[11px] font-medium text-destructive">
                Over context limit — optimize before sending.
              </p>
            )}
          </div>

          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.cartItemId} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {item.documentTitle}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        chunk #{item.chunkIndex} · {item.tokenCount} tok
                      </p>
                    </div>
                    <SourceTypeBadge type={item.sourceType} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {item.content}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => remove(item.cartItemId)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          <Separator />
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                clear()
                setOpen(false)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setOpen(false)
                router.push('/cart')
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Manage
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
