'use client'

import * as React from 'react'
import { MessageSquare, Sliders, Database, Eye } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TemplateSelector } from '@/components/chat/template-selector'
import { ParameterPanel } from '@/components/chat/parameter-panel'
import { ContextSelector } from '@/components/chat/context-selector'
import { PromptPreview } from '@/components/chat/prompt-preview'
import { ChatInterface } from '@/components/chat/chat-interface'
import { cn } from '@/lib/utils'

type MobileTab = 'chat' | 'template' | 'params'

/**
 * Workflow 4 — Template-based Structured Chat Flow.
 * 3-column responsive layout: template + variables | chat | parameters + context + preview.
 */
export default function StructuredChatPage() {
  const [mobileTab, setMobileTab] = React.useState<MobileTab>('chat')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={MessageSquare}
        title="Structured Chat"
        description="Workflow 4 — assemble RAG prompts from templates, inject cart context as {{context}}, and stream model responses token-by-token."
      />

      {/* Mobile tab switcher */}
      <Tabs
        value={mobileTab}
        onValueChange={(v) => setMobileTab(v as MobileTab)}
        className="md:hidden"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="params">Params</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Responsive 3-col layout on lg, 2-col on md, single col (tab-driven) on mobile */}
      <div className="grid gap-4 md:h-[calc(100vh-12rem)] md:grid-cols-12">
        {/* ── Left: template + variables ───────────────────────────────── */}
        <Card
          className={cn(
            'min-h-0 overflow-hidden p-4 md:col-span-5 md:flex lg:col-span-3',
            mobileTab === 'template' ? 'block' : 'hidden',
          )}
        >
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
            <TemplateSelector />
          </div>
        </Card>

        {/* ── Middle: chat interface ───────────────────────────────────── */}
        <section
          className={cn(
            'min-h-[70vh] md:col-span-7 md:min-h-0 lg:col-span-6 lg:block',
            mobileTab === 'chat' ? 'block' : 'hidden',
            'md:block',
          )}
        >
          <ChatInterface />
        </section>

        {/* ── Right: parameters + context + preview (tabs) ─────────────── */}
        <Card
          className={cn(
            'min-h-0 overflow-hidden p-4 md:col-span-12 md:flex lg:col-span-3',
            mobileTab === 'params' ? 'block' : 'hidden',
          )}
        >
          <Tabs defaultValue="parameters" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-3">
              <TabsTrigger value="parameters" className="gap-1">
                <Sliders className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Params</span>
              </TabsTrigger>
              <TabsTrigger value="context" className="gap-1">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Context</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1">
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
            </TabsList>
            <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <TabsContent value="parameters" className="mt-0">
                <ParameterPanel />
              </TabsContent>
              <TabsContent value="context" className="mt-0">
                <ContextSelector />
              </TabsContent>
              <TabsContent value="preview" className="mt-0">
                <PromptPreview />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
