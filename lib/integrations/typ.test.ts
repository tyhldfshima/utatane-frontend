import { describe, expect, it } from 'vitest'
import { INITIAL_PERMISSION_RULE, revalidateForPublish, type Contribution, type Version } from '../domain'
import { buildDistributionSnapshot, typCentralNotConfigured } from './typ'

const T0 = '2026-01-01T00:00:00Z'
const T1 = '2026-02-01T00:00:00Z'

const melodyA: Contribution = { id: 'melodyA', roleKindId: 'melody', holderIds: ['A'], birthVersionId: 'VA', createdAt: T0 }
const arrB: Contribution = { id: 'arrB', roleKindId: 'arrangement', holderIds: ['B'], birthVersionId: 'VB', createdAt: T1 }

const version: Version = {
  id: 'VB',
  hostHolderId: 'B',
  publishedAt: null,
  contributions: [
    { contributionId: 'melodyA', relation: 'referenced' },
    { contributionId: 'arrB', relation: 'created' },
  ],
  materialIds: [],
}

const contributions = new Map([melodyA, arrB].map((c) => [c.id, c]))
const policies = [{ contributionId: 'melodyA', holderId: null, versionNo: 1, mode: 'free' as const, scope: 'any_version' as const, effectiveAt: T0 }]
const derivations = [{ childId: 'arrB', parentId: 'melodyA', kind: 'based_on' }]

describe('分配の写し（中央へ渡す形）', () => {
  it('公開時の再検証に通った Version だけ写しを作り、由来と受取人 id を渡す', () => {
    const check = revalidateForPublish(version, { contributions, materials: new Map(), policies, permissions: [], coauthorMethods: new Map(), rule: INITIAL_PERMISSION_RULE }, T1)
    expect(check.passed).toBe(true)
    const snap = buildDistributionSnapshot({
      version,
      publishCheck: check,
      contributions,
      materials: new Map(),
      derivations,
      roleNatures: new Map([['melody', 'work'], ['arrangement', 'work']]),
      beneficiaryOf: (h) => (h === 'A' ? 'ben-A' : null),
      revenueRuleVersionId: 'rule-v1',
    })
    const m = snap.contributions.find((x) => x.contributionId === 'melodyA')!
    expect(m.holders).toEqual([{ rightsHolderId: 'A', beneficiaryId: 'ben-A' }])
    expect(m.generation).toBe(0)
    expect(m.paths).toHaveLength(2) // 直接の参照と、編曲B の由来
    expect(snap.contributions.find((x) => x.contributionId === 'arrB')!.createdInThisVersion).toBe(true)
    expect(snap.revenueRuleVersionId).toBe('rule-v1')
  })

  it('再検証に通っていなければ写しを作らない', () => {
    const failed = { versionId: 'VB', checkedAt: T1, permissionRuleVersion: 1, passed: false, items: [], materialIssues: [] }
    expect(() =>
      buildDistributionSnapshot({ version, publishCheck: failed, contributions, materials: new Map(), derivations, roleNatures: new Map(), beneficiaryOf: () => null, revenueRuleVersionId: 'r' }),
    ).toThrow('version_not_revalidated')
  })

  it('中央の口が未設定なら、呼んだ時点で分かる失敗にする', async () => {
    await expect(typCentralNotConfigured.giftToVersion({ idempotencyKey: 'k', versionId: 'VB', amount: 1 })).rejects.toThrow('typ_central_not_configured')
  })
})
