// lib/integrations/typ.ts — TYP の中央基盤（point.ty-hld.com）とつなぐ所のインターフェース
//
// ★この便では TYP の台帳・残高・購入・出金を作らない。接続する所の形だけを切る。
// ・UTATANE → 中央：贈る・残高・履歴・「なぜ届いたか」の明細（TypCentralClient）
// ・中央 → UTATANE：分配の算定に使う Version の写し（buildDistributionSnapshot の形で UTATANE が返す）
// 金額・換算・分配率はここで決めない（Revenue Rule の版 id を渡すだけ）。

import { traceVersionLineage, type LineagePath } from '../domain/lineage'
import type { PublishCheck } from '../domain/publish'
import type { Contribution, Derivation, Id, Material, RoleNature, Timestamp, Version } from '../domain/types'

// ── UTATANE → 中央 ─────────────────────────────────────────

export interface GiftToVersionRequest {
  /** 端末で「贈る」画面を開いたときに作る UUID。同じ鍵は1回として扱われる */
  idempotencyKey: string
  versionId: Id
  amount: number
  message?: string
}

export type GiftResult =
  | { status: 'recorded'; giftId: Id; recordedAt: Timestamp }
  | { status: 'rejected'; reason: string }

export type OperationLookup =
  | { status: 'recorded'; giftId: Id }
  | { status: 'not_recorded' }
  | { status: 'processing' }

export interface TypCentralClient {
  giftToVersion(req: GiftToVersionRequest): Promise<GiftResult>
  /** 通信が切れたときに、同じ鍵で「記録されたか」を確かめる */
  lookupOperation(idempotencyKey: string): Promise<OperationLookup>
}

/** 中央の口が決まるまでの既定。呼ばれたら分かる形で失敗する（どこかの住所へ落とさない） */
export const typCentralNotConfigured: TypCentralClient = {
  async giftToVersion() {
    throw new Error('typ_central_not_configured')
  },
  async lookupOperation() {
    throw new Error('typ_central_not_configured')
  },
}

// ── 中央 → UTATANE：分配の算定に使う写し ─────────────────────────

export interface SnapshotHolder {
  rightsHolderId: Id
  /** 中央の受取人 id（権利の持ち主。アカウント id ではない）。未連携なら null */
  beneficiaryId: Id | null
}

export interface SnapshotContribution {
  contributionId: Id
  roleKindId: Id
  nature: RoleNature
  holders: SnapshotHolder[]
  /** いちばん近い道での世代（0＝その Version が使った貢献） */
  generation: number
  /** 当たった道の全部（道ごとに数えるか1回かは Revenue Rule が決める） */
  paths: LineagePath[]
  /** この Version で新しく作った貢献か */
  createdInThisVersion: boolean
}

export interface DistributionSnapshot {
  versionId: Id
  /** 贈与の時点でこの Version に適用されていた Revenue Rule の版 */
  revenueRuleVersionId: Id
  /** 公開時の再検証の記録と、そこで使った Permission の id（許諾の写し） */
  publishCheckedAt: Timestamp
  usedPermissionIds: Id[]
  contributions: SnapshotContribution[]
}

/**
 * 中央が算定に使う写しを作る。由来は全世代を渡し、範囲・重みは中央が Rule の版で決める。
 * 公開時の再検証に通っていない Version の写しは作らない。
 */
export function buildDistributionSnapshot(args: {
  version: Version
  publishCheck: PublishCheck
  contributions: Map<Id, Contribution>
  materials: Map<Id, Material>
  derivations: Derivation[]
  roleNatures: Map<Id, RoleNature>
  beneficiaryOf: (rightsHolderId: Id) => Id | null
  revenueRuleVersionId: Id
}): DistributionSnapshot {
  const { version, publishCheck } = args
  if (publishCheck.versionId !== version.id || !publishCheck.passed) {
    throw new Error('version_not_revalidated')
  }
  const created = new Set(version.contributions.filter((x) => x.relation === 'created').map((x) => x.contributionId))
  const lineage = traceVersionLineage(version, args.materials, args.derivations)
  return {
    versionId: version.id,
    revenueRuleVersionId: args.revenueRuleVersionId,
    publishCheckedAt: publishCheck.checkedAt,
    usedPermissionIds: Array.from(new Set(publishCheck.items.flatMap((i) => i.usedPermissionIds))),
    contributions: lineage.map((e) => {
      const c = args.contributions.get(e.contributionId)
      if (!c) throw new Error(`contribution_not_found:${e.contributionId}`)
      const nature = args.roleNatures.get(c.roleKindId)
      if (!nature) throw new Error(`role_kind_not_found:${c.roleKindId}`)
      return {
        contributionId: c.id,
        roleKindId: c.roleKindId,
        nature,
        holders: c.holderIds.map((h) => ({ rightsHolderId: h, beneficiaryId: args.beneficiaryOf(h) })),
        generation: e.generation,
        paths: e.paths,
        createdInThisVersion: created.has(c.id),
      }
    }),
  }
}
