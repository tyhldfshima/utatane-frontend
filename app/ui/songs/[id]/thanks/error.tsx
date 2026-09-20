'use client'

import React from 'react'
import { COPY, ScreenFrame, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'

// C ありがとう：量を選ぶ のエラー（設計書 §3 C「いまの TYP を確かめられませんでした」［もう一度］・主ボタンは置かない）。
// ★設計書はこの画面に本文を置いていないので、本文は足さない。
export default function ThanksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={s.dim}>
      <ScreenFrame presentation="sheet">
        <div data-screen="thanks-error">
          {/* ★本文は空にする。設計書はこの画面に本文を置いていないので、部品の既定の文言を出さない */}
          <StateView kind="error" title={COPY.walletErrorTitle} message="" retry={{ onClick: reset }} />
        </div>
      </ScreenFrame>
    </div>
  )
}
