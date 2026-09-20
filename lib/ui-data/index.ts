// ★画面の読み口を選ぶ1か所。
//
// いまは見本の読み口（sampleSource）。本物のデータ（PR #4〜#6 の API・UTATANE 専用 DB）とつなぐ便では、
// 同じ形の読み口を作り、この1行を差し替える。画面（app/ui）は1枚も書き直さない。
//
// 画面は必ず uiData() 経由で読む。lib/preview/sample.ts を画面から直に読まない。

import type { UiDataSource } from './port'
import { sampleSource } from './sample-source'

let current: UiDataSource = sampleSource

/** 画面が使う読み口 */
export function uiData(): UiDataSource {
  return current
}

/** 読み口を差し替える（試験と、本物とつなぐ便で使う）。戻す手を返す。 */
export function setUiDataSource(source: UiDataSource): () => void {
  const before = current
  current = source
  return () => {
    current = before
  }
}

export { sampleSource }
export { hrefSong } from '@/lib/preview/model'
export * from './port'
