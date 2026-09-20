import React from 'react'
import { ScreenFrame, StateView } from '@/components/ui'

// F 公開する前の確認（参加者の同意）：読み込み中（設計書 §3 F「見出しと枠だけ出す」・主ボタンは置かない）。
// ★歌の題名は読み込む前には分からないので、見出しの所は枠にする。新しい文言は足さない。
export default function ConsentLoading() {
  return (
    <ScreenFrame back={{ href: '/ui/inbox', label: '対応待ちへ' }}>
      <div data-screen="consent-loading">
        <StateView kind="loading" />
      </div>
    </ScreenFrame>
  )
}
