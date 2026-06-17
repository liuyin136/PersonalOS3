'use client'

import * as React from 'react'
import {
  LayoutTemplate,
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  Hash,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { chatApi, builtinTemplates } from '@/lib/api'
import { useChatStore } from '@/lib/store/chat-store'
import { cn } from '@/lib/utils'
import type { PromptTemplate, PromptVariable } from '@/types/rag'

/**
 * Template selector — Workflow 4 left column.
 * Lists built-in + remote templates and renders dynamic variable inputs.
 */
export function TemplateSelector() {
  const [templates, setTemplates] = React.useState<PromptTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const template = useChatStore((s) => s.template)
  const setTemplate = useChatStore((s) => s.setTemplate)
  const variables = useChatStore((s) => s.variables)
  const setVariable = useChatStore((s) => s.setVariable)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    chatApi
      .listTemplates()
      .then((list) => {
        if (cancelled) return
        setTemplates(list.length > 0 ? list : builtinTemplates)
        // Auto-select the first template if nothing is selected.
        if (!useChatStore.getState().template && list.length > 0) {
          setTemplate(list[0])
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates(builtinTemplates)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setTemplate])

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          Prompt Templates
        </h3>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Template list */}
      <ScrollArea className="max-h-72">
        <div className="flex flex-col gap-2 pr-2">
          {loading && templates.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-lg border border-border bg-secondary/40"
                />
              ))
            : templates.map((t) => {
                const active = template?.id === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t)}
                    className={cn(
                      'group flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {active ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary/60" />
                        )}
                        <span className="text-sm font-semibold">{t.name}</span>
                      </div>
                      {t.builtin && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                        >
                          built-in
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 pl-5 text-[11px] leading-relaxed text-muted-foreground">
                      {t.description}
                    </p>
                  </button>
                )
              })}
        </div>
      </ScrollArea>

      {/* Variables */}
      {template && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Variables
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {template.variables.length} field
              {template.variables.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {template.variables.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
              This template has no variables.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {template.variables.map((v) => (
                <VariableInput
                  key={v.key}
                  variable={v}
                  value={variables[v.key] ?? ''}
                  onChange={(val) => setVariable(v.key, val)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Variable input — dispatches by PromptVariable.type                          */
/* -------------------------------------------------------------------------- */

const variableIcon: Record<PromptVariable['type'], LucideIcon> = {
  text: Sparkles,
  number: Hash,
  select: LayoutTemplate,
  boolean: CheckCircle2,
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: PromptVariable
  value: string
  onChange: (v: string) => void
}) {
  const Icon = variableIcon[variable.type]

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {variable.label}
        {variable.required && (
          <span className="text-[10px] font-normal text-destructive">*</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {'{{'}
          {variable.key}
          {'}}'}
        </span>
      </Label>

      {variable.type === 'text' && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${variable.label.toLowerCase()}...`}
          className="min-h-16 resize-y text-sm"
        />
      )}

      {variable.type === 'number' && (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="text-sm"
        />
      )}

      {variable.type === 'select' && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(variable.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {variable.type === 'boolean' && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
          />
          <span className="text-xs text-muted-foreground">
            {value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      )}
    </div>
  )
}
