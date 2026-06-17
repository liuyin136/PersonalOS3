'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Trash2,
  Sparkles,
  User,
  Bot,
  MessageSquareText,
  Zap,
  CircleStop,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { chatApi } from '@/lib/api'
import { uid } from '@/lib/api/client'
import { useChatStore } from '@/lib/store/chat-store'
import { cn } from '@/lib/utils'
import type { ChatMessage, ChatRequest, ChatRole } from '@/types/rag'

/**
 * Chat interface — Workflow 4 middle column.
 * Renders the conversation, accepts new user messages, streams (or fetches)
 * the assistant response, and updates the chat store.
 */
export function ChatInterface() {
  const template = useChatStore((s) => s.template)
  const variables = useChatStore((s) => s.variables)
  const parameters = useChatStore((s) => s.parameters)
  const messages = useChatStore((s) => s.messages)
  const selectedContextIds = useChatStore((s) => s.selectedContextIds)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const cancelRef = React.useRef(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to the latest message on changes.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, busy])

  const canSend =
    !busy &&
    input.trim().length > 0 &&
    !!template &&
    requiredVariablesFilled(template.variables, variables)

  const handleSend = async () => {
    if (!canSend || !template) return
    const text = input.trim()
    setInput('')
    setBusy(true)
    cancelRef.current = false

    // 1. Build the user message
    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user' as ChatRole,
      content: text,
      timestamp: new Date().toISOString(),
      contextItemIds: selectedContextIds,
    }

    // 2. Build the request payload from the *current* store messages + new msg
    //    (do this BEFORE mutating the store so we don't double-include it)
    const priorMessages = useChatStore.getState().messages
    const payload: ChatRequest = {
      messages: [...priorMessages, userMessage],
      templateId: template.id,
      variables,
      parameters,
      contextItemIds: parameters.useContext ? selectedContextIds : [],
    }

    // 3. Append user message to the store so it shows immediately
    addMessage(userMessage)

    try {
      if (parameters.stream) {
        // Streaming path — create an empty assistant message and incrementally
        // append deltas from the async generator.
        const assistantId = uid('msg')
        addMessage({
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          model: parameters.model,
        })

        let acc = ''
        for await (const chunk of chatApi.streamChat(payload)) {
          if (cancelRef.current) break
          if (chunk.delta) {
            acc += chunk.delta
            updateMessage(assistantId, { content: acc })
          }
          if (chunk.tokenCount) {
            updateMessage(assistantId, { tokenCount: chunk.tokenCount })
          }
        }
      } else {
        // Non-streaming — single fetch
        const assistant = await chatApi.sendChat(payload)
        if (!cancelRef.current) {
          addMessage(assistant)
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error sending chat.'
      addMessage({
        id: uid('msg'),
        role: 'assistant',
        content: `⚠️ **Request failed.**\n\n\`${message}\``,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setBusy(false)
      cancelRef.current = false
      textareaRef.current?.focus()
    }
  }

  const handleCancel = () => {
    cancelRef.current = true
    setBusy(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) handleSend()
    }
  }

  const handleClear = () => {
    clearMessages()
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-green text-primary-foreground">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Conversation</span>
            {template && (
              <span className="text-[11px] text-muted-foreground">
                via <span className="font-medium text-primary">{template.name}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {parameters.stream && (
            <Badge variant="outline" className="gap-1 text-[10px] text-primary">
              <Zap className="h-3 w-3" />
              streaming
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={messages.length === 0 || busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear chat
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="scrollbar-thin flex-1 overflow-y-auto"
      >
        <div className="flex min-h-full flex-col gap-4 p-4">
          {messages.length === 0 ? (
            <EmptyState templateName={template?.name} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {busy && !parameters.stream && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <footer className="border-t border-border bg-card p-3">
        {!template && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Select a prompt template on the left to start chatting.
          </p>
        )}
        {template && !requiredVariablesFilled(template.variables, variables) && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3 w-3" />
            Fill in all required template variables before sending.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              template
                ? `Message · ${template.name}…  (Enter to send, Shift+Enter for newline)`
                : 'Select a template to begin…'
            }
            className="min-h-12 max-h-40 resize-none text-sm"
            disabled={!template}
          />
          {busy ? (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleCancel}
              aria-label="Stop generation"
            >
              <CircleStop className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Message bubble                                                              */
/* -------------------------------------------------------------------------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'flex w-full gap-2.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          isUser
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-secondary text-secondary-foreground',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-secondary text-secondary-foreground',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose-rag max-w-none break-words text-sm">
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <span className="text-muted-foreground italic">…</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 px-1 text-[10px] text-muted-foreground',
            isUser ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.model && <span>· {message.model}</span>}
          {message.tokenCount != null && (
            <span>· {message.tokenCount} tok</span>
          )}
          {message.contextItemIds && message.contextItemIds.length > 0 && (
            <span>· {message.contextItemIds.length} ctx</span>
          )}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-secondary px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ templateName }: { templateName?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-secondary/20 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-green text-primary-foreground shadow-md">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <div>
        <h4 className="text-base font-semibold">Start a structured chat</h4>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          {templateName
            ? `The “${templateName}” template is loaded. Fill in the variables on the left, pick your context from the cart, then type your question below to generate a response.`
            : 'Pick a prompt template on the left, fill in its variables, choose cart items as context, and send your first message to see the RAG response stream in.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <Zap className="h-3 w-3 text-primary" /> streaming supported
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> template-driven
        </Badge>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function requiredVariablesFilled(
  vars: { key: string; required?: boolean }[],
  values: Record<string, string>,
): boolean {
  return vars
    .filter((v) => v.required)
    .every((v) => (values[v.key] ?? '').trim().length > 0)
}
