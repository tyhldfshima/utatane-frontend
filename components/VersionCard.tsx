'use client'
// components/VersionCard.tsx — バージョンカード（フィード・一覧用）

import { useState } from 'react'
import { Version, api } from '@/lib/api'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  version: Version
  onPurchased?: () => void
}

const ROLE_COLORS: Record<string, string> = {
  composer:  'bg-purple-50 text-purple-800',
  lyricist:  'bg-teal-50 text-teal-800',
  musician:  'bg-orange-50 text-orange-800',
}

const ROLE_LABELS: Record<string, string> = {
  composer: '作曲', lyricist: '作詞', musician: '演奏',
}

export function VersionCard({ version, onPurchased }: Props) {
  const { play, currentVersion, isPlaying } = usePlayerStore()
  const { user } = useAuthStore()
  const [tipOpen, setTipOpen] = useState(false)
  const [tipAmount, setTipAmount] = useState(300)
  const [tipMsg, setTipMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const isCurrentlyPlaying = currentVersion?.id === version.id && isPlaying

  const handlePlay = () => play(version)

  const handlePurchase = async () => {
    if (!user) { alert('ログインが必要です'); return }
    setLoading(true)
    try {
      const ref = new URLSearchParams(window.location.search).get('ref') ?? undefined
      const result = await api.purchase(version.id, 'stripe', ref)
      alert('購入完了！')
      onPurchased?.()
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message)
    } finally { setLoading(false) }
  }

  const handleTip = async () => {
    if (!user) { alert('ログインが必要です'); return }
    setLoading(true)
    try {
      await api.tip(version.id, tipAmount, tipMsg)
      alert(`¥${tipAmount} の投げ銭を送りました！`)
      setTipOpen(false); setTipMsg('')
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message)
    } finally { setLoading(false) }
  }

  return (
    <article className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* 波形エリア */}
      <div className="h-28 bg-gradient-to-r from-purple-50 to-teal-50 flex items-center justify-center relative">
        <button
          onClick={handlePlay}
          className="w-11 h-11 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50"
        >
          {isCurrentlyPlaying ? (
            <span className="flex gap-0.5">
              <span className="w-1 h-4 bg-purple-600 rounded-sm" />
              <span className="w-1 h-4 bg-purple-600 rounded-sm" />
            </span>
          ) : (
            <span className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-purple-600 ml-1" />
          )}
        </button>

        {/* バージョン番号 */}
        <span className="absolute top-3 right-3 text-xs bg-white/80 text-purple-700 px-2.5 py-1 rounded-full font-medium">
          {version.stats.purchase_count} 人購入
        </span>
      </div>

      {/* カード本体 */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-2">{version.title}</h3>

        {/* 貢献者バッジ */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {version.contributors.map((c) => (
            <span key={c.user_id}
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.role] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {ROLE_LABELS[c.role] ?? c.role}: {c.name}
            </span>
          ))}
        </div>

        {/* 収益シェアバー */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-px">
          {version.contributors.map((c) => (
            <div key={c.user_id}
              style={{ flex: c.share_pct }}
              className={c.role === 'composer' ? 'bg-purple-400' : c.role === 'lyricist' ? 'bg-teal-400' : 'bg-orange-400'}
            />
          ))}
          <div style={{ flex: 0.25 }} className="bg-gray-300" />
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2">
          <button onClick={handlePurchase} disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50">
            ¥{version.price.toLocaleString()} で購入
          </button>
          <button onClick={() => setTipOpen(!tipOpen)}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-800 hover:bg-teal-100">
            投げ銭
          </button>
        </div>

        {/* 投げ銭パネル */}
        {tipOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex gap-2 mb-2">
              {[100, 300, 500, 1000].map((amt) => (
                <button key={amt} onClick={() => setTipAmount(amt)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${tipAmount === amt ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  ¥{amt}
                </button>
              ))}
            </div>
            <input
              type="text" placeholder="一言メッセージ（任意）" value={tipMsg}
              onChange={(e) => setTipMsg(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 outline-none focus:border-teal-400"
            />
            <button onClick={handleTip} disabled={loading}
              className="w-full py-2 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
              ¥{tipAmount} を送る
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
