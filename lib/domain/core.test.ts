import { describe, expect, it } from 'vitest'
import {
  INITIAL_PERMISSION_RULE,
  appendVersion,
  assertContentEditable,
  canAddDerivation,
  evaluateCoauthorConsent,
  evaluateContributionUse,
  permissionFromRecruitment,
  requiredContributionsOf,
  revalidateForPublish,
  traceVersionLineage,
  versionAt,
  type Contribution,
  type Derivation,
  type Material,
  type Permission,
  type PermissionRule,
  type PublishContext,
  type ReusePolicyVersion,
  type Version,
} from './index'

// ── 見本のデータ（A さんが1人で詞A・曲A・編曲A・歌唱A を作った Version A） ──

const T0 = '2026-01-01T00:00:00Z'
const T1 = '2026-02-01T00:00:00Z'
const T2 = '2026-03-01T00:00:00Z'
const T3 = '2026-04-01T00:00:00Z'
const T4 = '2026-05-01T00:00:00Z'

const c = (id: string, role: string, holders: string[], birth: string, at = T0): Contribution => ({
  id,
  roleKindId: role,
  holderIds: holders,
  birthVersionId: birth,
  createdAt: at,
})

const lyricsA = c('lyricsA', 'lyrics', ['A'], 'VA')
const melodyA = c('melodyA', 'melody', ['A'], 'VA')
const arrA = c('arrA', 'arrangement', ['A'], 'VA')
const vocalA = c('vocalA', 'vocal', ['A'], 'VA')

/** えふさん例の条件：詞A＝承認／曲A＝自由／編曲A＝このVersionのみ／歌唱A＝使えない */
const policiesA: ReusePolicyVersion[] = [
  { contributionId: 'lyricsA', holderId: null, versionNo: 1, mode: 'approval', scope: 'any_version', effectiveAt: T0 },
  { contributionId: 'melodyA', holderId: null, versionNo: 1, mode: 'free', scope: 'any_version', effectiveAt: T0 },
  { contributionId: 'arrA', holderId: null, versionNo: 1, mode: 'free', scope: 'this_version_only', effectiveAt: T0 },
  { contributionId: 'vocalA', holderId: null, versionNo: 1, mode: 'forbidden', scope: 'any_version', effectiveAt: T0 },
]

const accompanimentA: Material = {
  id: 'mAccA',
  storageFileId: 'f1',
  embodiedContributionIds: ['melodyA', 'arrA'],
  provenance: { kind: 'self_made', declaredBy: 'A', declaredAt: T0 },
}
const melodyGuideA: Material = {
  id: 'mGuideA',
  storageFileId: 'f2',
  embodiedContributionIds: ['melodyA'],
  provenance: { kind: 'self_made', declaredBy: 'A', declaredAt: T0 },
}

const perm = (over: Partial<Permission> & Pick<Permission, 'id' | 'contributionId' | 'granteeHolderId' | 'draftVersionId'>): Permission => ({
  basis: 'request_approval',
  grantorHolderIds: ['A'],
  policyVersionNoAtGrant: 1,
  permissionRuleVersionAtGrant: 1,
  events: [{ kind: 'granted', actorHolderId: 'A', at: T1 }],
  ...over,
})

const ctx = (over: Partial<PublishContext> = {}): PublishContext => ({
  contributions: new Map([lyricsA, melodyA, arrA, vocalA].map((x) => [x.id, x])),
  materials: new Map([accompanimentA, melodyGuideA].map((m) => [m.id, m])),
  policies: policiesA,
  permissions: [],
  coauthorMethods: new Map(),
  rule: INITIAL_PERMISSION_RULE,
  ...over,
})

const draft = (id: string, host: string, refs: string[], created: Contribution[] = [], materialIds: string[] = []): Version => ({
  id,
  hostHolderId: host,
  publishedAt: null,
  contributions: [
    ...refs.map((cid) => ({ contributionId: cid, relation: 'referenced' as const })),
    ...created.map((x) => ({ contributionId: x.id, relation: 'created' as const })),
  ],
  materialIds,
})

const withCreated = (base: PublishContext, created: Contribution[]): PublishContext => ({
  ...base,
  contributions: new Map([...Array.from(base.contributions), ...created.map((x) => [x.id, x] as const)]),
})

// ── 由来（全世代・一意・輪の守り） ─────────────────────────────

describe('由来のたどり方', () => {
  // ケース61：A の曲 → B が編曲 → C が再編曲 → D がさらに派生
  const arrB = c('arrB', 'arrangement', ['B'], 'VB', T1)
  const arrC = c('arrC', 'arrangement', ['C'], 'VC', T2)
  const derivations: Derivation[] = [
    { childId: 'arrB', parentId: 'melodyA', kind: 'based_on' },
    { childId: 'arrC', parentId: 'arrB', kind: 'based_on' },
  ]
  const accC: Material = {
    id: 'mAccC',
    storageFileId: 'f3',
    embodiedContributionIds: ['melodyA', 'arrC'],
    provenance: { kind: 'self_made', declaredBy: 'C', declaredAt: T2 },
  }
  const vD = draft('VD', 'D', [], [c('vocalD', 'vocal', ['D'], 'VD', T3)], ['mAccC'])

  it('D から A まで全世代たどれ、曲A は一意（道は2本残る）', () => {
    const lineage = traceVersionLineage(vD, new Map([[accC.id, accC]]), derivations)
    const ids = lineage.map((e) => e.contributionId).sort()
    expect(ids).toEqual(['arrB', 'arrC', 'melodyA', 'vocalD'])
    const melody = lineage.find((e) => e.contributionId === 'melodyA')!
    expect(melody.generation).toBe(0) // 素材が直接収めている
    expect(melody.paths).toHaveLength(2) // 素材の道と、編曲の由来の道
    expect(melody.paths.map((p) => p.chain.length).sort()).toEqual([1, 3])
    expect(lineage.find((e) => e.contributionId === 'arrB')!.generation).toBe(1)
  })

  it('使っていない貢献は候補に入らない（ケース50：曲A だけを使う F 版）', () => {
    const vF = draft('VF', 'F', ['melodyA'], [c('lyricsF', 'lyrics', ['F'], 'VF', T1)])
    const ids = Array.from(requiredContributionsOf(vF, new Map()).keys())
    expect(ids).toContain('melodyA')
    expect(ids).not.toContain('vocalA')
    expect(ids).not.toContain('arrA')
  })

  it('時間の順でない矢印・輪になる矢印・自分への矢印は足せない（ケース58）', () => {
    const arrBc = c('arrB', 'arrangement', ['B'], 'VB', T1)
    const melodyAc = c('melodyA', 'melody', ['A'], 'VA', T0)
    expect(canAddDerivation(derivations, arrBc, melodyAc)).toEqual({ ok: true })
    // 古い貢献が新しい貢献を元にすることはできない
    expect(canAddDerivation(derivations, melodyAc, arrBc)).toEqual({ ok: false, reason: 'not_earlier' })
    // 時間を偽っても、輪になるなら足せない
    const lateMelody = { ...melodyAc, createdAt: T4 }
    expect(canAddDerivation(derivations, lateMelody, arrC)).toEqual({ ok: false, reason: 'would_create_cycle' })
    expect(canAddDerivation(derivations, arrBc, arrBc)).toEqual({ ok: false, reason: 'self_reference' })
  })

  it('データに輪があっても止まる', () => {
    const loop: Derivation[] = [
      { childId: 'x', parentId: 'y', kind: 'based_on' },
      { childId: 'y', parentId: 'x', kind: 'based_on' },
    ]
    const v = draft('VX', 'Z', ['x'])
    const lineage = traceVersionLineage(v, new Map(), loop)
    expect(lineage.map((e) => e.contributionId).sort()).toEqual(['x', 'y'])
  })
})

// ── 許諾（ポリシーと個別の許諾を分ける・公開時に判定） ─────────────────

describe('許諾の判定', () => {
  it('初期値（ポリシー無し）は申請→承認：許諾が無ければ不通過', () => {
    const r = evaluateContributionUse({
      contribution: c('lyricsX', 'lyrics', ['X'], 'VX'),
      draftVersionId: 'VN',
      granteeHolderId: 'N',
      policies: [],
      permissions: [],
      rule: INITIAL_PERMISSION_RULE,
      coauthorMethod: null,
      at: T2,
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('consent_missing')
  })

  it('B：詞A（承認）は許諾があれば通る（ケース46）', () => {
    const newMelody = c('melodyB', 'melody', ['B'], 'VB', T1)
    const vB = draft('VB', 'B', ['lyricsA'], [newMelody])
    const before = revalidateForPublish(vB, withCreated(ctx(), [newMelody]), T2)
    expect(before.passed).toBe(false)
    const p = perm({ id: 'p1', contributionId: 'lyricsA', granteeHolderId: 'B', draftVersionId: 'VB' })
    const after = revalidateForPublish(vB, withCreated(ctx({ permissions: [p] }), [newMelody]), T2)
    expect(after.passed).toBe(true)
    expect(after.items.find((i) => i.contributionId === 'lyricsA')!.usedPermissionIds).toEqual(['p1'])
  })

  it('D：伴奏の素材は編曲A（このVersionのみ）を収めるので使えない。旋律のガイド素材なら通る（ケース48）', () => {
    const vocalD = c('vocalD', 'vocal', ['D'], 'VD', T1)
    const p = perm({ id: 'p2', contributionId: 'lyricsA', granteeHolderId: 'D', draftVersionId: 'VD' })
    const withAcc = draft('VD', 'D', ['lyricsA'], [vocalD], ['mAccA'])
    const r1 = revalidateForPublish(withAcc, withCreated(ctx({ permissions: [p] }), [vocalD]), T2)
    expect(r1.passed).toBe(false)
    expect(r1.items.find((i) => i.contributionId === 'arrA')!.reason).toBe('policy_forbidden')

    const withGuide = draft('VD', 'D', ['lyricsA'], [vocalD], ['mGuideA'])
    const r2 = revalidateForPublish(withGuide, withCreated(ctx({ permissions: [p] }), [vocalD]), T2)
    expect(r2.passed).toBe(true)
  })

  it('歌唱A（使えない）は参照できない', () => {
    const v = draft('VQ', 'Q', ['vocalA'])
    const r = revalidateForPublish(v, ctx(), T2)
    expect(r.passed).toBe(false)
    expect(r.items[0].reason).toBe('policy_forbidden')
  })

  describe('承認の後・公開前に「使えない」へ変わった（ケース63・許諾ルール R2）', () => {
    const tightened: ReusePolicyVersion[] = [
      ...policiesA,
      { contributionId: 'lyricsA', holderId: null, versionNo: 2, mode: 'forbidden', scope: 'any_version', effectiveAt: T2 },
    ]
    const newMelody = c('melodyS', 'melody', ['S'], 'VS', T1)
    const vS = draft('VS', 'S', ['lyricsA'], [newMelody])
    const run = (p: Permission, rule: PermissionRule) =>
      revalidateForPublish(vS, withCreated(ctx({ policies: tightened, permissions: [p], rule }), [newMelody]), T3)
    const granted = perm({ id: 'p3', contributionId: 'lyricsA', granteeHolderId: 'S', draftVersionId: 'VS' })

    it('R2 未確定の間は、許可した人の「残す」の記録が無ければ不通過（安全側）', () => {
      const r = run(granted, INITIAL_PERMISSION_RULE)
      expect(r.passed).toBe(false)
      expect(r.items[0].invalidPermissions).toEqual([{ id: 'p3', reason: 'needs_grantor_choice' }])
    })
    it('許可した人が「残す」を選んでいれば通る。成立の記録は書き換わらない', () => {
      const kept: Permission = {
        ...granted,
        events: [...granted.events, { kind: 'kept_on_policy_change', actorHolderId: 'A', at: T2 }],
      }
      expect(run(kept, INITIAL_PERMISSION_RULE).passed).toBe(true)
      expect(kept.policyVersionNoAtGrant).toBe(1)
    })
    it('R2 の値を「失効する」「残る」にした場合', () => {
      expect(run(granted, { version: 2, r2OnPolicyTightened: 'expires' }).passed).toBe(false)
      expect(run(granted, { version: 2, r2OnPolicyTightened: 'survives' }).passed).toBe(true)
    })
  })

  it('取り消された許諾では通らない', () => {
    const newMelody = c('melodyR', 'melody', ['R'], 'VR', T1)
    const p = perm({
      id: 'p4',
      contributionId: 'lyricsA',
      granteeHolderId: 'R',
      draftVersionId: 'VR',
      events: [
        { kind: 'granted', actorHolderId: 'A', at: T1 },
        { kind: 'revoked', actorHolderId: 'A', at: T2 },
      ],
    })
    const r = revalidateForPublish(draft('VR', 'R', ['lyricsA'], [newMelody]), withCreated(ctx({ permissions: [p] }), [newMelody]), T3)
    expect(r.passed).toBe(false)
  })

  it('許諾はその下書き1つに対してだけ効く', () => {
    const newMelody = c('melodyR2', 'melody', ['R'], 'VR2', T1)
    const p = perm({ id: 'p5', contributionId: 'lyricsA', granteeHolderId: 'R', draftVersionId: 'VR' })
    const r = revalidateForPublish(draft('VR2', 'R', ['lyricsA'], [newMelody]), withCreated(ctx({ permissions: [p] }), [newMelody]), T3)
    expect(r.passed).toBe(false)
  })
})

// ── 共作（全員承認か委任・どちらか1人は無い・アカウント状態と権利は別） ──────────

describe('共作の同意', () => {
  const holders = ['A', 'B']

  it('承認方式を決めていなければ全員承認。1人だけでは通らない', () => {
    const r = evaluateCoauthorConsent({ holderIds: holders, method: null, consentedHolderIds: ['A'], delegateApproved: false, requesterHolderId: 'Z' })
    expect(r.satisfied).toBe(false)
    expect(r.missingHolderIds).toEqual(['B'])
  })

  it('全員が前もって委任していれば、代表者の承認で通る', () => {
    const method = { kind: 'delegated' as const, delegateHolderId: 'A', delegatedBy: ['A', 'B'] }
    const r = evaluateCoauthorConsent({ holderIds: holders, method, consentedHolderIds: ['A'], delegateApproved: true, requesterHolderId: 'Z' })
    expect(r).toEqual({ satisfied: true, basis: 'delegated', missingHolderIds: [] })
  })

  it('委任がそろっていなければ代表者の承認だけでは通らない', () => {
    const method = { kind: 'delegated' as const, delegateHolderId: 'A', delegatedBy: ['A'] }
    const r = evaluateCoauthorConsent({ holderIds: holders, method, consentedHolderIds: ['A'], delegateApproved: true, requesterHolderId: 'Z' })
    expect(r.satisfied).toBe(false)
  })

  it('代表者自身の利用は委任の外（全員承認が要る）', () => {
    const method = { kind: 'delegated' as const, delegateHolderId: 'A', delegatedBy: ['A', 'B'] }
    const r = evaluateCoauthorConsent({ holderIds: holders, method, consentedHolderIds: ['A'], delegateApproved: true, requesterHolderId: 'A' })
    expect(r.satisfied).toBe(false)
    expect(r.missingHolderIds).toEqual(['B'])
  })

  it('代表者が退会すると委任は他へ移らず止まる。権利者が退会しても権利は消えない（ケース62）', () => {
    const method = { kind: 'delegated' as const, delegateHolderId: 'A', delegatedBy: ['A', 'B'] }
    const states = new Map([['A', 'withdrawn' as const]])
    const r = evaluateCoauthorConsent({ holderIds: holders, method, consentedHolderIds: ['A'], delegateApproved: true, requesterHolderId: 'Z', accountStates: states })
    expect(r.satisfied).toBe(false)
    // 退会した B の同意が要る場面は、B の同意が無い限り止まる（他の人の判断で解かない）
    const r2 = evaluateCoauthorConsent({ holderIds: holders, method: null, consentedHolderIds: ['A'], delegateApproved: false, requesterHolderId: 'Z', accountStates: new Map([['B', 'withdrawn' as const]]) })
    expect(r2.satisfied).toBe(false)
  })

  it('共作の詞：A は自由・B は承認なら、B の承認で通る（ケース59）', () => {
    const lyricsAB = c('lyricsAB', 'lyrics', ['A', 'B'], 'VAB')
    const policies: ReusePolicyVersion[] = [
      { contributionId: 'lyricsAB', holderId: 'A', versionNo: 1, mode: 'free', scope: 'any_version', effectiveAt: T0 },
      { contributionId: 'lyricsAB', holderId: 'B', versionNo: 2, mode: 'approval', scope: 'any_version', effectiveAt: T0 },
    ]
    const base = { contribution: lyricsAB, draftVersionId: 'VW', granteeHolderId: 'W', policies, rule: INITIAL_PERMISSION_RULE, coauthorMethod: null, at: T2 }
    expect(evaluateContributionUse({ ...base, permissions: [] }).ok).toBe(false)
    const p = perm({ id: 'p6', contributionId: 'lyricsAB', granteeHolderId: 'W', draftVersionId: 'VW', grantorHolderIds: ['B'], policyVersionNoAtGrant: 2 })
    expect(evaluateContributionUse({ ...base, permissions: [p] }).ok).toBe(true)
  })
})

// ── 募集の事前承認（追補3 #2・ケース65） ─────────────────────────

describe('募集の事前承認', () => {
  const recruitment = { id: 'r1', contributionIds: ['lyricsA'], preapproved: true, grantorHolderIds: ['A'], openedAt: T0, closedAt: T3 }
  let n = 0
  const newId = () => `rp${++n}`

  it('参加が成立すると Permission が1件記録され、公開時の再検証を通る', () => {
    const p = permissionFromRecruitment({ recruitment, contributionId: 'lyricsA', applicantHolderId: 'E', draftVersionId: 'VE', policyVersionNo: 1, rule: INITIAL_PERMISSION_RULE, at: T1, newId })
    expect(p).not.toBeNull()
    expect(p!.basis).toBe('recruitment_preapproval')
    const newMelody = c('melodyE', 'melody', ['E'], 'VE', T1)
    const r = revalidateForPublish(draft('VE', 'E', ['lyricsA'], [newMelody]), withCreated(ctx({ permissions: [p!] }), [newMelody]), T2)
    expect(r.passed).toBe(true)
  })

  it('閉じた後・対象外・事前承認でない募集からは作らない', () => {
    const args = { contributionId: 'lyricsA', applicantHolderId: 'E', draftVersionId: 'VE', policyVersionNo: 1, rule: INITIAL_PERMISSION_RULE, newId }
    expect(permissionFromRecruitment({ ...args, recruitment, at: T4 })).toBeNull()
    expect(permissionFromRecruitment({ ...args, recruitment, contributionId: 'melodyA', at: T1 })).toBeNull()
    expect(permissionFromRecruitment({ ...args, recruitment: { ...recruitment, preapproved: false }, at: T1 })).toBeNull()
  })
})

// ── 持ち込み素材の出どころ（追補3 #4・ケース64） ──────────────────────

describe('持ち込み素材の出どころ', () => {
  const vocalU = c('vocalU', 'vocal', ['U'], 'VX')
  const mixX: Material = {
    id: 'mMixX',
    storageFileId: 'f9',
    embodiedContributionIds: ['melodyA', 'vocalU'],
    provenance: { kind: 'self_made', declaredBy: 'U', declaredAt: T1 },
  }

  it('出どころの申告が無い素材は公開できない', () => {
    const noDecl: Material = { ...melodyGuideA, id: 'mNo', provenance: null }
    const v = draft('VZ', 'Z', [], [], ['mNo'])
    const r = revalidateForPublish(v, ctx({ materials: new Map([[noDecl.id, noDecl]]) }), T2)
    expect(r.passed).toBe(false)
    expect(r.materialIssues[0].reason).toBe('provenance_missing')
  })

  it('混ざった音源から抜き出した歌声は、元の貢献を全部収めていないと公開できない', () => {
    const extracted: Material = {
      id: 'mExt',
      storageFileId: 'f10',
      embodiedContributionIds: ['vocalU'], // 曲A を収めていない
      provenance: { kind: 'from_utatane_material', declaredBy: 'Z', declaredAt: T2, sourceMaterialId: 'mMixX' },
    }
    const v = draft('VZ', 'Z', [], [], ['mExt'])
    const materials = new Map([mixX, extracted].map((m) => [m.id, m]))
    const r = revalidateForPublish(v, withCreated(ctx({ materials }), [vocalU]), T3)
    expect(r.passed).toBe(false)
    expect(r.materialIssues[0]).toEqual({ materialId: 'mExt', reason: 'source_contributions_not_embodied', missingContributionIds: ['melodyA'] })
  })
})

// ── 履歴つきの新版と、公開済み Version を書き換えないこと ─────────────────

describe('履歴つきの新版', () => {
  it('上書きせず追記し、過去の時点の版を引ける', () => {
    let h = appendVersion<string>([], { value: 'public', effectiveFrom: T1, recordedBy: 'A', reason: '公開' })
    h = appendVersion(h, { value: 'private', effectiveFrom: T3, recordedBy: 'A', reason: '取り下げ' })
    expect(h.map((x) => x.seq)).toEqual([1, 2])
    expect(versionAt(h, T2)?.value).toBe('public')
    expect(versionAt(h, T4)?.value).toBe('private')
    expect(versionAt(h, T0)).toBeNull()
    expect(() => appendVersion(h, { value: 'public', effectiveFrom: T2, recordedBy: 'A', reason: '過去へ' })).toThrow('history_not_forward')
  })

  it('公開済みの Version は中身を変えられない', () => {
    const published: Version = { ...draft('VA', 'A', []), publishedAt: T0 }
    expect(() => assertContentEditable(published)).toThrow('published_version_is_immutable')
    expect(() => revalidateForPublish(published, ctx(), T1)).toThrow('already_published')
  })
})
