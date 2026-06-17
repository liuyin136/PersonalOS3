'use client'

import * as React from 'react'
import { Search, Sparkles, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import type { SearchMode } from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Shared constants                                                    */
/* ------------------------------------------------------------------ */

export const EXAMPLE_QUERIES = [
  'architecture',
  'rate limiting',
  'onboarding',
  'incident response',
  'vector index tuning',
]

export const NAMESPACES: { value: string; label: string }[] = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'research', label: 'Research' },
  { value: 'ops', label: 'Operations' },
]

export const MODE_OPTIONS: {
  value: SearchMode
  label: string
  hint: string
}[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'Vector + keyword fusion (RRF)' },
  { value: 'vector', label: 'Vector', hint: 'Pure semantic similarity' },
  { value: 'keyword', label: 'Keyword', hint: 'BM25 lexical match' },
  { value: 'semantic', label: 'Semantic', hint: 'Concept-level match' },
]

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface HybridSearchBarProps {
  query: string
  setQuery: (v: string) => void
  mode: SearchMode
  setMode: (v: SearchMode) => void
  alpha: number
  setAlpha: (v: number) => void
  topK: number
  setTopK: (v: number) => void
  rerank: boolean
  setRerank: (v: boolean) => void
  namespace: string
  setNamespace: (v: string) => void
  /**
   * Run a search. Accepts an optional override query so chip clicks
   * don't have to wait for React state to flush.
   */
  onSearch: (overrideQuery?: string) => void
  isSearching: boolean
  totalResults?: number
  tookMs?: number
}

export function HybridSearchBar(props: HybridSearchBarProps) {
  const {
    query,
    setQuery,
    mode,
    setMode,
    alpha,
    setAlpha,
    topK,
    setTopK,
    rerank,
    setRerank,
    namespace,
    setNamespace,
    onSearch,
    isSearching,
    totalResults,
    tookMs,
  } = props

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass rounded-2xl border border-border p-4 shadow-sm sm:p-5"
      role="search"
    >
      {/* ---------------------------------------------------------------- */}
      {/* Row 1: mode segmented toggle + query + namespace + Search button */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (v) setMode(v as SearchMode)
          }}
          variant="outline"
          size="sm"
          className="w-full lg:w-auto"
          aria-label="Search mode"
        >
          {MODE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className="flex-1 px-3 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground lg:flex-none"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything — search across all ingested knowledge…"
            className="h-11 pl-10 text-base"
            autoFocus
            aria-label="Search query"
          />
        </div>

        <Select value={namespace} onValueChange={setNamespace}>
          <SelectTrigger
            className="h-11 w-full lg:w-44"
            aria-label="Namespace"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAMESPACES.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="submit"
          size="lg"
          disabled={isSearching}
          className="h-11 gradient-green text-primary-foreground shadow-sm"
        >
          {isSearching ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              <span>Searching…</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Search</span>
            </>
          )}
        </Button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Row 2: alpha (when hybrid) + topK + rerank + result summary      */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        {mode === 'hybrid' && (
          <div className="flex flex-1 items-center gap-3">
            <Label className="whitespace-nowrap text-xs font-medium text-muted-foreground">
              α Vector {Math.round(alpha * 100)}% · Keyword{' '}
              {Math.round((1 - alpha) * 100)}%
            </Label>
            <Slider
              value={[alpha]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setAlpha(v[0])}
              className="flex-1"
              aria-label="Alpha (vector vs keyword weight)"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <Label
            htmlFor="topk-bar"
            className="whitespace-nowrap text-xs font-medium text-muted-foreground"
          >
            Top-K
          </Label>
          <Select
            value={String(topK)}
            onValueChange={(v) => setTopK(Number(v))}
          >
            <SelectTrigger id="topk-bar" className="h-8 w-20" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((k) => (
                <SelectItem key={k} value={String(k)}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={rerank}
            onCheckedChange={setRerank}
            id="rerank-bar"
          />
          <Label
            htmlFor="rerank-bar"
            className="whitespace-nowrap text-xs font-medium text-muted-foreground"
          >
            Rerank
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {totalResults !== undefined && tookMs !== undefined && (
            <>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary"
              >
                {totalResults} {totalResults === 1 ? 'result' : 'results'}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 text-[10px] text-muted-foreground"
              >
                <Clock className="h-3 w-3" />
                {tookMs} ms
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Row 3: example chips                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Try:</span>
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setQuery(q)
              onSearch(q)
            }}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
          >
            {q}
          </button>
        ))}
      </div>
    </form>
  )
}
