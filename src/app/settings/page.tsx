'use client'

import * as React from 'react'
import {
  Settings,
  MessageSquare,
  Brain,
  Filter,
  Save,
  Loader2,
  Cpu,
  Info,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { settingsApi } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  ModelCatalog,
  ModelOption,
  ModelSettings,
} from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PARAM_RANGES = {
  temperature: { min: 0, max: 2, step: 0.05 },
  maxTokens: { min: 256, max: 8192, step: 256 },
  contextLimit: { min: 8000, max: 256000, step: 4000 },
} as const

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [catalog, setCatalog] = React.useState<ModelCatalog | null>(null)
  const [saved, setSaved] = React.useState<ModelSettings | null>(null)
  const [draft, setDraft] = React.useState<ModelSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Initial fetch — catalog + settings in parallel.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [cat, set] = await Promise.all([
          settingsApi.getCatalog(),
          settingsApi.getSettings(),
        ])
        if (cancelled) return
        setCatalog(cat)
        setSaved(set)
        setDraft(set)
      } catch (err) {
        if (cancelled) return
        toast.error('Failed to load model settings', {
          description:
            err instanceof Error ? err.message : 'Unknown error',
        })
        // Fallback: empty catalog + defaults so the UI still renders.
        setCatalog({ chatModels: [], embeddingModels: [], rerankerModels: [] })
        const fallback: ModelSettings = {
          chatModel: '',
          embeddingModel: '',
          rerankerModel: '',
          chatTemperature: 0.3,
          chatMaxTokens: 2048,
          contextLimit: 128000,
        }
        setSaved(fallback)
        setDraft(fallback)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = React.useMemo(() => {
    if (!saved || !draft) return false
    return (
      saved.chatModel !== draft.chatModel ||
      saved.embeddingModel !== draft.embeddingModel ||
      saved.rerankerModel !== draft.rerankerModel ||
      saved.chatTemperature !== draft.chatTemperature ||
      saved.chatMaxTokens !== draft.chatMaxTokens ||
      saved.contextLimit !== draft.contextLimit
    )
  }, [saved, draft])

  const handleSave = async () => {
    if (!draft || !dirty) return
    setSaving(true)
    try {
      const next = await settingsApi.updateSettings(draft)
      setSaved(next)
      setDraft(next)
      toast.success('Settings saved', {
        description: 'Model selection & generation parameters persisted.',
      })
    } catch (err) {
      toast.error('Failed to save settings', {
        description:
          err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (saved) setDraft(saved)
  }

  const updateDraft = (patch: Partial<ModelSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Model Settings"
        description="Choose the local chat, embedding and reranker models used across the RAG platform. All models run on your own infrastructure — no external API keys required."
        actions={
          <>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={saving || loading}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving || loading}
              className="gap-1.5 gradient-green text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </>
        }
      />

      {/* Dirty indicator banner */}
      {dirty && (
        <Alert className="border-primary/30 bg-primary/[0.04]">
          <Sparkles className="text-primary" />
          <AlertTitle className="text-primary">Unsaved changes</AlertTitle>
          <AlertDescription className="text-xs">
            Adjust the dropdowns or sliders, then click <strong>Save
            Settings</strong> to persist your selection.
          </AlertDescription>
        </Alert>
      )}

      {/* Local models note */}
      <Alert className="border bg-card">
        <Info className="text-primary" />
        <AlertTitle className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          100% local — no OpenAI / Claude / Anthropic keys needed
        </AlertTitle>
        <AlertDescription className="text-xs">
          These models run via <code className="rounded bg-secondary px-1 py-0.5 text-[10px]">sentence-transformers</code>{' '}
          and your OpenAI-compatible local inference server (e.g. vLLM,
          Ollama, LM Studio). Suitable for Hong Kong &amp; restricted-network
          deployments where outbound LLM API calls are not permitted.
        </AlertDescription>
      </Alert>

      {/* ---------------- Loading skeleton ---------------- */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="gap-3 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* ---------------- Model selection cards ---------------- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ModelCard
              icon={MessageSquare}
              title="Chat Model"
              description="Used by Workflow 4 (Structured Chat) for generation."
              options={catalog?.chatModels ?? []}
              value={draft?.chatModel ?? ''}
              onChange={(v) => updateDraft({ chatModel: v })}
            />
            <ModelCard
              icon={Brain}
              title="Embedding Model"
              description="Encodes chunks into vectors during ingest & search."
              options={catalog?.embeddingModels ?? []}
              value={draft?.embeddingModel ?? ''}
              onChange={(v) => updateDraft({ embeddingModel: v })}
            />
            <ModelCard
              icon={Filter}
              title="Reranker Model"
              description="Cross-encoder that re-scores parents after retrieval."
              options={catalog?.rerankerModels ?? []}
              value={draft?.rerankerModel ?? ''}
              onChange={(v) => updateDraft({ rerankerModel: v })}
            />
          </div>

          {/* ---------------- Generation parameters ---------------- */}
          <Card className="gap-5">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-primary" />
                Generation Parameters
              </CardTitle>
              <CardDescription className="text-xs">
                Tune the chat model&apos;s sampling behaviour and the
                effective context window.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Chat temperature
                  </Label>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-[10px] text-primary"
                  >
                    {draft?.chatTemperature.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[draft?.chatTemperature ?? 0.3]}
                  min={PARAM_RANGES.temperature.min}
                  max={PARAM_RANGES.temperature.max}
                  step={PARAM_RANGES.temperature.step}
                  onValueChange={(v) =>
                    updateDraft({ chatTemperature: v[0] })
                  }
                  aria-label="Chat temperature"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 · deterministic</span>
                  <span>2 · creative</span>
                </div>
              </div>

              {/* Max tokens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Chat max tokens
                  </Label>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-[10px] text-primary"
                  >
                    {draft?.chatMaxTokens.toLocaleString()}
                  </Badge>
                </div>
                <Slider
                  value={[draft?.chatMaxTokens ?? 2048]}
                  min={PARAM_RANGES.maxTokens.min}
                  max={PARAM_RANGES.maxTokens.max}
                  step={PARAM_RANGES.maxTokens.step}
                  onValueChange={(v) =>
                    updateDraft({ chatMaxTokens: v[0] })
                  }
                  aria-label="Chat max tokens"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>256</span>
                  <span>8 192</span>
                </div>
              </div>

              {/* Context limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Context limit (tokens)
                  </Label>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-[10px] text-primary"
                  >
                    {(draft?.contextLimit ?? 128000).toLocaleString()}
                  </Badge>
                </div>
                <Slider
                  value={[draft?.contextLimit ?? 128000]}
                  min={PARAM_RANGES.contextLimit.min}
                  max={PARAM_RANGES.contextLimit.max}
                  step={PARAM_RANGES.contextLimit.step}
                  onValueChange={(v) =>
                    updateDraft({ contextLimit: v[0] })
                  }
                  aria-label="Context limit"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={draft?.contextLimit ?? 128000}
                    min={PARAM_RANGES.contextLimit.min}
                    max={PARAM_RANGES.contextLimit.max}
                    step={PARAM_RANGES.contextLimit.step}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isNaN(n)) updateDraft({ contextLimit: n })
                    }}
                    className="h-8 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    8k – 256k
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ModelCard({
  icon: Icon,
  title,
  description,
  options,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  options: ModelOption[]
  value: string
  onChange: (v: string) => void
}) {
  const selected = options.find((o) => o.value === value)

  return (
    <Card className="gap-4 p-5">
      <CardHeader className="gap-2 p-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-full" size="sm">
            <SelectValue
              placeholder={
                options.length === 0
                  ? 'No models in catalog'
                  : 'Select a model…'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="flex flex-col items-start"
              >
                <div className="flex w-full flex-col gap-0.5">
                  <span className="text-xs font-medium">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[10px] text-muted-foreground">
                      {opt.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected ? (
          <div className="rounded-md border border-border bg-secondary/30 p-2.5">
            <div className="text-xs font-medium">{selected.label}</div>
            {selected.description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {selected.description}
              </p>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-md border border-dashed border-border p-2.5 text-[11px] text-muted-foreground',
            )}
          >
            {options.length === 0
              ? 'Catalog unavailable — backend may be offline.'
              : 'No model selected.'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
