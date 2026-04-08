'use client'
// app/page.tsx — フィードページ（バージョン一覧）

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { VersionCard } from '@/components/VersionCard'

const FILTERS = [
  { label: 'すべて', value: 'all' },
  { label: '作詞募集中', value: 'open_melody' },
  { label: '作曲募集中', value: 'open_lyrics' },
  { label: '完成版', value: 'completed' },
]

export default function FeedPage() {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('latest')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['versions', filter, sort],
    queryFn: () => api.getVersions({ type: filter, sort, page: '1' }),
  })

  return (
    <main className="max-w-2xl mx-auto px-4 pb-32">
      {/* ヘッダーバー */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="logo">🌱</span>
          <span className="text-lg font-bold text-forest tracking-tight">ウタタネ</span>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-paper">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2a6 6 0 0 1 6 6v3.5l1.7 2.6a.8.8 0 0 1-.7 1.2H4a.8.8 0 0 1-.7-1.2L5 11.5V8a6 6 0 0 1 6-6Z"
              stroke="#1B3A2D" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 16a2 2 0 1 0 4 0" stroke="#1B3A2D" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* ヒーローセクション */}
      <section className="py-8 mb-6">
        <h1 className="text-4xl font-bold text-forest leading-tight tracking-tight">
          一粒の歌が、
          <br />
          森になる。
        </h1>
        <p className="text-base text-moss mt-3">
          メロディと歌詞が出会い、音楽が生まれる共創プラットフォーム
        </p>
      </section>

      {/* フィルタータブ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-5 py-2 rounded-[20px] text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-forest text-cream'
                : 'bg-paper text-ink/50 hover:text-ink/70'
            }`}>
            {f.label}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="ml-auto flex-shrink-0 px-3 py-2 rounded-lg text-sm border border-sprout/20 outline-none bg-paper text-ink/60">
          <option value="latest">新着順</option>
          <option value="popular">人気順</option>
        </select>
      </div>

      {/* バージョン一覧 */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-paper rounded-xl h-64" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data?.versions.map((v) => (
            <VersionCard key={v.id} version={v} onPurchased={() => refetch()} />
          ))}
        </div>
      )}
    </main>
  )
}
