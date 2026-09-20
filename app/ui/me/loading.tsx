import React from 'react'
import { StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'

// I 自分：読み込み中（設計書 §3 I「見出しと枠」・主ボタンは置かない）。
// ★「自分」は一覧の画面なので、画面の枠（ScreenFrame）は使わず、見出しと枠だけを出す。
export default function MeLoading() {
  return (
    <div style={{ padding: '12px 16px' }} data-screen="me-loading">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>自分</h1>
      <StateView kind="loading" />
    </div>
  )
}
