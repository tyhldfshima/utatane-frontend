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
  composer:  'bg-[#534AB7]/10 text-[#534AB7]',
  lyricist:  'bg-[#1D9E75]/10 text-[#1D9E75]',
  musician:  'bg-[#D85A30]/10 text-[#D85A30]',
}

const ROLE_BAR_COLORS: Record<string, string> = {
  composer:  'bg-[#534AB7]',
  lyricist:  'bg-[#1D9E75]',
  musician:  'bg-[#D85A30]',
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
      const { url } = await api.stripeCheckout(version.id)
      window.location.href = url
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
    <article className="bg-cream border border-sprout/20 rounded-lg shadow-card overflow-hidden">
      {/* 波形エリア */}
      <div className="h-28 bg-paper flex items-center justify-center relative">
        <button
          onClick={handlePlay}
          className="w-11 h-11 rounded-md bg-cream border border-sprout/20 flex items-center justify-center hover:bg-paper"
        >
          {isCurrentlyPlaying ? (
            <span className="flex gap-0.5">
              <span className="w-1 h-4 bg-forest rounded-sm" />
              <span className="w-1 h-4 bg-forest rounded-sm" />
            </span>
          ) : (
            <span className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-forest ml-1" />
          )}
        </button>

        {/* 購入数 */}
        <span className="absolute top-3 right-3 text-xs bg-forest/80 text-cream px-2.5 py-1 rounded-sm font-medium">
          {version.stats?.purchase_count ?? 0} 人購入
        </span>
      </div>

      {/* カード本体 */}
      <div className="p-4">
        <h3 className="font-medium text-ink mb-2">{version.title}</h3>

        {/* 貢献者バッジ */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {version.contributors.map((c) => (
            <span key={c.user_id}
              className={`text-xs px-2.5 py-0.5 rounded-sm font-medium ${ROLE_COLORS[c.role] ?? 'bg-ink/5 text-ink/60'}`}
            >
              {ROLE_LABELS[c.role] ?? c.role}: {c.name}
            </span>
          ))}
        </div>

        {/* 収益シェアバー */}
        <div className="flex h-1.5 rounded-sm overflow-hidden mb-3 gap-px">
          {version.contributors.map((c) => (
            <div key={c.user_id}
              style={{ flex: c.share_pct }}
              className={ROLE_BAR_COLORS[c.role] ?? 'bg-ink/20'}
            />
          ))}
          <div style={{ flex: 0.25 }} className="bg-ink/10" />
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2">
          <button onClick={handlePurchase} disabled={loading}
            className="flex-1 py-2 rounded-md text-sm font-medium bg-amber text-cream hover:bg-amber/90 disabled:opacity-50">
            ¥{version.price.toLocaleString()} で購入
          </button>
          <button onClick={() => setTipOpen(!tipOpen)}
            className="flex-1 py-2 rounded-md text-sm font-medium bg-forest/10 text-forest hover:bg-forest/15">
            投げ銭
          </button>
        </div>

        {/* 投げ銭パネル */}
        {tipOpen && (
          <div className="mt-3 pt-3 border-t border-sprout/20">
            <div className="flex gap-2 mb-2">
              {[100, 300, 500, 1000].map((amt) => (
                <button key={amt} onClick={() => setTipAmount(amt)}
                  className={`flex-1 py-1.5 rounded-sm text-xs font-medium ${tipAmount === amt ? 'bg-forest text-cream' : 'bg-paper text-ink/60'}`}>
                  ¥{amt}
                </button>
              ))}
            </div>
            <input
              type="text" placeholder="一言メッセージ（任意）" value={tipMsg}
              onChange={(e) => setTipMsg(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-sprout/30 rounded-sm mb-2 outline-none focus:border-sprout bg-paper"
            />
            <button onClick={handleTip} disabled={loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-amber text-cream hover:bg-amber/90 disabled:opacity-50">
              ¥{tipAmount} を送る
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
