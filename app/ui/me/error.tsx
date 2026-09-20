'use client'

import React from 'react'
import { COPY, StateView } from '@/components/ui'

// I 自分：エラー（設計書 §3 I「読み込めませんでした。通信がつながりませんでした。」［もう一度］・主ボタンは置かない）。
export default function MeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: '12px 16px' }} data-screen="me-error">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>自分</h1>
      <StateView kind="error" title={COPY.meLoadErrorTitle} message={COPY.networkErrorShort} retry={{ onClick: reset }} />
    </div>
  )
}
