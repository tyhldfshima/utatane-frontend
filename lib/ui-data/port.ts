// 画面の読み口（UI data port）。
//
// これまで画面は、見本のデータ（lib/preview/sample.ts）を直に読んでいた。
// 本物のデータ（PR #4〜#6 の API・UTATANE 専用 DB）へ移るとき、画面を1枚ずつ書き直さずに済むよう、
// 「画面が要る形」をここに1枚で決める。差し替えるのは lib/ui-data/index.ts の1か所だけ。
//
// 決まり：
// ・すべて async。本物の読み込み（通信・DB）は待ちが要るため、見本でも同じ形にしておく。
// ・画面に出す形だけを持つ（判断は lib/domain、見せ方の計算は lib/preview/model.ts）。
// ・役割・始め方などは固定の一覧にしない。データから来た物をそのまま出す。

import type { IconName } from '@/components/ui'
import type { Id } from '@/lib/domain/types'
import type { CreditLine, InheritCandidate, PersonRef, SongView } from '@/lib/preview/model'

export type { CreditLine, InheritCandidate, PersonRef, SongView }

// ── ホーム（W1） ─────────────────────────────────────────

export type HomeItem = {
  songId: Id
  title: string
  /** 行の2段目に出す言葉（例：募集中：ギター・コーラス／あさひ ほか3人） */
  note: string
}

export type HomeSection = {
  key: string
  title: string
  icon: IconName
  items: HomeItem[]
}

// ── 制作中の歌（W4） ──────────────────────────────────────

export type DraftView = {
  id: Id
  title: string
  /** 題名の下に出す補足（元の題名から始まる、など）。無ければ null */
  titleNote: string | null
  hostName: string
  /** 参加した先なら、元の歌。育てて作った歌は grow の画面から作る */
  parentSongId: Id
}

// ── 対応待ち（M8） ───────────────────────────────────────

export type InboxItem = {
  id: Id
  title: string
  note: string
  href: string
  icon: IconName
}

export type InboxGroup = {
  key: string
  title: string
  items: InboxItem[]
}

// ── 公開する前の確認（F） ──────────────────────────────────

export type DeliveryLine = {
  name: string
  role: string
  /** その人がなぜ届け先に入るか（主催の案／使わせてくれた時に同意済み など） */
  note: string
}

export type ConsentView = {
  id: Id
  title: string
  hostName: string
  /** 同意する人（見ている人）の名前と役割 */
  yourName: string
  yourRole: string
  delivery: DeliveryLine[]
}

// ── 自分（I） ────────────────────────────────────────────

export type MeView = {
  viewer: PersonRef
  drafts: { id: Id | null; title: string; note: string }[]
  contributions: { title: string; roleLabel: string }[]
  /** 採用されなかった送り物 */
  notAdopted: { title: string; statusLabel: string }[]
  listenLater: { songId: Id; title: string; byline: string }[]
}

export type PublicProfileView = {
  holderId: Id
  displayName: string
  /** 名前の下に出す役割の札 */
  roleLabels: string[]
  created: { songId: Id; title: string }[]
  joined: { title: string; roleLabel: string }[]
  usedIn: { songId: Id; title: string; note: string }[]
}

// ── ありがとう（C） ──────────────────────────────────────

export type GiftSettings = {
  /** 量の札。中央（TYP）の設定から来る */
  amounts: number[]
  balance: number
  /** 残高の古さ（「13時05分 時点」の中身） */
  balanceAtLabel: string
}

// ── 主催が公開する前の確認（G） ────────────────────────────

/** ①〜⑥ のステップ。済んだかは公開前の再検証（lib/domain）と下書きのデータから出す */
export type PublishStep = {
  key: string
  /** 画面に出す名前（例：④ 素材と元の歌） */
  label: string
  done: boolean
}

/** ⑥ 必要な同意の1行。主催は自分の分なので並べない */
export type PublishConsentLine = {
  holderId: Id
  name: string
  /** 同意済みか（公開前の再検証で、その人の分が満たされているか） */
  done: boolean
}

export type PublishView = {
  draftId: Id
  title: string
  hostName: string
  steps: PublishStep[]
  consents: PublishConsentLine[]
  /** 公開に進めるか＝公開前の再検証（revalidateForPublish）が通ったか */
  ready: boolean
  /** 進めない理由（設計書の文言）。ready のときは空 */
  blockedReasons: string[]
  /** 公開した後に見に行く歌の住所。見本では公開の書き込みをしないので、無ければ null */
  publishedSongId: Id | null
}

// ── ＋つくる ─────────────────────────────────────────────

export type CreateOption = {
  id: string
  label: string
  icon: IconName
  /** 進める始め方だけ href を持つ。null は準備中（reason を出す） */
  href: string | null
  reason?: string
}

// ── 読み口 ───────────────────────────────────────────────

export interface UiDataSource {
  /** 見本のデータで動いているか（画面が「見本のデータ」の札を出すのに使う） */
  readonly isSample: boolean

  /** 見ている人 */
  getViewer(): Promise<PersonRef>

  listHome(): Promise<HomeSection[]>

  getSong(id: Id): Promise<SongView | null>

  /** 参加した先の制作中の歌（公開された歌への参加は、新しい制作に入る＝U3）。無ければ null */
  getJoinDraftFor(songId: Id): Promise<DraftView | null>
  getDraft(id: Id): Promise<DraftView | null>

  listInbox(): Promise<InboxGroup[]>
  getConsent(id: Id): Promise<ConsentView | null>

  getMe(): Promise<MeView>
  getPublicProfile(holderId: Id): Promise<PublicProfileView | null>

  getGiftSettings(): Promise<GiftSettings>

  listCreateOptions(): Promise<CreateOption[]>

  /**
   * 主催が公開する前の確認（G）。公開前の再検証（revalidateForPublish・checkMaterials・
   * evaluateCoauthorConsent）の結果を、画面に出す形にして返す。無ければ null
   */
  getPublish(draftId: Id): Promise<PublishView | null>
}
