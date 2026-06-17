'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Eye,
  Terminal,
  User,
  Database,
  Info,
  Braces,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/lib/store/chat-store'
import { useCartStore } from '@/lib/store/cart-store'
import { cn } from '@/lib/utils'

/**
 * Prompt preview — assembles the final system + user prompts the backend
 * will receive, by interpolating {{context}} and {{variable}} placeholders.
 */
export function PromptPreview() {
  const template = useChatStore((s) => s.template)
  const variables = useChatStore((s) => s.variables)
  const selectedContextIds = useChatStore((s) => s.selectedContextIds)
  const useContext = useChatStore((s) => s.parameters.useContext)
  const cartItems = useCartStore((s) => s.items)

  const contextItems = React.useMemo(
    () =>
      useContext
        ? cartItems.filter((i) => selectedContextIds.includes(i.id))
        : [],
    [cartItems, selectedContextIds, useContext],
  )

  const assembled = React.useMemo(() => {
    if (!template) {
      return { system: '', user: '', contextCount: 0, contextTokens: 0 }
    }
    const contextText = contextItems
      .map(
        (i) =>
          `<!-- ${i.documentTitle} · chunk #${i.chunkIndex} (${i.tokenCount} tok) -->\n${i.content}`,
      )
      .join('\n\n---\n\n')

    let system = template.systemPrompt
    let user = template.userPrompt

    // Replace {{context}} placeholder
    const contextBlock = contextText || '_No context attached._'
    system = system.replace(/\{\{context\}\}/g, contextBlock)

    // Replace each declared variable
    for (const v of template.variables) {
      const val = variables[v.key] ?? ''
      const re = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g')
      system = system.replace(re, val)
      user = user.replace(re, val)
    }

    return {
      system,
      user,
      contextCount: contextItems.length,
      contextTokens: contextItems.reduce((s, i) => s + i.tokenCount, 0),
    }
  }, [template, variables, contextItems])

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <Eye className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No template selected</p>
        <p className="text-xs text-muted-foreground">
          Choose a prompt template on the left to see the assembled prompt here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Context badge */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className={cn(
            'gap-1 text-[10px]',
            useContext
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Database className="h-3 w-3" />
          {useContext
            ? `${assembled.contextCount} ctx · ${assembled.contextTokens} tok`
            : 'context off'}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Braces className="h-3 w-3" />
          {template.variables.length} var
        </Badge>
        {!useContext && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            Turn on “Use cart context” to inject context.
          </span>
        )}
      </div>

      <ScrollArea className="max-h-[28rem] rounded-lg">
        <div className="flex flex-col gap-3 pr-2">
          {/* System prompt */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex items-center gap-1.5 border-b border-border bg-secondary/40 px-3 py-1.5">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                System prompt
              </span>
            </header>
            <div className="prose-rag max-w-none px-3 py-2 text-xs">
              <ReactMarkdown>{assembled.system}</ReactMarkdown>
            </div>
          </section>

          {/* User prompt */}
          <section className="overflow-hidden rounded-lg border border-primary/40 bg-primary/5">
            <header className="flex items-center gap-1.5 border-b border-primary/30 bg-primary/10 px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                User prompt
              </span>
            </header>
            <div className="prose-rag max-w-none px-3 py-2 text-xs">
              <ReactMarkdown>{assembled.user}</ReactMarkdown>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
