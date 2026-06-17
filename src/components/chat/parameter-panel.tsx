'use client'

import * as React from 'react'
import { Thermometer, Hash, Percent, Zap, Database } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useChatStore } from '@/lib/store/chat-store'
import type { ChatParameters } from '@/types/rag'

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', hint: 'OpenAI · flagship' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'OpenAI · fast' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', hint: 'OpenAI · legacy' },
  { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', hint: 'Anthropic · balanced' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku', hint: 'Anthropic · fast' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', hint: 'Google · long ctx' },
  { value: 'llama-3.1-70b', label: 'Llama 3.1 70B', hint: 'Meta · open' },
]

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  children: React.ReactNode
}

function Field({ icon: Icon, label, value, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </Label>
        <span className="font-mono text-xs font-semibold text-primary">
          {value}
        </span>
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ToggleField({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-2.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

/** Parameter panel — binds ChatParameters in the chat store to UI controls. */
export function ParameterPanel() {
  const parameters = useChatStore((s) => s.parameters)
  const setParameters = useChatStore((s) => s.setParameters)

  const update = (partial: Partial<ChatParameters>) => setParameters(partial)

  return (
    <div className="flex flex-col gap-4">
      <Field
        icon={Hash}
        label="Model"
        value={parameters.model}
      >
        <Select
          value={parameters.model}
          onValueChange={(v) => update({ model: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <div className="flex flex-col">
                  <span>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.hint}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        icon={Thermometer}
        label="Temperature"
        value={parameters.temperature.toFixed(2)}
        hint="Lower = focused, higher = creative"
      >
        <Slider
          value={[parameters.temperature]}
          min={0}
          max={2}
          step={0.05}
          onValueChange={(v) => update({ temperature: v[0] })}
        />
      </Field>

      <Field
        icon={Hash}
        label="Max tokens"
        value={parameters.maxTokens.toString()}
        hint="Maximum length of generated response"
      >
        <Slider
          value={[parameters.maxTokens]}
          min={256}
          max={8192}
          step={128}
          onValueChange={(v) => update({ maxTokens: v[0] })}
        />
      </Field>

      <Field
        icon={Percent}
        label="Top P"
        value={parameters.topP.toFixed(2)}
        hint="Nucleus sampling — 1 = full distribution"
      >
        <Slider
          value={[parameters.topP]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={(v) => update({ topP: v[0] })}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <ToggleField
          icon={Zap}
          label="Stream response"
          description="Token-by-token streaming"
          checked={parameters.stream}
          onCheckedChange={(v) => update({ stream: v })}
        />
        <ToggleField
          icon={Database}
          label="Use cart context"
          description="Inject selected cart items as context"
          checked={parameters.useContext}
          onCheckedChange={(v) => update({ useContext: v })}
        />
      </div>
    </div>
  )
}
