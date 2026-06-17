'use client'

import { useCallback, useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { UploadZone } from '@/components/ingest/upload-zone'
import { ChunkingPreview } from '@/components/ingest/chunking-preview'
import { SyncStatusPanel } from '@/components/ingest/sync-status-panel'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Toaster as SonnerToaster } from 'sonner'
import { ingestApi } from '@/lib/api'
import type {
  ChunkPreview,
  ChunkingConfig,
  IngestRequest,
  KnowledgeDocument,
  SyncStatusEvent,
} from '@/types/rag'

type PreviewTab = 'upload' | 'preview'

export default function IngestPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [chunks, setChunks] = useState<ChunkPreview[]>([])
  const [lastConfig, setLastConfig] = useState<ChunkingConfig | null>(null)

  const [loadingDocs, setLoadingDocs] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<PreviewTab>('upload')
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  // Fetch documents on mount.
  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true)
    try {
      const docs = await ingestApi.listDocuments()
      setDocuments(docs)
    } catch {
      toast.error('Failed to load documents', {
        description: 'Please refresh the page to retry.',
      })
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  // Add a new document and immediately preview its chunks.
  const handleIngest = useCallback(
    async (payload: IngestRequest) => {
      setSubmitting(true)
      let created: KnowledgeDocument | null = null
      try {
        created = await ingestApi.createIngest(payload)
        setDocuments((prev) => [created as KnowledgeDocument, ...prev])
        toast.success('Source ingested', {
          description: `Generating chunk preview for "${created.title}"…`,
        })
      } catch {
        toast.error('Ingest failed', {
          description: 'Could not create the document. Try again.',
        })
        setSubmitting(false)
        return
      }

      setLastConfig(payload.chunking)
      setChunks([])
      setActiveTab('preview')
      setPreviewLoading(true)
      try {
        const preview = await ingestApi.previewChunks(
          created.id,
          payload.chunking,
        )
        setChunks(preview)
        toast.success(`${preview.length} chunks ready for review`, {
          description:
            'Inspect them in the preview tab, then sync to pgvector.',
        })
      } catch {
        toast.error('Chunk preview failed', {
          description: 'You can still sync the document from the right panel.',
        })
      } finally {
        setPreviewLoading(false)
        setSubmitting(false)
      }
    },
    [],
  )

  // Sync a document to pgvector — animate progress via subscribeSyncStatus
  // and persist the final state via commitIngest.
  const handleSync = useCallback(
    (docId: string) => {
      if (syncingIds.has(docId)) return
      setSyncingIds((prev) => new Set(prev).add(docId))

      let committed = false
      const finalize = (updated?: KnowledgeDocument) => {
        if (committed) return
        committed = true
        if (updated) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === docId ? updated : d)),
          )
        }
        setSyncingIds((prev) => {
          const next = new Set(prev)
          next.delete(docId)
          return next
        })
      }

      const unsub = ingestApi.subscribeSyncStatus(
        docId,
        (event: SyncStatusEvent) => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    status: event.status,
                    progress: event.progress,
                    errorMessage:
                      event.status === 'failed' ? event.message : undefined,
                  }
                : d,
            ),
          )

          if (event.status === 'synced') {
            ingestApi
              .commitIngest(docId)
              .then((updated) => {
                finalize(updated)
                toast.success('Sync complete', {
                  description: `"${updated.title}" indexed with ${updated.chunkCount} chunks.`,
                })
              })
              .catch(() => {
                finalize()
                toast.error('Commit failed', {
                  description: 'Vectors could not be persisted.',
                })
              })
            unsub()
          } else if (event.status === 'failed') {
            finalize()
            unsub()
            toast.error('Sync failed', { description: event.message })
          }
        },
      )
    },
    [syncingIds],
  )

  const handleDelete = useCallback(
    async (docId: string) => {
      const previous = documents
      const target = previous.find((d) => d.id === docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      // Also clear any preview chunks if they belonged to this doc.
      setChunks((prev) =>
        prev.length > 0 && target ? [] : prev,
      )
      toast.success('Document removed', {
        description: target
          ? `"${target.title}" and its vectors were deleted.`
          : undefined,
      })
      try {
        await ingestApi.deleteDocument(docId)
      } catch {
        setDocuments(previous)
        toast.error('Delete failed', {
          description: 'Restored the document to the list.',
        })
      }
    },
    [documents],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Upload}
        title="Knowledge Ingestion"
        description="Workflow 1 · Upload sources, preview chunks, and sync embeddings into your pgvector knowledge base."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left: Upload form + chunk preview (tabbed) */}
        <div className="min-w-0 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as PreviewTab)}
          >
            <TabsList>
              <TabsTrigger value="upload" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                {chunks.length > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {chunks.length}
                  </span>
                ) : null}
                Chunk Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <UploadZone onSubmit={handleIngest} isSubmitting={submitting} />
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <ChunkingPreview
                chunks={chunks}
                loading={previewLoading}
                config={lastConfig}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Sticky sync status panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <SyncStatusPanel
            documents={documents}
            loading={loadingDocs}
            syncingIds={syncingIds}
            onSync={handleSync}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <SonnerToaster richColors closeButton position="top-right" />
    </div>
  )
}
