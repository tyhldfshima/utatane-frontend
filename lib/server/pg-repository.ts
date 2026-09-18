// lib/server/pg-repository.ts — 保存の口（CoreRepository）の Postgres 版（UTATANE 専用の Supabase）
//
// ・表は db/migrations/0001_utatane_core_v1.sql（スキーマ utatane）。
// ・つなぎ方は SqlClient（query だけ）。本番は pg の Pool（lib/server/pg-client.ts）、試験は PGlite。
// ・ポイント・残高・報酬は持たない。中央の受取人 id を参照として持つだけ。
// ★container.ts はまだ MemoryRepository のまま。切り替えは事後確認が通った後の別の便。

import type { Recruitment } from '../domain/permissions'
import type { PublishCheck } from '../domain/publish'
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

/** pg の Pool と PGlite のどちらでも満たせる最小の形 */
export interface SqlClient {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>
}

type Row = Record<string, unknown>

const iso = (v: unknown): Timestamp => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const isoOrNull = (v: unknown): Timestamp | null => (v === null || v === undefined ? null : iso(v))
const s = (v: unknown): string => String(v)
const sOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

export class PgRepository implements CoreRepository {
  constructor(private db: SqlClient) {}

  private async rows<R = Row>(text: string, params: unknown[] = []): Promise<R[]> {
    return (await this.db.query<R>(text, params)).rows
  }

  // ── 役割 ──────────────────────────────────────────────
  async listRoleKinds(): Promise<RoleKind[]> {
    const r = await this.rows('select id, nature from utatane.role_kinds order by created_at, id')
    return r.map((x) => ({ id: s(x.id), nature: s(x.nature) as RoleKind['nature'] }))
  }

  // ── 権利者 ─────────────────────────────────────────────
  private holder(x: Row): RightsHolderRecord {
    return { id: s(x.id), tyAccountId: sOrNull(x.ty_account_id), centralBeneficiaryId: sOrNull(x.central_beneficiary_id), createdAt: iso(x.created_at) }
  }
  async findHolderByAccount(tyAccountId: Id) {
    const r = await this.rows('select * from utatane.rights_holders where ty_account_id = $1', [tyAccountId])
    return r[0] ? this.holder(r[0]) : null
  }
  async getHolder(id: Id) {
    const r = await this.rows('select * from utatane.rights_holders where id = $1', [id])
    return r[0] ? this.holder(r[0]) : null
  }
  async insertHolder(h: RightsHolderRecord) {
    await this.db.query(
      'insert into utatane.rights_holders (id, ty_account_id, central_beneficiary_id, created_at) values ($1, $2, $3, $4)',
      [h.id, h.tyAccountId, h.centralBeneficiaryId, h.createdAt],
    )
  }
  async setCentralBeneficiary(holderId: Id, beneficiaryId: Id) {
    const r = await this.rows(
      `update utatane.rights_holders set central_beneficiary_id = $2
       where id = $1 and (central_beneficiary_id is null or central_beneficiary_id = $2) returning id`,
      [holderId, beneficiaryId],
    )
    if (!r.length) {
      if (!(await this.getHolder(holderId))) throw new Error('holder_not_found')
      throw new Error('beneficiary_already_linked')
    }
  }

  // ── Version ────────────────────────────────────────────
  async insertVersion(v: VersionRecord) {
    await this.db.query(
      'insert into utatane.versions (id, host_holder_id, title, created_at, published_at) values ($1, $2, $3, $4, $5)',
      [v.id, v.hostHolderId, v.title, v.createdAt, v.publishedAt],
    )
    for (const c of v.contributions) await this.addVersionContribution(v.id, c.contributionId, c.relation)
    for (const m of v.materialIds) await this.addVersionMaterial(v.id, m)
  }

  private async loadVersions(where: string, params: unknown[]): Promise<VersionRecord[]> {
    const vs = await this.rows(`select * from utatane.versions v where ${where} order by v.created_at, v.id`, params)
    if (!vs.length) return []
    const ids = vs.map((v) => s(v.id))
    const cs = await this.rows(
      'select version_id, contribution_id, relation from utatane.version_contributions where version_id = any($1::uuid[]) order by added_at, contribution_id',
      [ids],
    )
    const ms = await this.rows(
      'select version_id, material_id from utatane.version_materials where version_id = any($1::uuid[]) order by added_at, material_id',
      [ids],
    )
    return vs.map((v) => ({
      id: s(v.id),
      hostHolderId: s(v.host_holder_id),
      title: s(v.title),
      createdAt: iso(v.created_at),
      publishedAt: isoOrNull(v.published_at),
      contributions: cs
        .filter((c) => s(c.version_id) === s(v.id))
        .map((c) => ({ contributionId: s(c.contribution_id), relation: s(c.relation) as 'created' | 'referenced' })),
      materialIds: ms.filter((m) => s(m.version_id) === s(v.id)).map((m) => s(m.material_id)),
    }))
  }

  async getVersion(id: Id) {
    return (await this.loadVersions('v.id = $1', [id]))[0] ?? null
  }
  async addVersionContribution(versionId: Id, contributionId: Id, relation: 'created' | 'referenced') {
    await this.assertDraft(versionId)
    await this.db.query(
      'insert into utatane.version_contributions (version_id, contribution_id, relation) values ($1, $2, $3) on conflict do nothing',
      [versionId, contributionId, relation],
    )
  }
  async addVersionMaterial(versionId: Id, materialId: Id) {
    await this.assertDraft(versionId)
    await this.db.query('insert into utatane.version_materials (version_id, material_id) values ($1, $2) on conflict do nothing', [versionId, materialId])
  }
  private async assertDraft(versionId: Id) {
    const r = await this.rows('select published_at from utatane.versions where id = $1', [versionId])
    if (!r.length) throw new Error('version_not_found')
    if (r[0].published_at !== null) throw new Error('published_version_is_immutable')
  }
  async markPublished(versionId: Id, at: Timestamp) {
    await this.assertDraft(versionId)
    await this.db.query('update utatane.versions set published_at = $2 where id = $1', [versionId, at])
  }
  async listVersionsByHost(holderId: Id) {
    return this.loadVersions('v.host_holder_id = $1', [holderId])
  }
  async listVersionsUsingContributions(contributionIds: Id[]) {
    if (!contributionIds.length) return []
    return this.loadVersions(
      `exists (select 1 from utatane.version_contributions vc where vc.version_id = v.id and vc.contribution_id = any($1::uuid[]))
       or exists (select 1 from utatane.version_materials vm join utatane.material_embodiments me on me.material_id = vm.material_id
                  where vm.version_id = v.id and me.contribution_id = any($1::uuid[]))`,
      [contributionIds],
    )
  }

  // ── 貢献と由来 ──────────────────────────────────────────
  async insertContribution(c: Contribution) {
    await this.db.query(
      'insert into utatane.contributions (id, role_kind_id, birth_version_id, created_at) values ($1, $2, $3, $4)',
      [c.id, c.roleKindId, c.birthVersionId, c.createdAt],
    )
    for (const h of c.holderIds) {
      await this.db.query('insert into utatane.contribution_holders (contribution_id, rights_holder_id) values ($1, $2)', [c.id, h])
    }
  }
  private async loadContributions(where: string, params: unknown[]): Promise<Contribution[]> {
    const cs = await this.rows(`select * from utatane.contributions c where ${where} order by c.created_at, c.id`, params)
    if (!cs.length) return []
    const hs = await this.rows(
      'select contribution_id, rights_holder_id from utatane.contribution_holders where contribution_id = any($1::uuid[])',
      [cs.map((c) => s(c.id))],
    )
    return cs.map((c) => ({
      id: s(c.id),
      roleKindId: s(c.role_kind_id),
      birthVersionId: s(c.birth_version_id),
      createdAt: iso(c.created_at),
      holderIds: hs.filter((h) => s(h.contribution_id) === s(c.id)).map((h) => s(h.rights_holder_id)),
    }))
  }
  async getContribution(id: Id) {
    return (await this.getContributions([id]))[0] ?? null
  }
  async getContributions(ids: Id[]) {
    if (!ids.length) return []
    const found = await this.loadContributions('c.id = any($1::uuid[])', [ids])
    return ids.map((id) => found.find((c) => c.id === id)).filter((c): c is Contribution => !!c)
  }
  async listContributionsByHolder(holderId: Id) {
    return this.loadContributions(
      'exists (select 1 from utatane.contribution_holders h where h.contribution_id = c.id and h.rights_holder_id = $1)',
      [holderId],
    )
  }
  async insertDerivation(d: Derivation) {
    await this.db.query('insert into utatane.contribution_derivations (child_id, parent_id, kind) values ($1, $2, $3)', [d.childId, d.parentId, d.kind])
  }
  async listDerivations(): Promise<Derivation[]> {
    const r = await this.rows('select child_id, parent_id, kind from utatane.contribution_derivations order by created_at')
    return r.map((d) => ({ childId: s(d.child_id), parentId: s(d.parent_id), kind: s(d.kind) }))
  }

  // ── 再利用ポリシー・共作の承認方式 ────────────────────────────
  async insertPolicyVersion(p: ReusePolicyVersion) {
    await this.db.query(
      `insert into utatane.reuse_policy_versions (contribution_id, version_no, holder_id, mode, scope, named_holder_ids, effective_at)
       values ($1, $2, $3, $4, $5, $6::uuid[], $7)`,
      [p.contributionId, p.versionNo, p.holderId, p.mode, p.scope, p.namedHolderIds ?? [], p.effectiveAt],
    )
  }
  async listPolicies(contributionIds: Id[]): Promise<ReusePolicyVersion[]> {
    if (!contributionIds.length) return []
    const r = await this.rows(
      'select * from utatane.reuse_policy_versions where contribution_id = any($1::uuid[]) order by contribution_id, version_no',
      [contributionIds],
    )
    return r.map((p) => ({
      contributionId: s(p.contribution_id),
      versionNo: Number(p.version_no),
      holderId: sOrNull(p.holder_id),
      mode: s(p.mode) as ReusePolicyVersion['mode'],
      scope: s(p.scope) as ReusePolicyVersion['scope'],
      namedHolderIds: ((p.named_holder_ids as unknown[]) ?? []).map(s),
      effectiveAt: iso(p.effective_at),
    }))
  }
  async getCoauthorMethods(contributionIds: Id[]) {
    const out = new Map<Id, CoauthorApprovalMethod>()
    if (!contributionIds.length) return out
    const ms = await this.rows(
      `select distinct on (contribution_id) contribution_id, seq, method, delegate_holder_id
       from utatane.coauthor_approval_methods where contribution_id = any($1::uuid[])
       order by contribution_id, seq desc`,
      [contributionIds],
    )
    for (const m of ms) {
      if (s(m.method) === 'all') {
        out.set(s(m.contribution_id), { kind: 'all' })
        continue
      }
      const cons = await this.rows(
        'select delegator_holder_id from utatane.coauthor_delegation_consents where contribution_id = $1 and method_seq = $2',
        [m.contribution_id, m.seq],
      )
      out.set(s(m.contribution_id), {
        kind: 'delegated',
        delegateHolderId: s(m.delegate_holder_id),
        delegatedBy: cons.map((c) => s(c.delegator_holder_id)),
      })
    }
    return out
  }

  // ── 素材 ───────────────────────────────────────────────
  async insertMaterial(m: Material) {
    if (!m.provenance) throw new Error('provenance_required')
    await this.db.query('insert into utatane.materials (id, storage_file_id, uploaded_by) values ($1, $2, $3)', [m.id, m.storageFileId, m.provenance.declaredBy])
    for (const c of m.embodiedContributionIds) {
      await this.db.query('insert into utatane.material_embodiments (material_id, contribution_id) values ($1, $2)', [m.id, c])
    }
    await this.db.query(
      `insert into utatane.material_provenance (material_id, seq, kind, source_material_id, evidence, declared_by, declared_at)
       values ($1, 1, $2, $3, $4::jsonb, $5, $6)`,
      [m.id, m.provenance.kind, m.provenance.sourceMaterialId ?? null, JSON.stringify(m.provenance.evidence ?? {}), m.provenance.declaredBy, m.provenance.declaredAt],
    )
  }
  async getMaterials(ids: Id[]): Promise<Material[]> {
    if (!ids.length) return []
    const ms = await this.rows('select * from utatane.materials where id = any($1::uuid[])', [ids])
    const es = await this.rows('select material_id, contribution_id from utatane.material_embodiments where material_id = any($1::uuid[])', [ids])
    const ps = await this.rows(
      `select distinct on (material_id) * from utatane.material_provenance where material_id = any($1::uuid[]) order by material_id, seq desc`,
      [ids],
    )
    const out: Material[] = ms.map((m) => {
      const p = ps.find((x) => s(x.material_id) === s(m.id))
      return {
        id: s(m.id),
        storageFileId: s(m.storage_file_id),
        embodiedContributionIds: es.filter((e) => s(e.material_id) === s(m.id)).map((e) => s(e.contribution_id)),
        provenance: p
          ? {
              kind: s(p.kind),
              declaredBy: s(p.declared_by),
              declaredAt: iso(p.declared_at),
              ...(p.source_material_id ? { sourceMaterialId: s(p.source_material_id) } : {}),
              ...(p.evidence && Object.keys(p.evidence as object).length ? { evidence: p.evidence as Record<string, unknown> } : {}),
            }
          : null,
      }
    })
    return ids.map((id) => out.find((m) => m.id === id)).filter((m): m is Material => !!m)
  }

  // ── 参加 ───────────────────────────────────────────────
  async upsertParticipantEvent(versionId: Id, holderId: Id, event: ParticipantRecord['events'][number]) {
    await this.db.query('insert into utatane.version_participants (version_id, rights_holder_id) values ($1, $2) on conflict do nothing', [versionId, holderId])
    await this.db.query(
      'insert into utatane.participant_events (version_id, rights_holder_id, state, recorded_by, at) values ($1, $2, $3, $4, $5)',
      [versionId, holderId, event.state, event.recordedBy, event.at],
    )
  }
  private async loadParticipants(where: string, params: unknown[]): Promise<ParticipantRecord[]> {
    const ps = await this.rows(`select version_id, rights_holder_id from utatane.version_participants p where ${where}`, params)
    const out: ParticipantRecord[] = []
    for (const p of ps) {
      const es = await this.rows(
        'select state, recorded_by, at from utatane.participant_events where version_id = $1 and rights_holder_id = $2 order by id',
        [p.version_id, p.rights_holder_id],
      )
      out.push({
        versionId: s(p.version_id),
        rightsHolderId: s(p.rights_holder_id),
        events: es.map((e) => ({ state: s(e.state) as ParticipantRecord['events'][number]['state'], recordedBy: sOrNull(e.recorded_by), at: iso(e.at) })),
      })
    }
    return out
  }
  async listParticipants(versionId: Id) {
    return this.loadParticipants('p.version_id = $1', [versionId])
  }
  async listParticipationsByHolder(holderId: Id) {
    return this.loadParticipants('p.rights_holder_id = $1', [holderId])
  }

  // ── 許諾 ───────────────────────────────────────────────
  async currentPermissionRule(): Promise<PermissionRule> {
    const r = await this.rows('select version, r2_on_policy_tightened from utatane.permission_rules order by version desc limit 1')
    if (!r.length) throw new Error('permission_rule_missing')
    return { version: Number(r[0].version), r2OnPolicyTightened: s(r[0].r2_on_policy_tightened) as PermissionRule['r2OnPolicyTightened'] }
  }
  async insertPermissionRequest(r: PermissionRequestRecord) {
    await this.db.query(
      `insert into utatane.permission_requests (id, contribution_id, requester_holder_id, draft_version_id, message, idempotency_key, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [r.id, r.contributionId, r.requesterHolderId, r.draftVersionId, r.message, r.idempotencyKey, r.createdAt],
    )
    for (const x of r.responses) await this.addPermissionRequestResponse(r.id, x)
  }
  private async loadRequest(where: string, params: unknown[]): Promise<PermissionRequestRecord | null> {
    const r = await this.rows(`select * from utatane.permission_requests where ${where}`, params)
    if (!r.length) return null
    const x = r[0]
    const res = await this.rows('select responder_holder_id, answer, at from utatane.permission_request_responses where request_id = $1 order by id', [x.id])
    return {
      id: s(x.id),
      contributionId: s(x.contribution_id),
      requesterHolderId: s(x.requester_holder_id),
      draftVersionId: s(x.draft_version_id),
      message: sOrNull(x.message),
      idempotencyKey: s(x.idempotency_key),
      createdAt: iso(x.created_at),
      responses: res.map((y) => ({ responderHolderId: s(y.responder_holder_id), answer: s(y.answer) as 'approved' | 'declined' | 'expired', at: iso(y.at) })),
    }
  }
  async findPermissionRequestByKey(requesterHolderId: Id, idempotencyKey: string) {
    return this.loadRequest('requester_holder_id = $1 and idempotency_key = $2', [requesterHolderId, idempotencyKey])
  }
  async getPermissionRequest(id: Id) {
    return this.loadRequest('id = $1', [id])
  }
  async addPermissionRequestResponse(id: Id, r: PermissionRequestRecord['responses'][number]) {
    await this.db.query(
      'insert into utatane.permission_request_responses (request_id, responder_holder_id, answer, at) values ($1, $2, $3, $4)',
      [id, r.responderHolderId, r.answer, r.at],
    )
  }
  async insertPermission(p: Permission) {
    await this.db.query(
      `insert into utatane.permissions (id, contribution_id, grantee_holder_id, draft_version_id, basis, policy_version_no_at_grant, permission_rule_version_at_grant)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [p.id, p.contributionId, p.granteeHolderId, p.draftVersionId, p.basis, p.policyVersionNoAtGrant, p.permissionRuleVersionAtGrant],
    )
    for (const g of p.grantorHolderIds) {
      await this.db.query('insert into utatane.permission_grantors (permission_id, holder_id) values ($1, $2)', [p.id, g])
    }
    for (const e of p.events) await this.addPermissionEvent(p.id, e)
  }
  async addPermissionEvent(permissionId: Id, e: PermissionEvent) {
    await this.db.query(
      'insert into utatane.permission_events (permission_id, kind, actor_holder_id, at) values ($1, $2, $3, $4)',
      [permissionId, e.kind, e.actorHolderId, e.at],
    )
  }
  async listPermissionsForDraft(draftVersionId: Id): Promise<Permission[]> {
    const ps = await this.rows('select * from utatane.permissions where draft_version_id = $1 order by created_at, id', [draftVersionId])
    const out: Permission[] = []
    for (const p of ps) {
      const gs = await this.rows('select holder_id from utatane.permission_grantors where permission_id = $1', [p.id])
      const es = await this.rows('select kind, actor_holder_id, at from utatane.permission_events where permission_id = $1 order by id', [p.id])
      out.push({
        id: s(p.id),
        contributionId: s(p.contribution_id),
        granteeHolderId: s(p.grantee_holder_id),
        draftVersionId: s(p.draft_version_id),
        basis: s(p.basis) as Permission['basis'],
        grantorHolderIds: gs.map((g) => s(g.holder_id)),
        policyVersionNoAtGrant: Number(p.policy_version_no_at_grant),
        permissionRuleVersionAtGrant: Number(p.permission_rule_version_at_grant),
        events: es.map((e) => ({ kind: s(e.kind) as PermissionEvent['kind'], actorHolderId: sOrNull(e.actor_holder_id), at: iso(e.at) })),
      })
    }
    return out
  }

  // ── 募集 ───────────────────────────────────────────────
  async listOpenRecruitmentsByHolder(holderId: Id): Promise<Recruitment[]> {
    const rs = await this.rows(
      `select r.* from utatane.recruitments r
       where r.created_by = $1
         and (select e.kind from utatane.recruitment_events e where e.recruitment_id = r.id order by e.id desc limit 1)
             is distinct from 'closed'
       order by r.opened_at`,
      [holderId],
    )
    const out: Recruitment[] = []
    for (const r of rs) {
      const cs = await this.rows('select contribution_id from utatane.recruitment_contributions where recruitment_id = $1', [r.id])
      out.push({
        id: s(r.id),
        contributionIds: cs.map((c) => s(c.contribution_id)),
        preapproved: Boolean(r.preapproved),
        grantorHolderIds: [s(r.created_by)],
        openedAt: iso(r.opened_at),
        closedAt: null,
      })
    }
    return out
  }

  // ── 公開の再検証・公開状態 ───────────────────────────────────
  async insertPublishCheck(c: PublishCheckRecord) {
    const result = { items: c.items, materialIssues: c.materialIssues }
    await this.db.query(
      `insert into utatane.publish_checks (id, version_id, checked_at, permission_rule_version, passed, result)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [c.id, c.versionId, c.checkedAt, c.permissionRuleVersion, c.passed, JSON.stringify(result)],
    )
  }
  async listPublishChecks(versionId: Id): Promise<PublishCheckRecord[]> {
    const r = await this.rows('select * from utatane.publish_checks where version_id = $1 order by checked_at, id', [versionId])
    return r.map((x) => {
      const res = (typeof x.result === 'string' ? JSON.parse(x.result) : x.result) as Pick<PublishCheck, 'items' | 'materialIssues'>
      return {
        id: s(x.id),
        versionId: s(x.version_id),
        checkedAt: iso(x.checked_at),
        permissionRuleVersion: Number(x.permission_rule_version),
        passed: Boolean(x.passed),
        items: res.items,
        materialIssues: res.materialIssues,
      }
    })
  }
  async appendPublicationEvent(versionId: Id, e: HistoryEntry<PublicationState>) {
    await this.db.query(
      `insert into utatane.publication_events (version_id, seq, state, reason, recorded_by, effective_from)
       values ($1, $2, $3, $4, $5, $6)`,
      [versionId, e.seq, e.value, e.reason, e.recordedBy, e.effectiveFrom],
    )
  }
  async listPublicationEvents(versionId: Id): Promise<HistoryEntry<PublicationState>[]> {
    const r = await this.rows('select * from utatane.publication_events where version_id = $1 order by seq', [versionId])
    return r.map((x) => ({
      seq: Number(x.seq),
      value: s(x.state) as PublicationState,
      effectiveFrom: iso(x.effective_from),
      recordedBy: s(x.recorded_by),
      reason: s(x.reason),
    }))
  }

  // ── 再生 ───────────────────────────────────────────────
  async insertPlayIfAbsent(p: PlayRecord) {
    const r = await this.rows(
      `insert into utatane.plays (version_id, listener_ty_account_id, source, idempotency_key, played_at)
       values ($1, $2, $3, $4, $5) on conflict (version_id, idempotency_key) do nothing returning id`,
      [p.versionId, p.listenerTyAccountId, p.source, p.idempotencyKey, p.playedAt],
    )
    return { inserted: r.length === 1 }
  }
  async countPlays(versionId: Id) {
    const r = await this.rows<{ n: number | string }>('select count(*)::int as n from utatane.plays where version_id = $1', [versionId])
    return Number(r[0]?.n ?? 0)
  }

  // ── プロフィール ─────────────────────────────────────────
  async getProfile(tyAccountId: Id): Promise<ProfileRecord | null> {
    const r = await this.rows('select * from utatane.profiles where ty_account_id = $1', [tyAccountId])
    if (!r.length) return null
    return { tyAccountId: s(r[0].ty_account_id), artistName: sOrNull(r[0].artist_name), bio: sOrNull(r[0].bio), updatedAt: iso(r[0].updated_at) }
  }
}
