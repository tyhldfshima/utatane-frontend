import type { Metadata } from 'next'
import { Providers } from './providers'
import { NavBar } from '@/components/NavBar'
import { AudioPlayer } from '@/components/AudioPlayer'
import { NotificationBell } from '@/components/NotificationBell'
import './globals.css'

export const metadata: Metadata = {
  title: 'ウタタネ',
  description: '一粒の歌が、森になる。',
  themeColor: '#534AB7',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-white min-h-screen">
        <Providers>
          <Header />
          <div className="pt-14 pb-32">
            {children}
          </div>
          <AudioPlayer />
          <NavBar />
        </Providers>
      </body>
    </html>
  )
}

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="12" rx="4" ry="3.5" fill="#EEEDFE" opacity=".9"/>
            <path d="M8 8.5 Q8 4 8 2" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M8 6.5 Q5.5 5 4 6.5 Q5.5 8 8 6.5Z" fill="white" opacity=".85"/>
            <path d="M8 4.5 Q10.5 3 12 4.5 Q10.5 6 8 4.5Z" fill="white" opacity=".85"/>
          </svg>
        </div>
        <span className="font-semibold text-gray-900 tracking-tight">ウタタネ</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </header>
  )
}