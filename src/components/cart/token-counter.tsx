'use client'

import * as React from 'react'
import {
  Gauge,
  Package,
  CheckCircle2,
  Layers,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'
import type { CartSummary } from '@/types/rag'

const MIN_LIMIT = 8000
const MAX_LIMIT = 256000
const STEP = 4000

/** Returns a tailwind class for the progress bar given a usage ratio (0..1+). */
function usageColor(ratio: number): {
  bar: string
  text: string
  ring: string
  label: string
} {
  if (ratio >= 1) {
    return {
      bar: '[&>[data-slot=progress-indicator]]:bg-destructive',
      text: 'text-destructive',
      ring: 'ring-destructive/20',
      label: 'Over limit',
    }
  }
  if (ratio >= 0.85) {
    return {
      bar: '[&>[data-slot=progress-indicator]]:bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/20',
      label: 'Near limit',
    }
  }
  if (ratio >= 0.6) {
    return {
      bar: '[&>[data-slot=progress-indicator]]:bg-yellow-500',
      text: 'text-yellow-600 dark:text-yellow-400',
      ring: 'ring-yellow-500/20',
      label: 'Healthy',
    }
  }
  return {
    bar: '[&>[data-slot=progress-indicator]]:bg-primary',
    text: 'text-primary',
    ring: 'ring-primary/20',
    label: 'Plenty of room',
  }
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('h-3 w-3', accent)} />
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function TokenCounter({ summary }: { summary: CartSummary }) {
  const setContextLimit = useCartStore((s) => s.setContextLimit)
  const [draftLimit, setDraftLimit] = React.useState<string>(
    String(summary.contextLimit),
  )

  // Keep draft input in sync when store changes externally (e.g. slider).
  React.useEffect(() => {
    setDraftLimit(String(summary.contextLimit))
  }, [summary.contextLimit])

  const ratio = summary.contextLimit
    ? summary.selectedTokens / summary.contextLimit
    : 0
  const pct = Math.min(100, ratio * 100)
  const overLimit = summary.selectedTokens > summary.contextLimit
  const palette = usageColor(ratio)

  const handleSliderChange = (val: number[]) => {
    const v = val[0] ?? summary.contextLimit
    setContextLimit(v)
  }

  const handleInputCommit = () => {
    const parsed = Number.parseInt(draftLimit, 10)
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed))
      setContextLimit(clamped)
      setDraftLimit(String(clamped))
    } else {
      setDraftLimit(String(summary.contextLimit))
    }
  }

  const savings = Math.max(0, summary.totalTokens - summary.selectedTokens)

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b border-border bg-secondary/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Token Counter</CardTitle>
            <CardDescription className="text-xs">
              Monitor context window usage in real time
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            icon={Package}
            label="Total items"
            value={summary.itemCount}
            hint="In memory cart"
          />
          <StatTile
            icon={CheckCircle2}
            label="Selected"
            value={summary.selectedCount}
            hint="For prompt context"
            accent="text-primary"
          />
          <StatTile
            icon={Layers}
            label="Total tokens"
            value={summary.totalTokens.toLocaleString()}
            hint="Across all items"
          />
          <StatTile
            icon={ArrowRightLeft}
            label="Selected tokens"
            value={summary.selectedTokens.toLocaleString()}
            hint={`Saving ${savings.toLocaleString()} by toggling off`}
            accent="text-primary"
          />
        </div>

        {/* Context limit control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="context-limit-input"
              className="text-xs text-muted-foreground"
            >
              Context window limit
            </Label>
            <Badge
              variant="outline"
              className={cn('gap-1 text-[10px] font-semibold', palette.text)}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  ratio >= 1
                    ? 'bg-destructive'
                    : ratio >= 0.85
                      ? 'bg-amber-500'
                      : ratio >= 0.6
                        ? 'bg-yellow-500'
                        : 'bg-primary',
                )}
              />
              {palette.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="context-limit-input"
              type="number"
              inputMode="numeric"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              step={STEP}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              onBlur={handleInputCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInputCommit()
              }}
              className="h-8 w-28 tabular-nums text-xs"
            />
            <span className="text-[10px] text-muted-foreground">
              tokens · range {MIN_LIMIT.toLocaleString()}–
              {MAX_LIMIT.toLocaleString()}
            </span>
          </div>
          <Slider
            value={[summary.contextLimit]}
            min={MIN_LIMIT}
            max={MAX_LIMIT}
            step={STEP}
            onValueChange={handleSliderChange}
            className="mt-2"
          />
        </div>

        {/* Progress meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Context used</span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                overLimit ? 'text-destructive' : palette.text,
              )}
            >
              {summary.selectedTokens.toLocaleString()} /{' '}
              {summary.contextLimit.toLocaleString()} (
              {Math.round(ratio * 100)}%)
            </span>
          </div>
          <Progress
            value={pct}
            className={cn('h-2.5 transition-colors', palette.bar)}
          />
        </div>

        {/* Over-limit warning */}
        {overLimit && (
          <Alert variant="destructive" className="py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">
              Over context limit
            </AlertTitle>
            <AlertDescription className="text-[11px]">
              Selected context exceeds the window by{' '}
              <strong>
                {(summary.selectedTokens - summary.contextLimit).toLocaleString()}
              </strong>{' '}
              tokens. Apply an optimization strategy or deselect items before
              sending to chat.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
