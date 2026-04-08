'use client'
// app/page.tsx — ログイン済み→/feed、未ログイン→/lp にリダイレクト

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function RootPage() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    router.replace(user ? '/feed' : '/lp')
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
