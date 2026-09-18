'use client'
// app/versions/[id]/page.tsx — Version の画面（参加者と使われた貢献の2段・Version Tree・再生）
// 金額・分配率・換金は出さない。TYP は「TYP を贈る」と書く（贈る口は中央の API ができてからつなぐ）。

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { core } from '@/lib/core-client'
import { useAuthStore } from '@/stores/authStore'
import { VersionSections } from '@/components/core/VersionSections'
import { VersionTree } from '@/components/core/VersionTree'

export default function VersionPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const playKey = useMemo(() => crypto.randomUUID(), []) // この画面を開いた1回を1つの鍵にする（冪等）
  const [played, setPlayed] = useState(false)
  const [message, setMessage] = useState('')

  const view = useQuery({ queryKey: ['core-version', id], queryFn: () => core.version(id) })
  const tree = useQuery({ queryKey: ['core-tree', id], queryFn: () => core.tree(id) })

  useEffect(() => setPlayed(false), [id])

  if (view.isLoading) return <div className="p-8 text-gray-400">読み込み中…</div>
  if (!view.data) return <div className="p-8 text-gray-400">見つかりません</div>

  const v = view.data
  const me = user ? v.participants.find((p) => p.tyAccountId === user.id) : undefined

  const handlePlay = async () => {
    if (played || !v.version.publishedAt) return
    await core.recordPlay(id, playKey, 'version_page')
    setPlayed(true)
    qc.invalidateQueries({ queryKey: ['core-version', id] })
  }

  const respond = async (accept: boolean) => {
    await core.respondToInvitation(id, accept)
    setMessage(accept ? '参加を承認しました' : '参加を見送りました')
    qc.invalidateQueries({ queryKey: ['core-version', id] })
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24 space-y-4">
      <div>
        <h1 className="text-xl font-medium text-gray-900 mb-1">{v.version.title}</h1>
        <p className="text-sm text-gray-400">
          {v.version.publishedAt ? `${v.plays.toLocaleString()} 回聴かれました` : '下書き（まだ公開していません）'}
        </p>
      </div>

      {v.version.publishedAt && (
        <button onClick={handlePlay} disabled={played}
          className="w-full py-3 rounded-2xl text-sm font-medium bg-purple-600 text-white disabled:opacity-60">
          {played ? '聴いています' : '聴く'}
        </button>
      )}

      {me?.state === 'invited' && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
          <p className="text-sm text-amber-900">この歌に参加者として招かれています</p>
          <div className="flex gap-2">
            <button onClick={() => respond(true)} className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-sm">参加する</button>
            <button onClick={() => respond(false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm">見送る</button>
          </div>
        </div>
      )}
      {message && <p className="text-sm text-teal-700">{message}</p>}

      <VersionSections view={v} />
      {tree.data && <VersionTree tree={tree.data} />}

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/upload?from=${id}`} className="py-3 rounded-2xl text-sm font-medium text-center bg-orange-50 text-orange-700 border border-orange-100">
          この歌から作る
        </Link>
        <button disabled className="py-3 rounded-2xl text-sm font-medium bg-teal-50 text-teal-800 opacity-60" title="中央の TYP がつながってから使えます">
          TYP を贈る（準備中）
        </button>
      </div>
    </main>
  )
}
