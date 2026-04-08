'use client'
// components/NavBar.tsx — ボトムナビゲーション

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'フィード',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="13" y="2" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="2" y="13" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="13" y="13" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/upload',
    label: 'アップロード',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M11 7v8M8 10l3-3 3 3" stroke={active ? '#F7F2E8' : '#5DA67E'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: 'ウォレット',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="5" width="18" height="14" rx="2.5" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M2 9h18" stroke={active ? '#F7F2E8' : '#5DA67E'} strokeWidth="1.5"/>
        <circle cx="16" cy="14" r="1.5" fill={active ? '#F7F2E8' : '#5DA67E'}/>
      </svg>
    ),
  },
  {
    href: '/profile/me',
    label: 'マイページ',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="4" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M3 19c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function NavBar() {
  const pathname = usePathname()
  const { user } = useAuthStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-paper border-t border-sprout/20 z-40 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-xl mx-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const actualHref = href === '/profile/me' && user ? `/profile/${user.id}` : href
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href === '/profile/me' ? '/profile' : href)

          return (
            <Link key={href} href={actualHref}
              className="flex flex-col items-center gap-1 px-4 py-1 rounded-md min-w-0">
              {icon(isActive)}
              <span className={`text-xs font-medium ${isActive ? 'text-forest' : 'text-sprout'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
