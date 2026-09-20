// 画面の言葉（docs/design/utatane-focus-screens-spec.md §3・§5）。
// 同じ物は、どの画面でも同じ言い方にするため、部品はここから読む。

export const COPY = {
  retry: 'もう一度',
  back: '戻る',
  close: '閉じる',
  cancel: 'やめる',
  loading: '読み込んでいます',
  networkError: '通信がつながりませんでした。電波のよい所で、もう一度お試しください。',
  /** B・F・I のエラーは短い形（設計書 §3 B・F・I） */
  networkErrorShort: '通信がつながりませんでした。',
  /** A エラー（設計書 §3 A） */
  songLoadErrorTitle: '歌を読み込めませんでした',
  /** B 読み込み中・エラー（設計書 §3 B） */
  joinSending: '送っています',
  joinSendErrorTitle: '送れませんでした',
  /** C 読み込み中・エラー・結果を確認しています（設計書 §3 C） */
  walletChecking: '確かめています',
  walletErrorTitle: 'いまの TYP を確かめられませんでした',
  giftPendingBlock: '前のありがとうの結果を確認しています。結果がわかるまで、次のありがとうは贈れません。',
  /** F エラー（設計書 §3 F） */
  consentSendErrorTitle: '同意を送れませんでした',
  /** I エラー（設計書 §3 I） */
  meLoadErrorTitle: '読み込めませんでした',
  /** G 主催が公開する（設計書 §3 G・試作 g-normal〜g-done） */
  publishButton: '公開する',
  publishConfirmTitle: '公開しますか',
  publishConfirmBody: '公開すると、誰でも聴けるようになります。',
  publishConfirmNote: '公開した後に音や参加した人を変えるときは、新しい Version をつくります。題名や説明は後から直せます。',
  publishErrorTitle: '公開できませんでした。',
  publishErrorBody: '通信がつながりませんでした。まだ公開されていません。',
  publishDoneTitle: '公開しました',
  publishDoneBody: '誰でも聴けるようになりました。',
  publishDoneButton: '公開した歌を見る',
  publishAskAgain: 'もう一度お願いする',
  /** J 使わせてとお願いする（設計書 §3 J・試作 j-ask） */
  askTitle: '使わせてとお願いする',
  askBody: '次の物は、作った人の承認が必要です。お願いを送り、返事が来たら使えます。',
  askSentTitle: 'お願いを送りました',
  askReply: '返事が来たら使えます。',
  askWaiting: '返事を待っています',
  askWaitingBody: '次の物は、作った人に「使わせて」とお願いしています。返事が来たら使えます。',
  askSendErrorTitle: 'お願いを送れませんでした',
  consentDone: '同意済み',
  consentYet: 'まだ',
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
  /** C 利用不可（上限）。★上限の値は中央の制度の設定から来る（設計書 §4・いまは見本の値） */
  giftOverLimit: '1回に贈れるのは、設定の上限までです。',
  /** D 読み込み中（贈っています）（設計書 §3 D） */
  giftSending: '贈っています',
  /** D エラー（贈る前に止まった）（設計書 §3 D） */
  giftBlocked: 'この歌には、いま贈れません（歌が非公開になりました）。TYP は減っていません。',
  /** E 利用不可（いま止まっている）（設計書 §3 E） */
  giftPausedTitle: 'いまはありがとうを贈れません',
  giftPausedBody: 'しばらくしてから、もう一度お試しください。TYP は減っていません。',
  /** 設計の印。本番の画面には出さない（部品一覧でだけ出す）。 */
  tagY4Provisional: 'Y4 完成までの暫定（あとで外す）',
} as const
