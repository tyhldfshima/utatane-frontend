'use client'

import React from 'react'
import { COPY, ScreenFrame, StateView } from '@/components/ui'

// A 歌の画面：エラー（設計書 §3 A「歌を読み込めませんでした」「通信がつながりませんでした。電波のよい所で、
// もう一度お試しください。」［もう一度］・主ボタンは置かない）。
// ★この枠は歌の画面の下の画面（参加・育てる・生まれた流れ）でも使われる。
export default function SongError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }}>
      <div data-screen="song-error">
        <StateView kind="error" title={COPY.songLoadErrorTitle} message={COPY.networkError} retry={{ onClick: reset }} />
      </div>
    </ScreenFrame>
  )
}
