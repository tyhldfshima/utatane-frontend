'use client'
// app/profile/[id]/page.tsx — プロフィールページ
// 自分のプロフィール・他ユーザーのプロフィール両対応

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { api, Version } from '@/lib/api'

// ── 型 ────────────────────────────────────────────────────

interface ProfileUser {
  id: string; name: string; bio: string
  roles: string[]; avatar_url?: string
  stats: {
    works_count: number; versions_count: number
    followers_count: number; following_count: number
    total_typ_earned: number; total_typ_sent: number
  }
  is_following: boolean
}

interface Work {
  id: string; type: 'melody' | 'lyrics'; title: string
  created_at: string; versions_count: number; play_count: number
  total_typ: number          // この作品全バージョン合計TYP
  total_revenue: number      // この作品全バージョン合計購入収益（自分の取り分）
  reuse_mode: 'open' | 'exclusive'
}

// ── 定数 ────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  composer: '作曲家', lyricist: '作詞家',
  musician: 'ミュージシャン', viewer: 'リスナー',
}
const ROLE_COLORS: Record<string, string> = {
  composer: 'bg-purple-100 text-purple-800',
  lyricist: 'bg-teal-100 text-teal-800',
  musician: 'bg-orange-100 text-orange-800',
  viewer:   'bg-gray-100 text-gray-600',
}

// ── サブコンポーネント ─────────────────────────────────────

/** アバター */
function Avatar({ name, url, size = 'lg' }: { name: string; url?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-10 h-10 text-sm', md: 'w-14 h-14 text-base', lg: 'w-20 h-20 text-xl' }
  const initials = name.slice(0, 2)
  if (url) return <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover`} />
  return (
    <div className={`${sizes[size]} rounded-full bg-purple-100 flex items-center justify-center font-medium text-purple-800 flex-shrink-0`}>
      {initials}
    </div>
  )
}

/** 統計カード */
function StatGrid({ stats }: { stats: ProfileUser['stats'] }) {
  const items = [
    { label: '作品数',     value: stats.works_count },
    { label: 'バージョン', value: stats.versions_count },
    { label: 'フォロワー', value: stats.followers_count },
    { label: '獲得TYP',   value: stats.total_typ_earned, suffix: 'P' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {items.map(({ label, value, suffix }) => (
        <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-lg font-medium text-gray-900">
            {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
            {suffix && <span className="text-xs font-normal ml-0.5">{suffix}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

/** オーナー向け収益サマリーバナー */
function RevenueBanner({ works }: { works: Work[] }) {
  const totalTyp     = works.reduce((s, w) => s + w.total_typ, 0)
  const totalRevenue = works.reduce((s, w) => s + w.total_revenue, 0)
  const openCount    = works.filter(w => w.reuse_mode === 'open').length
  return (
    <div className="bg-gradient-to-r from-purple-50 to-teal-50 border border-purple-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-6">
      <div className="text-center">
        <p className="text-base font-medium text-amber-700">{totalTyp.toLocaleString()}</p>
        <p className="text-xs text-gray-400">総獲得TYP</p>
      </div>
      <div className="w-px h-8 bg-purple-100" />
      <div className="text-center">
        <p className="text-base font-medium text-teal-700">¥{totalRevenue.toLocaleString()}</p>
        <p className="text-xs text-gray-400">総購入収益</p>
      </div>
      <div className="w-px h-8 bg-purple-100" />
      <div className="text-center ml-auto">
        <p className="text-base font-medium text-purple-700">{openCount}</p>
        <p className="text-xs text-gray-400">コラボ募集中</p>
      </div>
    </div>
  )
}

/** 作品カード — /works/[id] への導線 */
function WorkCard({ work, isMine }: { work: Work; isMine: boolean }) {
  const isMelody  = work.type === 'melody'
  const typeLabel = isMelody ? '曲' : '詞'
  const iconBg    = isMelody ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'
  const tagColor  = isMelody ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'

  return (
    <Link href={`/works/${work.id}`}
      className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-purple-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">

        {/* アイコン */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {isMelody ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13 3v8a2 2 0 1 1-1-1.73V5.5L6 7v6a2 2 0 1 1-1-1.73V6.5l8-2.5V3z"
                fill="currentColor" opacity=".8"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5h12M3 8h10M3 11h8M3 14h6"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* 本文 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor}`}>{typeLabel}</span>
            <p className="text-sm font-medium text-gray-900 truncate">{work.title}</p>
          </div>

          {/* バージョン数・再生数 */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              {work.versions_count} バージョン
            </span>
            <span>{work.play_count.toLocaleString()} 再生</span>
          </div>

          {/* オーナー向け収益インライン */}
          {isMine && (
            <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-amber-500 font-medium">{work.total_typ.toLocaleString()}</span>
                <span className="text-gray-400">TYP</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-teal-600 font-medium">¥{work.total_revenue.toLocaleString()}</span>
                <span className="text-gray-400">収益</span>
              </div>
              {work.reuse_mode === 'open' && (
                <span className="ml-auto text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  コラボ受入中
                </span>
              )}
            </div>
          )}
        </div>

        {/* 矢印 */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-1 text-gray-300">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}

/** バージョンカード（演奏一覧用） */
function PerformanceCard({ version }: { version: Version }) {
  const { play } = usePlayerStore()
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <button onClick={() => play(version)}
          className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 hover:bg-orange-100">
          <span className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-orange-600 ml-0.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{version.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {version.play_count.toLocaleString()} 再生 · {version.stats.purchase_count} 購入
          </p>
        </div>
        <p className="text-xs font-medium text-green-600 flex-shrink-0">
          {version.stats.total_revenue_typ.toLocaleString()} TYP
        </p>
      </div>
      {/* 貢献者バー */}
      <div className="flex h-1 rounded-full overflow-hidden gap-px">
        {version.contributors.map((c) => (
          <div key={c.user_id} style={{ flex: c.share_pct }}
            className={c.role === 'composer' ? 'bg-purple-400' : c.role === 'lyricist' ? 'bg-teal-400' : 'bg-orange-400'} />
        ))}
        <div style={{ flex: 0.25 }} className="bg-gray-200" />
      </div>
    </div>
  )
}

/** 購入者限定コンテンツセクション */
function ExclusiveSection({ isPurchaser }: { isPurchaser: boolean }) {
  const posts = [
    { title: '制作秘話：このメロディが生まれた夜', date: '2026/04/05', type: 'story' },
    { title: '楽器別パート音源（ギター・ピアノ・ドラム）', date: '2026/04/02', type: 'audio' },
    { title: '歌詞の初稿と変遷過程', date: '2026/03/28', type: 'text' },
  ]

  if (!isPurchaser) return (
    <div className="bg-gray-50 rounded-2xl p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="5" y="9" width="10" height="9" rx="2" stroke="#9CA3AF" strokeWidth="1.5"/>
          <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">購入者限定コンテンツ</p>
      <p className="text-xs text-gray-400 mb-4">このクリエイターのバージョンを購入すると制作秘話が見られます</p>
      <button className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium">
        バージョン一覧を見る
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      {posts.map((p, i) => {
        const typeIcon: Record<string, string> = {
          story: '📖', audio: '🎵', text: '✏️'
        }
        return (
          <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-purple-100 transition-colors">
            <span className="text-lg flex-shrink-0">{typeIcon[p.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900 truncate">{p.title}</p>
              <p className="text-xs text-purple-500 mt-0.5">{p.date}</p>
            </div>
            <span className="text-xs text-purple-500 flex-shrink-0">→</span>
          </div>
        )
      })}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────

type TabType = 'works' | 'performances' | 'exclusive'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabType>('works')

  const isMine = me?.id === id

  // プロフィール取得
  const { data: profile, isLoading: profileLoading } = useQuery<ProfileUser>({
    queryKey: ['profile', id],
    queryFn: () => fetch(`/api/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }).then(r => r.json()),
  })

  // 作品一覧
  const { data: worksData } = useQuery<{ works: Work[] }>({
    queryKey: ['profile-works', id],
    queryFn: () => fetch(`/api/v1/users/${id}/works`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }).then(r => r.json()),
    enabled: tab === 'works',
  })

  // バージョン一覧（演奏）
  const { data: versionsData } = useQuery<{ versions: Version[] }>({
    queryKey: ['profile-versions', id],
    queryFn: () => fetch(`/api/v1/users/${id}/versions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }).then(r => r.json()),
    enabled: tab === 'performances',
  })

  // フォロー
  const followMut = useMutation({
    mutationFn: () => fetch(`/api/v1/users/${id}/follow`, {
      method: profile?.is_following ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', id] }),
  })

  if (profileLoading || !profile) return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="flex gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-5 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  const tabs: { id: TabType; label: string }[] = [
    { id: 'works',        label: '作品' },
    { id: 'performances', label: '演奏' },
    { id: 'exclusive',    label: '限定コンテンツ' },
  ]

  // 購入者かどうか（本来はAPIで確認）
  const isPurchaser = isMine || false

  return (
    <main className="max-w-xl mx-auto px-4 py-8 pb-24">

      {/* ヘッダー */}
      <div className="flex items-start gap-4 mb-5">
        <Avatar name={profile.name} url={profile.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-medium text-gray-900">{profile.name}</h1>
          </div>

          {/* ロールバッジ */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {profile.roles.filter(r => r !== 'viewer').map((r) => (
              <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABELS[r] ?? r}
              </span>
            ))}
          </div>

          {profile.bio && <p className="text-sm text-gray-500 leading-relaxed">{profile.bio}</p>}
        </div>
      </div>

      {/* フォロー / 編集ボタン */}
      {isMine ? (
        <button className="w-full py-2.5 mb-6 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
          プロフィールを編集
        </button>
      ) : (
        <button
          onClick={() => followMut.mutate()}
          disabled={followMut.isPending}
          className={`w-full py-2.5 mb-6 rounded-xl text-sm font-medium transition-colors
            ${profile.is_following
              ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
        >
          {profile.is_following ? 'フォロー中' : 'フォローする'}
        </button>
      )}

      {/* 統計 */}
      <StatGrid stats={profile.stats} />

      {/* タブ */}
      <div className="flex border-b border-gray-100 mb-5">
        {tabs.map(({ id: tabId, label }) => (
          <button key={tabId} onClick={() => setTab(tabId)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              tab === tabId ? 'text-purple-700' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {label}
            {tab === tabId && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {tab === 'works' && (
        <div>
          {isMine && worksData?.works && worksData.works.length > 0 && (
            <RevenueBanner works={worksData.works} />
          )}
          <div className="space-y-2">
            {worksData?.works.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">作品はまだありません</p>
            ) : (
              worksData?.works.map((w) => <WorkCard key={w.id} work={w} isMine={isMine} />)
            )}
          </div>
        </div>
      )}

      {tab === 'performances' && (
        <div className="space-y-3">
          {versionsData?.versions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">演奏はまだありません</p>
          ) : (
            versionsData?.versions.map((v) => <PerformanceCard key={v.id} version={v} />)
          )}
        </div>
      )}

      {tab === 'exclusive' && <ExclusiveSection isPurchaser={isPurchaser} />}

    </main>
  )
}
