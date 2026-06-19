'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Eye,
  Code2,
  ImageUp,
  Loader2,
  ClipboardPaste,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { imagesApi } from '@/lib/api'

export type EditorMode = 'fulltext' | 'render'

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  /** Default mode (defaults to 'fulltext'). */
  defaultMode?: EditorMode
  /** Textarea rows in fulltext mode. */
  rows?: number
  /** Placeholder for the textarea. */
  placeholder?: string
  /** Compact mode (smaller padding, no toolbar border). */
  compact?: boolean
  /** Optional id for the textarea (label association). */
  id?: string
  /** Disable the editor. */
  disabled?: boolean
  /** Called when an image is uploaded so the parent can track it. */
  onImageUploaded?: (url: string) => void
  className?: string
}

/**
 * Enhanced Markdown editor with:
 *  - Clipboard image paste (Ctrl/Cmd+V) → instant upload to /data/pic →
 *    MD image syntax inserted at cursor.
 *  - Fulltext ↔ Render mode toggle with live sync.
 *  - File picker for image uploads.
 *
 * Render mode uses react-markdown with the prose-rag class so the
 * Notion-green styled preview matches the rest of the app.
 */
export function MarkdownEditor({
  value,
  onChange,
  defaultMode = 'fulltext',
  rows = 12,
  placeholder = 'Write Markdown here… paste an image with Ctrl/Cmd+V to upload it.',
  compact = false,
  id,
  disabled = false,
  onImageUploaded,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<EditorMode>(defaultMode)
  const [uploading, setUploading] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  /* ---------------------------------------------------------------- */
  /* Image upload + MD insertion                                       */
  /* ---------------------------------------------------------------- */

  const insertAtCursor = React.useCallback(
    (text: string) => {
      const ta = textareaRef.current
      if (!ta) {
        onChange(value + text)
        return
      }
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = value.slice(0, start) + text + value.slice(end)
      onChange(next)
      // Restore cursor just after inserted text
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + text.length
        ta.setSelectionRange(pos, pos)
      })
    },
    [onChange, value],
  )

  const uploadAndInsert = React.useCallback(
    async (file: File | Blob, altHint?: string) => {
      setUploading(true)
      try {
        const img = await imagesApi.upload(file, altHint ? `${altHint}.png` : undefined)
        const alt = altHint || 'pasted image'
        insertAtCursor(`\n\n![${alt}](${img.url})\n\n`)
        onImageUploaded?.(img.url)
        toast.success('Image uploaded', {
          description: `Saved to /data/pic/${img.filename}`,
        })
      } catch (e) {
        toast.error('Image upload failed', {
          description: e instanceof Error ? e.message : 'Unknown error',
        })
      } finally {
        setUploading(false)
      }
    },
    [insertAtCursor, onImageUploaded],
  )

  /* ---------------------------------------------------------------- */
  /* Clipboard paste detection                                         */
  /* ---------------------------------------------------------------- */

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            void uploadAndInsert(file, 'pasted')
          }
          return
        }
      }
      // If no image, let the default paste happen.
    },
    [uploadAndInsert],
  )

  /* ---------------------------------------------------------------- */
  /* File picker for images                                            */
  /* ---------------------------------------------------------------- */

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && file.type.startsWith('image/')) {
        void uploadAndInsert(file, file.name.replace(/\.[^.]+$/, ''))
      }
      e.target.value = ''
    },
    [uploadAndInsert],
  )

  /* Drop image files into the textarea */
  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      const file = e.dataTransfer.files?.[0]
      if (file && file.type.startsWith('image/')) {
        e.preventDefault()
        void uploadAndInsert(file, file.name.replace(/\.[^.]+$/, ''))
      }
    },
    [uploadAndInsert],
  )

  /* ---------------------------------------------------------------- */
  /* Extract image URLs from content (for the image management strip) */
  /* ---------------------------------------------------------------- */

  const images = React.useMemo(() => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g
    const out: { alt: string; url: string }[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(value)) !== null) {
      out.push({ alt: m[1], url: m[2] })
    }
    return out
  }, [value])

  const removeImage = React.useCallback(
    (url: string) => {
      const re = new RegExp(
        `\\n*!\\[[^\\]]*\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n*`,
        'g',
      )
      onChange(value.replace(re, '\n\n'))
      // Best-effort delete from server
      const filename = url.split('/').pop()
      if (filename) void imagesApi.delete(filename)
    },
    [onChange, value],
  )

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-card', className)}>
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border bg-secondary/30',
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
        )}
      >
        <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
          <button
            type="button"
            onClick={() => setMode('fulltext')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'fulltext'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            Fulltext
          </button>
          <button
            type="button"
            onClick={() => setMode('render')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'render'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Render
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {uploading && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading…
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload image</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Editor / Preview body */}
      <div className="relative min-h-0 flex-1">
        {mode === 'fulltext' ? (
          <Textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            spellCheck={false}
            className={cn(
              'scrollbar-thin min-h-[200px] resize-y rounded-none border-0 font-mono text-sm focus-visible:ring-0',
              compact ? 'px-3 py-2' : 'px-4 py-3',
            )}
          />
        ) : (
          <ScrollArea
            className={cn(
              'h-full min-h-[200px]',
              compact ? 'max-h-[400px]' : 'max-h-[600px]',
            )}
          >
            <div
              className={cn(
                'prose-rag text-sm',
                compact ? 'px-3 py-2' : 'px-4 py-3',
              )}
            >
              {value.trim() ? (
                <ReactMarkdown
                  components={{
                    img: ({ src, alt }) => (
                      <img
                        src={typeof src === 'string' ? src : ''}
                        alt={alt ?? ''}
                        className="my-3 max-w-full rounded-lg border border-border"
                        loading="lazy"
                      />
                    ),
                  }}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Image management strip */}
      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/20 px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <ClipboardPaste className="h-3 w-3" />
            {images.length} image{images.length === 1 ? '' : 's'}:
          </span>
          {images.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="group flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1"
            >
              <img
                src={img.url}
                alt={img.alt}
                className="h-6 w-6 rounded object-cover"
                loading="lazy"
              />
              <span className="max-w-[120px] truncate text-[10px] text-muted-foreground">
                {img.alt || 'image'}
              </span>
              <button
                type="button"
                onClick={() => removeImage(img.url)}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
