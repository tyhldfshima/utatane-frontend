// lib/domain/publish.ts — 公開時の再検証
//
// 公開しようとするたびに、参照した貢献と、使う素材が収める貢献のすべてについて、
// 公開時点で有効な許諾がそろっているかを確かめ、その結果を1件の記録として返す（③：消さない）。
// 持ち込み素材は出どころの申告が必須（追補3 #4）。
// 「UTATANE 内の素材から作った」素材は、元の素材が収める貢献をすべて収めていなければならない
// （歌声の抜き出しで条件をすり抜けない：ケース64）。

import { requiredContributionsOf } from './lineage'
import { evaluateContributionUse, type ContributionUseResult } from './permissions'
import type {
  AccountState,
  CoauthorApprovalMethod,
  Contribution,
  Id,
  Material,
  Permission,
  PermissionRule,
  ReusePolicyVersion,
  Timestamp,
  Version,
} from './types'

export interface MaterialIssue {
  materialId: Id
  reason: 'provenance_missing' | 'source_material_missing' | 'source_contributions_not_embodied'
  missingContributionIds?: Id[]
}

export interface PublishCheckItem extends ContributionUseResult {
  contributionId: Id
}

export interface PublishCheck {
  versionId: Id
  checkedAt: Timestamp
  permissionRuleVersion: number
  passed: boolean
  items: PublishCheckItem[]
  materialIssues: MaterialIssue[]
}

export interface PublishContext {
  contributions: Map<Id, Contribution>
  materials: Map<Id, Material>
  policies: readonly ReusePolicyVersion[]
  permissions: readonly Permission[]
  coauthorMethods: Map<Id, CoauthorApprovalMethod>
  rule: PermissionRule
  accountStates?: Map<Id, AccountState>
}

export function checkMaterials(version: Version, materials: Map<Id, Material>): MaterialIssue[] {
  const issues: MaterialIssue[] = []
  for (const mid of version.materialIds) {
    const m = materials.get(mid)
    if (!m) throw new Error(`material_not_found:${mid}`)
    if (!m.provenance) {
      issues.push({ materialId: mid, reason: 'provenance_missing' })
      continue
    }
    if (m.provenance.kind === 'from_utatane_material') {
      const src = m.provenance.sourceMaterialId ? materials.get(m.provenance.sourceMaterialId) : undefined
      if (!src) {
        issues.push({ materialId: mid, reason: 'source_material_missing' })
        continue
      }
      const missing = src.embodiedContributionIds.filter((c) => !m.embodiedContributionIds.includes(c))
      if (missing.length) {
        issues.push({ materialId: mid, reason: 'source_contributions_not_embodied', missingContributionIds: missing })
      }
    }
  }
  return issues
}

/** 公開時の再検証。ホスト（主催者）を利用する人として判定する */
export function revalidateForPublish(
  version: Version,
  ctx: PublishContext,
  at: Timestamp,
): PublishCheck {
  if (version.publishedAt !== null) throw new Error('already_published')
  const materialIssues = checkMaterials(version, ctx.materials)
  const items: PublishCheckItem[] = []
  for (const cid of Array.from(requiredContributionsOf(version, ctx.materials).keys())) {
    const c = ctx.contributions.get(cid)
    if (!c) throw new Error(`contribution_not_found:${cid}`)
    const r = evaluateContributionUse({
      contribution: c,
      draftVersionId: version.id,
      granteeHolderId: version.hostHolderId,
      policies: ctx.policies,
      permissions: ctx.permissions,
      rule: ctx.rule,
      coauthorMethod: ctx.coauthorMethods.get(cid) ?? null,
      accountStates: ctx.accountStates,
      at,
    })
    items.push({ contributionId: cid, ...r })
  }
  return {
    versionId: version.id,
    checkedAt: at,
    permissionRuleVersion: ctx.rule.version,
    passed: materialIssues.length === 0 && items.every((i) => i.ok),
    items,
    materialIssues,
  }
}
