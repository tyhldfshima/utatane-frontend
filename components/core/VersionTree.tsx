'use client'
// components/core/VersionTree.tsx — Version Tree（由来を1段ずつ開く・下流の1段）
import Link from 'next/link'
import { useState } from 'react'
import type { TreeView } from '@/lib/server/core-service'

export function VersionTree({ tree }: { tree: TreeView }) {
  const [open, setOpen] = useState(1) // 最初は世代0（この歌が使った貢献）だけ
  const shown = tree.upstream.slice(0, open)
  const more = tree.upstream.length - open

  return (
    <section aria-labelledby="tree" className="bg-white border border-gray-100 rounded-2xl p-5">
      <h2 id="tree" className="text-sm font-medium text-gray-700 mb-3">この歌の森</h2>
      <ol className="space-y-3">
        {shown.map((g) => (
          <li key={g.generation}>
            <p className="text-xs text-gray-400 mb-1">
              {g.generation === 0 ? 'この歌が使った貢献' : `${g.generation} つ前の元`}
            </p>
            <p className="text-sm text-gray-800">{g.entries.length} 件の貢献</p>
          </li>
        ))}
      </ol>
      {more > 0 && (
        <button onClick={() => setOpen(open + 1)} className="mt-3 text-xs text-purple-700 hover:underline">
          もう1段さかのぼる（あと {more} 段）
        </button>
      )}
      <div className="mt-4 pt-4 border-t border-gray-50">
        <p className="text-xs text-gray-400 mb-1">この歌から生まれた歌</p>
        {tree.downstream.length === 0 ? (
          <p className="text-sm text-gray-400">まだありません</p>
        ) : (
          <ul className="space-y-1">
            {tree.downstream.map((d) => (
              <li key={d.versionId}>
                <Link href={`/versions/${d.versionId}`} className="text-sm text-gray-800 hover:underline">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
