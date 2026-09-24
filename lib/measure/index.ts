// ★計測の送り口を選ぶ1か所。
//
// いまは「何もしない送り口」です。呼ばれても外へは1バイトも送りません。
// 送り先（分析基盤）を決める便では、同じ形の送り口を作って、この1行を差し替えます。
// 画面（app/ui）は1枚も書き直しません。読み口（lib/ui-data）と同じ作りです。

import type { LoopStage, MeasureSink } from './port'

/**
 * 何もしない送り口。★これが既定です。
 * 呼ばれても、通信も保存も記録もしません（外へ何も送りません）。
 */
export const noopSink: MeasureSink = {
  mark(_stage: LoopStage): void {
    // わざと何もしない。送り先は、まだ決まっていない（正本 §4）。
  },
}

let current: MeasureSink = noopSink

/** 画面が使う送り口 */
export function measure(): MeasureSink {
  return current
}

/** 送り口を差し替える（試験と、送り先を決める便で使う）。戻す手を返す。 */
export function setMeasureSink(sink: MeasureSink): () => void {
  const before = current
  current = sink
  return () => {
    current = before
  }
}

export * from './port'
