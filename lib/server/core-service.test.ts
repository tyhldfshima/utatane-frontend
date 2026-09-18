import { beforeEach, describe, expect, it } from 'vitest'
import { CoreError, CoreService } from './core-service'
import { MemoryRepository } from './memory-repository'

let n = 0
let t = 0
const newId = () => `id-${++n}`
// 呼ぶたびに1秒進む時計（由来の時間の順を確かめるため）
const now = () => new Date(Date.UTC(2026, 8, 19, 0, 0, t++)).toISOString()

let repo: MemoryRepository
let svc: CoreService

beforeEach(() => {
  n = 0
  t = 0
  repo = new MemoryRepository()
  svc = new CoreService({ repo, newId, now })
})

async function seedByA() {
  const v = await svc.createDraft('A', '春の伴奏')
  const melody = await svc.createContribution({ tyAccountId: 'A', versionId: v.id, roleKindId: 'melody' })
  const r = await svc.publish({ tyAccountId: 'A', versionId: v.id })
  expect(r.published).toBe(true)
  return { v, melody }
}

describe('投稿（下書き → 貢献 → 公開）', () => {
  it('種を置いて公開できる。公開した後は中身を足せない（新しい Version を作る）', async () => {
    const { v } = await seedByA()
    await expect(svc.createContribution({ tyAccountId: 'A', versionId: v.id, roleKindId: 'lyrics' })).rejects.toMatchObject({ status: 409, code: 'published_version_is_immutable' })
    const view = await svc.getVersionView(v.id)
    expect(view.publicationState).toBe('public')
    expect(view.latestPublishCheck?.passed).toBe(true)
  })

  it('主催でない人は下書きを変えられない', async () => {
    const v = await svc.createDraft('A', 'x')
    await expect(svc.createContribution({ tyAccountId: 'B', versionId: v.id, roleKindId: 'melody' })).rejects.toMatchObject({ status: 403 })
  })

  it('題名が無い・知らない役割は受け付けない', async () => {
    await expect(svc.createDraft('A', ' ')).rejects.toBeInstanceOf(CoreError)
    const v = await svc.createDraft('A', 'x')
    await expect(svc.createContribution({ tyAccountId: 'A', versionId: v.id, roleKindId: 'no_such_role' })).rejects.toMatchObject({ code: 'role_kind_not_found' })
  })
})

describe('公開時の再検証を通らない Version は公開できない', () => {
  it('ほかの人の貢献（初期値＝申請→承認）は、許可が無いと公開されず、許可の後に公開される', async () => {
    const { melody } = await seedByA()
    const d = await svc.createDraft('B', '詞をつけた歌')
    await svc.createContribution({ tyAccountId: 'B', versionId: d.id, roleKindId: 'lyrics' })
    await svc.referenceContribution({ tyAccountId: 'B', versionId: d.id, contributionId: melody.id })

    const first = await svc.publish({ tyAccountId: 'B', versionId: d.id })
    expect(first.published).toBe(false)
    expect(first.check.items.find((i) => i.contributionId === melody.id)?.reason).toBe('consent_missing')
    expect((await repo.getVersion(d.id))?.publishedAt).toBeNull()

    const req = await svc.requestPermission({ tyAccountId: 'B', draftVersionId: d.id, contributionId: melody.id, idempotencyKey: 'k1' })
    // 同じ鍵なら同じ申請（冪等）
    expect((await svc.requestPermission({ tyAccountId: 'B', draftVersionId: d.id, contributionId: melody.id, idempotencyKey: 'k1' })).id).toBe(req.id)
    // 作者でない人は返事できない
    await expect(svc.respondToPermissionRequest({ tyAccountId: 'C', requestId: req.id, approve: true })).rejects.toMatchObject({ status: 403 })
    const p = await svc.respondToPermissionRequest({ tyAccountId: 'A', requestId: req.id, approve: true })
    expect(p?.basis).toBe('request_approval')

    const second = await svc.publish({ tyAccountId: 'B', versionId: d.id })
    expect(second.published).toBe(true)
    // 公開の試みごとに記録が残る（消さない）
    expect((await repo.listPublishChecks(d.id)).map((c) => c.passed)).toEqual([false, true])
  })

  it('作者が「使えない」にした貢献は、申請しても公開できない', async () => {
    const { melody } = await seedByA()
    await svc.setPolicy({ tyAccountId: 'A', contributionId: melody.id, mode: 'forbidden', scope: 'any_version' })
    const d = await svc.createDraft('B', 'x')
    await svc.referenceContribution({ tyAccountId: 'B', versionId: d.id, contributionId: melody.id })
    const r = await svc.publish({ tyAccountId: 'B', versionId: d.id })
    expect(r.published).toBe(false)
    expect(r.check.items[0].reason).toBe('policy_forbidden')
  })

  it('一緒に作った人は、参加を承認するまで公開できない（承認された参加だけが正式）', async () => {
    const d = await svc.createDraft('A', 'デュエット')
    await svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'vocal', coAuthorTyAccountIds: ['C'] })
    const r1 = await svc.publish({ tyAccountId: 'A', versionId: d.id })
    expect(r1.published).toBe(false)
    expect(r1.participationIssues).toHaveLength(1)
    await svc.respondToInvitation({ tyAccountId: 'C', versionId: d.id, accept: true })
    expect((await svc.publish({ tyAccountId: 'A', versionId: d.id })).published).toBe(true)
  })

  it('素材は出どころの申告が無いと入れられない', async () => {
    const d = await svc.createDraft('A', 'x')
    const c = await svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'melody' })
    await expect(svc.addMaterial({ tyAccountId: 'A', versionId: d.id, storageFileId: 'f1', embodiedContributionIds: [c.id], provenance: null })).rejects.toMatchObject({ code: 'provenance_required' })
    const m = await svc.addMaterial({ tyAccountId: 'A', versionId: d.id, storageFileId: 'f1', embodiedContributionIds: [c.id], provenance: { kind: 'self_made' } })
    expect(m.provenance?.declaredBy).toBeTruthy()
  })
})

describe('受取人の結び（D-2：初めて貢献を作ったとき）', () => {
  it('中央につながれば受取人 id を結ぶ', async () => {
    const calls: string[] = []
    svc = new CoreService({ repo, newId, now, beneficiaries: { ensureBeneficiary: async ({ tyAccountId }) => { calls.push(tyAccountId); return `ben-${tyAccountId}` } } })
    const d = await svc.createDraft('A', 'x')
    await svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'melody' })
    await svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'lyrics' })
    expect((await repo.findHolderByAccount('A'))?.centralBeneficiaryId).toBe('ben-A')
    expect(calls).toEqual(['A']) // 結んだ後は呼ばない
  })

  it('中央につながらなくても貢献は作れる（未連携のまま・後で結ぶ）', async () => {
    const d = await svc.createDraft('A', 'x')
    await svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'melody' })
    expect((await repo.findHolderByAccount('A'))?.centralBeneficiaryId).toBeNull()
  })
})

describe('再生（冪等）', () => {
  it('同じ鍵の再生は1回だけ数える。公開していない Version は数えない', async () => {
    const { v } = await seedByA()
    expect((await svc.recordPlay({ versionId: v.id, tyAccountId: null, idempotencyKey: 'p1' })).plays).toBe(1)
    expect(await svc.recordPlay({ versionId: v.id, tyAccountId: null, idempotencyKey: 'p1' })).toEqual({ recorded: false, plays: 1 })
    const d = await svc.createDraft('A', 'draft')
    await expect(svc.recordPlay({ versionId: d.id, tyAccountId: null, idempotencyKey: 'p2' })).rejects.toMatchObject({ status: 409 })
  })
})

describe('チャンネルと Version Tree', () => {
  it('自分の作品／参加作品／自分の貢献が使われた作品に分かれ、同じ Version は1回だけ出る', async () => {
    const { v: vA, melody } = await seedByA()
    await svc.setPolicy({ tyAccountId: 'A', contributionId: melody.id, mode: 'free', scope: 'any_version' })
    // B が A の曲を使う（A は参加していない）
    const vB = await svc.createDraft('B', 'B の歌')
    await svc.createContribution({ tyAccountId: 'B', versionId: vB.id, roleKindId: 'lyrics', coAuthorTyAccountIds: ['C'] })
    await svc.referenceContribution({ tyAccountId: 'B', versionId: vB.id, contributionId: melody.id })
    await svc.respondToInvitation({ tyAccountId: 'C', versionId: vB.id, accept: true })

    // 公開前は、ほかの人のチャンネルに出ない
    expect((await svc.getChannel('A')).used).toEqual([])
    expect((await svc.getChannel('B')).own).toEqual([])
    expect((await svc.getChannel('B', 'B')).own.map((x) => x.versionId)).toEqual([vB.id]) // 本人には下書きも出る
    expect((await svc.publish({ tyAccountId: 'B', versionId: vB.id })).published).toBe(true)

    const a = await svc.getChannel('A')
    expect(a.own.map((x) => x.versionId)).toEqual([vA.id])
    expect(a.used.map((x) => x.versionId)).toEqual([vB.id])
    expect(a.used[0].usedRoles).toEqual(['melody'])
    expect(a.participated).toEqual([])

    const c = await svc.getChannel('C')
    expect(c.participated.map((x) => x.versionId)).toEqual([vB.id])
    expect(c.own).toEqual([])

    const b = await svc.getChannel('B')
    expect(b.own.map((x) => x.versionId)).toEqual([vB.id])
    expect(b.used).toEqual([]) // 自分の作品に出たものは重ねて出さない
  })

  it('由来を世代ごとにまとめ、下流の1段を出す', async () => {
    const { v: vA, melody } = await seedByA()
    await svc.setPolicy({ tyAccountId: 'A', contributionId: melody.id, mode: 'free', scope: 'any_version' })
    const vB = await svc.createDraft('B', '編曲した歌')
    await svc.createContribution({ tyAccountId: 'B', versionId: vB.id, roleKindId: 'arrangement', derivedFrom: [{ parentId: melody.id, kind: 'based_on' }] })
    // 下書きは参加者にだけ見える
    await expect(svc.getTree(vB.id)).rejects.toMatchObject({ status: 404 })
    await expect(svc.getVersionView(vB.id, 'C')).rejects.toMatchObject({ status: 404 })
    const tree = await svc.getTree(vB.id, 'B')
    expect(tree.upstream.map((g) => g.generation)).toEqual([0, 1])
    expect(tree.upstream[1].entries[0].contributionId).toBe(melody.id)

    await svc.referenceContribution({ tyAccountId: 'B', versionId: vB.id, contributionId: melody.id })
    expect((await svc.getTree(vA.id)).downstream).toEqual([]) // 下書きは下流に出さない
    expect((await svc.publish({ tyAccountId: 'B', versionId: vB.id })).published).toBe(true)
    const treeA = await svc.getTree(vA.id)
    expect(treeA.downstream.map((d) => d.versionId)).toEqual([vB.id])
  })

  it('元にする貢献が無ければ由来を作らない', async () => {
    const d = await svc.createDraft('A', 'x')
    await expect(svc.createContribution({ tyAccountId: 'A', versionId: d.id, roleKindId: 'arrangement', derivedFrom: [{ parentId: 'nope', kind: 'based_on' }] })).rejects.toMatchObject({ code: 'parent_contribution_not_found' })
  })
})
