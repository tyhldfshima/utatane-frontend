// lib/server/core-service.ts — 中核の使い方（投稿・参加・派生・許諾・公開・再生・チャンネル）
//
// ・判断は lib/domain をそのまま呼ぶ。ここは「保存の口から集めて、決まりに渡して、結果を保存する」だけ。
// ・保存は CoreRepository（いまはメモリ）。DB ができても、このファイルは変えない。
// ・TYP の台帳・残高・報酬は扱わない。受取人の結び（D-2）だけ中央の口を呼ぶ。

import { appendVersion, assertContentEditable } from '../domain/history'
import { canAddDerivation, traceVersionLineage, type LineageEntry } from '../domain/lineage'
import { policyFor } from '../domain/permissions'
import { revalidateForPublish, type PublishCheck } from '../domain/publish'
import type {
  Contribution,
  DerivationKind,
  Id,
  Material,
  Permission,
  ProvenanceDeclaration,
  PublicationState,
  ReuseMode,
  ReuseScope,
  Timestamp,
} from '../domain/types'
import { beneficiaryRegistryNotConfigured, type BeneficiaryRegistry } from '../integrations/typ'
import type { CoreRepository, ParticipantState, RightsHolderRecord, VersionRecord } from './repository'

export class CoreError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code)
  }
}

export interface CoreDeps {
  repo: CoreRepository
  now?: () => Timestamp
  newId?: () => Id
  beneficiaries?: BeneficiaryRegistry
}

const defaultNewId = () => crypto.randomUUID()
const defaultNow = () => new Date().toISOString()

export type ChannelSection = 'own' | 'participated' | 'used' | 'recruiting'

export interface VersionView {
  version: VersionRecord
  publicationState: string | null
  plays: number
  /** この Version で新しく作った人（参加者） */
  participants: { rightsHolderId: Id; tyAccountId: Id | null; state: ParticipantState | 'host'; roles: Id[] }[]
  /** ほかの Version から使われた貢献（元の Version へのリンクつき） */
  usedContributions: { contribution: Contribution; birthVersionId: Id; via: 'direct' | 'material' }[]
  latestPublishCheck: PublishCheck | null
}

export interface TreeView {
  versionId: Id
  /** 由来（上流）を世代ごとにまとめたもの。画面は1段ずつ開く */
  upstream: { generation: number; entries: LineageEntry[] }[]
  /** この Version で生まれた貢献を使っている Version（下流の1段） */
  downstream: { versionId: Id; title: string; publishedAt: Timestamp | null }[]
}

export class CoreService {
  private repo: CoreRepository
  private now: () => Timestamp
  private newId: () => Id
  private beneficiaries: BeneficiaryRegistry

  constructor(deps: CoreDeps) {
    this.repo = deps.repo
    this.now = deps.now ?? defaultNow
    this.newId = deps.newId ?? defaultNewId
    this.beneficiaries = deps.beneficiaries ?? beneficiaryRegistryNotConfigured
  }

  async listRoleKinds() {
    return this.repo.listRoleKinds()
  }

  // ── 権利者 ──────────────────────────────────────────────

  async holderFor(tyAccountId: Id): Promise<RightsHolderRecord> {
    const found = await this.repo.findHolderByAccount(tyAccountId)
    if (found) return found
    const h: RightsHolderRecord = { id: this.newId(), tyAccountId, centralBeneficiaryId: null, createdAt: this.now() }
    await this.repo.insertHolder(h)
    return h
  }

  /** D-2：初めて貢献を作ったときに中央の受取人を結ぶ。中央につながらなければ未連携のまま続ける */
  private async linkBeneficiaryIfNeeded(holder: RightsHolderRecord) {
    if (holder.centralBeneficiaryId || !holder.tyAccountId) return
    const id = await this.beneficiaries.ensureBeneficiary({ tyAccountId: holder.tyAccountId, rightsHolderId: holder.id })
    if (id) await this.repo.setCentralBeneficiary(holder.id, id)
  }

  // ── 投稿（下書き → 貢献 → 素材 → 公開） ─────────────────────

  async createDraft(tyAccountId: Id, title: string): Promise<VersionRecord> {
    if (!title.trim()) throw new CoreError(422, 'title_required')
    const host = await this.holderFor(tyAccountId)
    const v: VersionRecord = {
      id: this.newId(),
      hostHolderId: host.id,
      title: title.trim(),
      createdAt: this.now(),
      publishedAt: null,
      contributions: [],
      materialIds: [],
    }
    await this.repo.insertVersion(v)
    await this.repo.upsertParticipantEvent(v.id, host.id, { state: 'accepted', at: v.createdAt, recordedBy: host.id })
    return v
  }

  private async draftForHost(versionId: Id, tyAccountId: Id): Promise<{ v: VersionRecord; host: RightsHolderRecord }> {
    const v = await this.repo.getVersion(versionId)
    if (!v) throw new CoreError(404, 'version_not_found')
    const host = await this.holderFor(tyAccountId)
    if (v.hostHolderId !== host.id) throw new CoreError(403, 'not_host')
    try {
      assertContentEditable(v)
    } catch {
      throw new CoreError(409, 'published_version_is_immutable')
    }
    return { v, host }
  }

  /** この下書きで新しい貢献を作る。作者に他の人が入るなら、その人を参加者として招く */
  async createContribution(args: {
    tyAccountId: Id
    versionId: Id
    roleKindId: Id
    coAuthorTyAccountIds?: Id[]
    derivedFrom?: { parentId: Id; kind: DerivationKind }[]
  }): Promise<Contribution> {
    const { v, host } = await this.draftForHost(args.versionId, args.tyAccountId)
    const roles = await this.repo.listRoleKinds()
    if (!roles.some((r) => r.id === args.roleKindId)) throw new CoreError(422, 'role_kind_not_found')

    const coHolders: RightsHolderRecord[] = []
    for (const acc of args.coAuthorTyAccountIds ?? []) {
      if (acc === args.tyAccountId) continue
      coHolders.push(await this.holderFor(acc))
    }
    const c: Contribution = {
      id: this.newId(),
      roleKindId: args.roleKindId,
      holderIds: [host.id, ...coHolders.map((h) => h.id)],
      birthVersionId: v.id,
      createdAt: this.now(),
    }

    // 由来の矢印は先に確かめてから保存する（時間の順・輪にならない）
    const derivations = await this.repo.listDerivations()
    const parents = await this.repo.getContributions((args.derivedFrom ?? []).map((d) => d.parentId))
    for (const d of args.derivedFrom ?? []) {
      const parent = parents.find((p) => p.id === d.parentId)
      if (!parent) throw new CoreError(422, 'parent_contribution_not_found')
      const check = canAddDerivation(derivations, c, parent)
      if (!check.ok) throw new CoreError(422, check.reason)
    }

    await this.repo.insertContribution(c)
    for (const d of args.derivedFrom ?? []) {
      await this.repo.insertDerivation({ childId: c.id, parentId: d.parentId, kind: d.kind })
    }
    await this.repo.addVersionContribution(v.id, c.id, 'created')
    for (const h of coHolders) {
      await this.repo.upsertParticipantEvent(v.id, h.id, { state: 'invited', at: this.now(), recordedBy: host.id })
    }
    await this.linkBeneficiaryIfNeeded(host)
    return c
  }

  /** 既にある貢献を参照する（コピーしない） */
  async referenceContribution(args: { tyAccountId: Id; versionId: Id; contributionId: Id }): Promise<void> {
    const { v } = await this.draftForHost(args.versionId, args.tyAccountId)
    const c = await this.repo.getContribution(args.contributionId)
    if (!c) throw new CoreError(404, 'contribution_not_found')
    await this.repo.addVersionContribution(v.id, c.id, c.birthVersionId === v.id ? 'created' : 'referenced')
  }

  /** 素材を足す。出どころの申告は必須（無ければ入れない） */
  async addMaterial(args: {
    tyAccountId: Id
    versionId: Id
    storageFileId: Id
    embodiedContributionIds: Id[]
    provenance: Omit<ProvenanceDeclaration, 'declaredBy' | 'declaredAt'> | null
  }): Promise<Material> {
    const { v, host } = await this.draftForHost(args.versionId, args.tyAccountId)
    if (!args.provenance) throw new CoreError(422, 'provenance_required')
    if (args.embodiedContributionIds.length === 0) throw new CoreError(422, 'embodied_contributions_required')
    const found = await this.repo.getContributions(args.embodiedContributionIds)
    if (found.length !== args.embodiedContributionIds.length) throw new CoreError(422, 'contribution_not_found')
    const m: Material = {
      id: this.newId(),
      storageFileId: args.storageFileId,
      embodiedContributionIds: args.embodiedContributionIds,
      provenance: { ...args.provenance, declaredBy: host.id, declaredAt: this.now() },
    }
    await this.repo.insertMaterial(m)
    await this.repo.addVersionMaterial(v.id, m.id)
    return m
  }

  // ── 参加 ────────────────────────────────────────────────

  async respondToInvitation(args: { tyAccountId: Id; versionId: Id; accept: boolean }): Promise<void> {
    const v = await this.repo.getVersion(args.versionId)
    if (!v) throw new CoreError(404, 'version_not_found')
    const me = await this.holderFor(args.tyAccountId)
    const mine = (await this.repo.listParticipants(v.id)).find((p) => p.rightsHolderId === me.id)
    if (!mine) throw new CoreError(404, 'not_invited')
    await this.repo.upsertParticipantEvent(v.id, me.id, {
      state: args.accept ? 'accepted' : 'declined',
      at: this.now(),
      recordedBy: me.id,
    })
  }

  // ── 再利用ポリシーと許諾 ──────────────────────────────────

  async setPolicy(args: { tyAccountId: Id; contributionId: Id; mode: ReuseMode; scope: ReuseScope; namedTyAccountIds?: Id[] }) {
    const me = await this.holderFor(args.tyAccountId)
    const c = await this.repo.getContribution(args.contributionId)
    if (!c) throw new CoreError(404, 'contribution_not_found')
    if (!c.holderIds.includes(me.id)) throw new CoreError(403, 'not_author')
    const existing = await this.repo.listPolicies([c.id])
    const versionNo = existing.reduce((mx, p) => Math.max(mx, p.versionNo), 0) + 1
    const named: Id[] = []
    for (const acc of args.namedTyAccountIds ?? []) named.push((await this.holderFor(acc)).id)
    const p = {
      contributionId: c.id,
      holderId: c.holderIds.length > 1 ? me.id : null,
      versionNo,
      mode: args.mode,
      scope: args.scope,
      namedHolderIds: named,
      effectiveAt: this.now(),
    }
    await this.repo.insertPolicyVersion(p)
    // 厳しくしたとき、成立済みで未公開の許諾は「残す／取り消す」を選ぶ対象として返す（R2）
    return { policy: p }
  }

  async requestPermission(args: { tyAccountId: Id; draftVersionId: Id; contributionId: Id; idempotencyKey: string; message?: string }) {
    const { v, host } = await this.draftForHost(args.draftVersionId, args.tyAccountId)
    const existing = await this.repo.findPermissionRequestByKey(host.id, args.idempotencyKey)
    if (existing) return existing
    const c = await this.repo.getContribution(args.contributionId)
    if (!c) throw new CoreError(404, 'contribution_not_found')
    const r = {
      id: this.newId(),
      contributionId: c.id,
      requesterHolderId: host.id,
      draftVersionId: v.id,
      message: args.message ?? null,
      idempotencyKey: args.idempotencyKey,
      createdAt: this.now(),
      responses: [],
    }
    await this.repo.insertPermissionRequest(r)
    return r
  }

  /** 申請への返事。承認なら、返事をした作者1人分の Permission を記録する（共作は1人ずつ） */
  async respondToPermissionRequest(args: { tyAccountId: Id; requestId: Id; approve: boolean }): Promise<Permission | null> {
    const req = await this.repo.getPermissionRequest(args.requestId)
    if (!req) throw new CoreError(404, 'permission_request_not_found')
    const me = await this.holderFor(args.tyAccountId)
    const c = await this.repo.getContribution(req.contributionId)
    if (!c) throw new CoreError(404, 'contribution_not_found')
    const methods = await this.repo.getCoauthorMethods([c.id])
    const method = methods.get(c.id)
    const isDelegate = method?.kind === 'delegated' && method.delegateHolderId === me.id
    if (!c.holderIds.includes(me.id)) throw new CoreError(403, 'not_author')
    if (req.responses.some((r) => r.responderHolderId === me.id)) throw new CoreError(409, 'already_responded')

    const at = this.now()
    await this.repo.addPermissionRequestResponse(req.id, { responderHolderId: me.id, answer: args.approve ? 'approved' : 'declined', at })
    if (!args.approve) return null

    const rule = await this.repo.currentPermissionRule()
    const policies = await this.repo.listPolicies([c.id])
    const current = policyFor(policies, c.id, me.id, at)
    const p: Permission = {
      id: this.newId(),
      contributionId: c.id,
      granteeHolderId: req.requesterHolderId,
      draftVersionId: req.draftVersionId,
      basis: isDelegate ? 'delegated_approval' : 'request_approval',
      grantorHolderIds: [me.id],
      policyVersionNoAtGrant: current ? current.versionNo : 0,
      permissionRuleVersionAtGrant: rule.version,
      events: [{ kind: 'granted', actorHolderId: me.id, at }],
    }
    await this.repo.insertPermission(p)
    return p
  }

  // ── 公開（公開時の再検証 → 記録 → 公開） ─────────────────────

  async publish(args: { tyAccountId: Id; versionId: Id }): Promise<{ published: boolean; check: PublishCheck; participationIssues: Id[] }> {
    const { v, host } = await this.draftForHost(args.versionId, args.tyAccountId)
    const at = this.now()

    const materials = await this.repo.getMaterials(v.materialIds)
    const needed = new Set<Id>(v.contributions.map((c) => c.contributionId))
    for (const m of materials) m.embodiedContributionIds.forEach((id) => needed.add(id))
    const contributions = await this.repo.getContributions(Array.from(needed))
    const ids = contributions.map((c) => c.id)

    const check = revalidateForPublish(
      v,
      {
        contributions: new Map(contributions.map((c) => [c.id, c])),
        materials: new Map(materials.map((m) => [m.id, m])),
        policies: await this.repo.listPolicies(ids),
        permissions: await this.repo.listPermissionsForDraft(v.id),
        coauthorMethods: await this.repo.getCoauthorMethods(ids),
        rule: await this.repo.currentPermissionRule(),
      },
      at,
    )

    // 承認された参加だけが正式な Version になる：この Version で作った貢献の作者は全員「承認済み」であること
    const participants = await this.repo.listParticipants(v.id)
    const accepted = new Set(
      participants.filter((p) => p.events[p.events.length - 1]?.state === 'accepted').map((p) => p.rightsHolderId),
    )
    const participationIssues = Array.from(
      new Set(
        contributions
          .filter((c) => c.birthVersionId === v.id)
          .flatMap((c) => c.holderIds)
          .filter((h) => h !== host.id && !accepted.has(h)),
      ),
    )

    await this.repo.insertPublishCheck({ id: this.newId(), ...check })
    const ok = check.passed && participationIssues.length === 0
    if (ok) {
      await this.repo.markPublished(v.id, at)
      const history = await this.repo.listPublicationEvents(v.id)
      const next = appendVersion<PublicationState>(history, { value: 'public', effectiveFrom: at, recordedBy: host.id, reason: '公開' })
      await this.repo.appendPublicationEvent(v.id, next[next.length - 1])
    }
    return { published: ok, check, participationIssues }
  }

  // ── 見る（Version・Tree・チャンネル） ────────────────────────

  /** 下書きは参加者（主催・招かれた人）にだけ見せる。ほかの人には「無い」と同じに見せる */
  private async visibleVersion(versionId: Id, viewerTyAccountId: Id | null): Promise<VersionRecord> {
    const v = await this.repo.getVersion(versionId)
    if (!v) throw new CoreError(404, 'version_not_found')
    if (v.publishedAt !== null) return v
    const viewer = viewerTyAccountId ? await this.repo.findHolderByAccount(viewerTyAccountId) : null
    const participants = await this.repo.listParticipants(v.id)
    if (!viewer || !participants.some((p) => p.rightsHolderId === viewer.id)) throw new CoreError(404, 'version_not_found')
    return v
  }

  async getVersionView(versionId: Id, viewerTyAccountId: Id | null = null): Promise<VersionView> {
    const v = await this.visibleVersion(versionId, viewerTyAccountId)
    const materials = await this.repo.getMaterials(v.materialIds)
    const direct = v.contributions.map((c) => c.contributionId)
    const embodied = materials.flatMap((m) => m.embodiedContributionIds)
    const contributions = await this.repo.getContributions(Array.from(new Set([...direct, ...embodied])))
    const byId = new Map(contributions.map((c) => [c.id, c]))

    const participantsRaw = await this.repo.listParticipants(v.id)
    const participants: VersionView['participants'] = []
    for (const p of participantsRaw) {
      const h = await this.repo.getHolder(p.rightsHolderId)
      const state = p.events[p.events.length - 1]?.state ?? 'invited'
      const roles = contributions.filter((c) => c.birthVersionId === v.id && c.holderIds.includes(p.rightsHolderId)).map((c) => c.roleKindId)
      participants.push({
        rightsHolderId: p.rightsHolderId,
        tyAccountId: state === 'anonymized' ? null : h?.tyAccountId ?? null,
        state: p.rightsHolderId === v.hostHolderId ? 'host' : state,
        roles,
      })
    }

    const usedContributions: VersionView['usedContributions'] = []
    for (const c of contributions) {
      if (c.birthVersionId === v.id) continue
      usedContributions.push({ contribution: c, birthVersionId: c.birthVersionId, via: direct.includes(c.id) ? 'direct' : 'material' })
    }
    const history = await this.repo.listPublicationEvents(v.id)
    const checks = await this.repo.listPublishChecks(v.id)
    return {
      version: v,
      publicationState: history.length ? history[history.length - 1].value : null,
      plays: await this.repo.countPlays(v.id),
      participants,
      usedContributions: usedContributions.filter((u) => byId.has(u.contribution.id)),
      latestPublishCheck: checks.length ? checks[checks.length - 1] : null,
    }
  }

  async getTree(versionId: Id, viewerTyAccountId: Id | null = null): Promise<TreeView> {
    const v = await this.visibleVersion(versionId, viewerTyAccountId)
    const materials = await this.repo.getMaterials(v.materialIds)
    const lineage = traceVersionLineage(v, new Map(materials.map((m) => [m.id, m])), await this.repo.listDerivations())
    const gens = new Map<number, LineageEntry[]>()
    for (const e of lineage) {
      const list = gens.get(e.generation) ?? []
      list.push(e)
      gens.set(e.generation, list)
    }
    const born = v.contributions.filter((c) => c.relation === 'created').map((c) => c.contributionId)
    const downstream = (await this.repo.listVersionsUsingContributions(born))
      .filter((x) => x.id !== v.id && x.publishedAt !== null)
      .map((x) => ({ versionId: x.id, title: x.title, publishedAt: x.publishedAt }))
    return {
      versionId: v.id,
      upstream: Array.from(gens.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([generation, entries]) => ({ generation, entries })),
      downstream,
    }
  }

  /**
   * チャンネル（データはコピーせず、関係から並べる）
   * own＝主催／participated＝その Version で新しい貢献を作った（主催でない）／
   * used＝自分の貢献がほかの Version で使われた（そこでは新しい貢献をしていない）／recruiting＝自分の募集
   * 同じ Version は上の区分で1回だけ出す。
   * ★出すのは公開済みの Version だけ。例外は、本人が自分のチャンネルを見るときの「自分の作品」の下書き。
   */
  async getChannel(tyAccountId: Id, viewerTyAccountId: Id | null = null): Promise<Record<ChannelSection, { versionId: Id; title: string; publishedAt: Timestamp | null; usedRoles?: Id[] }[]>> {
    const me = await this.repo.findHolderByAccount(tyAccountId)
    const empty = { own: [], participated: [], used: [], recruiting: [] }
    if (!me) return empty
    const seen = new Set<Id>()
    const row = (v: VersionRecord) => ({ versionId: v.id, title: v.title, publishedAt: v.publishedAt })
    const isOwnerViewing = viewerTyAccountId === tyAccountId

    const own = (await this.repo.listVersionsByHost(me.id))
      .filter((v) => v.publishedAt !== null || isOwnerViewing)
      .map((v) => {
        seen.add(v.id)
        return row(v)
      })

    const mine = await this.repo.listContributionsByHolder(me.id)
    const participated: ReturnType<typeof row>[] = []
    for (const birth of Array.from(new Set(mine.map((c) => c.birthVersionId)))) {
      if (seen.has(birth)) continue
      const v = await this.repo.getVersion(birth)
      const p = (await this.repo.listParticipants(birth)).find((x) => x.rightsHolderId === me.id)
      const state = p?.events[p.events.length - 1]?.state
      if (!v || v.publishedAt === null || state !== 'accepted') continue
      seen.add(v.id)
      participated.push(row(v))
    }

    const used: (ReturnType<typeof row> & { usedRoles: Id[] })[] = []
    const usingVersions = await this.repo.listVersionsUsingContributions(mine.map((c) => c.id))
    for (const v of usingVersions) {
      if (seen.has(v.id) || v.publishedAt === null) continue
      const materials = await this.repo.getMaterials(v.materialIds)
      const usedIds = new Set([...v.contributions.map((c) => c.contributionId), ...materials.flatMap((m) => m.embodiedContributionIds)])
      const usedRoles = Array.from(new Set(mine.filter((c) => usedIds.has(c.id) && c.birthVersionId !== v.id).map((c) => c.roleKindId)))
      if (!usedRoles.length) continue
      seen.add(v.id)
      used.push({ ...row(v), usedRoles })
    }

    const recruiting: ReturnType<typeof row>[] = []
    for (const r of await this.repo.listOpenRecruitmentsByHolder(me.id)) {
      const c = await this.repo.getContribution(r.contributionIds[0] ?? '')
      const v = c ? await this.repo.getVersion(c.birthVersionId) : null
      if (v && v.publishedAt !== null) recruiting.push(row(v))
    }
    return { own, participated, used, recruiting }
  }

  // ── 再生（冪等） ─────────────────────────────────────────

  async recordPlay(args: { versionId: Id; tyAccountId: Id | null; idempotencyKey: string; source?: string }) {
    const v = await this.repo.getVersion(args.versionId)
    if (!v) throw new CoreError(404, 'version_not_found')
    if (v.publishedAt === null) throw new CoreError(409, 'version_not_published')
    if (!args.idempotencyKey) throw new CoreError(422, 'idempotency_key_required')
    const r = await this.repo.insertPlayIfAbsent({
      versionId: v.id,
      listenerTyAccountId: args.tyAccountId,
      source: args.source ?? null,
      idempotencyKey: args.idempotencyKey,
      playedAt: this.now(),
    })
    return { recorded: r.inserted, plays: await this.repo.countPlays(v.id) }
  }
}
