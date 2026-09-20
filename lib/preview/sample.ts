// ★見本のデータ。UTATANE の中核（lib/domain）の正本の型のまま持つ。
//
// ここには「自由に使えます／承認が必要／利用できません」・生まれた流れ・つくった人を書かない。
// それらは決まりの結果なので、lib/ui-data/sample-source.ts が lib/domain の関数
// （effectiveMode・traceVersionLineage・requiredContributionsOf）から出す。
// 画面は「見本のデータ」の札を出す。本物とつなぐ便では lib/ui-data/index.ts を差し替える。
// 題名・人の名前は見本。見ている人＝そら（h-sora）。

import { hrefSong } from './model'
import type { SongView } from './model'
import type {
  Contribution,
  Derivation,
  Id,
  Material,
  PublicationState,
  ReusePolicyVersion,
  RoleKind,
  Timestamp,
  Version,
} from '@/lib/domain/types'

export { hrefSong }

// ── 見本の形（正本の型＋表示名だけ） ────────────────────────────

export type SampleHolder = { holderId: Id; displayName: string }

/** 役割の種類の表。役割は固定の一覧にしない＝表示名もデータで持つ */
export type SampleRoleKind = RoleKind & { roleLabel: string; assetLabel: string }

/** まだ採用されていない送り物。採用されるまで Contribution に確定しない（既存の決まり） */
export type SampleSubmission = {
  id: Id
  versionId: Id
  roleKindId: Id
  holderIds: Id[]
  state: 'submitted' | 'not_adopted'
}

export type SampleSong = {
  id: Id
  versionId: Id
  title: string
  about: string
  /** 募集している役割。募集が無ければ null */
  recruitmentRoleKindIds: Id[] | null
  gift: SongView['gift']
}

export type SampleData = {
  viewerHolderId: Id
  /** 権利の可否をどの時点で見るか（ポリシーの版の選び方に効く） */
  now: Timestamp
  holders: SampleHolder[]
  roleKinds: SampleRoleKind[]
  contributions: Contribution[]
  derivations: Derivation[]
  materials: Material[]
  versions: Version[]
  reusePolicies: ReusePolicyVersion[]
  /** 表示の対象から外れた貢献（非公開の申し出・外してほしい申請など） */
  hiddenContributionIds: Id[]
  /** Version の公開状態。載っていない Version は 'public' */
  publicationStates: Record<Id, PublicationState>
  submissions: SampleSubmission[]
  songs: SampleSong[]
}

// ── 人 ────────────────────────────────────────────────────

const HOLDERS: SampleHolder[] = [
  { holderId: 'h-asahi', displayName: 'あさひ' },
  { holderId: 'h-minato', displayName: 'みなと' },
  { holderId: 'h-tsubasa', displayName: 'つばさ' },
  { holderId: 'h-riku', displayName: 'りく' },
  { holderId: 'h-hinata', displayName: 'ひなた' },
  { holderId: 'h-umi', displayName: 'うみ' },
  { holderId: 'h-sora', displayName: 'そら' },
]

export const VIEWER = { holderId: 'h-sora', displayName: 'そら' }

// ── 役割の種類 ─────────────────────────────────────────────

const ROLE_KINDS: SampleRoleKind[] = [
  { id: 'lyrics', nature: 'work', roleLabel: '歌詞', assetLabel: '歌詞' },
  { id: 'melody', nature: 'work', roleLabel: '作曲', assetLabel: '曲' },
  { id: 'arrangement', nature: 'work', roleLabel: '編曲', assetLabel: '編曲' },
  { id: 'vocal', nature: 'performance', roleLabel: 'ボーカル', assetLabel: 'ボーカル' },
  { id: 'guitar', nature: 'performance', roleLabel: 'ギター', assetLabel: 'ギター' },
  { id: 'piano', nature: 'performance', roleLabel: 'ピアノ', assetLabel: 'ピアノ' },
  { id: 'chorus', nature: 'performance', roleLabel: 'コーラス', assetLabel: 'コーラス' },
  { id: 'mix', nature: 'finishing', roleLabel: 'MIX', assetLabel: 'MIX' },
]

// ── 時点 ──────────────────────────────────────────────────

const T_YOAKE = '2026-01-10T00:00:00Z'
const T_MINATO = '2026-03-01T00:00:00Z'
const T_FUTATABI = '2026-05-01T00:00:00Z'
const T_FUTARI = '2026-06-01T00:00:00Z'
const T_HIMITSU = '2026-07-01T00:00:00Z'
const NOW = '2026-09-20T00:00:00Z'

// ── 貢献 ──────────────────────────────────────────────────

const c = (id: Id, roleKindId: Id, holderIds: Id[], birthVersionId: Id, createdAt: Timestamp): Contribution => ({
  id,
  roleKindId,
  holderIds,
  birthVersionId,
  createdAt,
})

const CONTRIBUTIONS: Contribution[] = [
  c('c4-lyrics', 'lyrics', ['h-hinata'], 'v-yoake', T_YOAKE),
  c('c-lyrics', 'lyrics', ['h-asahi'], 'v-minato', T_MINATO),
  c('c-melody', 'melody', ['h-asahi'], 'v-minato', T_MINATO),
  c('c-vocal', 'vocal', ['h-minato'], 'v-minato', T_MINATO),
  c('c-guitar', 'guitar', ['h-tsubasa'], 'v-minato', T_MINATO),
  c('c-mix', 'mix', ['h-riku'], 'v-minato', T_MINATO),
  c('c2-vocal', 'vocal', ['h-umi'], 'v-futatabi', T_FUTATABI),
  c('c2-piano', 'piano', ['h-riku'], 'v-futatabi', T_FUTATABI),
  c('c3-arrange', 'arrangement', ['h-umi'], 'v-futari', T_FUTARI),
  c('c3-piano', 'piano', ['h-umi'], 'v-futari', T_FUTARI),
]

/** 由来（子 → 親）。「港の灯り」の歌詞は「夜明けのうた」の歌詞を元にしている */
const DERIVATIONS: Derivation[] = [{ childId: 'c-lyrics', parentId: 'c4-lyrics', kind: 'modified_from' }]

// ── Version ───────────────────────────────────────────────

const VERSIONS: Version[] = [
  {
    id: 'v-yoake',
    hostHolderId: 'h-hinata',
    publishedAt: T_YOAKE,
    contributions: [{ contributionId: 'c4-lyrics', relation: 'created' }],
    materialIds: [],
  },
  {
    id: 'v-minato',
    hostHolderId: 'h-asahi',
    publishedAt: T_MINATO,
    contributions: [
      { contributionId: 'c-lyrics', relation: 'created' },
      { contributionId: 'c-melody', relation: 'created' },
      { contributionId: 'c-vocal', relation: 'created' },
      { contributionId: 'c-guitar', relation: 'created' },
      { contributionId: 'c-mix', relation: 'created' },
    ],
    materialIds: [],
  },
  {
    id: 'v-futatabi',
    hostHolderId: 'h-tsubasa',
    publishedAt: T_FUTATABI,
    contributions: [
      { contributionId: 'c-guitar', relation: 'referenced' },
      { contributionId: 'c2-vocal', relation: 'created' },
      { contributionId: 'c2-piano', relation: 'created' },
    ],
    materialIds: [],
  },
  {
    id: 'v-futari',
    hostHolderId: 'h-minato',
    publishedAt: T_FUTARI,
    contributions: [
      { contributionId: 'c-vocal', relation: 'referenced' },
      { contributionId: 'c3-arrange', relation: 'created' },
      { contributionId: 'c3-piano', relation: 'created' },
    ],
    materialIds: [],
  },
  // 「港の灯り」から生まれたが、いまは見られない歌（公開状態が private）
  {
    id: 'v-himitsu',
    hostHolderId: 'h-umi',
    publishedAt: T_HIMITSU,
    contributions: [{ contributionId: 'c-melody', relation: 'referenced' }],
    materialIds: [],
  },
]

// ── 再利用の設定（貢献の現在のポリシー・版つき） ──────────────────
// ★「利用できません」は mode ではなく scope（この Version だけ）から出る。
//   固定の対応表ではなく effectiveMode が畳む（lib/domain/permissions.ts）。

const policy = (
  contributionId: Id,
  mode: ReusePolicyVersion['mode'],
  scope: ReusePolicyVersion['scope'],
  effectiveAt: Timestamp,
): ReusePolicyVersion => ({ contributionId, holderId: null, versionNo: 1, mode, scope, effectiveAt })

const REUSE_POLICIES: ReusePolicyVersion[] = [
  policy('c4-lyrics', 'free', 'any_version', T_YOAKE),
  policy('c-lyrics', 'free', 'any_version', T_MINATO),
  policy('c-melody', 'approval', 'any_version', T_MINATO),
  policy('c-vocal', 'approval', 'any_version', T_MINATO),
  policy('c-guitar', 'free', 'any_version', T_MINATO),
  // りくさんの MIX は「この Version だけ」＝ほかの Version からは利用できません
  policy('c-mix', 'free', 'this_version_only', T_MINATO),
  policy('c2-vocal', 'approval', 'any_version', T_FUTATABI),
  policy('c2-piano', 'free', 'any_version', T_FUTATABI),
  policy('c3-arrange', 'free', 'any_version', T_FUTARI),
  // c3-piano は設定が無い＝初期値（申請→承認・DEFAULT_REUSE_MODE）が効く
]

// ── 送り物（採用前） ───────────────────────────────────────

const SUBMISSIONS: SampleSubmission[] = [
  { id: 's-chorus', versionId: 'v-minato', roleKindId: 'chorus', holderIds: ['h-hinata'], state: 'not_adopted' },
]

// ── 歌（画面に出す題名・説明・募集・ありがとう） ─────────────────

const noGiftIssue: SongView['gift'] = {
  ruleEstablished: true,
  selfIsParticipant: false,
  selfIsRecipient: false,
  receivableCount: 4,
  unreceivableCount: 0,
  pendingResult: false,
}

const SONG_LIST: SampleSong[] = [
  {
    id: 'minato',
    versionId: 'v-minato',
    title: '港の灯り',
    about: '港町の夜を歌った歌です。',
    recruitmentRoleKindIds: ['guitar', 'chorus'],
    gift: noGiftIssue,
  },
  {
    id: 'futatabi',
    versionId: 'v-futatabi',
    title: '灯り、ふたたび',
    about: '「港の灯り」のギターを受け継いで生まれた歌です。',
    recruitmentRoleKindIds: null,
    gift: { ...noGiftIssue, receivableCount: 2, unreceivableCount: 1 },
  },
  {
    id: 'futari',
    versionId: 'v-futari',
    title: '港の灯り（ふたりで）',
    about: '「港の灯り」のボーカルを受け継いで生まれた歌です。',
    recruitmentRoleKindIds: null,
    gift: noGiftIssue,
  },
  {
    id: 'yoake',
    versionId: 'v-yoake',
    title: '夜明けのうた',
    about: '歌詞だけの種です。',
    // 募集が1つの歌（何で参加するかの選択を省く見本）
    recruitmentRoleKindIds: ['melody'],
    gift: { ...noGiftIssue, receivableCount: 1 },
  },
]

/** ★見本の正本。ここから先は lib/ui-data/sample-source.ts が決まりの関数で画面の形にする。 */
export const SAMPLE: SampleData = {
  viewerHolderId: VIEWER.holderId,
  now: NOW,
  holders: HOLDERS,
  roleKinds: ROLE_KINDS,
  contributions: CONTRIBUTIONS,
  derivations: DERIVATIONS,
  materials: [],
  versions: VERSIONS,
  reusePolicies: REUSE_POLICIES,
  hiddenContributionIds: [],
  publicationStates: { 'v-himitsu': 'private' },
  submissions: SUBMISSIONS,
  songs: SONG_LIST,
}

// ── 画面の読み口（lib/ui-data）に渡す見本（決まりの外の物） ─────────
// ここから下は、これまで画面の中に直に書いていた見本を、データとして出した物。

/** 制作中の歌（参加した先）。公開された歌への参加は、その歌を元にした新しい制作中の歌に入る（U3）。 */
export const DRAFTS = {
  'minato-join': {
    id: 'minato-join',
    title: '港の灯り',
    titleNote: '元の題名から始まります。主催が変えることがあります。',
    hostName: 'あさひ',
    parentSongId: 'minato',
  },
  'yoake-join': {
    id: 'yoake-join',
    title: '夜明けのうた',
    titleNote: '元の題名から始まります。主催が変えることがあります。',
    hostName: 'ひなた',
    parentSongId: 'yoake',
  },
} as const

/** 参加した先の制作中の歌（公開された歌への参加は、その歌を元にした新しい制作に入る＝U3） */
export function joinDraftFor(songId: string) {
  return Object.values(DRAFTS).find((d) => d.parentSongId === songId) ?? null
}

/** 対応待ち（公開する前の確認のお願い） */
export const CONSENTS = {
  ame: {
    id: 'ame',
    title: '雨のあとで',
    hostName: 'うみ',
    yourRole: 'ボーカル',
    delivery: [
      { name: 'うみ', role: '作曲', note: '主催の案' },
      { name: 'そら', role: 'ボーカル', note: '主催の案' },
      { name: 'あさひ', role: '歌詞', note: '使わせてくれた時に同意済み' },
    ],
  },
} as const

/** ホームの段（W1）。段の順と、どの歌を載せるかも見本。 */
export const HOME = [
  { key: 'seed', title: '種', icon: 'seed', songIds: ['yoake'] },
  { key: 'join', title: '参加できる歌', icon: 'join', songIds: ['minato', 'yoake'], recruitNote: true },
  { key: 'branch', title: '枝分かれ', icon: 'branch', songIds: ['futatabi'] },
  { key: 'newVersion', title: '新しい Version', icon: 'newVersion', songIds: ['futari'] },
] as const

/** 対応待ち（M8）。公開する前の確認のお願い以外は、まだ見本を置かない。 */
export const INBOX = [
  { key: 'consent', title: '公開する前の確認のお願い', consentIds: ['ame'] },
  { key: 'join', title: '参加希望', consentIds: [] },
  { key: 'submission', title: '送られた歌の確認', consentIds: [] },
  { key: 'permission', title: '使わせてのお願い', consentIds: [] },
] as const

/** 自分の管理画面（I）。★TYポイント・TYP の残高と入口は置かない（941be1bd）。 */
export const ME = {
  drafts: [{ id: null, title: '「港の灯り」から育てた歌', note: 'まだ誰にも公開されていません' }],
  contributions: [{ title: '雨のあとで', roleLabel: 'ボーカル' }],
  notAdopted: [{ title: 'コーラス 別案（港の灯り）', statusLabel: '今回は見送られました' }],
  listenLater: [{ songId: 'minato', title: '港の灯り', byline: 'あさひ ほか3人' }],
} as const

/** 公開プロフィール（M9）。ほかの人から見える形。 */
export const PROFILE = {
  roleLabels: ['ボーカル'],
  created: [],
  joined: [{ title: '雨のあとで', roleLabel: 'ボーカル' }],
  usedIn: [],
} as const

/** ありがとうの量の札・残高（仮の形：本物は中央の設定と TYP の口から読む）。 */
export const GIFT = {
  amounts: [100, 300, 500],
  balance: 1200,
  balanceAtLabel: '13時05分 時点',
} as const

/** ＋つくる（何から始めますか）。進めるのは「今ある歌から育てる」だけ。 */
export const CREATE_OPTIONS = [
  { id: 'hum', label: '音・鼻歌から始める', icon: 'mic', href: null, reason: 'この始め方は、まだ準備中です。' },
  { id: 'lyrics', label: '歌詞から始める', icon: 'pen', href: null, reason: 'この始め方は、まだ準備中です。' },
  { id: 'upload', label: '音源を投稿する', icon: 'note', href: null, reason: 'この始め方は、まだ準備中です。' },
  { id: 'grow', label: '今ある歌から育てる', icon: 'branch', href: `${hrefSong('minato')}/tree` },
] as const
