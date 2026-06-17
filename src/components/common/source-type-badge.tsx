'use client'

import { FileText, File, Globe, Link2, FileType, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SourceType, IngestStatus } from '@/types/rag'

const sourceConfig: Record<
  SourceType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pdf: { label: 'PDF', icon: File },
  markdown: { label: 'MD', icon: FileText },
  txt: { label: 'TXT', icon: FileText },
  html: { label: 'HTML', icon: Globe },
  docx: { label: 'DOCX', icon: FileType },
  url: { label: 'URL', icon: Link2 },
  confluence: { label: 'CONF', icon: BookOpen },
}

export function SourceTypeBadge({ type }: { type: SourceType }) {
  const cfg = sourceConfig[type]
  const Icon = cfg.icon
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 bg-secondary/60 text-[10px] font-semibold')}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

const statusConfig: Record<
  IngestStatus,
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground border-transparent',
    dot: 'bg-muted-foreground',
  },
  uploading: {
    label: 'Uploading',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-transparent',
    dot: 'bg-blue-500',
  },
  chunking: {
    label: 'Chunking',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-transparent',
    dot: 'bg-amber-500',
  },
  embedding: {
    label: 'Embedding',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-transparent',
    dot: 'bg-purple-500',
  },
  indexing: {
    label: 'Indexing',
    className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-transparent',
    dot: 'bg-cyan-500',
  },
  synced: {
    label: 'Synced',
    className: 'bg-primary/15 text-primary border-transparent',
    dot: 'bg-primary',
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/15 text-destructive border-transparent',
    dot: 'bg-destructive',
  },
}

export function StatusBadge({ status }: { status: IngestStatus }) {
  const cfg = statusConfig[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-[11px] font-medium', cfg.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}
