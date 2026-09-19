import React from 'react'
import { ScreenFrame, SecondaryButton, UnavailableButton } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong } from '@/lib/preview/sample'

// ＋つくる（何から始めますか）。この便では「今ある歌から育てる」だけをつなぐ（主要4導線 ④）。
// ほかの始め方は、素材の置き場とつなぐ便で作る（仮の形）。
export default function CreatePage() {
  return (
    <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }} title="何から始めますか">
      <div data-screen="create">
        <UnavailableButton label="音・鼻歌から始める" icon="mic" reason="この始め方は、まだ準備中です。" />
        <UnavailableButton label="歌詞から始める" icon="pen" reason="この始め方は、まだ準備中です。" />
        <UnavailableButton label="音源を投稿する" icon="note" reason="この始め方は、まだ準備中です。" />
        <SecondaryButton label="今ある歌から育てる" icon="branch" href={`${hrefSong('minato')}/tree`} />
        <p className={s.sub}>今ある歌の「この歌が生まれた流れ」から、新しい Version として育てられます。</p>
      </div>
    </ScreenFrame>
  )
}
