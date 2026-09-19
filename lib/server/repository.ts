// lib/server/repository.ts — 保存の口（リポジトリの型）
//
// UTATANE の音楽データ（Version・Contribution・素材・許諾・参加者など）の読み書きは、必ずこの口を通す。
// いまは試験用の手元の保存（memory-repository.ts）で動かす。
// ★専用 DB（Supabase・東京）ができたら、この口の中身（Supabase 版の実装）だけを足して差し替える。
//   サービス（core-service.ts）と API の口（app/api/v1）は変えない。
// ★ポイント台帳・残高・取引・報酬は持たない（point.ty-hld.com の責務）。中央の id を参照として持つだけ。

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
  Version,
} from '../domain/types'
import type { PublishCheck } from '../domain/publish'
import type { Recruitment } from '../domain/permissions'

export interface RightsHolderRecord {
  id: Id
  tyAccountId: Id | null
  /** 中央の受取人 id。未連携なら null（D-2：初めて貢献を作ったときに結ぶ） */
  centralBeneficiaryId: Id | null
  createdAt: Timestamp
}

export interface VersionRecord extends Version {
  title: string
  createdAt: Timestamp
}

export type ParticipantState = 'invited' | 'requested' | 'accepted' | 'declined' | 'left' | 'anonymized'

export interface ParticipantRecord {
  versionId: Id
  rightsHolderId: Id
  /** 状態の履歴（追記だけ） */
  events: { state: ParticipantState; at: Timestamp; recordedBy: Id | null }[]
}

export interface PermissionRequestRecord {
  id: Id
  contributionId: Id
  requesterHolderId: Id
  draftVersionId: Id
  message: string | null
  idempotencyKey: string
  createdAt: Timestamp
  responses: { responderHolderId: Id; answer: 'approved' | 'declined' | 'expired'; at: Timestamp }[]
}

export interface PublishCheckRecord extends PublishCheck {
  id: Id
}

export interface PlayRecord {
  versionId: Id
  listenerTyAccountId: Id | null
  source: string | null
  idempotencyKey: string
  playedAt: Timestamp
}

export interface ProfileRecord {
  tyAccountId: Id
  artistName: string | null
  bio: string | null
  updatedAt: Timestamp
}

export interface CoreRepository {
  /**
   * まとめて書く口。fn の中の書き込みは、全部入るか全部戻るかのどちらか（途中で失敗したら全部戻す）。
   * fn には、そのまとまりの中で使う保存の口が渡る。まとまりの中でさらに呼んでも、外側のまとまりに入る。
   */
  transaction<T>(fn: (repo: CoreRepository) => Promise<T>): Promise<T>

  // 役割
  listRoleKinds(): Promise<RoleKind[]>

  // 権利者
  findHolderByAccount(tyAccountId: Id): Promise<RightsHolderRecord | null>
  getHolder(id: Id): Promise<RightsHolderRecord | null>
  insertHolder(h: RightsHolderRecord): Promise<void>
  setCentralBeneficiary(holderId: Id, beneficiaryId: Id): Promise<void>

  // Version
  insertVersion(v: VersionRecord): Promise<void>
  getVersion(id: Id): Promise<VersionRecord | null>
  /** 下書きの中身の追加だけ。公開済みには呼ばない（サービスが確かめる。DB でもトリガーで止める） */
  addVersionContribution(versionId: Id, contributionId: Id, relation: 'created' | 'referenced'): Promise<void>
  addVersionMaterial(versionId: Id, materialId: Id): Promise<void>
  markPublished(versionId: Id, at: Timestamp): Promise<void>
  listVersionsByHost(holderId: Id): Promise<VersionRecord[]>
  listVersionsUsingContributions(contributionIds: Id[]): Promise<VersionRecord[]>

  // 貢献と由来
  insertContribution(c: Contribution): Promise<void>
  getContribution(id: Id): Promise<Contribution | null>
  getContributions(ids: Id[]): Promise<Contribution[]>
  listContributionsByHolder(holderId: Id): Promise<Contribution[]>
  insertDerivation(d: Derivation): Promise<void>
  listDerivations(): Promise<Derivation[]>

  // 再利用ポリシー・共作の承認方式
  insertPolicyVersion(p: ReusePolicyVersion): Promise<void>
  listPolicies(contributionIds: Id[]): Promise<ReusePolicyVersion[]>
  getCoauthorMethods(contributionIds: Id[]): Promise<Map<Id, CoauthorApprovalMethod>>

  // 素材
  insertMaterial(m: Material): Promise<void>
  getMaterials(ids: Id[]): Promise<Material[]>

  // 参加
  upsertParticipantEvent(versionId: Id, holderId: Id, event: ParticipantRecord['events'][number]): Promise<void>
  listParticipants(versionId: Id): Promise<ParticipantRecord[]>
  listParticipationsByHolder(holderId: Id): Promise<ParticipantRecord[]>

  // 許諾
  currentPermissionRule(): Promise<PermissionRule>
  insertPermissionRequest(r: PermissionRequestRecord): Promise<void>
  findPermissionRequestByKey(requesterHolderId: Id, idempotencyKey: string): Promise<PermissionRequestRecord | null>
  getPermissionRequest(id: Id): Promise<PermissionRequestRecord | null>
  addPermissionRequestResponse(id: Id, r: PermissionRequestRecord['responses'][number]): Promise<void>
  insertPermission(p: Permission): Promise<void>
  addPermissionEvent(permissionId: Id, e: PermissionEvent): Promise<void>
  listPermissionsForDraft(draftVersionId: Id): Promise<Permission[]>

  // 募集
  listOpenRecruitmentsByHolder(holderId: Id): Promise<Recruitment[]>

  // 公開の再検証・公開状態（追記だけ）
  insertPublishCheck(c: PublishCheckRecord): Promise<void>
  listPublishChecks(versionId: Id): Promise<PublishCheckRecord[]>
  appendPublicationEvent(versionId: Id, e: HistoryEntry<PublicationState>): Promise<void>
  listPublicationEvents(versionId: Id): Promise<HistoryEntry<PublicationState>[]>

  // 再生
  insertPlayIfAbsent(p: PlayRecord): Promise<{ inserted: boolean }>
  countPlays(versionId: Id): Promise<number>

  // プロフィール
  getProfile(tyAccountId: Id): Promise<ProfileRecord | null>
}
