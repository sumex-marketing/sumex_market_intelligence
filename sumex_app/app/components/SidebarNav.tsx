'use client'

import { useState, useEffect } from 'react'
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
  Loader2,
} from 'lucide-react'
import { UserRole } from '@/lib/types'

interface SidebarNavProps {
  userRole: UserRole
}

export default function SidebarNav({ userRole }: SidebarNavProps) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Clear pending state when navigation finishes
  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

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
    <>
      {/* Top Laser Progress Bar during page transitions */}
      {pendingHref && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #23F7DD, #8E33FF, #23F7DD)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 0.8s infinite linear',
            zIndex: 99999,
            boxShadow: '0 0 10px rgba(35, 247, 221, 0.7)',
          }}
        />
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon
          const isPending = pendingHref === item.href
          const isActive = pendingHref
            ? isPending
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => {
                if (pathname !== item.href) {
                  setPendingHref(item.href)
                }
              }}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              style={{
                transition: 'all 0.1s ease',
                position: 'relative',
              }}
            >
              {isPending ? (
                <Loader2
                  size={16}
                  className="sidebar-item-icon animate-spin"
                  style={{ color: '#23F7DD' }}
                />
              ) : (
                <Icon className="sidebar-item-icon" />
              )}
              <span>{item.label}</span>
              {isPending && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#23F7DD',
                    boxShadow: '0 0 6px #23F7DD',
                  }}
                />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
