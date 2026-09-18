// components/core/VersionSections.tsx — Version の画面の2段（参加者／使われた貢献）
// データはコピーせず、同じ Version と関係を出すだけ。金額・分配率は出さない。
import Link from 'next/link'
import { roleLabel } from '@/lib/core-client'
import type { VersionView } from '@/lib/server/core-service'

export function VersionSections({ view }: { view: VersionView }) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="participants" className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 id="participants" className="text-sm font-medium text-gray-700 mb-3">この Version で作った人</h2>
        {view.participants.length === 0 ? (
          <p className="text-sm text-gray-400">まだいません</p>
        ) : (
          <ul className="space-y-2">
            {view.participants.map((p) => (
              <li key={p.rightsHolderId} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">
                  {p.tyAccountId ? (
                    <Link href={`/profile/${p.tyAccountId}`} className="hover:underline">
                      {p.tyAccountId.slice(0, 8)}
                    </Link>
                  ) : (
                    '参加者1名（非表示）'
                  )}
                  {p.state === 'host' && <span className="ml-2 text-xs text-gray-400">主催</span>}
                  {p.state === 'invited' && <span className="ml-2 text-xs text-amber-600">参加の承認待ち</span>}
                </span>
                <span className="text-xs text-gray-500">{p.roles.map(roleLabel).join('・') || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="used" className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 id="used" className="text-sm font-medium text-gray-700 mb-3">この歌が使っている、ほかの歌の貢献</h2>
        {view.usedContributions.length === 0 ? (
          <p className="text-sm text-gray-400">ありません（この Version で生まれた貢献だけ）</p>
        ) : (
          <ul className="space-y-2">
            {view.usedContributions.map((u) => (
              <li key={u.contribution.id} className="flex items-center justify-between text-sm">
                <span>
                  {roleLabel(u.contribution.roleKindId)}
                  <span className="ml-2 text-xs text-gray-400">{u.via === 'material' ? '素材の中' : 'そのまま'}</span>
                </span>
                <Link href={`/versions/${u.birthVersionId}`} className="text-xs text-purple-700 hover:underline">
                  生まれた歌を見る
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
