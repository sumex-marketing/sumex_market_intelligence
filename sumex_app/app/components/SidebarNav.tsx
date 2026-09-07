'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LineChart,
  Zap,
  FileText,
  Edit3,
  Calendar,
  Settings,
} from 'lucide-react'
import { UserRole } from '@/lib/types'

interface SidebarNavProps {
  userRole: UserRole
}

export default function SidebarNav({ userRole }: SidebarNavProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Market Desk',
      href: '/market',
      icon: LineChart,
    },
    {
      label: 'Signal Feed',
      href: '/signals',
      icon: Zap,
    },
    {
      label: 'Research Cards',
      href: '/research',
      icon: FileText,
    },
    {
      label: 'Content Drafts',
      href: '/content',
      icon: Edit3,
    },
    {
      label: 'Macro Calendar',
      href: '/macro',
      icon: Calendar,
    },
  ]

  if (userRole === 'admin') {
    navItems.push({
      label: 'System Settings',
      href: '/settings',
      icon: Settings,
    })
  }

  return (
    <nav className="sidebar-nav">
      <div className="sidebar-section-label">Navigation</div>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="sidebar-item-icon" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
