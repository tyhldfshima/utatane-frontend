'use client'
// components/TYPWallet.tsx — TYPウォレット（2残高表示・送付・換金）

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function TYPWallet() {
  const qc = useQueryClient()
  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn:  api.getWallet,
  })

  const [mode, setMode] = useState<'send' | 'redeem' | 'donate' | null>(null)
  const [amount, setAmount] = useState(1000)
  const [toUserId, setToUserId] = useState('')
  const [message, setMessage] = useState('')

  const sendMut = useMutation({
    mutationFn: () => api.sendTYP(toUserId, amount, message, 'sendable'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet'] }); setMode(null) },
  })

  const redeemMut = useMutation({
    mutationFn: () => api.redeemTYP(amount, 'bank-account-id'),
    onSuccess: (data) => {
      alert(`¥${data.jpy_amount.toLocaleString()} を ${data.scheduled_transfer} に振り込みます`)
      qc.invalidateQueries({ queryKey: ['wallet'] }); setMode(null)
    },
  })

  if (isLoading || !wallet) return (
    <div className="animate-pulse bg-gray-100 rounded-2xl h-48" />
  )

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      {/* 2残高 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-700 mb-1">換金可能残高</p>
          <p className="text-2xl font-medium text-amber-900">
            {wallet.convertible_balance.toLocaleString()}
            <span className="text-sm font-normal ml-1">TYP</span>
          </p>
          <p className="text-xs text-amber-600 mt-1">≈ ¥{Math.floor(wallet.convertible_balance * 0.95).toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-700 mb-1">送付専用残高</p>
          <p className="text-2xl font-medium text-purple-900">
            {wallet.sendable_balance.toLocaleString()}
            <span className="text-sm font-normal ml-1">TYP</span>
          </p>
          <p className="text-xs text-purple-600 mt-1">他者への感謝に使えます</p>
        </div>
      </div>

      {/* 保留中 */}
      {wallet.pending_distributions > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          + {wallet.pending_distributions.toLocaleString()} TYP 処理中（まもなく反映）
        </p>
      )}

      {/* アクションボタン */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={() => setMode(mode === 'send' ? null : 'send')}
          className="py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-800 hover:bg-purple-100">
          送付
        </button>
        <button onClick={() => setMode(mode === 'redeem' ? null : 'redeem')}
          className="py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-800 hover:bg-amber-100">
          換金
        </button>
        <button onClick={() => setMode(mode === 'donate' ? null : 'donate')}
          className="py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-800 hover:bg-teal-100">
          寄付
        </button>
      </div>

      {/* 送付フォーム */}
      {mode === 'send' && (
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <input placeholder="送付先ユーザーID" value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
          <input type="number" placeholder="送付額 (TYP)" value={amount}
            onChange={(e) => setAmount(+e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
          <input placeholder="ひとこと（任意）" value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
          <p className="text-xs text-purple-600">送付専用残高から {amount.toLocaleString()} TYP を送ります</p>
          <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !toUserId || amount <= 0}
            className="w-full py-2 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
            {sendMut.isPending ? '送付中…' : 'ありがとうを送る'}
          </button>
        </div>
      )}

      {/* 換金フォーム */}
      {mode === 'redeem' && (
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <input type="number" placeholder="換金額 (最低1,000TYP)" value={amount}
            min={1000} onChange={(e) => setAmount(+e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400" />
          <p className="text-xs text-amber-600">
            ¥{Math.floor(amount * 0.95).toLocaleString()} を振り込みます（手数料5%）
          </p>
          <button onClick={() => redeemMut.mutate()} disabled={redeemMut.isPending || amount < 1000}
            className="w-full py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
            {redeemMut.isPending ? '処理中…' : '換金申請'}
          </button>
        </div>
      )}

      {/* 生涯獲得 */}
      <p className="text-xs text-gray-400 text-right mt-3">
        生涯獲得: {wallet.lifetime_earned.toLocaleString()} TYP
      </p>
    </div>
  )
}
