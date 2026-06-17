'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Sparkles, Github, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { navItems } from './nav-config'
import { useCartStore } from '@/lib/store/cart-store'
import { Badge } from '@/components/ui/badge'

interface TopBarProps {
  onOpenMobile: () => void
}

export function TopBar({ onOpenMobile }: TopBarProps) {
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.items.length)

  const current = navItems.find((i) =>
    i.href === '/' ? pathname === '/' : pathname.startsWith(i.href),
  )

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobile}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {current?.label ?? 'Verdant RAG'}
            </h1>
            {current?.workflow && (
              <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
                Workflow {current.workflow}
              </Badge>
            )}
          </div>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {current?.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="hidden lg:flex"
          aria-label="Notifications"
        >
          <Bell className="h-[1.1rem] w-[1.1rem]" />
        </Button>

        {cartCount > 0 && (
          <Badge
            variant="secondary"
            className="hidden bg-primary/10 text-primary sm:inline-flex"
          >
            <Sparkles className="h-3 w-3" />
            {cartCount} in cart
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="GitHub"
          className="hidden sm:inline-flex"
        >
          <a href="#" target="_blank" rel="noreferrer">
            <Github className="h-[1.1rem] w-[1.1rem]" />
          </a>
        </Button>

        <ThemeToggle />
      </div>
    </header>
  )
}
