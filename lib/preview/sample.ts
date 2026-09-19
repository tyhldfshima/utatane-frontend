// ★仮の形：UTATANE 本体のデータ（Version・Contribution・募集・公開同意・申請）とつなぐまでの見本。
// 画面は「見本のデータ」の札を出す。つなぐ便（PR #4〜#6 の合流の後）で、この読み込みを本物に差し替える。
// 題名・人の名前は見本。見ている人＝そら（h-sora）。

import type { ContributionView, SongView } from './model'

const p = (holderId: string, displayName: string) => ({ holderId, displayName })
const ASAHI = p('h-asahi', 'あさひ')
const MINATO = p('h-minato', 'みなと')
const TSUBASA = p('h-tsubasa', 'つばさ')
const RIKU = p('h-riku', 'りく')
const HINATA = p('h-hinata', 'ひなた')
const UMI = p('h-umi', 'うみ')
const SORA = p('h-sora', 'そら')

export const VIEWER = SORA

const c = (
  id: string,
  roleKindId: string,
  roleLabel: string,
  assetLabel: string,
  holders: ContributionView['holders'],
  reuseMode: ContributionView['reuseMode'],
  state: ContributionView['state'] = 'adopted',
  visible = true,
): ContributionView => ({ id, roleKindId, roleLabel, assetLabel, holders, reuseMode, state, visible })

const noGiftIssue = {
  ruleEstablished: true,
  selfIsParticipant: false,
  selfIsRecipient: false,
  receivableCount: 4,
  unreceivableCount: 0,
  pendingResult: false,
}

export const SONGS: Record<string, SongView> = {
  // 募集あり・役割が複数の人・作曲と演奏の人がいる歌
  minato: {
    id: 'minato',
    title: '港の灯り',
    hostName: 'あさひ',
    byline: 'あさひ ほか3人',
    published: true,
    about: '港町の夜を歌った歌です。',
    contributions: [
      c('c-lyrics', 'lyrics', '歌詞', '歌詞', [ASAHI], 'free'),
      c('c-melody', 'melody', '作曲', '曲', [ASAHI], 'approval'),
      c('c-vocal', 'vocal', 'ボーカル', 'ボーカル', [MINATO], 'approval'),
      c('c-guitar', 'guitar', 'ギター', 'ギター', [TSUBASA], 'free'),
      c('c-mix', 'mix', 'MIX', 'MIX', [RIKU], 'forbidden'),
      // 採用されなかった提出物は出さない
      c('c-chorus-draft', 'chorus', 'コーラス', 'コーラス', [HINATA], 'approval', 'not_adopted'),
    ],
    recruitment: {
      hostName: 'あさひ',
      roles: [
        { roleKindId: 'guitar', roleLabel: 'ギター' },
        { roleKindId: 'chorus', roleLabel: 'コーラス' },
      ],
    },
    gift: noGiftIssue,
    children: [
      { songId: 'futari', title: '港の灯り（ふたりで）', inherited: 'ボーカルを受け継いだ', visible: true },
      { songId: 'futatabi', title: '灯り、ふたたび', inherited: 'ギターを受け継いだ', visible: true },
      { songId: null, title: '', inherited: '', visible: false },
    ],
    lineage: [
      { label: 'あさひさんの歌詞から', icon: 'pen' },
      { label: '「夜明けのうた」の歌から育った', icon: 'branch' },
    ],
  },
  // 募集なし・受け取れない方がいる（Y4 暫定で贈れない）
  futatabi: {
    id: 'futatabi',
    title: '灯り、ふたたび',
    hostName: 'つばさ',
    byline: 'つばさ ほか2人',
    published: true,
    about: '「港の灯り」のギターを受け継いで生まれた歌です。',
    contributions: [
      c('c2-guitar', 'guitar', 'ギター', 'ギター', [TSUBASA], 'free'),
      c('c2-vocal', 'vocal', 'ボーカル', 'ボーカル', [UMI], 'approval'),
      c('c2-piano', 'piano', 'ピアノ', 'ピアノ', [RIKU], 'free'),
    ],
    recruitment: null,
    gift: { ...noGiftIssue, receivableCount: 2, unreceivableCount: 1 },
    grownFrom: { songId: 'minato', title: '港の灯り', inherited: 'ギター' },
    children: [],
    lineage: [{ label: '「港の灯り」のギターを受け継いだ', icon: 'branch' }],
  },
  // 育った歌
  futari: {
    id: 'futari',
    title: '港の灯り（ふたりで）',
    hostName: 'みなと',
    byline: 'みなと ほか1人',
    published: true,
    about: '「港の灯り」のボーカルを受け継いで生まれた歌です。',
    contributions: [
      c('c3-vocal', 'vocal', 'ボーカル', 'ボーカル', [MINATO], 'approval'),
      c('c3-arrange', 'arrangement', '編曲', '編曲', [UMI], 'free'),
      c('c3-piano', 'piano', 'ピアノ', 'ピアノ', [UMI], 'free'),
    ],
    recruitment: null,
    gift: noGiftIssue,
    grownFrom: { songId: 'minato', title: '港の灯り', inherited: 'ボーカル' },
    children: [],
    lineage: [{ label: '「港の灯り」のボーカルを受け継いだ', icon: 'branch' }],
  },
  // 歌詞だけの種（作曲の人を足さない）
  yoake: {
    id: 'yoake',
    title: '夜明けのうた',
    hostName: 'ひなた',
    byline: 'ひなた',
    published: true,
    about: '歌詞だけの種です。',
    contributions: [c('c4-lyrics', 'lyrics', '歌詞', '歌詞', [HINATA], 'free')],
    // 募集が1つの歌（何で参加するかの選択を省く見本）
    recruitment: {
      hostName: 'ひなた',
      roles: [{ roleKindId: 'melody', roleLabel: '作曲' }],
    },
    gift: { ...noGiftIssue, receivableCount: 1 },
    children: [],
    lineage: [],
  },
}

export function findSong(id: string): SongView | null {
  return SONGS[id] ?? null
}

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

export function hrefSong(id: string) {
  return `/ui/songs/${encodeURIComponent(id)}`
}
