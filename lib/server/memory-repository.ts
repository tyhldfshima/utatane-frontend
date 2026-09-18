// lib/server/memory-repository.ts — 試験用の手元の保存（メモリ）
//
// ★本番の保存ではない。プロセスが終われば消える。専用 DB ができたら Supabase 版に差し替える。
// 追記だけの決まり（公開済み Version の中身・履歴）は、DB のトリガーと同じ所で止める。

import type {
  CoauthorApprovalMethod,
  Contribution,
  Derivation,
  HistoryEntry,
  Id,
  Material,
  Permission,
  PermissionEvent,
  PermissionRule,
  PublicationState,
  ReusePolicyVersion,
  RoleKind,
  Timestamp,
} from '../domain/types'
import { INITIAL_PERMISSION_RULE } from '../domain/types'
import type { Recruitment } from '../domain/permissions'
import type {
  CoreRepository,
  ParticipantRecord,
  PermissionRequestRecord,
  PlayRecord,
  ProfileRecord,
  PublishCheckRecord,
  RightsHolderRecord,
  VersionRecord,
} from './repository'

/** DDL 案の初期の行と同じ役割の一覧（行で足す） */
export const SEED_ROLE_KINDS: RoleKind[] = [
  { id: 'lyrics', nature: 'work' },
  { id: 'melody', nature: 'work' },
  { id: 'arrangement', nature: 'work' },
  { id: 'vocal', nature: 'performance' },
  { id: 'instrument', nature: 'performance' },
  { id: 'recording', nature: 'recording' },
  { id: 'mix', nature: 'finishing' },
  { id: 'video', nature: 'work' },
]

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export class MemoryRepository implements CoreRepository {
  private roleKinds = [...SEED_ROLE_KINDS]
  private holders = new Map<Id, RightsHolderRecord>()
  private versions = new Map<Id, VersionRecord>()
  private contributions = new Map<Id, Contribution>()
  private derivations: Derivation[] = []
  private policies: ReusePolicyVersion[] = []
  private coauthorMethods = new Map<Id, CoauthorApprovalMethod>()
  private materials = new Map<Id, Material>()
  private participants = new Map<string, ParticipantRecord>()
  private rules: PermissionRule[] = [INITIAL_PERMISSION_RULE]
  private requests = new Map<Id, PermissionRequestRecord>()
  private permissions = new Map<Id, Permission>()
  private recruitments: Recruitment[] = []
  private publishChecks: PublishCheckRecord[] = []
  private publication = new Map<Id, HistoryEntry<PublicationState>[]>()
  private plays: PlayRecord[] = []
  private profiles = new Map<Id, ProfileRecord>()

  async listRoleKinds() {
    return clone(this.roleKinds)
  }

  async findHolderByAccount(tyAccountId: Id) {
    const found = Array.from(this.holders.values()).find((h) => h.tyAccountId === tyAccountId)
    return found ? clone(found) : null
  }
  async getHolder(id: Id) {
    const h = this.holders.get(id)
    return h ? clone(h) : null
  }
  async insertHolder(h: RightsHolderRecord) {
    if (this.holders.has(h.id)) throw new Error('duplicate_holder')
    this.holders.set(h.id, clone(h))
  }
  async setCentralBeneficiary(holderId: Id, beneficiaryId: Id) {
    const h = this.holders.get(holderId)
    if (!h) throw new Error('holder_not_found')
    if (h.centralBeneficiaryId && h.centralBeneficiaryId !== beneficiaryId) throw new Error('beneficiary_already_linked')
    h.centralBeneficiaryId = beneficiaryId
  }

  async insertVersion(v: VersionRecord) {
    this.versions.set(v.id, clone(v))
  }
  async getVersion(id: Id) {
    const v = this.versions.get(id)
    return v ? clone(v) : null
  }
  private draftOrThrow(id: Id) {
    const v = this.versions.get(id)
    if (!v) throw new Error('version_not_found')
    if (v.publishedAt !== null) throw new Error('published_version_is_immutable')
    return v
  }
  async addVersionContribution(versionId: Id, contributionId: Id, relation: 'created' | 'referenced') {
    const v = this.draftOrThrow(versionId)
    if (v.contributions.some((c) => c.contributionId === contributionId)) return
    v.contributions.push({ contributionId, relation })
  }
  async addVersionMaterial(versionId: Id, materialId: Id) {
    const v = this.draftOrThrow(versionId)
    if (!v.materialIds.includes(materialId)) v.materialIds.push(materialId)
  }
  async markPublished(versionId: Id, at: Timestamp) {
    const v = this.draftOrThrow(versionId)
    v.publishedAt = at
  }
  async listVersionsByHost(holderId: Id) {
    return clone(Array.from(this.versions.values()).filter((v) => v.hostHolderId === holderId))
  }
  async listVersionsUsingContributions(contributionIds: Id[]) {
    const set = new Set(contributionIds)
    const usesMaterial = (v: VersionRecord) =>
      v.materialIds.some((mid) => (this.materials.get(mid)?.embodiedContributionIds ?? []).some((c) => set.has(c)))
    return clone(
      Array.from(this.versions.values()).filter(
        (v) => v.contributions.some((c) => set.has(c.contributionId)) || usesMaterial(v),
      ),
    )
  }

  async insertContribution(c: Contribution) {
    if (this.contributions.has(c.id)) throw new Error('duplicate_contribution')
    this.contributions.set(c.id, clone(c))
  }
  async getContribution(id: Id) {
    const c = this.contributions.get(id)
    return c ? clone(c) : null
  }
  async getContributions(ids: Id[]) {
    return ids.map((id) => this.contributions.get(id)).filter((c): c is Contribution => !!c).map(clone)
  }
  async listContributionsByHolder(holderId: Id) {
    return clone(Array.from(this.contributions.values()).filter((c) => c.holderIds.includes(holderId)))
  }
  async insertDerivation(d: Derivation) {
    this.derivations.push(clone(d))
  }
  async listDerivations() {
    return clone(this.derivations)
  }

  async insertPolicyVersion(p: ReusePolicyVersion) {
    if (this.policies.some((x) => x.contributionId === p.contributionId && x.versionNo === p.versionNo)) {
      throw new Error('duplicate_policy_version')
    }
    this.policies.push(clone(p))
  }
  async listPolicies(contributionIds: Id[]) {
    const set = new Set(contributionIds)
    return clone(this.policies.filter((p) => set.has(p.contributionId)))
  }
  async getCoauthorMethods(contributionIds: Id[]) {
    const out = new Map<Id, CoauthorApprovalMethod>()
    for (const id of contributionIds) {
      const m = this.coauthorMethods.get(id)
      if (m) out.set(id, clone(m))
    }
    return out
  }

  async insertMaterial(m: Material) {
    this.materials.set(m.id, clone(m))
  }
  async getMaterials(ids: Id[]) {
    return ids.map((id) => this.materials.get(id)).filter((m): m is Material => !!m).map(clone)
  }

  async upsertParticipantEvent(versionId: Id, holderId: Id, event: ParticipantRecord['events'][number]) {
    const key = `${versionId}:${holderId}`
    const p = this.participants.get(key) ?? { versionId, rightsHolderId: holderId, events: [] }
    p.events.push(clone(event))
    this.participants.set(key, p)
  }
  async listParticipants(versionId: Id) {
    return clone(Array.from(this.participants.values()).filter((p) => p.versionId === versionId))
  }
  async listParticipationsByHolder(holderId: Id) {
    return clone(Array.from(this.participants.values()).filter((p) => p.rightsHolderId === holderId))
  }

  async currentPermissionRule() {
    return clone(this.rules[this.rules.length - 1])
  }
  async insertPermissionRequest(r: PermissionRequestRecord) {
    this.requests.set(r.id, clone(r))
  }
  async findPermissionRequestByKey(requesterHolderId: Id, idempotencyKey: string) {
    const r = Array.from(this.requests.values()).find(
      (x) => x.requesterHolderId === requesterHolderId && x.idempotencyKey === idempotencyKey,
    )
    return r ? clone(r) : null
  }
  async getPermissionRequest(id: Id) {
    const r = this.requests.get(id)
    return r ? clone(r) : null
  }
  async addPermissionRequestResponse(id: Id, r: PermissionRequestRecord['responses'][number]) {
    const req = this.requests.get(id)
    if (!req) throw new Error('permission_request_not_found')
    req.responses.push(clone(r))
  }
  async insertPermission(p: Permission) {
    this.permissions.set(p.id, clone(p))
  }
  async addPermissionEvent(permissionId: Id, e: PermissionEvent) {
    const p = this.permissions.get(permissionId)
    if (!p) throw new Error('permission_not_found')
    p.events.push(clone(e))
  }
  async listPermissionsForDraft(draftVersionId: Id) {
    return clone(Array.from(this.permissions.values()).filter((p) => p.draftVersionId === draftVersionId))
  }

  async listOpenRecruitmentsByHolder(holderId: Id) {
    return clone(this.recruitments.filter((r) => r.closedAt === null && r.grantorHolderIds.includes(holderId)))
  }

  async insertPublishCheck(c: PublishCheckRecord) {
    this.publishChecks.push(clone(c))
  }
  async listPublishChecks(versionId: Id) {
    return clone(this.publishChecks.filter((c) => c.versionId === versionId))
  }
  async appendPublicationEvent(versionId: Id, e: HistoryEntry<PublicationState>) {
    const list = this.publication.get(versionId) ?? []
    list.push(clone(e))
    this.publication.set(versionId, list)
  }
  async listPublicationEvents(versionId: Id) {
    return clone(this.publication.get(versionId) ?? [])
  }

  async insertPlayIfAbsent(p: PlayRecord) {
    if (this.plays.some((x) => x.versionId === p.versionId && x.idempotencyKey === p.idempotencyKey)) {
      return { inserted: false }
    }
    this.plays.push(clone(p))
    return { inserted: true }
  }
  async countPlays(versionId: Id) {
    return this.plays.filter((p) => p.versionId === versionId).length
  }

  async getProfile(tyAccountId: Id) {
    const p = this.profiles.get(tyAccountId)
    return p ? clone(p) : null
  }
}
