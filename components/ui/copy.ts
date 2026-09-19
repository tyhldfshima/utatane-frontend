// 画面の言葉（docs/design/utatane-focus-screens-spec.md §3・§5）。
// 同じ物は、どの画面でも同じ言い方にするため、部品はここから読む。

export const COPY = {
  retry: 'もう一度',
  back: '戻る',
  close: '閉じる',
  loading: '読み込んでいます',
  networkError: '通信がつながりませんでした。電波のよい所で、もう一度お試しください。',
  checkingTitle: '結果を確認しています',
  checkingBody: '結果がわかったら、お知らせでお伝えします。二重に贈ることはありません。',
  notReadyTitle: 'いまは表示できません',
  notReadyBody: '時間をおいて、もう一度お試しください。',
  giftButton: 'ありがとうを贈る',
  giftUnavailableY4: 'この歌には、いまありがとうを受け取れない方がいるため、贈れません。',
  giftUnavailableSelf: 'あなたもこの歌の届け先に入っているため、ありがとうは贈れません。',
  giftPending: '前のありがとうの結果を確認しています',
  /** えふさん確定の文言（2026-09-19：「TYP」で統一）。Y4 本番受入の後に出す。 */
  giftAfterY4Note: '受け取れない方の分は送られず、あなたのTYPからも減りません',
  /** 参加の基本語（「曲」は作曲済みを前提に読めるため「歌の制作」） */
  joinTitle: 'この歌の制作に参加する',
  joinButton: '参加する',
  growTitle: '新しい Version として育てる',
  growLead: 'この歌の一部を受け継いで、あなたが主催する新しい Version をつくります。',
  joinLead: '今の主催者の制作に加わります。',
  giftIrreversible: '贈ったあとで、取り消すことはできません。',
  /** 設計の印。本番の画面には出さない（部品一覧でだけ出す）。 */
  tagY4Provisional: 'Y4 完成までの暫定（あとで外す）',
} as const
