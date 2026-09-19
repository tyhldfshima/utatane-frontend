// 画面に出す形（UTATANE 本体のデータとつなぐまでの仮の形）。
// 決まった内部モデル（lib/domain/types.ts）の言葉を使い、画面に出す物だけを持つ。
// ★役割は固定の一覧にしない（roleKindId と表示名をデータから持つ）。

import type { Id, ReuseMode } from '@/lib/domain/types'

export type PersonRef = { holderId: Id; displayName: string }

/** 貢献の状態。提出物は採用されるまで Contribution に確定しない（既存の決まり）。 */
export type ContributionState = 'adopted' | 'submitted' | 'not_adopted'

export type ContributionView = {
  id: Id
  roleKindId: Id
  /** 役割の表示名（種類の表から引く。画面で固定しない） */
  roleLabel: string
  /** 受け継ぐときに見せる物の名前（例：歌詞・曲・ボーカル） */
  assetLabel: string
  holders: PersonRef[]
  state: ContributionState
  /** 表示の対象か（非公開の申し出・外してほしい申請などで外れる） */
  visible: boolean
  /** ほかの人に使ってもらう時の希望 */
  reuseMode: ReuseMode
}

export type RecruitmentView = {
  /** 募集している人（主催） */
  hostName: string
  roles: { roleKindId: Id; roleLabel: string }[]
}

export type SongView = {
  id: Id
  title: string
  hostName: string
  byline: string
  /** 公開済みか（公開前は制作中の歌） */
  published: boolean
  contributions: ContributionView[]
  /** 募集が無ければ null（参加のカードを出さない） */
  recruitment: RecruitmentView | null
  /** ありがとうの出し分けに使う（giftGate の入力） */
  gift: {
    ruleEstablished: boolean
    selfIsParticipant: boolean
    selfIsRecipient: boolean
    receivableCount: number
    unreceivableCount: number
    pendingResult: boolean
  }
  /** 育った歌なら、元の歌と受け継いだ物 */
  grownFrom?: { songId: Id; title: string; inherited: string }
  /** この歌から生まれた歌 */
  children: { songId: Id | null; title: string; inherited: string; visible: boolean }[]
  /** この歌が受け継いだ物（生まれた流れ） */
  lineage: { label: string; icon: 'pen' | 'branch' | 'note' | 'mic' }[]
  about: string
}

// ── この歌をつくった人 ─────────────────────────────────────

export type CreditLine = { holderId: Id; name: string; roles: string[] }

/**
 * 「この歌をつくった人」（えふさん確定 ①）。
 * そのVersionで採用され、表示対象になっている Contribution だけから作る。人物を足したり推し量ったりしない。
 * 同じ人が複数の役割なら1行にまとめる（例：あさひさん　歌詞・作曲）。
 */
export function creditsOf(contributions: ContributionView[]): CreditLine[] {
  const lines: CreditLine[] = []
  for (const c of contributions) {
    if (c.state !== 'adopted' || !c.visible) continue
    for (const h of c.holders) {
      const line = lines.find((l) => l.holderId === h.holderId)
      if (line) {
        if (!line.roles.includes(c.roleLabel)) line.roles.push(c.roleLabel)
      } else {
        lines.push({ holderId: h.holderId, name: h.displayName, roles: [c.roleLabel] })
      }
    }
  }
  return lines
}

export function creditText(line: CreditLine): string {
  return `${line.name}さん　${line.roles.join('・')}`
}

// ── 参加（募集） ──────────────────────────────────────────

/** 募集中の役割の表示（例：ギター・コーラス）。募集が無い・役割が無いときは null（カードを出さない）。 */
export function recruitmentText(r: RecruitmentView | null): string | null {
  if (!r || r.roles.length === 0) return null
  return r.roles.map((x) => x.roleLabel).join('・')
}

// ── 新しい Version として育てる：何を受け継ぐか ──────────────────

export const REUSE_LABEL: Record<ReuseMode, string> = {
  free: '自由に使えます',
  approval: '承認が必要',
  forbidden: '利用できません',
}

export type InheritCandidate = {
  id: Id
  label: string
  mode: ReuseMode
  statusLabel: string
  /** 「利用できません」は選べない */
  selectable: boolean
}

/**
 * 元の Version に実在する、採用済み・表示対象の Contribution だけを候補にする（えふさん確定 ⑤）。
 * 「詞・曲・歌声」を固定の項目にしない。
 */
export function inheritCandidates(song: SongView): InheritCandidate[] {
  return song.contributions
    .filter((c) => c.state === 'adopted' && c.visible)
    .map((c) => ({
      id: c.id,
      label: `${c.holders.map((h) => `${h.displayName}さん`).join('・')}の${c.assetLabel}`,
      mode: c.reuseMode,
      statusLabel: REUSE_LABEL[c.reuseMode],
      selectable: c.reuseMode !== 'forbidden',
    }))
}

/** 選んだ物を「そのまま使える物」と「承認が必要な物」に分ける。利用できない物は選ばれても捨てる。 */
export function splitSelection(candidates: InheritCandidate[], selectedIds: string[]) {
  const picked = candidates.filter((c) => selectedIds.includes(c.id) && c.selectable)
  return {
    free: picked.filter((c) => c.mode === 'free'),
    needsApproval: picked.filter((c) => c.mode === 'approval'),
  }
}

/**
 * 今回あなたは何を加えますか（えふさん確定 ⑥）。最初は大きな区分だけ。役割の全部をここで決めさせない。
 * ★あとから Contribution を追加・募集できる。
 */
export const ADD_OPTIONS = [
  { id: 'lyrics', label: '作詞' },
  { id: 'melody', label: '作曲' },
  { id: 'vocal', label: '歌唱' },
  { id: 'performance', label: '演奏' },
  { id: 'other', label: 'その他' },
] as const
