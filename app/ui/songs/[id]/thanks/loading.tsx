import React from 'react'
import { COPY, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'

// C ありがとう：量を選ぶ の読み込み中（設計書 §3 C「あなたの TYP の所に『確かめています』。前の数字は出さない」
// ・主ボタンは「なし（押せない［確認へ］）」）。
// ★歌の画面の読み込み中ではなく、この画面だけの形にする（前の数字を出さないため）。
export default function ThanksLoading() {
  return (
    <div className={s.dim}>
      <ScreenFrame
        presentation="sheet"
        primary={{ kind: 'unavailable', label: '確認へ', reason: COPY.walletChecking }}
      >
        <div data-screen="thanks-loading">
          <dl className={s.kv}>
            <dt>あなたの TYP</dt>
            <dd>{COPY.walletChecking}</dd>
          </dl>
        </div>
      </ScreenFrame>
    </div>
  )
}
