'use client'
// app/versions/[id]/page.tsx — バージョン詳細ページ

import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePlayerStore } from '@/stores/playerStore'
import { useState } from 'react'
import { SingBottomSheet } from '@/components/SingBottomSheet'

const ROLE_JP: Record<string, string> = { composer: '作曲', lyricist: '作詞', musician: '演奏' }
const ROLE_COLOR: Record<string, string> = {
  composer: '#7F77DD', lyricist: '#1D9E75', musician: '#D85A30',
}

export default function VersionPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') ?? undefined
  const { play } = usePlayerStore()
  const [tipOpen, setTipOpen] = useState(false)
  const [tipAmount, setTipAmount] = useState(500)
  const [tipMsg, setTipMsg] = useState('')
  const [singOpen, setSingOpen] = useState(false)

  const { data: version, isLoading } = useQuery({
    queryKey: ['version', id],
    queryFn: () => api.getVersion(id, ref),
  })

  if (isLoading) return <div className="p-8 text-gray-400">読み込み中…</div>
  if (!version) return <div className="p-8 text-gray-400">見つかりません</div>

  const totalPct = version.contributors.reduce((s, c) => s + c.share_pct, 0)

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      {/* タイトル */}
      <h1 className="text-xl font-medium text-gray-900 mb-1">{version.title}</h1>
      <p className="text-sm text-gray-400 mb-6">
        {version.play_count.toLocaleString()} 再生 · {version.stats.purchase_count} 購入 · {version.stats.tip_count} 投げ銭
      </p>

      {/* プレイヤーエリア */}
      <div className="bg-gradient-to-r from-purple-50 to-teal-50 rounded-2xl h-40 flex items-center justify-center mb-6">
        <button onClick={() => play(version)}
          className="w-14 h-14 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50">
          <span className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-purple-600 ml-1.5" />
        </button>
      </div>

      {/* 貢献者と収益シェア */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">このバージョンの参加者</h2>
        {version.contributors.map((c) => (
          <div key={c.user_id} className="flex items-center gap-3 mb-3 last:mb-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
              style={{ background: ROLE_COLOR[c.role] }}>
              {c.name[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400">{ROLE_JP[c.role] ?? c.role}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: ROLE_COLOR[c.role] }}>
                {Math.round(c.share_pct * 100)}%
              </p>
              <p className="text-xs text-gray-400">
                {Math.round(version.stats.total_revenue_typ * c.share_pct).toLocaleString()} TYP
              </p>
            </div>
          </div>
        ))}

        {/* 収益バー */}
        <div className="flex h-2 rounded-full overflow-hidden gap-px mt-4">
          {version.contributors.map((c) => (
            <div key={c.user_id}
              style={{ flex: c.share_pct, background: ROLE_COLOR[c.role] }}
              className="rounded-none first:rounded-l-full last:rounded-r-full" />
          ))}
          <div style={{ flex: 1 - totalPct }} className="bg-gray-200 rounded-r-full" />
        </div>
      </section>

      {/* アクション */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={async () => {
          const { url } = await api.stripeCheckout(id)
          window.location.href = url
        }} className="py-3 rounded-2xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700">
          ¥{version.price.toLocaleString()} で購入
        </button>
        <button onClick={() => setTipOpen(!tipOpen)}
          className="py-3 rounded-2xl text-sm font-medium bg-teal-50 text-teal-800 hover:bg-teal-100">
          投げ銭する
        </button>
      </div>

      {/* 歌ってみるボタン */}
      <button onClick={() => setSingOpen(true)}
        className="w-full py-3.5 rounded-2xl text-sm font-medium bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 flex items-center justify-center gap-2 mb-4">
        <span className="text-base">🎤</span>
        この曲で歌ってみる
      </button>

      {tipOpen && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
          <div className="flex gap-2 mb-3">
            {[100, 300, 500, 1000, 3000].map((a) => (
              <button key={a} onClick={() => setTipAmount(a)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium ${tipAmount === a ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                ¥{a}
              </button>
            ))}
          </div>
          <textarea placeholder="感謝のメッセージ（任意）" value={tipMsg}
            onChange={(e) => setTipMsg(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl mb-2 outline-none focus:border-teal-400 resize-none" />
          <button onClick={async () => {
            await api.tip(id, tipAmount, tipMsg)
            setTipOpen(false); setTipMsg('')
            alert(`¥${tipAmount} を送りました！`)
          }} className="w-full py-2.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700">
            ¥{tipAmount} を投げ銭する
          </button>
        </div>
      )}

      {/* YouTube動画リンク (Phase1) */}
      {version.video_external_url && (
        <a href={version.video_external_url} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <span className="w-5 h-5 bg-red-500 rounded text-white flex items-center justify-center text-xs">▶</span>
          YouTube で動画を見る
        </a>
      )}

      {/* 歌ってみるシート */}
      {singOpen && (
        <SingBottomSheet
          versionId={id}
          versionTitle={version.title}
          audioUrl={version.audio_url ?? ''}
          lyrics={version.lyrics_text ?? undefined}
          onClose={() => setSingOpen(false)}
        />
      )}
    </main>
  )
}
