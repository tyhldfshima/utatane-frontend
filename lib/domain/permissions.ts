// lib/domain/permissions.ts — 再利用ポリシーと、個別に成立した許諾（Permission/Consent）の判定
//
// ・①貢献の現在の再利用ポリシー ②個別に成立した Permission ③公開時の再検証の結果 を別の物として扱う。
//   ①を変えても②は書き換えない（追補3 33章）。
// ・判定は公開時に行う（確定7）。初期商品ルール＝公開時点で有効な許諾が必須（R1）。
// ・公開前にポリシーが厳しくなったとき、成立済みの許諾が失効するかは許諾ルール R2 で決める。
//   R2 が未確定の間は安全側＝許可した人の「残す」の記録が無ければ不通過。

import { evaluateCoauthorConsent } from './coauthor'
import type {
  AccountState,
  CoauthorApprovalMethod,
  Contribution,
  Id,
  Permission,
  PermissionRule,
  ReuseMode,
  ReusePolicyVersion,
  Timestamp,
} from './types'
import { DEFAULT_REUSE_MODE } from './types'

const MODE_RANK: Record<ReuseMode, number> = { free: 0, approval: 1, forbidden: 2 }

/** その作者に効くポリシーの版（ある日時に有効なもの）。作者ごとの版が無ければ全員向けの版 */
export function policyFor(
  policies: readonly ReusePolicyVersion[],
  contributionId: Id,
  holderId: Id,
  at: Timestamp,
): ReusePolicyVersion | null {
  const effective = policies
    .filter((p) => p.contributionId === contributionId && p.effectiveAt <= at)
    .sort((a, b) => a.versionNo - b.versionNo)
  const own = effective.filter((p) => p.holderId === holderId)
  if (own.length) return own[own.length - 1]
  const all = effective.filter((p) => p.holderId === null)
  return all.length ? all[all.length - 1] : null
}

/** 新しい Version から見た実質の可否（scope を mode に畳む） */
export function effectiveMode(
  policy: ReusePolicyVersion | null,
  granteeHolderId: Id,
): ReuseMode {
  if (!policy) return DEFAULT_REUSE_MODE
  if (policy.scope === 'this_version_only') return 'forbidden'
  if (policy.scope === 'named_holders' && !(policy.namedHolderIds ?? []).includes(granteeHolderId)) {
    return 'forbidden'
  }
  return policy.mode
}

function lastEvent(p: Permission) {
  return p.events[p.events.length - 1]
}

export type PermissionValidity =
  | { valid: true }
  | { valid: false; reason: 'revoked' | 'expired_by_rule' | 'needs_grantor_choice' }

/**
 * 成立済みの Permission が、公開の時点で有効か。
 * @param tightenedSinceGrant 成立の後にポリシーが厳しくなったか
 */
export function permissionValidity(
  p: Permission,
  rule: PermissionRule,
  tightenedSinceGrant: boolean,
): PermissionValidity {
  const last = lastEvent(p)
  if (!last || last.kind === 'revoked' || last.kind === 'revoked_on_policy_change') {
    return { valid: false, reason: 'revoked' }
  }
  if (!tightenedSinceGrant) return { valid: true }
  switch (rule.r2OnPolicyTightened) {
    case 'survives':
      return { valid: true }
    case 'expires':
      return { valid: false, reason: 'expired_by_rule' }
    case 'grantor_chooses':
    case 'undecided':
      return last.kind === 'kept_on_policy_change'
        ? { valid: true }
        : { valid: false, reason: 'needs_grantor_choice' }
  }
}

export interface ContributionUseInput {
  contribution: Contribution
  draftVersionId: Id
  granteeHolderId: Id
  policies: readonly ReusePolicyVersion[]
  /** この貢献・この下書きについて成立した Permission */
  permissions: readonly Permission[]
  rule: PermissionRule
  coauthorMethod: CoauthorApprovalMethod | null
  accountStates?: Map<Id, AccountState>
  at: Timestamp
}

export interface ContributionUseResult {
  ok: boolean
  reason:
    | 'created_in_this_version'
    | 'consent_satisfied'
    | 'policy_forbidden'
    | 'consent_missing'
  missingHolderIds: Id[]
  /** 判定に使った Permission の id（③の記録と、TYP 算定の許諾の写しに使う） */
  usedPermissionIds: Id[]
  /** 判定に使ったポリシーの版（作者ごと） */
  policyVersionNos: Record<Id, number | null>
  /** 無効と判定した Permission と理由 */
  invalidPermissions: { id: Id; reason: string }[]
}

/**
 * 1つの貢献を、ある下書き Version で使ってよいかを、公開時点の条件で判定する。
 */
export function evaluateContributionUse(input: ContributionUseInput): ContributionUseResult {
  const { contribution: c, draftVersionId, granteeHolderId: grantee, at } = input
  const base = {
    missingHolderIds: [] as Id[],
    usedPermissionIds: [] as Id[],
    policyVersionNos: {} as Record<Id, number | null>,
    invalidPermissions: [] as { id: Id; reason: string }[],
  }
  if (c.birthVersionId === draftVersionId) {
    return { ok: true, reason: 'created_in_this_version', ...base }
  }

  const consented = new Set<Id>()
  let blocked = false
  let delegateApproved = false
  const livePermissions = input.permissions.filter(
    (p) => p.contributionId === c.id && p.draftVersionId === draftVersionId && p.granteeHolderId === grantee,
  )

  // 作者ごとに、公開時点のポリシーと成立済みの Permission を突き合わせる
  const permissionCovers = (holder: Id): Permission | null => {
    for (const p of livePermissions) {
      if (!p.grantorHolderIds.includes(holder)) continue
      const nowPolicy = policyFor(input.policies, c.id, holder, at)
      const nowMode = effectiveMode(nowPolicy, grantee)
      const grantPolicy = input.policies.find(
        (x) => x.contributionId === c.id && x.versionNo === p.policyVersionNoAtGrant,
      )
      const grantMode = effectiveMode(grantPolicy ?? null, grantee)
      const tightened = MODE_RANK[nowMode] > MODE_RANK[grantMode]
      const v = permissionValidity(p, input.rule, tightened)
      if (v.valid) return p
      base.invalidPermissions.push({ id: p.id, reason: v.reason })
    }
    return null
  }

  for (const holder of c.holderIds) {
    const policy = policyFor(input.policies, c.id, holder, at)
    base.policyVersionNos[holder] = policy ? policy.versionNo : null
    if (holder === grantee) {
      consented.add(holder) // 自分の貢献を自分が使う
      continue
    }
    const mode = effectiveMode(policy, grantee)
    const p = permissionCovers(holder)
    if (p) {
      consented.add(holder)
      base.usedPermissionIds.push(p.id)
      if (p.basis === 'delegated_approval') delegateApproved = true
      continue
    }
    if (mode === 'free') consented.add(holder)
    else if (mode === 'forbidden') blocked = true
  }

  // 委任に基づく承認（代表者1人の Permission）は、上の繰り返しで代表者の行として拾われ、
  // delegateApproved が立つ。全員分を満たすかは承認方式の判定に任せる。
  const consent = evaluateCoauthorConsent({
    holderIds: c.holderIds,
    method: input.coauthorMethod,
    consentedHolderIds: Array.from(consented),
    delegateApproved,
    requesterHolderId: grantee,
    accountStates: input.accountStates,
  })
  if (consent.satisfied) {
    return { ...base, ok: true, reason: 'consent_satisfied', missingHolderIds: [] }
  }
  return {
    ...base,
    ok: false,
    reason: blocked ? 'policy_forbidden' : 'consent_missing',
    missingHolderIds: consent.missingHolderIds,
  }
}

// ── 募集の事前承認（追補3 #2） ─────────────────────────────────

export interface Recruitment {
  id: Id
  contributionIds: Id[]
  preapproved: boolean
  /** 募集を出した権利者（共作なら承認方式に沿って全員、または委任を受けた代表者） */
  grantorHolderIds: Id[]
  openedAt: Timestamp
  closedAt: Timestamp | null
}

/**
 * 募集への参加が成立したときに、事前承認から Permission を1件作る。
 * 募集が閉じていた・事前承認でない・募集の対象外なら null（通常の申請に戻る）。
 */
export function permissionFromRecruitment(args: {
  recruitment: Recruitment
  contributionId: Id
  applicantHolderId: Id
  draftVersionId: Id
  policyVersionNo: number
  rule: PermissionRule
  at: Timestamp
  newId: () => Id
}): Permission | null {
  const r = args.recruitment
  if (!r.preapproved) return null
  if (!r.contributionIds.includes(args.contributionId)) return null
  if (args.at < r.openedAt) return null
  if (r.closedAt !== null && r.closedAt <= args.at) return null
  return {
    id: args.newId(),
    contributionId: args.contributionId,
    granteeHolderId: args.applicantHolderId,
    draftVersionId: args.draftVersionId,
    basis: 'recruitment_preapproval',
    grantorHolderIds: r.grantorHolderIds,
    policyVersionNoAtGrant: args.policyVersionNo,
    permissionRuleVersionAtGrant: args.rule.version,
    events: [{ kind: 'granted', actorHolderId: null, at: args.at }],
  }
}
