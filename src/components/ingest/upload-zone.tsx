'use client'

import * as React from 'react'
import { useState } from 'react'
import {
  Upload,
  FileText,
  File,
  Globe,
  Link2,
  FileType,
  BookOpen,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { IngestRequest, SourceType, ChunkingConfig } from '@/types/rag'

interface UploadZoneProps {
  onSubmit: (payload: IngestRequest) => Promise<void> | void
  isSubmitting: boolean
}

const SOURCE_OPTIONS: {
  value: SourceType
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'pdf', label: 'PDF', icon: File },
  { value: 'markdown', label: 'Markdown', icon: FileText },
  { value: 'txt', label: 'Plain Text', icon: FileText },
  { value: 'html', label: 'HTML', icon: Globe },
  { value: 'docx', label: 'DOCX', icon: FileType },
  { value: 'url', label: 'Web URL', icon: Link2 },
  { value: 'confluence', label: 'Confluence', icon: BookOpen },
]

const NAMESPACE_OPTIONS = ['engineering', 'hr', 'legal'] as const

const STRATEGY_OPTIONS: {
  value: ChunkingConfig['strategy']
  label: string
  description: string
}[] = [
  { value: 'fixed', label: 'Fixed-size', description: 'equal token chunks' },
  { value: 'recursive', label: 'Recursive', description: 'structural splits' },
  { value: 'semantic', label: 'Semantic', description: 'topical grouping' },
  { value: 'markdown', label: 'Markdown-aware', description: 'preserves headings' },
]

const SEPARATORS_BY_STRATEGY: Record<ChunkingConfig['strategy'], string[]> = {
  fixed: [' '],
  recursive: ['\n\n', '\n', '. ', ' '],
  semantic: ['\n\n'],
  markdown: ['\n## ', '\n### ', '\n\n'],
}

function detectSourceFromFilename(name: string): SourceType {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'txt':
      return 'txt'
    case 'html':
    case 'htm':
      return 'html'
    case 'docx':
      return 'docx'
    default:
      return 'markdown'
  }
}

export function UploadZone({ onSubmit, isSubmitting }: UploadZoneProps) {
  const [title, setTitle] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('markdown')
  const [sourceUri, setSourceUri] = useState('')
  const [namespace, setNamespace] = useState<string>('engineering')
  const [tagsInput, setTagsInput] = useState('')
  const [strategy, setStrategy] = useState<ChunkingConfig['strategy']>('recursive')
  const [chunkSize, setChunkSize] = useState(800)
  const [chunkOverlap, setChunkOverlap] = useState(120)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function applyDroppedFile(file: File) {
    const type = detectSourceFromFilename(file.name)
    setSourceType(type)
    setTitle((prev) => prev || file.name.replace(/\.[^.]+$/, ''))
    setSourceUri((prev) => prev || `s3://verdant/uploads/${file.name}`)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      applyDroppedFile(file)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      applyDroppedFile(file)
    }
    e.target.value = ''
  }

  function buildConfig(): ChunkingConfig {
    return {
      strategy,
      chunkSize,
      chunkOverlap,
      separators: SEPARATORS_BY_STRATEGY[strategy],
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !sourceUri.trim()) return
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const payload: IngestRequest = {
      title: title.trim(),
      sourceType,
      sourceUri: sourceUri.trim(),
      namespace,
      tags,
      chunking: buildConfig(),
    }
    void onSubmit(payload)
  }

  function resetForm() {
    setTitle('')
    setSourceUri('')
    setTagsInput('')
    setStrategy('recursive')
    setChunkSize(800)
    setChunkOverlap(120)
  }

  const canSubmit = title.trim().length > 0 && sourceUri.trim().length > 0

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Upload className="h-4 w-4" />
          </span>
          Add knowledge source
        </CardTitle>
        <CardDescription>
          Drag &amp; drop a file, pick a source type, then configure the
          chunking strategy before ingesting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50',
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-green text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragging ? 'Drop to attach' : 'Drag & drop a file here'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports PDF, Markdown, TXT, HTML, DOCX · or use a URL / Confluence page
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <FileText className="h-4 w-4" />
              Browse files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.md,.markdown,.txt,.html,.htm,.docx"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Source fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Onboarding Handbook 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceType">Source type</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => setSourceType(v as SourceType)}
              >
                <SelectTrigger id="sourceType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="namespace">Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger id="namespace" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAMESPACE_OPTIONS.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sourceUri">Source URI</Label>
              <Input
                id="sourceUri"
                placeholder="s3://bucket/path · https:// · confluence://wiki/space/page"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tags">
                Tags{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="tags"
                placeholder="architecture, rag, reference"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Chunking config */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Chunking strategy</h4>
                <p className="text-xs text-muted-foreground">
                  Controls how text is split before embedding.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) =>
                  setStrategy(v as ChunkingConfig['strategy'])
                }
              >
                <SelectTrigger id="strategy" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">
                          · {opt.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chunkSize">Chunk size</Label>
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground">
                    {chunkSize} tok
                  </span>
                </div>
                <Slider
                  id="chunkSize"
                  min={200}
                  max={2000}
                  step={50}
                  value={[chunkSize]}
                  onValueChange={(v) => setChunkSize(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chunkOverlap">Chunk overlap</Label>
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground">
                    {chunkOverlap} tok
                  </span>
                </div>
                <Slider
                  id="chunkOverlap"
                  min={0}
                  max={400}
                  step={10}
                  value={[chunkOverlap]}
                  onValueChange={(v) => setChunkOverlap(v[0])}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingesting…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Ingest &amp; preview chunks
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
