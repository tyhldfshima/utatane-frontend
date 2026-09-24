'use client'
// app/profile/[id]/page.tsx — プロフィールとチャンネル
// 自分の作品／参加作品／自分の貢献が使われた作品／コラボ募集中（データはコピーせず関係から並べる）

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { core } from '@/lib/core-client'
import { useAuthStore } from '@/stores/authStore'
import { ChannelSections } from '@/components/core/ChannelSections'

export default function ProfilePage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { user, isLoading } = useAuthStore()
  const id = rawId === 'me' ? user?.id ?? '' : rawId
  const channel = useQuery({ queryKey: ['core-channel', id], queryFn: () => core.channel(id), enabled: !!id })

  if (rawId === 'me' && !isLoading && !user) {
    return <div className="p-8 text-gray-500">マイページを見るにはログインしてください</div>
  }
  if (!id || channel.isLoading) return <div className="p-8 text-gray-400">読み込み中…</div>
  if (!channel.data) return <div className="p-8 text-gray-400">読み込めませんでした</div>

  return (
    <main className="max-w-xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-lg font-medium text-gray-900 mb-1">{user?.id === id ? 'マイページ' : 'チャンネル'}</h1>
      <p className="text-xs text-gray-400 mb-6">{id.slice(0, 8)}</p>
      <ChannelSections channel={channel.data} />
    </main>
  )
}
