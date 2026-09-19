// 取引についての問い合わせの引き継ぎ（えふさん確定 2026-09-19）。
// ★取引の番号（transaction ID）は利用者に見せない。画面の住所（URL）にも入れない。
// ★利用者が番号を写して入力する作りにしない。問い合わせの画面へは、端末の中（sessionStorage）で引き継ぐ。
// ★人が伝える番号が要るようになったら、短い問い合わせ番号を別に設計する（今は作らない）。

export const INQUIRY_PATH = '/ui/inquiry'
export const INQUIRY_STORAGE_KEY = 'utatane.inquiry.handoff'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type InquiryHandoff = { transactionId: string; startedAt: string }

/** 問い合わせを始める。移る先の住所を返す（番号は入っていない）。 */
export function startInquiry(transactionId: string, storage: StorageLike, now = new Date()): string {
  const handoff: InquiryHandoff = { transactionId, startedAt: now.toISOString() }
  storage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(handoff))
  return INQUIRY_PATH
}

/** 問い合わせの画面で、引き継いだ取引を読む（画面には出さない）。1回読んだら消す。 */
export function takeInquiry(storage: StorageLike): InquiryHandoff | null {
  const raw = storage.getItem(INQUIRY_STORAGE_KEY)
  if (!raw) return null
  storage.removeItem(INQUIRY_STORAGE_KEY)
  try {
    const v = JSON.parse(raw) as Partial<InquiryHandoff>
    return typeof v.transactionId === 'string' && typeof v.startedAt === 'string'
      ? { transactionId: v.transactionId, startedAt: v.startedAt }
      : null
  } catch {
    return null
  }
}
