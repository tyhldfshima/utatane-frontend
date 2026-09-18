'use client'
// app/upload/page.tsx — 投稿（種を置く／派生を作る）
// 下書き → 貢献 → （素材）→ 公開の再検証 → 公開。判定はサーバ（lib/domain）が行う。
// 参加は Version の画面で「参加する」から（招かれた人が承認する）。
// 金額・分配率は出さない。

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { core, roleLabel, type PublishResult } from '@/lib/core-client'
import { useAuthStore } from '@/stores/authStore'

type Mode = 'seed' | 'derive'

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">読み込み中…</div>}>
      <Upload />
    </Suspense>
  )
}

function Upload() {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from')
  const [mode, setMode] = useState<Mode>(from ? 'derive' : 'seed')

  if (isLoading) return <div className="p-8 text-gray-400">読み込み中…</div>
  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">投稿にはログインが必要です</p>
        <button onClick={() => router.push('/login?next=/upload')} className="px-6 py-2.5 rounded-2xl bg-purple-600 text-white text-sm font-medium">
          ログイン
        </button>
      </div>
    )
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <h1 className="text-xl font-medium text-gray-900 mb-4">投稿する</h1>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {(['seed', 'derive'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`py-2.5 rounded-xl text-sm font-medium ${mode === m ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {m === 'seed' ? '種を置く' : 'ほかの歌から作る'}
          </button>
        ))}
      </div>
      <PostForm mode={mode} fromVersionId={mode === 'derive' ? from : null} />
    </main>
  )
}

function PostForm({ mode, fromVersionId }: { mode: Mode; fromVersionId: string | null }) {
  const roleKinds = useQuery({ queryKey: ['core-role-kinds'], queryFn: core.roleKinds })
  const source = useQuery({ queryKey: ['core-version', fromVersionId], queryFn: () => core.version(fromVersionId as string), enabled: !!fromVersionId })

  const [title, setTitle] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [coAuthors, setCoAuthors] = useState('')
  const [use, setUse] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ versionId: string; publish: PublishResult; requested: number } | null>(null)
  const [error, setError] = useState('')

  const toggle = (list: string[], set: (x: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  // ほかの歌の「使える貢献」＝その歌で生まれた貢献と、その歌が使っている貢献
  const candidates = source.data
    ? [
        ...source.data.version.contributions.map((c) => c.contributionId),
        ...source.data.usedContributions.map((u) => u.contribution.id),
      ].filter((x, i, a) => a.indexOf(x) === i)
    : []

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const { version } = await core.createDraft(title)
      const co = coAuthors.split(/[\s,、]+/).map((s) => s.trim()).filter(Boolean)
      for (const roleKindId of roles) {
        await core.createContribution(version.id, { roleKindId, coAuthorTyAccountIds: co })
      }
      let requested = 0
      for (const cid of use) {
        await core.referenceContribution(version.id, cid)
        await core.requestPermission({ draftVersionId: version.id, contributionId: cid, idempotencyKey: crypto.randomUUID() })
        requested++
      }
      const publish = await core.publish(version.id)
      setResult({ versionId: version.id, publish, requested })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown_error')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        {result.publish.published ? (
          <p className="text-sm text-teal-700">公開しました</p>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-900 space-y-1">
            <p>下書きに残しました。公開するには、次がそろう必要があります。</p>
            {result.publish.check.items.filter((i) => !i.ok).length > 0 && <p>・使う貢献の作者の許可（申請を {result.requested} 件送りました）</p>}
            {result.publish.participationIssues.length > 0 && <p>・招いた人の参加の承認</p>}
            {result.publish.check.materialIssues.length > 0 && <p>・素材の出どころの申告</p>}
          </div>
        )}
        <Link href={`/versions/${result.versionId}`} className="text-sm text-purple-700 hover:underline">この歌の画面へ</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-gray-700">題名</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="mt-1.5 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" placeholder="例：春の終わりに" />
      </label>

      {mode === 'derive' && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">使う貢献（ほかの歌から）</legend>
          {!fromVersionId && <p className="text-sm text-gray-400">元にする歌の画面の「この歌から作る」から始めてください</p>}
          {source.data && candidates.length === 0 && <p className="text-sm text-gray-400">使える貢献がありません</p>}
          <div className="flex flex-wrap gap-2">
            {candidates.map((cid) => {
              const c = source.data?.usedContributions.find((u) => u.contribution.id === cid)?.contribution
              return (
                <button key={cid} type="button" onClick={() => toggle(use, setUse, cid)}
                  className={`px-3 py-1.5 rounded-full text-sm ${use.includes(cid) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {c ? roleLabel(c.roleKindId) : `${source.data?.version.title ?? ''} の貢献`}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">作者の許可が要る貢献は、申請を送ってから公開の確かめをします</p>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">この歌であなたが作るもの</legend>
        <div className="flex flex-wrap gap-2">
          {(roleKinds.data?.roleKinds ?? []).map((r) => (
            <button key={r.id} type="button" onClick={() => toggle(roles, setRoles, r.id)}
              className={`px-3 py-1.5 rounded-full text-sm ${roles.includes(r.id) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {roleLabel(r.id)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">一緒に作った人（任意）</span>
        <input value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)}
          className="mt-1.5 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" placeholder="TY アカウントの id（その人の承認で参加が成立します）" />
      </label>

      <p className="text-xs text-gray-400">音源・譜面のファイルを上げる所は、置き場（中央の保管サービス）とつないでから足します。</p>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">うまくいきませんでした（{error}）</p>}

      <button onClick={submit} disabled={busy || !title.trim() || (roles.length === 0 && use.length === 0)}
        className="w-full py-3.5 rounded-2xl bg-purple-600 text-white font-medium disabled:opacity-40">
        {busy ? '確かめています…' : '公開を確かめる'}
      </button>
    </div>
  )
}
