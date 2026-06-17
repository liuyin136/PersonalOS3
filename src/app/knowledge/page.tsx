'use client'

import * as React from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ArrowUpRight,
  Boxes,
  Database,
  FileText,
  Hash,
  Library,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { knowledgeApi, ingestApi } from '@/lib/api'
import { PageHeader } from '@/components/common/page-header'
import { SourceTypeBadge, StatusBadge } from '@/components/common/source-type-badge'
import type {
  KnowledgeDocument,
  KnowledgeNamespace,
  KnowledgeStats,
} from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Local config                                                        */
/* ------------------------------------------------------------------ */

interface StatMeta {
  key: keyof Pick<
    KnowledgeStats,
    'totalDocuments' | 'totalChunks' | 'totalTokens' | 'namespaces'
  >
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const statMeta: StatMeta[] = [
  { key: 'totalDocuments', label: 'Documents', icon: FileText },
  { key: 'totalChunks', label: 'Chunks', icon: Boxes },
  { key: 'totalTokens', label: 'Tokens', icon: Hash },
  { key: 'namespaces', label: 'Namespaces', icon: Database },
]

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function KnowledgePage() {
  const [stats, setStats] = React.useState<KnowledgeStats | null>(null)
  const [namespaces, setNamespaces] = React.useState<KnowledgeNamespace[]>(
    [],
  )
  const [documents, setDocuments] = React.useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      knowledgeApi.getStats(),
      knowledgeApi.listNamespaces(),
      ingestApi.listDocuments(),
    ])
      .then(([s, ns, docs]) => {
        if (!active) return
        setStats(s)
        setNamespaces(ns)
        setDocuments(docs)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load knowledge base')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <PageHeader
        icon={Library}
        title="Knowledge Base"
        description="Browse vector namespaces, inspect document inventory, and jump straight into hybrid search."
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/search">
              <Search className="h-4 w-4" />
              New Search
            </Link>
          </Button>
        }
      />

      {/* ----------------------------------------------------------- */}
      {/* Stats summary                                               */}
      {/* ----------------------------------------------------------- */}
      <section aria-label="Knowledge stats summary">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statMeta.map((meta, idx) => {
            const Icon = meta.icon
            const value = stats ? stats[meta.key] : null
            return (
              <Card
                key={meta.key}
                className="animate-in fade-in slide-in-from-bottom-2 duration-500 gap-0 py-4"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <CardContent className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg gradient-green text-primary-foreground shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    {loading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : value === null ? (
                      <span className="text-xl font-bold text-muted-foreground">
                        —
                      </span>
                    ) : (
                      <p className="text-xl font-bold tabular-nums sm:text-2xl">
                        {value.toLocaleString()}
                      </p>
                    )}
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {error && (
          <p className="mt-3 text-xs text-destructive">
            Could not load live stats: {error}. Showing cached / empty state.
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------- */}
      {/* Namespaces grid                                             */}
      {/* ----------------------------------------------------------- */}
      <section aria-labelledby="namespaces-title">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2
              id="namespaces-title"
              className="text-lg font-semibold tracking-tight"
            >
              Namespaces
            </h2>
            {!loading && (
              <Badge variant="secondary" className="rounded-full">
                {namespaces.length}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : namespaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Database className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No namespaces yet</p>
              <p className="text-xs text-muted-foreground">
                Create one during ingestion to organise your vectors.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/ingest">Start Ingesting</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {namespaces.map((ns, idx) => (
              <Card
                key={ns.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-500 gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <CardHeader className="gap-2 border-b border-border/60 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-green text-primary-foreground shadow-sm">
                        <Database className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold">
                          {ns.name}
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Created {format(parseISO(ns.createdAt), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 bg-secondary/60 text-[10px] font-semibold"
                      title="Embedding model"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      {ns.embeddingModel}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs leading-relaxed">
                    {ns.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="grid grid-cols-3 gap-2 py-4">
                  <Stat label="Docs" value={ns.documentCount} />
                  <Stat label="Chunks" value={ns.chunkCount} />
                  <Stat label="Tokens" value={ns.totalTokens} compact />
                </CardContent>

                <CardFooter className="border-t border-border/60 bg-muted/30 py-3">
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Link href={`/search?ns=${encodeURIComponent(ns.name)}`}>
                      <Search className="h-3.5 w-3.5" />
                      Open in Search
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- */}
      {/* Recent documents table                                      */}
      {/* ----------------------------------------------------------- */}
      <section aria-labelledby="recent-docs-title">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2
            id="recent-docs-title"
            className="text-lg font-semibold tracking-tight"
          >
            Recent Documents
          </h2>
          {!loading && (
            <Badge variant="secondary" className="rounded-full">
              {documents.length}
            </Badge>
          )}
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No documents yet</p>
              <p className="text-xs text-muted-foreground">
                Ingested documents will appear here.
              </p>
            </CardContent>
          ) : (
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="pl-4">Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Namespace</TableHead>
                    <TableHead className="text-right">Chunks</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="pr-4 text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4 max-w-[260px]">
                        <div className="flex flex-col">
                          <span className="truncate text-sm font-medium">
                            {doc.title}
                          </span>
                          {doc.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {doc.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SourceTypeBadge type={doc.sourceType} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="gap-1 bg-secondary/40 text-[11px]"
                        >
                          <Database className="h-3 w-3" />
                          {doc.namespace}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {doc.chunkCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {doc.tokenCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                        {format(parseISO(doc.updatedAt), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Footer link */}
        <div className="mt-3 flex items-center justify-end">
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto gap-1 px-0 text-primary"
          >
            <Link href="/ingest">
              Manage ingestions
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  compact,
}: {
  label: string
  value: number
  compact?: boolean
}) {
  const display = compact
    ? value >= 1000
      ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
      : value.toLocaleString()
    : value.toLocaleString()
  return (
    <div className="rounded-lg bg-secondary/50 px-2.5 py-2 text-center">
      <p className={cn('font-bold tabular-nums', compact ? 'text-sm' : 'text-base')}>
        {display}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
