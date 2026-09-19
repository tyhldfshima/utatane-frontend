// 「ありがとうを贈る」の出し分け（docs/design/utatane-focus-screens-spec.md §2-3・画面 A）。
//
// えふさん確定：受取不能者を含む Version は、Y4 本番受入 PASS までは「ありがとうを贈る」を利用不可にする。
// これは恒久の決まりではなく、Y4 完成までの暫定。PASS 後は Y4_PHASE を 'after-acceptance' に
// 変えるだけで、利用不可を出さなくなり、確認の画面に giftAfterY4Note を出す形に切り替わる。
// ★条件は Y4_PHASE の1つだけ。画面の中に別の分かれ道を作らない。
// ★どこから読むか（設定・環境・中央の答え）は、実装の便で決める。今はここに置く。

import { COPY } from './copy'

export type Y4Phase = 'before-acceptance' | 'after-acceptance'

/** Y4 本番受入の前か後か（唯一の切り替え点）。 */
export const Y4_PHASE: Y4Phase = 'before-acceptance'

export type GiftGateInput = {
  /** 届け方（TYP Delivery Rule）が成立しているか */
  ruleEstablished: boolean
  /** 自分がこの歌に参加しているか（T4） */
  selfIsParticipant: boolean
  /** 自分がこの歌の届け先に入っているか（941be1bd 3） */
  selfIsRecipient: boolean
  /** 受け取れる人の数 */
  receivableCount: number
  /** 受け取れない人の数 */
  unreceivableCount: number
  /** 前の贈与が結果確認中か（T8） */
  pendingResult: boolean
  /** 試験・部品一覧のためだけに上書きできる。画面からは渡さない。 */
  phase?: Y4Phase
}

export type GiftGate =
  | { kind: 'available'; note?: string }
  | { kind: 'unavailable-y4'; reason: string }
  | { kind: 'unavailable-self'; reason: string }
  | { kind: 'checking'; reason: string }
  | { kind: 'hidden' }

export function giftGate(input: GiftGateInput): GiftGate {
  const phase = input.phase ?? Y4_PHASE
  if (!input.ruleEstablished) return { kind: 'hidden' }
  // 恒久の決まり：自分が参加している・届け先に入っている歌には贈れない（Y4 とは別の条件）。
  if (input.selfIsParticipant || input.selfIsRecipient) {
    return { kind: 'unavailable-self', reason: COPY.giftUnavailableSelf }
  }
  if (input.receivableCount <= 0) return { kind: 'hidden' }
  if (input.pendingResult) return { kind: 'checking', reason: COPY.giftPending }
  if (input.unreceivableCount > 0) {
    if (phase === 'before-acceptance') {
      return { kind: 'unavailable-y4', reason: COPY.giftUnavailableY4 }
    }
    return { kind: 'available', note: COPY.giftAfterY4Note }
  }
  return { kind: 'available' }
}
