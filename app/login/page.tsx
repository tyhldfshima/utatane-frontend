'use client'
// app/login/page.tsx — ログインページ（中央の TY アカウント。メールとパスワードは使わない：ADR-006）

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  )
}

function Login() {
  const { signIn } = useAuthStore()
  const params = useSearchParams()
  const [error, setError] = useState(params.get('error') ? 'ログインできませんでした。もう一度お試しください。' : '')
  const [busy, setBusy] = useState(false)

  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      await signIn(params.get('next') ?? '/')
    } catch {
      setError('ログインの準備ができていません。しばらくしてからお試しください。')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
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

        <h1 className="text-xl font-medium text-gray-900 mb-1">ログイン</h1>
        <p className="text-sm text-gray-400 mb-6">一粒の歌が、森になる。</p>

        {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

        <button onClick={handleGoogle} disabled={busy}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.3 10.3 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4"/><path d="M9 18a8.6 8.6 0 0 0 5.96-2.18L12.04 13.6A5.43 5.43 0 0 1 9 14.52a5.43 5.43 0 0 1-5.12-3.74H.82v2.34A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.88 10.78a5.38 5.38 0 0 1 0-3.56V4.88H.82a9 9 0 0 0 0 8.24l3.06-2.34z" fill="#FBBC05"/><path d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .82 4.88l3.06 2.34A5.43 5.43 0 0 1 9 3.58z" fill="#EA4335"/></svg>
          {busy ? '移動しています…' : 'Google でログイン'}
        </button>
        <p className="mt-5 text-center text-xs text-gray-400">TY アカウントでログインします</p>
      </div>
    </div>
  )
}
