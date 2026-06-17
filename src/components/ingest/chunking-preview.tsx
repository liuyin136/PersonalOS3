'use client'

import Markdown from 'react-markdown'
import {
  Layers,
  Hash,
  Cpu,
  Boxes,
  Info,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChunkPreview, ChunkingConfig } from '@/types/rag'

interface ChunkingPreviewProps {
  chunks: ChunkPreview[]
  loading: boolean
  config: ChunkingConfig | null
}

export function ChunkingPreview({
  chunks,
  loading,
  config,
}: ChunkingPreviewProps) {
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0)
  const hasChunks = chunks.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Layers className="h-4 w-4" />
          </span>
          Chunk preview
        </CardTitle>
        <CardDescription>
          {config ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-foreground">{config.strategy}</span>
              <span className="text-muted-foreground">strategy ·</span>
              <span className="font-mono text-xs">{config.chunkSize} tok</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-xs">{config.chunkOverlap} overlap</span>
            </span>
          ) : (
            <>No preview yet — ingest a source to see how it will be chunked.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : !hasChunks ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No chunks yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                After ingest, chunks will appear here as rendered Markdown for
                review before syncing to pgvector.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="gap-1">
                <Boxes className="h-3 w-3" />
                {chunks.length} chunks
              </Badge>
              <Badge variant="secondary">
                {totalTokens.toLocaleString()} tokens
              </Badge>
              {chunks[0] && (
                <Badge variant="outline" className="gap-1">
                  <Cpu className="h-3 w-3" />
                  {chunks[0].embeddingModel}
                </Badge>
              )}
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info className="h-3 w-3" />
                scroll to inspect
              </span>
            </div>

            <div className="max-h-[560px] space-y-3 overflow-y-auto scrollbar-thin pr-1">
              {chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-lg border border-border bg-card/50 p-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="gap-1 font-mono text-[10px]"
                    >
                      <Hash className="h-3 w-3" />
                      {String(chunk.index).padStart(3, '0')}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {chunk.tokenCount} tok
                    </Badge>
                    {chunk.overlap > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        ↻ {chunk.overlap} overlap
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        no overlap
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] text-muted-foreground"
                    >
                      {chunk.embeddingModel}
                    </Badge>
                  </div>
                  <div className="prose-rag text-sm">
                    <Markdown>{chunk.content}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
