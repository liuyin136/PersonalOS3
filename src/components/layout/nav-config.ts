import {
  LayoutDashboard,
  Upload,
  Search,
  ShoppingCart,
  MessageSquare,
  Library,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  description: string
  workflow?: number
}

export const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Overview & platform health',
  },
  {
    href: '/ingest',
    label: 'Ingest',
    icon: Upload,
    description: 'Knowledge import & vector sync',
    workflow: 1,
  },
  {
    href: '/search',
    label: 'Search',
    icon: Search,
    description: 'Hybrid retrieval & editing',
    workflow: 2,
  },
  {
    href: '/cart',
    label: 'Memory Cart',
    icon: ShoppingCart,
    description: 'Context staging & token control',
    workflow: 3,
  },
  {
    href: '/chat',
    label: 'Structured Chat',
    icon: MessageSquare,
    description: 'Templated RAG chat',
    workflow: 4,
  },
  {
    href: '/knowledge',
    label: 'Knowledge',
    icon: Library,
    description: 'Namespaces & documents',
  },
]
