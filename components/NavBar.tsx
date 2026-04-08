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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="2" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/upload',
    label: 'アップロード',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M12 8v8M9 11l3-3 3 3" stroke={active ? '#F7F2E8' : '#5DA67E'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: 'ウォレット',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="15" rx="2.5" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M2 10h20" stroke={active ? '#F7F2E8' : '#5DA67E'} strokeWidth="1.5"/>
        <circle cx="17" cy="15" r="1.5" fill={active ? '#F7F2E8' : '#5DA67E'}/>
      </svg>
    ),
  },
  {
    href: '/profile/me',
    label: 'マイページ',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="9" r="4" fill={active ? '#1B3A2D' : 'none'} stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#1B3A2D' : '#5DA67E'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function NavBar() {
  const pathname = usePathname()
  const { user } = useAuthStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-paper border-t-[0.5px] border-moss/10 z-40 safe-bottom">
      <div className="flex items-center justify-around px-2 max-w-xl mx-auto h-[60px]">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const actualHref = href === '/profile/me' && user ? `/profile/${user.id}` : href
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href === '/profile/me' ? '/profile' : href)

          return (
            <Link key={href} href={actualHref}
              className="flex flex-col items-center justify-center gap-0.5 px-4 min-w-0 h-full">
              {icon(isActive)}
              <span className={`text-[11px] font-medium ${isActive ? 'text-forest' : 'text-sprout/70'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
