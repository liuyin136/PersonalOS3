'use client'

import * as React from 'react'
import { Pencil, Loader2, Sparkles, Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { SourceTypeBadge } from '@/components/common/source-type-badge'
import { searchApi } from '@/lib/api'
import { toast } from 'sonner'
import type { ChunkHit, ParentResult } from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EditModalProps {
  chunk: ChunkHit | null
  parent: ParentResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (chunkId: string, newContent: string, reembedded: boolean) => void
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function EditModal({
  chunk,
  parent,
  open,
  onOpenChange,
  onSaved,
}: EditModalProps) {
  const [content, setContent] = React.useState('')
  const [reembed, setReembed] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Reset content whenever a new chunk is opened.
  React.useEffect(() => {
    if (chunk) {
      setContent(chunk.content)
      setReembed(true)
    }
  }, [chunk])

  // Avoid rendering anything until we actually have a chunk.
  if (!chunk) return null

  const charCount = content.length
  const tokenEstimate = Math.ceil(charCount / 3.8)
  const dirty = content.trim().length > 0 && content !== chunk.content

  const handleSave = async () => {
    if (!dirty) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      const res = await searchApi.editChunk({
        id: chunk.id,
        content,
        reembed,
      })
      toast.success('Chunk updated', {
        description: reembed
          ? 'Re-embedded into pgvector successfully.'
          : 'Saved without re-embedding.',
      })
      onSaved(chunk.id, content, res.reembedded)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to update chunk', {
        description:
          err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Chunk
          </DialogTitle>
          <DialogDescription>
            Edit the chunk content. Re-embedding regenerates the vector
            and updates the pgvector index in place.
          </DialogDescription>
        </DialogHeader>

        {/* Chunk meta — parent context + chunk index */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
          <span className="font-medium">
            {parent?.documentTitle ?? 'Untitled document'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            chunk {chunk.chunkIndex}
          </Badge>
          {parent && <SourceTypeBadge type={parent.sourceType} />}
          {parent && (
            <Badge
              variant="outline"
              className="bg-secondary/60 text-[10px] text-muted-foreground"
            >
              {parent.namespace}
            </Badge>
          )}
          <span className="ml-auto text-muted-foreground">
            {charCount} chars · ~{tokenEstimate} tokens
          </span>
        </div>

        {/* Content textarea */}
        <div className="space-y-2">
          <Label
            htmlFor="chunk-content"
            className="text-xs font-medium text-muted-foreground"
          >
            Chunk content (Markdown supported)
          </Label>
          <Textarea
            id="chunk-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="scrollbar-thin font-mono text-xs"
            spellCheck={false}
          />
        </div>

        {/* Re-embed switch */}
        <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <Label
                htmlFor="reembed"
                className="cursor-pointer text-sm font-medium"
              >
                Re-embed after save
              </Label>
              <p className="text-xs text-muted-foreground">
                Regenerate the embedding vector and update the pgvector
                index.
              </p>
            </div>
          </div>
          <Switch
            id="reembed"
            checked={reembed}
            onCheckedChange={setReembed}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || content.trim().length === 0}
            className="gradient-green text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {reembed ? 'Save & Re-embed' : 'Save Changes'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
