'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Database,
  FileText,
  Hash,
  Leaf,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { knowledgeApi } from '@/lib/api'
import { navItems } from '@/components/layout/nav-config'
import { useCartStore } from '@/lib/store/cart-store'
import type { KnowledgeStats } from '@/types/rag'

/* ------------------------------------------------------------------ */
/* Local config                                                        */
/* ------------------------------------------------------------------ */

interface StatMeta {
  key: keyof Pick<
    KnowledgeStats,
    'totalDocuments' | 'totalChunks' | 'totalTokens' | 'namespaces'
  >
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const statMeta: StatMeta[] = [
  { key: 'totalDocuments', label: 'Total Documents', icon: FileText },
  { key: 'totalChunks', label: 'Total Chunks', icon: Boxes },
  { key: 'totalTokens', label: 'Total Tokens', icon: Hash },
  { key: 'namespaces', label: 'Namespaces', icon: Database },
]

const workflowItems = navItems.filter((n) => n.workflow)

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function tagSize(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0
  if (ratio >= 0.75) return 'text-sm px-3.5 py-1.5'
  if (ratio >= 0.45) return 'text-xs px-3 py-1'
  return 'text-[11px] px-2.5 py-0.5'
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [stats, setStats] = React.useState<KnowledgeStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const cartCount = useCartStore((s) => s.items.length)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    knowledgeApi
      .getStats()
      .then((data) => {
        if (active) {
          setStats(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load stats')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const topTags = stats?.topTags ?? []
  const maxTagCount = topTags.length
    ? Math.max(...topTags.map((t) => t.count))
    : 1

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* ----------------------------------------------------------- */}
      {/* Hero                                                        */}
      {/* ----------------------------------------------------------- */}
      <section
        className="relative overflow-hidden rounded-2xl gradient-green p-6 text-primary-foreground shadow-md sm:p-8 md:p-10"
        aria-labelledby="hero-title"
      >
        {/* Decorative leaf glyphs */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-black/5 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Notion-style RAG workspace
            </div>
            <h1
              id="hero-title"
              className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            >
              Verdant RAG
            </h1>
            <p className="text-sm leading-relaxed text-primary-foreground/85 sm:text-base">
              Ingest knowledge, retrieve with hybrid search, stage reusable
              memory context, and run structured RAG chats — all in one
              calm, green workspace.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                asChild
                size="lg"
                className="bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground/90"
              >
                <Link href="/ingest">
                  <Leaf className="h-4 w-4" />
                  Start Ingesting
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              >
                <Link href="/search">
                  <ArrowRight className="h-4 w-4" />
                  Explore Search
                </Link>
              </Button>
            </div>
          </div>

          {/* Floating mini-status card */}
          <div className="hidden shrink-0 rounded-xl bg-white/10 p-4 backdrop-blur-md md:block">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary-foreground/70">
              Cart memory
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {cartCount}
            </p>
            <p className="text-xs text-primary-foreground/80">
              {cartCount === 1 ? 'item staged' : 'items staged'}
            </p>
            <Separator className="my-3 bg-primary-foreground/20" />
            <Link
              href="/cart"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-foreground/90 hover:text-primary-foreground"
            >
              View cart <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* Stats overview                                              */}
      {/* ----------------------------------------------------------- */}
      <section aria-labelledby="stats-title">
        <div className="mb-4 flex items-center gap-2">
          <h2
            id="stats-title"
            className="text-lg font-semibold tracking-tight"
          >
            Platform Overview
          </h2>
          {error && (
            <Badge
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive"
            >
              stats unavailable
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statMeta.map((meta, idx) => {
            const Icon = meta.icon
            const value = stats ? stats[meta.key] : null
            return (
              <Card
                key={meta.key}
                className="animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {meta.label}
                  </CardTitle>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-green text-primary-foreground shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : value === null ? (
                    <span className="text-2xl font-bold text-muted-foreground">
                      —
                    </span>
                  ) : (
                    <span className="text-2xl font-bold tabular-nums sm:text-3xl">
                      {value.toLocaleString()}
                    </span>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {meta.key === 'namespaces'
                      ? 'vector collections'
                      : meta.key === 'totalTokens'
                        ? 'estimated tokens indexed'
                        : 'across all namespaces'}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* RAG Workflows                                               */}
      {/* ----------------------------------------------------------- */}
      <section aria-labelledby="workflows-title">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2
            id="workflows-title"
            className="text-lg font-semibold tracking-tight"
          >
            RAG Workflows
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflowItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <Card
                  className={cn(
                    'relative h-full gap-0 overflow-hidden py-5 transition-all duration-200',
                    'hover:-translate-y-1 hover:border-primary/40 hover:shadow-md',
                  )}
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-1 gradient-green opacity-70 transition-opacity group-hover:opacity-100" />
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-colors group-hover:gradient-green group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                        {item.workflow}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold tracking-tight">
                        {item.label}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open workflow
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* Bottom row: Top tags + Quick links                          */}
      {/* ----------------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top tags */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-primary" />
              Top Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" />
                ))}
              </div>
            ) : topTags.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No tags collected yet. Ingest documents to populate tags.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {topTags.map((t) => (
                  <Badge
                    key={t.tag}
                    variant="secondary"
                    className={cn(
                      'gap-1.5 rounded-full font-medium transition-colors hover:bg-primary/15 hover:text-primary',
                      tagSize(t.count, maxTagCount),
                    )}
                    title={`${t.count} documents`}
                  >
                    <span className="text-primary">#</span>
                    {t.tag}
                    <span className="rounded-full bg-background/60 px-1.5 text-[10px] tabular-nums text-muted-foreground">
                      {t.count}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-4 w-4 text-primary" />
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors group-hover:gradient-green group-hover:text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {item.label}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
