'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles,
  Send,
  Loader2,
  Scissors,
  FileText,
  Copy,
  ArrowDownUp,
  Ban,
  TrendingDown,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cartApi } from '@/lib/api'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'
import type { CartSummary, OptimizationStrategy } from '@/types/rag'

interface StrategyMeta {
  value: OptimizationStrategy
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STRATEGIES: StrategyMeta[] = [
  {
    value: 'none',
    label: 'None',
    description: 'Keep all selected items unchanged',
    icon: Ban,
  },
  {
    value: 'truncate',
    label: 'Truncate',
    description: 'Cut each chunk to fit within target tokens',
    icon: Scissors,
  },
  {
    value: 'summarize',
    label: 'Summarize',
    description: 'Replace each chunk with an LLM-generated summary',
    icon: FileText,
  },
  {
    value: 'deduplicate',
    label: 'Deduplicate',
    description: 'Remove near-duplicate chunks by semantic similarity',
    icon: Copy,
  },
  {
    value: 'reorder',
    label: 'Reorder',
    description: 'Re-rank chunks by relevance and importance',
    icon: ArrowDownUp,
  },
]

export function OptimizationPanel({ summary }: { summary: CartSummary }) {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const contextLimit = useCartStore((s) => s.contextLimit)

  const [strategy, setStrategy] = React.useState<OptimizationStrategy>('truncate')
  const [targetTokens, setTargetTokens] = React.useState<string>(
    String(Math.round(summary.contextLimit * 0.7)),
  )
  const [optimizing, setOptimizing] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<{
    before: number
    after: number
    strategy: OptimizationStrategy
  } | null>(null)
  const userTouchedTarget = React.useRef(false)

  // Keep target tokens in sync with context limit unless the user has edited it.
  React.useEffect(() => {
    if (!userTouchedTarget.current) {
      setTargetTokens(String(Math.round(contextLimit * 0.7)))
    }
  }, [contextLimit])

  const selectedItemIds = React.useMemo(
    () => items.filter((i) => i.selected).map((i) => i.id),
    [items],
  )
  const selectedTokens = summary.selectedTokens

  const handleOptimize = async () => {
    if (selectedItemIds.length === 0) {
      toast.error('No items selected', {
        description: 'Select at least one cart item before optimizing.',
      })
      return
    }
    setOptimizing(true)
    setLastResult(null)
    try {
      const parsedTarget = Number.parseInt(targetTokens, 10)
      const payload = {
        itemIds: selectedItemIds,
        strategy,
        targetTokens:
          Number.isFinite(parsedTarget) && parsedTarget > 0
            ? parsedTarget
            : undefined,
      }
      const res = await cartApi.optimize(payload)
      const before = selectedTokens
      const after = res.optimizedTokens || before
      const saved = Math.max(0, before - after)
      setLastResult({ before, after, strategy })

      const meta = STRATEGIES.find((s) => s.value === strategy)
      toast.success('Optimization complete', {
        description: `${meta?.label ?? strategy}: ${before.toLocaleString()} → ${after.toLocaleString()} tokens (saved ${saved.toLocaleString()})`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Optimization failed', { description: message })
    } finally {
      setOptimizing(false)
    }
  }

  const handleSendToChat = () => {
    if (selectedItemIds.length === 0) {
      toast.error('No context selected', {
        description: 'Select one or more items to attach to the chat.',
      })
      return
    }
    if (selectedTokens > contextLimit) {
      toast.warning('Over context limit', {
        description: `Selected tokens (${selectedTokens.toLocaleString()}) exceed the limit (${contextLimit.toLocaleString()}). Consider optimizing first.`,
      })
    }
    toast.success('Opening Structured Chat', {
      description: `${selectedItemIds.length} item${selectedItemIds.length > 1 ? 's' : ''} attached as context.`,
    })
    router.push('/chat')
  }

  const meta = STRATEGIES.find((s) => s.value === strategy)

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b border-border bg-secondary/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Optimization</CardTitle>
            <CardDescription className="text-xs">
              Compress & refine selected context before sending
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Strategy selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Optimization strategy
          </Label>
          <Select
            value={strategy}
            onValueChange={(v) => setStrategy(v as OptimizationStrategy)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a strategy" />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map((s) => {
                const Icon = s.icon
                return (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{s.label}</span>
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {meta && (
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <meta.icon className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              {meta.description}
            </p>
          )}
        </div>

        {/* Target tokens */}
        {strategy !== 'none' && (
          <div className="space-y-2">
            <Label
              htmlFor="target-tokens-input"
              className="text-xs text-muted-foreground"
            >
              Target tokens (optional)
            </Label>
            <Input
              id="target-tokens-input"
              type="number"
              inputMode="numeric"
              min={1000}
              max={summary.contextLimit}
              value={targetTokens}
              onChange={(e) => {
                userTouchedTarget.current = true
                setTargetTokens(e.target.value)
              }}
              placeholder="e.g. 32000"
              className="h-9 tabular-nums text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Leave blank to auto-fit within the current context window.
            </p>
          </div>
        )}

        {/* Optimize button */}
        <Button
          className="w-full"
          onClick={handleOptimize}
          disabled={optimizing || selectedItemIds.length === 0}
        >
          {optimizing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Optimizing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Optimize{' '}
              <Badge
                variant="secondary"
                className="ml-1 bg-primary-foreground/15 text-primary-foreground"
              >
                {selectedItemIds.length}
              </Badge>
            </>
          )}
        </Button>

        {/* Before/after result */}
        {lastResult && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <TrendingDown className="h-3 w-3" />
              Last optimization
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">
                  Before
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {lastResult.before.toLocaleString()}
                </span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">
                  After
                </span>
                <span className="font-semibold tabular-nums text-primary">
                  {lastResult.after.toLocaleString()}
                </span>
              </div>
              <span className="text-muted-foreground">·</span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">
                  Saved
                </span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    lastResult.before - lastResult.after > 0
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {Math.max(0, lastResult.before - lastResult.after).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Send to chat */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className={cn(
              'w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary',
            )}
            onClick={handleSendToChat}
            disabled={selectedItemIds.length === 0}
          >
            <Send className="h-4 w-4" />
            Send to Structured Chat
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            Navigate to Workflow 4 with{' '}
            <span className="font-semibold text-foreground">
              {selectedItemIds.length}
            </span>{' '}
            item{selectedItemIds.length === 1 ? '' : 's'} as context
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
