// lib/domain/history.ts — 履歴つきの新版（上書きしない・追記だけ）
//
// 公開状態の変更と Revenue Rule の変更は、過去を上書きせず新しい版を足す（追補3 #5）。
// 公開済み Version の中身（貢献・素材）は過去方向へ書き換えない。変えたければ新しい Version を作る（確定3）。

import type { HistoryEntry, Id, Timestamp, Version } from './types'

/** 新しい版を足した履歴を返す。元の配列は変えない。効き始めは前の版より後でなければならない */
export function appendVersion<T>(
  history: readonly HistoryEntry<T>[],
  next: { value: T; effectiveFrom: Timestamp; recordedBy: Id; reason: string },
): HistoryEntry<T>[] {
  const last = history[history.length - 1]
  if (last && !(last.effectiveFrom < next.effectiveFrom)) {
    throw new Error('history_not_forward')
  }
  const seq = last ? last.seq + 1 : 1
  return [...history, { seq, ...next }]
}

/** ある日時に有効だった版（無ければ null）。過去の計算は、その時点の版で行う */
export function versionAt<T>(
  history: readonly HistoryEntry<T>[],
  at: Timestamp,
): HistoryEntry<T> | null {
  let found: HistoryEntry<T> | null = null
  for (const h of history) {
    if (h.effectiveFrom <= at) found = h
    else break
  }
  return found
}

/** 公開済み Version の中身を変えようとしていないかの確かめ（変えるなら新しい Version） */
export function assertContentEditable(version: Version): void {
  if (version.publishedAt !== null) throw new Error('published_version_is_immutable')
}
