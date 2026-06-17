'use client'

import * as React from 'react'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { CartDock } from '@/components/cart/cart-dock'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main column — offset by sidebar width on md+ */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <TopBar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <footer className="mt-auto border-t border-border bg-card/50 px-4 py-4 md:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <p>
              © {new Date().getFullYear()} Verdant RAG — Notion-style green
              knowledge platform.
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Template phase · backend-ready
            </p>
          </div>
        </footer>
      </div>

      {/* Floating Memory Cart dock (available on all pages) */}
      <CartDock />
    </div>
  )
}
