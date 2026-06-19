'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Database,
  ServerCog,
  Brain,
  Search,
  MessageSquare,
  Settings,
  Library,
  Upload,
  RefreshCw,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { healthApi, request } from '@/lib/api'
import type { HealthStatus } from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CheckResult {
  key: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: HealthStatus
  latencyMs?: number
  detail?: string
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CHECK_DEFS: {
  key: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    key: 'api',
    name: 'API Server',
    description: 'FastAPI app responding on /api/health',
    icon: ServerCog,
  },
  {
    key: 'database',
    name: 'Postgres + pgvector',
    description: 'Primary store + HNSW vector index',
    icon: Database,
  },
  {
    key: 'redis',
    name: 'Redis',
    description: 'Arq task queue broker + cache',
    icon: Database,
  },
  {
    key: 'embedder',
    name: 'Embedding Model',
    description: 'sentence-transformers BGE encoder',
    icon: Brain,
  },
  {
    key: 'ingest',
    name: 'Ingest Endpoint',
    description: 'GET /api/ingest/documents',
    icon: Upload,
  },
  {
    key: 'search',
    name: 'Search Endpoint',
    description: 'POST /api/search (hybrid)',
    icon: Search,
  },
  {
    key: 'chat',
    name: 'Chat Endpoint',
    description: 'GET /api/chat/templates',
    icon: MessageSquare,
  },
  {
    key: 'settings',
    name: 'Settings Endpoint',
    description: 'GET /api/settings',
    icon: Settings,
  },
  {
    key: 'knowledge',
    name: 'Knowledge Endpoint',
    description: 'GET /api/knowledge/stats',
    icon: Library,
  },
]

const STATUS_STYLE: Record<
  HealthStatus,
  {
    badge: string
    ring: string
    icon: string
    dot: string
    Icon: React.ComponentType<{ className?: string }>
  }
> = {
  ok: {
    badge: 'bg-primary/15 text-primary border-transparent',
    ring: 'border-primary/40',
    icon: 'text-primary',
    dot: 'bg-primary',
    Icon: CheckCircle2,
  },
  degraded: {
    badge:
      'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-transparent',
    ring: 'border-amber-500/40',
    icon: 'text-amber-500',
    dot: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  down: {
    badge: 'bg-destructive/15 text-destructive border-transparent',
    ring: 'border-destructive/40',
    icon: 'text-destructive',
    dot: 'bg-destructive',
    Icon: XCircle,
  },
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Run a single lightweight call against an endpoint, measuring latency
 * and returning a HealthStatus. Network errors and HTTP >= 500 map to
 * `down`; 4xx or unexpectedly-empty bodies map to `degraded`; 2xx → ok.
 */
async function ping(
  fn: () => Promise<unknown>,
): Promise<{ status: HealthStatus; latencyMs: number; detail?: string }> {
  const start = performance.now()
  try {
    await fn()
    const latencyMs = Math.round(performance.now() - start)
    return { status: 'ok', latencyMs, detail: undefined }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const msg = err instanceof Error ? err.message : 'Network error'
    if (/HTTP 5\d\d|Network error|Failed to fetch/i.test(msg)) {
      return { status: 'down', latencyMs, detail: msg }
    }
    return { status: 'degraded', latencyMs, detail: msg }
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HealthPage() {
  const [results, setResults] = React.useState<CheckResult[]>([])
  const [loading, setLoading] = React.useState(true)
  const [autoRefresh, setAutoRefresh] = React.useState(false)
  const [seeding, setSeeding] = React.useState(false)

  const runChecks = React.useCallback(async () => {
    setLoading(true)
    setResults([])

    // First, hit /api/health for the structured report.
    let report = null
    try {
      report = await healthApi.check()
    } catch {
      report = null
    }

    // Run each endpoint check in parallel — independent of the report.
    const tasks: Promise<CheckResult>[] = CHECK_DEFS.map(async (def) => {
      // For DB / Redis / embedder, read from the structured report.
      if (
        def.key === 'database' ||
        def.key === 'redis' ||
        def.key === 'embedder'
      ) {
        const comp = report?.components.find((c) =>
          def.key === 'database'
            ? /postgres|database|db/i.test(c.name)
            : def.key === 'redis'
              ? /redis/i.test(c.name)
              : /embed/i.test(c.name),
        )
        return {
          ...def,
          status: comp?.status ?? 'down',
          latencyMs: comp?.latencyMs,
          detail:
            comp?.detail ??
            (report
              ? 'Not reported by backend'
              : 'Health endpoint unreachable'),
        }
      }

      // Otherwise, ping the endpoint directly.
      let probe: () => Promise<unknown> = () =>
        Promise.reject(new Error('No probe'))
      switch (def.key) {
        case 'api':
          probe = () => request('/api/health')
          break
        case 'ingest':
          probe = () => request('/api/ingest/documents')
          break
        case 'search':
          probe = () =>
            request('/api/search', {
              method: 'POST',
              body: {
                query: 'health check',
                mode: 'hybrid',
                namespace: 'engineering',
                top_k: 1,
                alpha: 0.5,
                rerank: false,
                rerank_top: 1,
              },
            })
          break
        case 'chat':
          probe = () => request('/api/chat/templates')
          break
        case 'settings':
          probe = () => request('/api/settings')
          break
        case 'knowledge':
          probe = () => request('/api/knowledge/stats')
          break
      }
      const res = await ping(probe)
      return { ...def, ...res }
    })

    const settled = await Promise.all(tasks)
    setResults(settled)
    setLoading(false)
  }, [])

  // Initial check on mount.
  React.useEffect(() => {
    void runChecks()
  }, [runChecks])

  // Auto-refresh every 10s when toggled.
  React.useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      void runChecks()
    }, 10000)
    return () => clearInterval(id)
  }, [autoRefresh, runChecks])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await request('/api/seed', { method: 'POST' })
      toast.success('Sample data seeded', {
        description:
          'The database now has demo documents & chunks.',
      })
      // Re-run checks so users see fresh state.
      void runChecks()
    } catch (err) {
      toast.error('Failed to seed sample data', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSeeding(false)
    }
  }

  /* ---- Derive overall status ---- */
  const overall: HealthStatus = React.useMemo(() => {
    if (results.length === 0) return 'down'
    if (results.some((r) => r.status === 'down')) return 'down'
    if (results.some((r) => r.status === 'degraded')) return 'degraded'
    return 'ok'
  }, [results])

  const okCount = results.filter((r) => r.status === 'ok').length
  const degradedCount = results.filter((r) => r.status === 'degraded').length
  const downCount = results.filter((r) => r.status === 'down').length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="System Health"
        description="Live status of every backend dependency and RAG endpoint. Re-run checks any time, or seed sample data to populate the database."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runChecks()}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Re-run checks
            </Button>
            <Button
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
              className="gap-1.5 gradient-green text-primary-foreground"
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sprout className="h-4 w-4" />
              )}
              Seed sample data
            </Button>
          </>
        }
      />

      {/* ---------------- Overall banner ---------------- */}
      <OverallBanner
        status={overall}
        okCount={okCount}
        degradedCount={degradedCount}
        downCount={downCount}
        loading={loading}
      />

      {/* ---------------- Auto-refresh + summary ---------------- */}
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Auto-refresh</div>
              <p className="text-xs text-muted-foreground">
                Re-run all checks every 10 seconds while this page is
                open.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-xs">
              {autoRefresh ? 'On' : 'Off'}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Component grid ---------------- */}
      {loading && results.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHECK_DEFS.map((def) => (
            <Card key={def.key} className="gap-3 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {results.map((r) => {
            const style = STATUS_STYLE[r.status]
            const Icon = r.icon
            const StatusIcon = style.Icon
            return (
              <motion.div
                key={r.key}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Card
                  className={cn(
                    'h-full gap-3 p-5 transition-colors',
                    style.ring,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary',
                        style.icon,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-tight">
                        {r.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.description}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 text-[10px] font-semibold uppercase',
                        style.badge,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {r.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          style.dot,
                        )}
                      />
                      {r.latencyMs !== undefined ? (
                        <span>{r.latencyMs} ms</span>
                      ) : (
                        <span>—</span>
                      )}
                    </span>
                  </div>
                  {r.detail && (
                    <p className="line-clamp-2 break-words rounded-md bg-secondary/40 px-2 py-1.5 text-[10px] text-muted-foreground">
                      {r.detail}
                    </p>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function OverallBanner({
  status,
  okCount,
  degradedCount,
  downCount,
  loading,
}: {
  status: HealthStatus
  okCount: number
  degradedCount: number
  downCount: number
  loading: boolean
}) {
  const style = STATUS_STYLE[status]
  const Icon = style.Icon
  const title =
    status === 'ok'
      ? 'All systems operational'
      : status === 'degraded'
        ? 'Some systems degraded'
        : 'One or more systems are down'
  const description =
    status === 'ok'
      ? 'Every backend dependency and RAG endpoint is responding normally.'
      : status === 'degraded'
        ? 'Most endpoints are healthy, but at least one is responding slowly or with errors.'
        : 'At least one critical component is unreachable. Backend logs may have details.'

  return (
    <Alert
      className={cn(
        'border bg-card',
        status === 'ok' && 'border-primary/30',
        status === 'degraded' && 'border-amber-500/30',
        status === 'down' && 'border-destructive/30',
      )}
    >
      <Icon
        className={cn(
          status === 'ok' && 'text-primary',
          status === 'degraded' && 'text-amber-500',
          status === 'down' && 'text-destructive',
        )}
      />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>
          {loading && status === 'down'
            ? 'Checking system health…'
            : title}
        </span>
        <div className="hidden items-center gap-1.5 sm:flex">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-[10px] text-primary"
          >
            {okCount} ok
          </Badge>
          {degradedCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-300"
            >
              {degradedCount} degraded
            </Badge>
          )}
          {downCount > 0 && (
            <Badge
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
            >
              {downCount} down
            </Badge>
          )}
        </div>
      </AlertTitle>
      <AlertDescription className="text-xs">
        {loading && status === 'down' ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running dependency probes…
          </span>
        ) : (
          description
        )}
      </AlertDescription>
    </Alert>
  )
}
