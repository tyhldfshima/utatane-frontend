'use client'
// app/notifications/page.tsx — 通知ページ

import { useState } from 'react'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

// ── 型 ────────────────────────────────────────────────────

type NotifType =
  | 'typ_received'       // TYP受取
  | 'typ_monthly'        // 月次TYP付与
  | 'purchase'           // 自分の曲が購入された
  | 'new_performance'    // 自分の曲に演奏が追加
  | 'collab_request'     // コラボ申請
  | 'collab_approved'    // コラボ申請が承認された
  | 'new_follower'       // 新しいフォロワー
  | 'version_created'    // フォロー中クリエイターの新着
  | 'nft_royalty'        // NFT転売ロイヤリティ

interface Notification {
  id: string
  type: NotifType
  read: boolean
  created_at: string
  // 型ごとのペイロード
  from_user?:   { id: string; name: string }
  typ_amount?:  number
  version?:     { id: string; title: string }
  work?:        { id: string; title: string; type: 'melody' | 'lyrics' }
  collab_id?:   string
  collab_status?: 'pending' | 'approved' | 'rejected'
  nft_price?:   number
}

// ── 通知設定 ──────────────────────────────────────────────

const NOTIF_META: Record<NotifType, {
  icon: (n: Notification) => React.ReactNode
  color: string
  bg: string
  title: (n: Notification) => string
  body: (n: Notification) => string
  href?: (n: Notification) => string
}> = {
  typ_received: {
    color: '#854F0B', bg: '#FAEEDA',
    icon: () => <span className="text-base">💝</span>,
    title: (n) => `${n.from_user?.name ?? '誰か'}さんから TYP が届きました`,
    body:  (n) => `${n.typ_amount?.toLocaleString() ?? 0} TYP を受け取りました`,
    href:  () => '/wallet',
  },
  typ_monthly: {
    color: '#633806', bg: '#FAEEDA',
    icon: () => <span className="text-base">🎁</span>,
    title: () => '今月の TYP が付与されました',
    body:  (n) => `サブスク特典として ${n.typ_amount?.toLocaleString() ?? 0} TYP が送付専用残高に追加されました`,
    href:  () => '/wallet',
  },
  purchase: {
    color: '#085041', bg: '#E1F5EE',
    icon: () => <span className="text-base">🛒</span>,
    title: (n) => `${n.from_user?.name ?? '誰か'}さんが購入しました`,
    body:  (n) => `「${n.version?.title ?? ''}」— 収益が分配されます`,
    href:  (n) => `/versions/${n.version?.id ?? ''}`,
  },
  new_performance: {
    color: '#712B13', bg: '#FAECE7',
    icon: () => <span className="text-base">🎤</span>,
    title: (n) => `あなたの${n.work?.type === 'melody' ? '曲' : '詞'}に演奏が追加されました`,
    body:  (n) => `「${n.work?.title ?? ''}」— ${n.from_user?.name ?? '誰か'}さんが歌いました`,
    href:  (n) => `/versions/${n.version?.id ?? ''}`,
  },
  collab_request: {
    color: '#3C3489', bg: '#EEEDFE',
    icon: () => <span className="text-base">🤝</span>,
    title: (n) => `${n.from_user?.name ?? '誰か'}さんからコラボ申請`,
    body:  (n) => `「${n.work?.title ?? ''}」に${n.work?.type === 'melody' ? '詞' : '曲'}をつけたいとのことです`,
  },
  collab_approved: {
    color: '#085041', bg: '#E1F5EE',
    icon: () => <span className="text-base">✅</span>,
    title: (n) => `コラボ申請が承認されました`,
    body:  (n) => `「${n.work?.title ?? ''}」への参加が認められました`,
    href:  (n) => `/works/${n.work?.id ?? ''}`,
  },
  new_follower: {
    color: '#534AB7', bg: '#EEEDFE',
    icon: () => <span className="text-base">👤</span>,
    title: (n) => `${n.from_user?.name ?? '誰か'}さんがフォローしました`,
    body:  () => 'あなたの新着作品が届くようになりました',
    href:  (n) => `/profile/${n.from_user?.id ?? ''}`,
  },
  version_created: {
    color: '#3C3489', bg: '#EEEDFE',
    icon: () => <span className="text-base">🎵</span>,
    title: (n) => `${n.from_user?.name ?? ''}さんが新作をアップしました`,
    body:  (n) => `「${n.version?.title ?? ''}」`,
    href:  (n) => `/versions/${n.version?.id ?? ''}`,
  },
  nft_royalty: {
    color: '#712B13', bg: '#FBEAF0',
    icon: () => <span className="text-base">💎</span>,
    title: () => 'NFT転売ロイヤリティが入りました',
    body:  (n) => `「${n.version?.title ?? ''}」の NFT が ¥${n.nft_price?.toLocaleString() ?? 0} で転売されました`,
    href:  () => '/wallet',
  },
}

// ── フィルター定義 ────────────────────────────────────────

const FILTERS: { id: string; label: string; types?: NotifType[] }[] = [
  { id: 'all',      label: 'すべて' },
  { id: 'typ',      label: 'TYP',    types: ['typ_received','typ_monthly','nft_royalty'] },
  { id: 'music',    label: '音楽',   types: ['purchase','new_performance','version_created'] },
  { id: 'collab',   label: 'コラボ', types: ['collab_request','collab_approved'] },
  { id: 'social',   label: 'フォロー', types: ['new_follower'] },
]

// ── 相対時刻 ─────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)         return 'たった今'
  if (diff < 3600)       return `${Math.floor(diff / 60)}分前`
  if (diff < 86400)      return `${Math.floor(diff / 3600)}時間前`
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP')
}

// ── 通知カード ────────────────────────────────────────────

function NotifCard({ notif, onRead, onCollab }: {
  notif: Notification
  onRead: (id: string) => void
  onCollab: (collabId: string, action: 'approve' | 'reject') => void
}) {
  const meta = NOTIF_META[notif.type]
  const isCollab = notif.type === 'collab_request'

  const inner = (
    <div
      onClick={() => !notif.read && onRead(notif.id)}
      className={`flex gap-3 p-4 rounded-2xl transition-colors cursor-pointer ${
        notif.read ? 'bg-gray-50' : 'bg-white border border-gray-100 shadow-sm'
      }`}
    >
      {/* 未読インジケーター */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg }}>
          {meta.icon(notif)}
        </div>
        {!notif.read && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* 本文 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug mb-0.5">
          {meta.title(notif)}
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-1">
          {meta.body(notif)}
        </p>
        <p className="text-xs text-gray-400">{relativeTime(notif.created_at)}</p>

        {/* コラボ申請の承認/拒否ボタン */}
        {isCollab && notif.collab_status === 'pending' && notif.collab_id && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => { e.preventDefault(); onCollab(notif.collab_id!, 'approve') }}
              className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-xs font-medium hover:bg-teal-700"
            >
              承認する
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onCollab(notif.collab_id!, 'reject') }}
              className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
            >
              断る
            </button>
          </div>
        )}
        {isCollab && notif.collab_status === 'approved' && (
          <span className="inline-block mt-2 text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full">承認済み</span>
        )}
        {isCollab && notif.collab_status === 'rejected' && (
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">お断り済み</span>
        )}
      </div>
    </div>
  )

  // href がある場合はリンクでラップ（コラボ申請は除く）
  const href = !isCollab && meta.href?.(notif)
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

// ── メインページ ──────────────────────────────────────────

// モックデータ（API接続前の確認用）
const MOCK: Notification[] = [
  { id:'1', type:'typ_received',    read:false, created_at: new Date(Date.now()-120000).toISOString(),    from_user:{id:'u1',name:'田中 蓮'},   typ_amount:300, version:{id:'v1',title:'春の終わりに — ver.2'} },
  { id:'2', type:'purchase',        read:false, created_at: new Date(Date.now()-3600000).toISOString(),   from_user:{id:'u2',name:'佐藤 葵'},   version:{id:'v1',title:'春の終わりに — ver.2'} },
  { id:'3', type:'collab_request',  read:false, created_at: new Date(Date.now()-7200000).toISOString(),   from_user:{id:'u3',name:'鈴木 海'},   work:{id:'w1',title:'夜の散歩道',type:'melody'}, collab_id:'c1', collab_status:'pending' },
  { id:'4', type:'new_performance', read:false, created_at: new Date(Date.now()-18000000).toISOString(),  from_user:{id:'u4',name:'山田 花'},   work:{id:'w1',title:'春のバラード',type:'melody'}, version:{id:'v2',title:'春のバラード — Hana ver.'} },
  { id:'5', type:'new_follower',    read:true,  created_at: new Date(Date.now()-86400000).toISOString(),  from_user:{id:'u5',name:'高橋 悠'} },
  { id:'6', type:'version_created', read:true,  created_at: new Date(Date.now()-86400000*2).toISOString(),from_user:{id:'u6',name:'中村 奏'},   version:{id:'v3',title:'星屑ラビリンス — Piano ver.'} },
  { id:'7', type:'nft_royalty',     read:true,  created_at: new Date(Date.now()-86400000*3).toISOString(),version:{id:'v1',title:'春の終わりに — ver.2'}, nft_price:8000 },
  { id:'8', type:'typ_monthly',     read:true,  created_at: new Date(Date.now()-86400000*5).toISOString(),typ_amount:300 },
  { id:'9', type:'collab_approved', read:true,  created_at: new Date(Date.now()-86400000*6).toISOString(),work:{id:'w2',title:'夜の散歩道',type:'lyrics'} },
]

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const [notifs, setNotifs] = useState<Notification[]>([])
  const queryClient = useQueryClient()

  const { isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await api.getNotifications({ limit: 50 })
      const mapped: Notification[] = (data.notifications as any[]).map(n => ({
        id: n.id, type: n.type, read: n.read, created_at: n.created_at,
        from_user: n.from_user,
        typ_amount: n.payload?.amount,
        version: n.payload?.version_id
          ? { id: n.payload.version_id, title: n.payload.version_title ?? '' }
          : undefined,
        work: n.payload?.work_id
          ? { id: n.payload.work_id, title: n.payload.work_title ?? '', type: 'melody' as const }
          : undefined,
      }))
      setNotifs(mapped)
      return mapped
    },
  })

  const unreadCount = notifs.filter(n => !n.read).length

  const filtered = notifs.filter(n => {
    const f = FILTERS.find(f => f.id === filter)
    if (!f?.types) return true
    return f.types.includes(n.type)
  })

  const handleRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await api.readNotification(id)
  }

  const handleReadAll = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    await api.readAllNotifications()
  }

  // コラボ承認は廃止（通知のみ）
  const handleCollab = (_collabId: string, _action: 'approve' | 'reject') => {}

  return (
    <main className="max-w-xl mx-auto px-4 py-6 pb-24">

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-medium text-gray-900">通知</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">未読 {unreadCount} 件</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleReadAll}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium">
            すべて既読にする
          </button>
        )}
      </div>

      {/* フィルター */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f.label}
            {f.id === 'all' && unreadCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 通知リスト */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-3">🔔</p>
          <p className="text-sm text-gray-400">通知はありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotifCard key={n.id} notif={n} onRead={handleRead} onCollab={handleCollab} />
          ))}
        </div>
      )}
    </main>
  )
}
