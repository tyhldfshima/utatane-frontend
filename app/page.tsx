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
    <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-forest">ウタタネ</h1>
        <p className="text-sm text-moss mt-1">一粒の歌が、森になる。</p>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-forest text-cream'
                : 'bg-paper text-ink/60 hover:bg-paper/80'
            }`}>
            {f.label}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-md text-sm border border-sprout/30 outline-none bg-paper text-ink/70">
          <option value="latest">新着順</option>
          <option value="popular">人気順</option>
        </select>
      </div>

      {/* バージョン一覧 */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-paper rounded-lg h-56" />
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
