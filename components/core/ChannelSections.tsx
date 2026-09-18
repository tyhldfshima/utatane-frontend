// components/core/ChannelSections.tsx — チャンネルの4つの区分
// 自分の作品／参加作品／自分の貢献が使われた作品／コラボ募集中。
// 「使われた作品」には「参加」「共演」「feat.」の言葉を使わない。
import Link from 'next/link'
import { roleLabel, type ChannelRow } from '@/lib/core-client'
import type { ChannelSection } from '@/lib/server/core-service'

export const CHANNEL_TITLES: Record<ChannelSection, string> = {
  own: '自分の作品',
  participated: '参加作品',
  used: 'あなたの貢献が使われた作品',
  recruiting: 'コラボ募集中',
}

const ORDER: ChannelSection[] = ['own', 'participated', 'used', 'recruiting']

export function ChannelSections({ channel }: { channel: Record<ChannelSection, ChannelRow[]> }) {
  return (
    <div className="space-y-5">
      {ORDER.map((key) => (
        <section key={key} aria-labelledby={`ch-${key}`}>
          <h2 id={`ch-${key}`} className="text-sm font-medium text-gray-700 mb-2">
            {CHANNEL_TITLES[key]}
            <span className="ml-2 text-xs text-gray-400">{channel[key].length}</span>
          </h2>
          {channel[key].length === 0 ? (
            <p className="text-sm text-gray-400">まだありません</p>
          ) : (
            <ul className="space-y-2">
              {channel[key].map((row) => (
                <li key={row.versionId} className="bg-white border border-gray-100 rounded-xl p-3">
                  <Link href={`/versions/${row.versionId}`} className="text-sm text-gray-900 hover:underline">
                    {row.title}
                  </Link>
                  {key === 'used' && row.usedRoles && (
                    <p className="text-xs text-gray-500 mt-1">{row.usedRoles.map(roleLabel).join('・')}が使われた</p>
                  )}
                  {!row.publishedAt && <p className="text-xs text-amber-600 mt-1">下書き</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
