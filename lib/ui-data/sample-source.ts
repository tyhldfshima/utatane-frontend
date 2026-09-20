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
import { checkMaterials, revalidateForPublish } from '@/lib/domain/publish'
import type { MaterialIssue } from '@/lib/domain/publish'
import type {
  CoauthorApprovalMethod,
  Contribution,
  Id,
  Material,
  ProvenanceKind,
  ReuseMode,
  Version,
} from '@/lib/domain/types'
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
  DeclareProvenanceInput,
  PermissionAskItem,
  PermissionAskView,
  RequestPermissionInput,
  DraftMaterialView,
  DraftMaterialsView,
  DraftView,
  GiftSettings,
  HomeSection,
  InboxGroup,
  MeView,
  PublicProfileView,
  PublishConsentLine,
  PublishStep,
  PublishView,
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
  // ★申告の保存で見本の正本を書き換えないよう、読み口ごとの写しを持つ
  const materials = new Map<Id, Material>(data.materials.map((m) => [m.id, { ...m }]))
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
      // ★公開前の下書きは、まだ「生まれた歌」ではない
      .filter((v) => v.id !== version.id && v.publishedAt !== null)
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

  // ── 主催が公開する前の確認（G） ────────────────────────
  // ★止まる理由も、ステップの「済」も、正本の関数（revalidateForPublish・checkMaterials・
  //   evaluateCoauthorConsent）の結果から出す。画面に固定で書かない。

  const STEP_MATERIALS = '④ 素材と元の歌'

  const buildPublish = (draftId: Id): PublishView | null => {
    const draft = data.publishDrafts.find((d) => d.id === draftId)
    if (!draft) return null
    const version = versions.get(draft.versionId)
    if (!version || version.publishedAt !== null) return null

    const check = revalidateForPublish(
      version,
      {
        contributions,
        materials,
        policies: data.reusePolicies,
        permissions: data.permissions,
        coauthorMethods: new Map<Id, CoauthorApprovalMethod>(),
        rule: data.permissionRule,
      },
      data.now,
    )
    const materialIssues = checkMaterials(version, materials)

    // ⑥ 必要な同意（主催は自分の分なので並べない）。1つでも足りない物があれば「まだ」
    const lines = new Map<Id, PublishConsentLine>()
    for (const item of check.items) {
      const c = contributions.get(item.contributionId)
      if (!c) continue
      for (const holder of c.holderIds) {
        if (holder === version.hostHolderId) continue
        const done = !item.missingHolderIds.includes(holder)
        const before = lines.get(holder)
        if (before) before.done = before.done && done
        else lines.set(holder, { holderId: holder, name: personOf(holder).displayName, done })
      }
    }

    // 止まる理由（設計書の文言）
    const reasons: string[] = []
    if (materialIssues.length > 0) reasons.push(`${STEP_MATERIALS} がまだ済んでいません。`)
    for (const item of check.items) {
      if (item.ok) continue
      const c = contributions.get(item.contributionId)
      if (!c) continue
      const asset = roleOf(c.roleKindId).assetLabel
      for (const holder of item.missingHolderIds) {
        const name = personOf(holder).displayName
        const line =
          item.reason === 'policy_forbidden'
            ? `${name}さんの${asset}は利用できません。`
            : `${name}さんの同意を待っています。`
        if (!reasons.includes(line)) reasons.push(line)
      }
    }

    const createdHere = version.contributions
      .filter((vc) => vc.relation === 'created')
      .map((vc) => vc.contributionId)
    const steps: PublishStep[] = [
      { key: 'sound', label: '① 音', done: version.materialIds.length > 0 },
      { key: 'credits', label: '② クレジット', done: creditsOf(adoptedOf(version)).length > 0 },
      // ★③ 届け方は中央（Revenue Rule・受取人）の担当で、lib/domain に判定が無い
      { key: 'delivery', label: '③ 届け方', done: draft.deliveryReady },
      { key: 'materials', label: STEP_MATERIALS, done: materialIssues.length === 0 },
      {
        key: 'reuse',
        label: '⑤ 使ってもらう時の希望',
        done: createdHere.every((cid) =>
          (contributions.get(cid)?.holderIds ?? []).every(
            (h) => policyFor(data.reusePolicies, cid, h, data.now) !== null,
          ),
        ),
      },
      { key: 'publish', label: '⑥ 同意と公開', done: false },
    ]

    return {
      draftId: draft.id,
      title: draft.title,
      hostName: personOf(version.hostHolderId).displayName,
      steps,
      consents: Array.from(lines.values()),
      ready: check.passed,
      blockedReasons: reasons,
      publishedSongId: draft.publishedSongId,
    }
  }

  // ── ④ 素材と元の歌：出どころの申告 ──────────────────────
  // ★止まる理由は checkMaterials の結果から出す。画面に固定で書かない。

  const ISSUE_TEXT: Record<MaterialIssue['reason'], string> = {
    provenance_missing: '出どころが申告されていません。',
    source_material_missing: '元の素材が見つかりません。',
    source_contributions_not_embodied: '元の素材が収めている貢献を、すべて収めていません。',
  }

  const materialLabel = (id: Id): string => data.materialLabels[id] ?? id
  const kindLabel = (kind: ProvenanceKind): string | null =>
    data.provenanceKinds.find((k) => k.id === kind)?.label ?? null

  const buildDraftMaterials = (draftId: Id): DraftMaterialsView | null => {
    const draft = data.publishDrafts.find((d) => d.id === draftId)
    if (!draft) return null
    const version = versions.get(draft.versionId)
    if (!version || version.publishedAt !== null) return null

    const issues = checkMaterials(version, materials)
    const rows: DraftMaterialView[] = version.materialIds.map((mid) => {
      const m = materials.get(mid)
      const issue = issues.find((x) => x.materialId === mid)
      const source = m?.provenance?.sourceMaterialId
      return {
        id: mid,
        label: materialLabel(mid),
        declaredLabel: m?.provenance ? kindLabel(m.provenance.kind) : null,
        sourceLabel: source ? materialLabel(source) : null,
        issue: issue ? ISSUE_TEXT[issue.reason] : null,
      }
    })
    return {
      draftId: draft.id,
      title: draft.title,
      materials: rows,
      kinds: data.provenanceKinds.map((k) => ({ id: k.id as string, label: k.label })),
      sourceOptions: Array.from(materials.keys())
        .filter((id) => !version.materialIds.includes(id))
        .map((id) => ({ id, label: materialLabel(id) })),
      done: issues.length === 0,
    }
  }

  // ── 使わせてとお願いする（J の「承認が必要」） ──────────────
  // ★「承認が必要」かは、読み口が lib/domain の effectiveMode で畳んだ結果（song.inherit の mode）。
  //   ここで固定の一覧を持たない。
  // ★送ったお願いは、まだ承認されていないので Permission ではない。見本の中の「返事待ち」として持つ。

  const requests = data.permissionRequests.map((r) => ({ ...r }))

  const isWaiting = (songId: Id, contributionId: Id): boolean =>
    requests.some((r) => r.songId === songId && r.contributionId === contributionId)

  const buildAsk = (songId: Id, selectedIds: Id[]): PermissionAskView | null => {
    const song = songOf(songId)
    if (!song) return null
    const picked = song.inherit.filter((c) => selectedIds.includes(c.id) && c.selectable)
    const needsApproval = picked.filter((c) => c.mode === 'approval')
    const free = picked.filter((c) => c.mode === 'free')
    const items: PermissionAskItem[] = needsApproval.map((c) => {
      const con = contributions.get(c.id)
      return {
        id: c.id,
        label: c.label,
        holderNames: (con?.holderIds ?? []).map((h) => personOf(h).displayName),
        statusLabel: c.statusLabel,
        waiting: isWaiting(songId, c.id),
      }
    })
    return {
      songId: song.id,
      songTitle: song.title,
      items,
      freeIds: free.map((c) => c.id),
      canSkip: free.length > 0,
      waiting: items.length > 0 && items.every((i) => i.waiting),
    }
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

    async getPublish(draftId: string): Promise<PublishView | null> {
      return buildPublish(draftId)
    },

    async getDraftMaterials(draftId: string): Promise<DraftMaterialsView | null> {
      return buildDraftMaterials(draftId)
    },

    /** ★見本の読み口の中に保存する（本物の保存は PR #4〜#6 待ち） */
    async getPermissionAsk(songId: string, selectedIds: string[]): Promise<PermissionAskView | null> {
      return buildAsk(songId, selectedIds)
    },

    /** ★見本の読み口の中で返事待ちに進むだけ（本物の送信は PR #4〜#6 待ち） */
    async requestPermission(input: RequestPermissionInput): Promise<PermissionAskView | null> {
      const view = buildAsk(input.songId, input.contributionIds)
      if (!view) return null
      for (const item of view.items) {
        if (isWaiting(input.songId, item.id)) continue
        requests.push({
          songId: input.songId,
          contributionId: item.id,
          requestedBy: viewer.holderId,
          requestedAt: data.now,
        })
      }
      return buildAsk(input.songId, input.contributionIds)
    },

    async declareProvenance(input: DeclareProvenanceInput): Promise<DraftMaterialsView | null> {
      const draft = data.publishDrafts.find((d) => d.id === input.draftId)
      if (!draft) return null
      const version = versions.get(draft.versionId)
      if (!version || version.publishedAt !== null) return null
      if (!version.materialIds.includes(input.materialId)) return null
      const m = materials.get(input.materialId)
      if (!m) return null
      const kind = data.provenanceKinds.find((k) => k.id === input.kind)
      if (!kind) return null

      m.provenance = {
        kind: kind.id,
        declaredBy: version.hostHolderId,
        declaredAt: data.now,
        ...(input.sourceMaterialId ? { sourceMaterialId: input.sourceMaterialId } : {}),
      }
      cache.clear() // 素材が変わると、その Version が使う貢献の見え方も変わる
      return buildDraftMaterials(input.draftId)
    },
  }
}

export const sampleSource: UiDataSource = createSampleSource(SAMPLE)
