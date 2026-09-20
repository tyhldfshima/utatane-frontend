import React from 'react'
import { Icon, ScreenFrame, SecondaryButton, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'

// A 歌の画面：読み込み中（設計書 §3 A「題名と［再生］を先に出す。ほかは枠だけ出す。再生バーは止めない」）。
// ★この枠は歌の画面の下の画面（参加・育てる・生まれた流れ）でも使われる。
// ★再生バーは画面の枠（AppShell）の側にあるので、ここが入れ替わっても止まらない。
// ★新しい文言は足さない。枠だけ出す（読み上げには StateView の「読み込んでいます」が届く）。
export default function SongLoading() {
  return (
    <ScreenFrame
      back={{ href: '/ui', label: 'ホームへ' }}
      lead={
        <div data-screen="song-loading">
          <div className={`${s.jacket} ${s.jacketXL}`}>
            <Icon name="note" size="l" />
          </div>
          <SecondaryButton label="再生" icon="play" />
        </div>
      }
    >
      <StateView kind="loading" />
    </ScreenFrame>
  )
}
