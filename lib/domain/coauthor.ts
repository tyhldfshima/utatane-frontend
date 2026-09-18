// lib/domain/coauthor.ts — 共作の同意
//
// 承認方式は「全員承認」か「代表者へ承認権限を委任（全員が事前に委任）」だけ（追補3 #3）。
// 「どちらか1人の承認」は持たない。承認方式を決めていない共作は全員承認として扱う。
// 代表者自身が利用する人になる申請は、委任の範囲の外（全員承認）。
// アカウント状態（退会・連絡不能など）で権利は消えない。止まったものを後から1人の判断で解く形は持たない。

import type { AccountState, CoauthorApprovalMethod, Id } from './types'

export interface CoauthorConsentInput {
  holderIds: Id[]
  method: CoauthorApprovalMethod | null
  /** その利用に同意した権利者（自由の設定・承認・本人の利用） */
  consentedHolderIds: Id[]
  /** 代表者が委任に基づいて承認したか */
  delegateApproved: boolean
  /** 利用する人 */
  requesterHolderId: Id
  accountStates?: Map<Id, AccountState>
}

export interface CoauthorConsentResult {
  satisfied: boolean
  basis: 'all' | 'delegated'
  missingHolderIds: Id[]
}

/** 委任が有効か＝代表者が権利者の1人で、権利者全員の委任の記録がそろっている */
export function isDelegationValid(holderIds: Id[], method: CoauthorApprovalMethod | null): boolean {
  if (!method || method.kind !== 'delegated') return false
  if (!holderIds.includes(method.delegateHolderId)) return false
  return holderIds.every((h) => method.delegatedBy.includes(h))
}

export function evaluateCoauthorConsent(input: CoauthorConsentInput): CoauthorConsentResult {
  const { holderIds, method, consentedHolderIds, delegateApproved, requesterHolderId } = input
  const missingAll = holderIds.filter((h) => !consentedHolderIds.includes(h))

  const delegationUsable =
    isDelegationValid(holderIds, method) &&
    method !== null &&
    method.kind === 'delegated' &&
    // 代表者自身の利用は委任の外
    method.delegateHolderId !== requesterHolderId &&
    // 代表者が動けない（退会・停止・連絡不能・死亡の届出）ときは、委任は他へ移らない
    (input.accountStates?.get(method.delegateHolderId) ?? 'active') === 'active'

  if (delegationUsable && delegateApproved) {
    return { satisfied: true, basis: 'delegated', missingHolderIds: [] }
  }
  return { satisfied: missingAll.length === 0, basis: 'all', missingHolderIds: missingAll }
}
