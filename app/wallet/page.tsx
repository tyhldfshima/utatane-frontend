'use client'
// app/wallet/page.tsx — TYPウォレット専用ページ

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WalletHistory } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'

// ── 定数 ────────────────────────────────────────────────
const CHARITIES = [
  { id: 'c1', name: '子ども食堂ネットワーク', category: '食・子ども' },
  { id: 'c2', name: '動物愛護センター支援', category: '動物' },
  { id: 'c3', name: '音楽教育支援基金',      category: '教育・音楽' },
  { id: 'c4', name: '環境保全アクション',    category: '環境' },
]

const TIP_AMOUNTS = [100, 300, 500, 1000, 3000]

// ── サブコンポーネント ────────────────────────────────────

/** 残高カード */
function BalanceCard({ convertible, sendable, pending }: {
  convertible: number; sendable: number; pending: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-2">
      <div className="bg-amber-50 rounded-2xl p-5">
        <p className="text-xs font-medium text-amber-700 mb-2">換金可能残高</p>
        <p className="text-3xl font-medium text-amber-900">
          {convertible.toLocaleString()}
          <span className="text-base font-normal text-amber-700 ml-1">TYP</span>
        </p>
        <p className="text-xs text-amber-600 mt-1.5">
          ≈ ¥{Math.floor(convertible * 0.95).toLocaleString()}（換金手数料5%）
        </p>
      </div>
      <div className="bg-purple-50 rounded-2xl p-5">
        <p className="text-xs font-medium text-purple-700 mb-2">送付専用残高</p>
        <p className="text-3xl font-medium text-purple-900">
          {sendable.toLocaleString()}
          <span className="text-base font-normal text-purple-700 ml-1">TYP</span>
        </p>
        <p className="text-xs text-purple-600 mt-1.5">他者への感謝にのみ使えます</p>
      </div>
      {pending > 0 && (
        <div className="col-span-2 bg-gray-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-gray-500">処理中（まもなく反映）</span>
          <span className="text-xs font-medium text-gray-700">+{pending.toLocaleString()} TYP</span>
        </div>
      )}
    </div>
  )
}

/** アクションボタン行 */
function ActionBar({ active, onSelect }: {
  active: string | null; onSelect: (a: string | null) => void
}) {
  const actions = [
    { id: 'send',   label: 'TYPを贈る',  color: 'purple' },
    { id: 'redeem', label: '換金する',    color: 'amber'  },
    { id: 'donate', label: '寄付する',    color: 'teal'   },
  ]
  const styles: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-800',
    amber:  'bg-amber-100 text-amber-800',
    teal:   'bg-teal-100 text-teal-800',
  }
  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {actions.map(({ id, label, color }) => (
        <button key={id} onClick={() => onSelect(active === id ? null : id)}
          className={`py-3 rounded-xl text-sm font-medium transition-colors
            ${active === id ? styles[color] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** 送付パネル */
function SendPanel({ sendableBalance, onDone }: { sendableBalance: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [toUserId, setToUserId] = useState('')
  const [amount, setAmount]   = useState(300)
  const [message, setMessage] = useState('')
  const [from, setFrom]       = useState<'sendable' | 'convertible'>('sendable')

  const mut = useMutation({
    mutationFn: () => api.sendTYP(toUserId, amount, message, from),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-history'] })
      onDone()
    },
  })

  return (
    <div className="bg-purple-50 rounded-2xl p-5 mb-5 space-y-4">
      <h2 className="text-sm font-medium text-purple-900">TYPを贈る</h2>

      <div>
        <label className="text-xs text-purple-700 mb-1.5 block">どちらの残高から？</label>
        <div className="grid grid-cols-2 gap-2">
          {(['sendable', 'convertible'] as const).map((t) => (
            <button key={t} onClick={() => setFrom(t)}
              className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                from === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200'
              }`}>
              {t === 'sendable' ? `送付専用 (${sendableBalance.toLocaleString()} P)` : '換金可能残高から'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-purple-700 mb-1.5 block">相手のユーザーID</label>
        <input value={toUserId} onChange={(e) => setToUserId(e.target.value)}
          placeholder="ユーザーID を入力"
          className="w-full px-3 py-2.5 rounded-xl border border-purple-200 text-sm outline-none focus:border-purple-400 bg-white" />
      </div>

      <div>
        <label className="text-xs text-purple-700 mb-1.5 block">送付額</label>
        <div className="flex gap-2 mb-2">
          {TIP_AMOUNTS.map((a) => (
            <button key={a} onClick={() => setAmount(a)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                amount === a ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
              }`}>
              {a}P
            </button>
          ))}
        </div>
        <input type="number" value={amount} min={1} onChange={(e) => setAmount(+e.target.value)}
          placeholder="自由入力"
          className="w-full px-3 py-2.5 rounded-xl border border-purple-200 text-sm outline-none focus:border-purple-400 bg-white" />
      </div>

      <div>
        <label className="text-xs text-purple-700 mb-1.5 block">メッセージ（任意）</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="いつも助かっています、ありがとう！" rows={2} maxLength={200}
          className="w-full px-3 py-2.5 rounded-xl border border-purple-200 text-sm resize-none outline-none focus:border-purple-400 bg-white" />
      </div>

      <button onClick={() => mut.mutate()} disabled={mut.isPending || !toUserId || amount <= 0}
        className="w-full py-3 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
        {mut.isPending ? '送付中…' : `${amount.toLocaleString()} TYP を贈る`}
      </button>
    </div>
  )
}

/** 換金パネル */
function RedeemPanel({ convertible, onDone }: { convertible: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState(1000)

  const mut = useMutation({
    mutationFn: () => api.redeemTYP(amount, 'default-bank'),
    onSuccess: (data) => {
      alert(`¥${data.jpy_amount.toLocaleString()} を ${data.scheduled_transfer} に振り込みます`)
      qc.invalidateQueries({ queryKey: ['wallet'] })
      onDone()
    },
  })

  const jpy = Math.floor(amount * 0.95)

  return (
    <div className="bg-amber-50 rounded-2xl p-5 mb-5 space-y-4">
      <h2 className="text-sm font-medium text-amber-900">換金する</h2>
      <p className="text-xs text-amber-700">換金可能残高: {convertible.toLocaleString()} TYP</p>

      <div>
        <label className="text-xs text-amber-700 mb-1.5 block">換金額（最低 1,000 TYP）</label>
        <div className="flex gap-2 mb-2">
          {[1000, 3000, 5000, 10000].map((a) => (
            <button key={a} onClick={() => setAmount(a)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                amount === a ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}>
              {(a / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
        <input type="number" value={amount} min={1000} onChange={(e) => setAmount(+e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-sm outline-none focus:border-amber-400 bg-white" />
      </div>

      <div className="bg-white rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-xs text-amber-700">
          <span>{amount.toLocaleString()} TYP</span>
          <span>→ ¥{amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs text-amber-600">
          <span>手数料（5%）</span>
          <span>−¥{(amount - jpy).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm font-medium text-amber-900 pt-1 border-t border-amber-100">
          <span>振込額</span>
          <span>¥{jpy.toLocaleString()}</span>
        </div>
        <p className="text-xs text-amber-600">翌月15日払い</p>
      </div>

      <button onClick={() => mut.mutate()} disabled={mut.isPending || amount < 1000 || amount > convertible}
        className="w-full py-3 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
        {mut.isPending ? '処理中…' : '換金申請する'}
      </button>
    </div>
  )
}

/** 寄付パネル */
function DonatePanel({ convertible, onDone }: { convertible: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [charityId, setCharityId] = useState(CHARITIES[0].id)
  const [amount, setAmount]       = useState(500)

  const mut = useMutation({
    mutationFn: () => api.donateTYP(amount, charityId),
    onSuccess: (data) => {
      const name = CHARITIES.find(c => c.id === charityId)?.name ?? ''
      alert(`「${name}」へ ¥${data.jpy_donated.toLocaleString()} が届きます。ありがとうございます！`)
      qc.invalidateQueries({ queryKey: ['wallet'] })
      onDone()
    },
  })

  return (
    <div className="bg-teal-50 rounded-2xl p-5 mb-5 space-y-4">
      <h2 className="text-sm font-medium text-teal-900">寄付する</h2>
      <p className="text-xs text-teal-700">換金可能残高から寄付します。PFが現金化して寄付先へ届けます。</p>

      <div>
        <label className="text-xs text-teal-700 mb-1.5 block">寄付先を選ぶ</label>
        <div className="space-y-2">
          {CHARITIES.map((c) => (
            <button key={c.id} onClick={() => setCharityId(c.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                charityId === c.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-800 border-teal-200 hover:bg-teal-50'
              }`}>
              <span className="text-sm font-medium">{c.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${charityId === c.id ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-700'}`}>
                {c.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-teal-700 mb-1.5 block">寄付額</label>
        <div className="flex gap-2 mb-2">
          {[100, 300, 500, 1000].map((a) => (
            <button key={a} onClick={() => setAmount(a)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                amount === a ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
              }`}>
              {a}P
            </button>
          ))}
        </div>
        <p className="text-xs text-teal-600 mt-1">
          {amount.toLocaleString()} TYP → ¥{Math.floor(amount * 0.95).toLocaleString()}（手数料5%）が寄付先へ届きます
        </p>
      </div>

      <button onClick={() => mut.mutate()} disabled={mut.isPending || amount > convertible}
        className="w-full py-3 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
        {mut.isPending ? '処理中…' : `${amount.toLocaleString()} TYP を寄付する`}
      </button>
    </div>
  )
}

/** 履歴リスト */
const ACTION_MAP: Record<string, { label: string; color: string; sign: string }> = {
  earned:           { label: '収益分配', color: 'text-green-600', sign: '+' },
  viewer_cashback:  { label: '視聴還元', color: 'text-green-500', sign: '+' },
  purchase_cashback:{ label: '購入還元', color: 'text-green-500', sign: '+' },
  received:         { label: '受け取り', color: 'text-purple-600', sign: '+' },
  sent:             { label: '送付',     color: 'text-gray-500',   sign: '−' },
  redeemed:         { label: '換金',     color: 'text-amber-600',  sign: '−' },
  donated:          { label: '寄付',     color: 'text-teal-600',   sign: '−' },
}

function HistoryList() {
  const [filter, setFilter] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['wallet-history', filter],
    queryFn: () => api.getWalletHistory({ action: filter === 'all' ? undefined : filter }),
  })

  const filters = ['all','earned','received','sent','redeemed','donated']
  const filterLabels: Record<string,string> = {
    all:'すべて', earned:'収益', received:'受取', sent:'送付', redeemed:'換金', donated:'寄付'
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_,i) => (
            <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : data?.transactions.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">履歴はありません</p>
      ) : (
        <div className="space-y-2">
          {data?.transactions.map((tx) => {
            const info = ACTION_MAP[tx.type] ?? { label: tx.type, color: 'text-gray-600', sign: '' }
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {info.label}
                    {tx.role && <span className="text-xs text-gray-400 ml-1.5">({tx.role})</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <p className={`text-sm font-medium flex-shrink-0 ${info.color}`}>
                  {info.sign}{Math.abs(tx.typ_amount).toLocaleString()} TYP
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────
export default function WalletPage() {
  const router  = useRouter()
  const { user } = useAuthStore()
  const [panel, setPanel] = useState<string | null>(null)

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn:  api.getWallet,
    enabled: !!user,
  })

  if (!user) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <p className="text-gray-500 mb-4">ウォレットを確認するにはログインが必要です</p>
      <button onClick={() => router.push('/login')}
        className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium">
        ログインする
      </button>
    </div>
  )

  return (
    <main className="max-w-xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-xl font-medium text-gray-900 mb-6">TYPウォレット</h1>

      {isLoading || !wallet ? (
        <div className="animate-pulse space-y-3 mb-6">
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
      ) : (
        <>
          <BalanceCard
            convertible={wallet.convertible_balance}
            sendable={wallet.sendable_balance}
            pending={wallet.pending_distributions}
          />

          {/* 生涯統計 */}
          <div className="grid grid-cols-3 gap-2 mb-6 mt-3">
            {[
              { label: '生涯獲得', value: wallet.lifetime_earned },
            ].map(({ label, value }) => (
              <div key={label} className="col-span-3 text-right">
                <span className="text-xs text-gray-400">{label}: </span>
                <span className="text-xs font-medium text-gray-600">{value.toLocaleString()} TYP</span>
              </div>
            ))}
          </div>

          {/* アクションボタン */}
          <ActionBar active={panel} onSelect={setPanel} />

          {/* パネル */}
          {panel === 'send'   && <SendPanel   sendableBalance={wallet.sendable_balance}   onDone={() => setPanel(null)} />}
          {panel === 'redeem' && <RedeemPanel convertible={wallet.convertible_balance}    onDone={() => setPanel(null)} />}
          {panel === 'donate' && <DonatePanel convertible={wallet.convertible_balance}    onDone={() => setPanel(null)} />}
        </>
      )}

      {/* 履歴 */}
      <h2 className="text-base font-medium text-gray-900 mb-4">取引履歴</h2>
      <HistoryList />
    </main>
  )
}
