// app/layout.tsx — ルートレイアウト
// ナビゲーション・グローバルプレイヤー・React Query・認証初期化を統合

import type { Metadata } from 'next'
import { Providers } from './providers'
import { NavBar } from '@/components/NavBar'
import { AudioPlayer } from '@/components/AudioPlayer'
import './globals.css'

export const metadata: Metadata = {
  title: 'ウタタネ — 一粒の歌が、森になる。',
  description: '歌タネを蒔こう。作る人も、歌う人も、聴く人も——全員が主役の音楽経済圏。',
  themeColor: '#534AB7',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-white min-h-screen">
        <Providers>
          {/* グローバルヘッダー */}
          <Header />

          {/* メインコンテンツ */}
          <div className="pt-14 pb-32">
            {children}
          </div>

          {/* グローバル音楽プレイヤー（BottomNavの上） */}
          <AudioPlayer />

          {/* ボトムナビゲーション */}
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
          {/* 種が芽吹くロゴマーク */}
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
        <WalletPreview />
      </div>
    </header>
  )
}

// 通知ベル（クライアントコンポーネント）
'use client'
function NotificationBell() {
  return (
    <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" stroke="#374151" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 16a2 2 0 0 0 4 0" stroke="#374151" strokeWidth="1.5"/>
      </svg>
      {/* 未読バッジ */}
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
    </button>
  )
}

// ウォレット残高プレビュー（ヘッダー右）
function WalletPreview() {
  // 実際はuseAuthStore + useQueryで取得
  return (
    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100">
      <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-amber-800" style={{fontSize:'9px'}}>T</span>
      <span id="header-balance">—</span>
    </button>
  )
}
