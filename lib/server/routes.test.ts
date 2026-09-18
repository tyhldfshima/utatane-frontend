import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as createVersion } from '@/app/api/v1/versions/route'
import { GET as getVersion } from '@/app/api/v1/versions/[id]/route'
import { POST as addContribution } from '@/app/api/v1/versions/[id]/contributions/route'
import { POST as publish } from '@/app/api/v1/versions/[id]/publish/route'
import { POST as addMaterial } from '@/app/api/v1/versions/[id]/materials/route'
import { POST as play } from '@/app/api/v1/versions/[id]/plays/route'
import { GET as channel } from '@/app/api/v1/profiles/[id]/channel/route'
import { AuthFailure } from './auth'
import { setContainerForTesting } from './container'
import { CoreService } from './core-service'
import { MemoryRepository } from './memory-repository'

// 試験用の本人確認：「Bearer <アカウント>」をそのまま本人とみなす
const fakeAuth = {
  async verify(header: string | null) {
    if (!header) throw new AuthFailure(401, 'missing_token')
    return header.replace('Bearer ', '')
  },
}

beforeEach(() => setContainerForTesting({ service: new CoreService({ repo: new MemoryRepository() }), auth: fakeAuth }))
afterEach(() => setContainerForTesting(null))

const req = (method: string, body?: unknown, as?: string) =>
  new Request('http://localhost/api', {
    method,
    headers: as ? { authorization: `Bearer ${as}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('API の口（Route Handlers・手元の保存）', () => {
  it('本人確認の無い書き込みは 401', async () => {
    const r = await createVersion(req('POST', { title: 'x' }))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'missing_token' })
  })

  it('下書き → 貢献 → 公開 の順に通る。公開後は 409 で中身を変えられない', async () => {
    const created = await createVersion(req('POST', { title: '種' }, 'A'))
    expect(created.status).toBe(201)
    const { version } = await created.json()
    const params = { params: { id: version.id } }

    const c = await addContribution(req('POST', { mode: 'create', roleKindId: 'melody' }, 'A'), params)
    expect(c.status).toBe(201)

    const p = await publish(req('POST', undefined, 'A'), params)
    expect(p.status).toBe(200)
    expect((await p.json()).published).toBe(true)

    const again = await addContribution(req('POST', { mode: 'create', roleKindId: 'lyrics' }, 'A'), params)
    expect(again.status).toBe(409)

    const view = await getVersion(req('GET'), params)
    expect(view.status).toBe(200)
    expect((await view.json()).publicationState).toBe('public')
  })

  it('公開時の再検証に通らなければ 409 publish_check_failed と判定の中身を返す', async () => {
    const a = await (await createVersion(req('POST', { title: '種' }, 'A'))).json()
    const aParams = { params: { id: a.version.id } }
    const { contribution } = await (await addContribution(req('POST', { mode: 'create', roleKindId: 'melody' }, 'A'), aParams)).json()
    await publish(req('POST', undefined, 'A'), aParams)

    const b = await (await createVersion(req('POST', { title: '派生' }, 'B'))).json()
    const bParams = { params: { id: b.version.id } }
    await addContribution(req('POST', { mode: 'reference', contributionId: contribution.id }, 'B'), bParams)
    const r = await publish(req('POST', undefined, 'B'), bParams)
    expect(r.status).toBe(409)
    const body = await r.json()
    expect(body.error).toBe('publish_check_failed')
    expect(body.check.items[0].reason).toBe('consent_missing')

    // 下書きは主催以外に見えない
    expect((await getVersion(req('GET', undefined, 'C'), bParams)).status).toBe(404)
    expect((await getVersion(req('GET', undefined, 'B'), bParams)).status).toBe(200)
  })

  it('素材は出どころの申告が無ければ 422', async () => {
    const v = await (await createVersion(req('POST', { title: 'x' }, 'A'))).json()
    const params = { params: { id: v.version.id } }
    const { contribution } = await (await addContribution(req('POST', { mode: 'create', roleKindId: 'melody' }, 'A'), params)).json()
    const r = await addMaterial(req('POST', { storageFileId: 'f', embodiedContributionIds: [contribution.id] }, 'A'), params)
    expect(r.status).toBe(422)
    expect((await r.json()).error).toBe('provenance_required')
  })

  it('再生はログインしていなくても記録でき、同じ鍵は1回だけ。チャンネルは公開済みだけ出る', async () => {
    const v = await (await createVersion(req('POST', { title: '歌' }, 'A'))).json()
    const params = { params: { id: v.version.id } }
    await addContribution(req('POST', { mode: 'create', roleKindId: 'vocal' }, 'A'), params)
    expect((await (await channel(req('GET'), { params: { id: 'A' } })).json()).own).toEqual([])
    await publish(req('POST', undefined, 'A'), params)

    expect((await (await play(req('POST', { idempotencyKey: 'k' }), params)).json()).plays).toBe(1)
    expect((await (await play(req('POST', { idempotencyKey: 'k' }), params)).json()).plays).toBe(1)
    const ch = await (await channel(req('GET'), { params: { id: 'A' } })).json()
    expect(ch.own.map((x: { versionId: string }) => x.versionId)).toEqual([v.version.id])
  })
})
