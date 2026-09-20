import React from 'react'
import { MaterialsPanel } from './MaterialsPanel'

// 自分の素材（置く → 一覧 → 再生）。
// 置き場は保管サービスの利用者ごとの区画 utatane/{利用者}/…（常に非公開・2026-09-19 えふさん確定 A-1）。
// 画面の中身は、読み込みと操作があるので画面の中で動く部品（MaterialsPanel）にしている。
export default function MaterialsPage() {
  return <MaterialsPanel />
}
