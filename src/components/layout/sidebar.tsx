'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Leaf, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems } from './nav-config'
import { useCartStore } from '@/lib/store/cart-store'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.items.length)

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <Link href="/" className="flex items-center gap-2.5" onClick={onCloseMobile}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-green text-primary-foreground shadow-sm">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight">Verdant RAG</span>
              <span className="text-[11px] text-muted-foreground">Knowledge Platform</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workflows
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[1.15rem] w-[1.15rem] shrink-0',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.workflow && (
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold',
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {item.workflow}
                      </span>
                    )}
                    {item.href === '/cart' && cartCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer status */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-medium">Backend: placeholder</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              FastAPI + LangChain endpoints are stubbed. Wire <code className="rounded bg-muted px-1 py-0.5 text-[10px]">NEXT_PUBLIC_API_BASE_URL</code> to enable.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
