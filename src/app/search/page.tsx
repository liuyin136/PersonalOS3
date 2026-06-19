'use client'

import * as React from 'react'
import {
  Search,
  SlidersHorizontal,
  Lightbulb,
  History,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import {
  HybridSearchBar,
  MODE_OPTIONS,
  NAMESPACES,
} from '@/components/search/hybrid-search-bar'
import { SearchResults } from '@/components/search/search-results'
import { EditModal } from '@/components/search/edit-modal'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { searchApi } from '@/lib/api'
import type {
  SearchMode,
  SearchResponse,
  ChunkHit,
  ParentResult,
} from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TIPS = [
  'Hybrid mode blends vector + BM25 keyword scores using the α slider.',
  'Results are aggregated by parent Markdown document and reranked.',
  'Lower α favours exact keyword matches; higher α favours semantic similarity.',
  'Enable rerank to apply a cross-encoder model for precision ordering.',
  'Top-K controls chunk retrieval from pgvector; rerankTop caps parents returned.',
  'Edit a chunk to refine content — re-embed to update its vector.',
]

const DEFAULT_QUERY = 'architecture'

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SearchPage() {
  // ---- Search parameters ----
  const [query, setQuery] = React.useState('')
  const [mode, setMode] = React.useState<SearchMode>('hybrid')
  const [alpha, setAlpha] = React.useState(0.5)
  const [topK, setTopK] = React.useState(12)
  const [rerank, setRerank] = React.useState(true)
  const [rerankTop, setRerankTop] = React.useState(10)
  const [namespace, setNamespace] = React.useState('engineering')

  // ---- Results state (parent-reranked) ----
  const [response, setResponse] = React.useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)

  // ---- Edit modal state ----
  const [editingChunk, setEditingChunk] = React.useState<ChunkHit | null>(null)
  const [editingParent, setEditingParent] = React.useState<ParentResult | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  // ---- Recent searches (in-memory) ----
  const [recent, setRecent] = React.useState<string[]>([])

  /**
   * Run a hybrid search. Accepts an optional override query so chip
   * clicks and recent-search clicks don't have to wait for React
   * state to flush.
   */
  const runSearch = React.useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? query).trim()
      if (!q) return
      setIsSearching(true)
      try {
        const res = await searchApi.search({
          query: q,
          mode,
          namespace,
          topK,
          alpha,
          rerank,
          rerankTop,
        })
        setResponse(res)
        setHasSearched(true)
        setRecent((prev) => {
          const next = [q, ...prev.filter((r) => r !== q)].slice(0, 5)
          return next
        })
      } catch (err) {
        console.error('Search failed', err)
        setResponse({ query: q, mode, total: 0, tookMs: 0, results: [] })
        setHasSearched(true)
      } finally {
        setIsSearching(false)
      }
    },
    [query, mode, namespace, topK, alpha, rerank, rerankTop],
  )

  // Run a default search on first mount so the page isn't empty.
  React.useEffect(() => {
    setQuery(DEFAULT_QUERY)
    runSearch(DEFAULT_QUERY)
    // Intentionally run only once on mount — `runSearch` is stable enough
    // for this initial call thanks to its override-query argument.
  }, [])

  const handleEdit = (chunk: ChunkHit, parent: ParentResult) => {
    setEditingChunk(chunk)
    setEditingParent(parent)
    setEditOpen(true)
  }

  const handleSaved = (
    chunkId: string,
    newContent: string,
    _reembedded: boolean,
  ) => {
    setResponse((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        results: prev.results.map((p) => ({
          ...p,
          topChunks: p.topChunks.map((c) =>
            c.id === chunkId
              ? { ...c, content: newContent, markdown: newContent }
              : c,
          ),
        })),
      }
    })
  }

  const modeHint = MODE_OPTIONS.find((m) => m.value === mode)?.hint

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Search}
        title="Hybrid Search & Retrieval"
        description="Workflow 2 — Retrieve chunks via hybrid vector + keyword search, then aggregate by parent document and rerank. Read, edit, and re-embed chunks in real time."
      />

      {/* ---------------------------------------------------------- */}
      {/* Top: full-width search bar                                  */}
      {/* ---------------------------------------------------------- */}
      <HybridSearchBar
        query={query}
        setQuery={setQuery}
        mode={mode}
        setMode={setMode}
        alpha={alpha}
        setAlpha={setAlpha}
        topK={topK}
        setTopK={setTopK}
        rerank={rerank}
        setRerank={setRerank}
        namespace={namespace}
        setNamespace={setNamespace}
        onSearch={runSearch}
        isSearching={isSearching}
        totalResults={response?.total}
        tookMs={response?.tookMs}
      />

      {/* ---------------------------------------------------------- */}
      {/* Two-column grid: results (left, 2/3) + sidebar (right, 1/3) */}
      {/* ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main results list */}
        <div className="lg:col-span-2">
          <SearchResults
            results={response?.results ?? []}
            isLoading={isSearching}
            hasSearched={hasSearched}
            onEdit={handleEdit}
          />
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Search Parameters card */}
            <Card className="gap-4">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Search Parameters
                </CardTitle>
                <CardDescription className="text-xs">
                  Fine-tune retrieval. Changes apply on next search.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Mode toggle (extended) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Mode
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(v) => {
                      if (v) setMode(v as SearchMode)
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {MODE_OPTIONS.map((opt) => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value}
                        className="flex-1 text-[11px] font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        {opt.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {modeHint && (
                    <p className="text-[11px] text-muted-foreground">
                      {modeHint}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Alpha slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      α Vector / Keyword
                    </Label>
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-[10px] text-primary"
                    >
                      {Math.round(alpha * 100)} /{' '}
                      {Math.round((1 - alpha) * 100)}
                    </Badge>
                  </div>
                  <Slider
                    value={[alpha]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => setAlpha(v[0])}
                    disabled={mode !== 'hybrid'}
                    aria-label="Alpha"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Keyword</span>
                    <span>Vector</span>
                  </div>
                </div>

                <Separator />

                {/* Top-K + Rerank + RerankTop */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Top-K (chunks)
                    </Label>
                    <Select
                      value={String(topK)}
                      onValueChange={(v) => setTopK(Number(v))}
                    >
                      <SelectTrigger
                        className="h-8 w-full"
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: 20 },
                          (_, i) => i + 1,
                        ).map((k) => (
                          <SelectItem key={k} value={String(k)}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Rerank
                    </Label>
                    <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-secondary/30 px-3">
                      <Switch
                        checked={rerank}
                        onCheckedChange={setRerank}
                        id="rerank-sidebar"
                      />
                      <Label
                        htmlFor="rerank-sidebar"
                        className="text-xs"
                      >
                        {rerank ? 'On' : 'Off'}
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Rerank Top — parents to return */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Results to return (parents)
                    </Label>
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-[10px] text-primary"
                    >
                      {rerankTop}
                    </Badge>
                  </div>
                  <Slider
                    value={[rerankTop]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={(v) => setRerankTop(v[0])}
                    disabled={!rerank}
                    aria-label="Rerank top parents"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                <Separator />

                {/* Namespace */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Namespace
                  </Label>
                  <Select value={namespace} onValueChange={setNamespace}>
                    <SelectTrigger className="h-8 w-full" size="sm">
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
                </div>

                <Button
                  onClick={() => runSearch()}
                  disabled={isSearching || !query.trim()}
                  className="w-full gradient-green text-primary-foreground"
                  size="sm"
                >
                  <Search className="h-4 w-4" />
                  Apply &amp; Re-run
                </Button>
              </CardContent>
            </Card>

            {/* Tips card */}
            <Card className="gap-3">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Retrieval Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {TIPS.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Recent searches card (only when there are some) */}
            {recent.length > 0 && (
              <Card className="gap-3">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <History className="h-4 w-4 text-primary" />
                    Recent Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {recent.map((r, i) => (
                      <button
                        key={`${r}-${i}`}
                        onClick={() => {
                          setQuery(r)
                          runSearch(r)
                        }}
                        className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-accent"
                      >
                        <span className="truncate">{r}</span>
                        <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Real-time edit modal                                        */}
      {/* ---------------------------------------------------------- */}
      <EditModal
        chunk={editingChunk}
        parent={editingParent}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
