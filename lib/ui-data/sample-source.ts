// 見本の読み口。lib/preview/sample.ts の見本（正本の型のままのデータ）を、
// ★UTATANE の中核の決まり（lib/domain）の関数に通して、画面の読み口（port.ts）の形にする。
//
// ここで決まりから出す物（固定の値を持たない）：
// ・「自由に使えます／承認が必要／利用できません」＝ policyFor → effectiveMode
// ・「この歌が生まれた流れ」＝ traceVersionLineage
// ・「この歌をつくった人」＝ requiredContributionsOf → creditsOf（採用され表示対象の貢献だけ）
// ・「何を受け継げるか」＝ inheritCandidates（可否は上の effectiveMode の結果）
//
// ★ここは見本だけを扱う。本物とつなぐ便では、同じ形の別の読み口を作り、index.ts で差し替える。

import { effectiveMode, policyFor } from '@/lib/domain/permissions'
import { requiredContributionsOf, traceVersionLineage } from '@/lib/domain/lineage'
import type { Contribution, Id, Material, ReuseMode, Version } from '@/lib/domain/types'
import { creditsOf, inheritCandidates, recruitmentText } from '@/lib/preview/model'
import type { ContributionView, CreditLine, InheritCandidate, PersonRef, SongView } from '@/lib/preview/model'
import {
  CONSENTS,
  CREATE_OPTIONS,
  DRAFTS,
  GIFT,
  HOME,
  INBOX,
  ME,
  PROFILE,
  SAMPLE,
  VIEWER,
} from '@/lib/preview/sample'
import type { SampleData, SampleRoleKind } from '@/lib/preview/sample'
import type {
  ConsentView,
  CreateOption,
  DraftView,
  GiftSettings,
  HomeSection,
  InboxGroup,
  MeView,
  PublicProfileView,
  UiDataSource,
} from './port'

/** 共作で作者ごとに希望が違うときは、いちばん厳しい可否を出す（安全側） */
const MODE_RANK: Record<ReuseMode, number> = { free: 0, approval: 1, forbidden: 2 }
function strictest(modes: ReuseMode[]): ReuseMode {
  return modes.reduce((a, b) => (MODE_RANK[b] > MODE_RANK[a] ? b : a), 'free' as ReuseMode)
}

/** 生まれた流れの行に付ける印。役割の性質から出す（画面で固定しない） */
const NATURE_ICON = {
  work: 'pen',
  performance: 'mic',
  recording: 'note',
  finishing: 'note',
} as const satisfies Record<SampleRoleKind['nature'], SongView['lineage'][number]['icon']>

export function createSampleSource(data: SampleData): UiDataSource {
  const holders = new Map<Id, PersonRef>(data.holders.map((h) => [h.holderId, h]))
  const roleKinds = new Map<Id, SampleRoleKind>(data.roleKinds.map((r) => [r.id, r]))
  const contributions = new Map<Id, Contribution>(data.contributions.map((c) => [c.id, c]))
  const materials = new Map<Id, Material>(data.materials.map((m) => [m.id, m]))
  const versions = new Map<Id, Version>(data.versions.map((v) => [v.id, v]))
  const songByVersion = new Map<Id, SampleData['songs'][number]>(data.songs.map((s) => [s.versionId, s]))
  const hidden = new Set<Id>(data.hiddenContributionIds)
  const viewer = holders.get(data.viewerHolderId) ?? VIEWER

  const personOf = (id: Id): PersonRef => holders.get(id) ?? { holderId: id, displayName: id }
  const roleOf = (id: Id): SampleRoleKind =>
    roleKinds.get(id) ?? { id, nature: 'work', roleLabel: id, assetLabel: id }

  /** ★可否は正本の関数から出す（固定の値を持たない） */
  const modeOf = (contributionId: Id, holderIds: Id[]): ReuseMode =>
    strictest(
      holderIds.map((h) => effectiveMode(policyFor(data.reusePolicies, contributionId, h, data.now), viewer.holderId)),
    )

  const viewOf = (c: Contribution): ContributionView => {
    const role = roleOf(c.roleKindId)
    return {
      id: c.id,
      roleKindId: c.roleKindId,
      roleLabel: role.roleLabel,
      assetLabel: role.assetLabel,
      holders: c.holderIds.map(personOf),
      state: 'adopted',
      visible: !hidden.has(c.id),
      reuseMode: modeOf(c.id, c.holderIds),
    }
  }

  /** その Version が使う貢献（直接の参照＋素材が収める貢献）＝正本の requiredContributionsOf */
  const adoptedOf = (version: Version): ContributionView[] =>
    Array.from(requiredContributionsOf(version, materials).keys())
      .map((id) => contributions.get(id))
      .filter((c): c is Contribution => c !== undefined)
      .map(viewOf)

  /** まだ採用されていない送り物。Contribution ではないので、設定が無いときの初期値で出す */
  const submissionsOf = (version: Version): ContributionView[] =>
    data.submissions
      .filter((s) => s.versionId === version.id)
      .map((s) => {
        const role = roleOf(s.roleKindId)
        return {
          id: s.id,
          roleKindId: s.roleKindId,
          roleLabel: role.roleLabel,
          assetLabel: role.assetLabel,
          holders: s.holderIds.map(personOf),
          state: s.state,
          visible: true,
          reuseMode: effectiveMode(null, viewer.holderId),
        }
      })

  const titleOfVersion = (versionId: Id): string | null => songByVersion.get(versionId)?.title ?? null
  const nameList = (holderIds: Id[]) => holderIds.map((h) => `${personOf(h).displayName}さん`).join('・')

  /** この歌が受け継いだ物（生まれた流れ）＝正本の traceVersionLineage。この Version で生まれた物は除く */
  const lineageOf = (version: Version): SongView['lineage'] =>
    traceVersionLineage(version, materials, data.derivations)
      .filter((e) => contributions.get(e.contributionId)?.birthVersionId !== version.id)
      .sort((a, b) => a.generation - b.generation)
      .map((e) => {
        const c = contributions.get(e.contributionId) as Contribution
        const role = roleOf(c.roleKindId)
        const from = titleOfVersion(c.birthVersionId)
        const where = from ? `「${from}」の` : ''
        return {
          label: `${where}${nameList(c.holderIds)}の${role.assetLabel}を受け継いだ`,
          icon: e.generation === 0 ? NATURE_ICON[role.nature] : ('branch' as const),
        }
      })

  /** 元の歌（受け継いで生まれた歌のとき）。この Version が参照した、よそで生まれた貢献から出す */
  const grownFromOf = (version: Version): SongView['grownFrom'] => {
    const borrowed = version.contributions
      .filter((vc) => vc.relation === 'referenced')
      .map((vc) => contributions.get(vc.contributionId))
      .filter((c): c is Contribution => c !== undefined && c.birthVersionId !== version.id)
    if (borrowed.length === 0) return undefined
    const parentVersionId = borrowed[0].birthVersionId
    const parent = songByVersion.get(parentVersionId)
    if (!parent) return undefined
    const inherited = borrowed
      .filter((c) => c.birthVersionId === parentVersionId)
      .map((c) => roleOf(c.roleKindId).assetLabel)
      .join('・')
    return { songId: parent.id, title: parent.title, inherited }
  }

  /** この歌から生まれた歌＝ほかの Version の由来に、この Version で生まれた貢献が出てくる物 */
  const childrenOf = (version: Version): SongView['children'] =>
    data.versions
      .filter((v) => v.id !== version.id)
      .map((v) => {
        const taken = traceVersionLineage(v, materials, data.derivations)
          .map((e) => contributions.get(e.contributionId))
          .filter((c): c is Contribution => c !== undefined && c.birthVersionId === version.id)
        return { v, taken }
      })
      .filter((x) => x.taken.length > 0)
      .sort((a, b) => String(a.v.publishedAt ?? '').localeCompare(String(b.v.publishedAt ?? '')))
      .map(({ v, taken }) => {
        const song = songByVersion.get(v.id)
        const open = (data.publicationStates[v.id] ?? 'public') === 'public' && Boolean(song)
        return {
          songId: open && song ? song.id : null,
          title: open && song ? song.title : '',
          inherited: open ? `${taken.map((c) => roleOf(c.roleKindId).assetLabel).join('・')}を受け継いだ` : '',
          visible: open,
        }
      })

  const bylineOf = (credits: CreditLine[]): string => {
    if (credits.length === 0) return ''
    return credits.length === 1 ? credits[0].name : `${credits[0].name} ほか${credits.length - 1}人`
  }

  const cache = new Map<Id, SongView | null>()

  const buildSong = (songId: Id): SongView | null => {
    const song = data.songs.find((s) => s.id === songId)
    if (!song) return null
    const version = versions.get(song.versionId)
    if (!version) return null
    const adopted = adoptedOf(version)
    const credits: CreditLine[] = creditsOf(adopted)
    const inherit: InheritCandidate[] = inheritCandidates(adopted)
    return {
      id: song.id,
      title: song.title,
      hostName: personOf(version.hostHolderId).displayName,
      byline: bylineOf(credits),
      published: version.publishedAt !== null,
      about: song.about,
      contributions: [...adopted, ...submissionsOf(version)],
      recruitment: song.recruitmentRoleKindIds
        ? {
            hostName: personOf(version.hostHolderId).displayName,
            roles: song.recruitmentRoleKindIds.map((id) => ({ roleKindId: id, roleLabel: roleOf(id).roleLabel })),
          }
        : null,
      gift: { ...song.gift },
      grownFrom: grownFromOf(version),
      children: childrenOf(version),
      lineage: lineageOf(version),
      credits,
      inherit,
    }
  }

  const songOf = (songId: Id): SongView | null => {
    if (!cache.has(songId)) cache.set(songId, buildSong(songId))
    return cache.get(songId) ?? null
  }

  /** 「参加できる歌」の段だけ、募集中の役割を2段目に出す */
  const homeNote = (songId: Id, recruitNote: boolean): string => {
    const song = songOf(songId)
    if (!song) return ''
    if (!recruitNote) return song.byline
    const roles = recruitmentText(song.recruitment)
    return roles ? `募集中：${roles}` : ''
  }

  return {
    isSample: true,

    async getViewer(): Promise<PersonRef> {
      return viewer
    },

    async listHome(): Promise<HomeSection[]> {
      return HOME.map((sec) => ({
        key: sec.key,
        title: sec.title,
        icon: sec.icon,
        items: sec.songIds
          .filter((id) => songOf(id))
          .map((id) => ({
            songId: id,
            title: (songOf(id) as SongView).title,
            note: homeNote(id, 'recruitNote' in sec && sec.recruitNote === true),
          })),
      }))
    },

    async getSong(id: string): Promise<SongView | null> {
      return songOf(id)
    },

    async getJoinDraftFor(songId: string): Promise<DraftView | null> {
      const d = Object.values(DRAFTS).find((x) => x.parentSongId === songId)
      return d ? { ...d } : null
    },

    async getDraft(id: string): Promise<DraftView | null> {
      const d = DRAFTS[id as keyof typeof DRAFTS]
      return d ? { ...d } : null
    },

    async listInbox(): Promise<InboxGroup[]> {
      return INBOX.map((g) => ({
        key: g.key,
        title: g.title,
        items: g.consentIds
          .map((id) => CONSENTS[id as keyof typeof CONSENTS])
          .filter(Boolean)
          .map((c) => ({
            id: c.id,
            title: c.title,
            note: `${c.hostName}さんから。あなたの名前・届け方を確認して、公開に同意してください`,
            href: `/ui/inbox/consent/${encodeURIComponent(c.id)}#step-3`,
            icon: 'doc' as const,
          })),
      }))
    },

    async getConsent(id: string): Promise<ConsentView | null> {
      const c = CONSENTS[id as keyof typeof CONSENTS]
      if (!c) return null
      return {
        id: c.id,
        title: c.title,
        hostName: c.hostName,
        yourName: viewer.displayName,
        yourRole: c.yourRole,
        delivery: c.delivery.map((d) => ({ ...d })),
      }
    },

    async getMe(): Promise<MeView> {
      return {
        viewer,
        drafts: ME.drafts.map((d) => ({ ...d })),
        contributions: ME.contributions.map((x) => ({ ...x })),
        notAdopted: ME.notAdopted.map((x) => ({ ...x })),
        listenLater: ME.listenLater.map((x) => ({ ...x })),
      }
    },

    async getPublicProfile(holderId: string): Promise<PublicProfileView | null> {
      if (holderId !== viewer.holderId) return null
      return {
        holderId: viewer.holderId,
        displayName: viewer.displayName,
        roleLabels: [...PROFILE.roleLabels],
        created: PROFILE.created.map((x) => ({ ...(x as { songId: string; title: string }) })),
        joined: PROFILE.joined.map((x) => ({ ...x })),
        usedIn: PROFILE.usedIn.map((x) => ({ ...(x as { songId: string; title: string; note: string }) })),
      }
    },

    async getGiftSettings(): Promise<GiftSettings> {
      return { amounts: [...GIFT.amounts], balance: GIFT.balance, balanceAtLabel: GIFT.balanceAtLabel }
    },

    async listCreateOptions(): Promise<CreateOption[]> {
      return CREATE_OPTIONS.map((o) => ({ ...o }))
    },
  }
}

export const sampleSource: UiDataSource = createSampleSource(SAMPLE)
