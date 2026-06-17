'use client'

import {
  Database,
  Loader2,
  Trash2,
  FileStack,
  Hash,
  ScrollText,
  CheckCircle2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SourceTypeBadge,
  StatusBadge,
} from '@/components/common/source-type-badge'
import type { KnowledgeDocument } from '@/types/rag'

interface SyncStatusPanelProps {
  documents: KnowledgeDocument[]
  loading: boolean
  syncingIds: Set<string>
  onSync: (docId: string) => void
  onDelete: (docId: string) => void
}

export function SyncStatusPanel({
  documents,
  loading,
  syncingIds,
  onSync,
  onDelete,
}: SyncStatusPanelProps) {
  const totalChunks = documents.reduce((s, d) => s + d.chunkCount, 0)
  const totalTokens = documents.reduce((s, d) => s + d.tokenCount, 0)
  const syncedCount = documents.filter((d) => d.status === 'synced').length

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-green text-primary-foreground">
            <Database className="h-4 w-4" />
          </span>
          Sync status
        </CardTitle>
        <CardDescription>
          {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
          {syncedCount} synced to pgvector
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mini stats */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat
            icon={<FileStack className="h-3 w-3" />}
            value={String(documents.length)}
            label="docs"
          />
          <Stat
            icon={<Hash className="h-3 w-3" />}
            value={totalChunks.toLocaleString()}
            label="chunks"
          />
          <Stat
            icon={<ScrollText className="h-3 w-3" />}
            value={`${(totalTokens / 1000).toFixed(1)}k`}
            label="tokens"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Database className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs text-muted-foreground">
              Ingest a source on the left to begin.
            </p>
          </div>
        ) : (
          <div className="max-h-[600px] space-y-3 overflow-y-auto scrollbar-thin pr-1">
            {documents.map((doc) => {
              const syncing = syncingIds.has(doc.id)
              const isSynced = doc.status === 'synced'
              return (
                <div
                  key={doc.id}
                  className="rounded-lg border border-border bg-card/60 p-3 shadow-sm transition-colors hover:border-primary/40"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        title={doc.title}
                      >
                        {doc.title}
                      </p>
                      <p
                        className="truncate font-mono text-[10px] text-muted-foreground"
                        title={doc.sourceUri}
                      >
                        {doc.sourceUri}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>

                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <SourceTypeBadge type={doc.sourceType} />
                    <Badge variant="outline" className="text-[10px]">
                      {doc.namespace}
                    </Badge>
                    {doc.tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        #{tag}
                      </Badge>
                    ))}
                    {doc.tags.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{doc.tags.length - 2}
                      </span>
                    )}
                  </div>

                  <Progress value={doc.progress} className="h-1.5" />

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span>{doc.chunkCount} chunks</span>
                      <span>·</span>
                      <span>{doc.tokenCount.toLocaleString()} tok</span>
                    </span>
                    <span className="font-mono">{doc.progress}%</span>
                  </div>

                  {doc.errorMessage && doc.status === 'failed' && (
                    <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                      {doc.errorMessage}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={isSynced ? 'outline' : 'default'}
                      onClick={() => onSync(doc.id)}
                      disabled={syncing}
                      className="h-7 gap-1 text-xs"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Syncing…
                        </>
                      ) : isSynced ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Re-sync
                        </>
                      ) : (
                        <>
                          <Database className="h-3 w-3" />
                          Sync to pgvector
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(doc.id)}
                      disabled={syncing}
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
      <div className="flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="mt-1 text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
