'use client'
// app/login/page.tsx — ログインページ

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState<'login' | 'register'>('login')

  const handleSubmit = async () => {
    setError('')
    try {
      await login(email, password)
      router.push('/')
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-gray-100">

        {/* ロゴ */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <ellipse cx="9" cy="13.5" rx="4.5" ry="4" fill="#EEEDFE" opacity=".9"/>
              <path d="M9 9.5 Q9 5 9 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 7.5 Q6 5.5 4.5 7.5 Q6.5 9.5 9 7.5Z" fill="white" opacity=".85"/>
              <path d="M9 5 Q12 3 13.5 5 Q12 7 9 5Z" fill="white" opacity=".85"/>
            </svg>
          </div>
          <span className="text-xl font-semibold text-gray-900">ウタタネ</span>
        </div>

        <h1 className="text-xl font-medium text-gray-900 mb-1">
          {mode === 'login' ? 'ログイン' : 'アカウント作成'}
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          {mode === 'login' ? '一粒の歌を、森にしよう。' : '無料で始められます'}
        </p>

        {/* フォーム */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">メールアドレス</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">パスワード</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200" />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button onClick={handleSubmit} disabled={isLoading || !email || !password}
            className="w-full py-3.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {isLoading ? '処理中…' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
          </button>
        </div>

        {/* SNSログイン（将来拡張用） */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">または</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <button className="mt-4 w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.3 10.3 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4"/><path d="M9 18a8.6 8.6 0 0 0 5.96-2.18L12.04 13.6A5.43 5.43 0 0 1 9 14.52a5.43 5.43 0 0 1-5.12-3.74H.82v2.34A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.88 10.78a5.38 5.38 0 0 1 0-3.56V4.88H.82a9 9 0 0 0 0 8.24l3.06-2.34z" fill="#FBBC05"/><path d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .82 4.88l3.06 2.34A5.43 5.43 0 0 1 9 3.58z" fill="#EA4335"/></svg>
          Google でログイン
        </button>

        {/* モード切替 */}
        <p className="mt-5 text-center text-xs text-gray-400">
          {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-purple-600 font-medium ml-1 hover:underline">
            {mode === 'login' ? '新規登録' : 'ログイン'}
          </button>
        </p>
      </div>
    </div>
  )
}
