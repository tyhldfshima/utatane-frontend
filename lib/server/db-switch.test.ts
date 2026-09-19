// 保存先の切り替え（UTATANE 専用 DB）の試験
// ・画面・API の経路が、本物の PostgreSQL（PGlite に移行ファイル 0001 を流したもの）に書いて読めること
// ・UTATANE_DATABASE_URL が無いときは、既定の保存へ落とさず 503 utatane_database_not_configured で止まること
// ・まとめて書く所（公開・貢献の作成・許可の返事）が、途中で失敗したら全部戻ること（メモリ版・Postgres 版の両方）
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as createVersion } from '@/app/api/v1/versions/route'
import { GET as getVersion } from '@/app/api/v1/versions/[id]/route'
import { POST as addContribution } from '@/app/api/v1/versions/[id]/contributions/route'
import { POST as publish } from '@/app/api/v1/versions/[id]/publish/route'
import { POST as play } from '@/app/api/v1/versions/[id]/plays/route'
import { GET as channel } from '@/app/api/v1/profiles/[id]/channel/route'
import { AuthFailure } from './auth'
import { getContainer, setContainerForTesting } from './container'
import { CoreError, CoreService } from './core-service'
import { MemoryRepository } from './memory-repository'
import { PgRepository } from './pg-repository'
import type { CoreRepository } from './repository'
import { freshUtataneDb } from './testing/pglite'

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const A = uuid('0000000a', 1)
const B = uuid('0000000b', 2)

const fakeAuth = {
  async verify(header: string | null) {
    if (!header) throw new AuthFailure(401, 'missing_token')
    return header.replace('Bearer ', '')
  },
}

const req = (method: string, body?: unknown, as?: string) =>
  new Request('http://localhost/api', {
    method,
    headers: as ? { authorization: `Bearer ${as}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  })

afterEach(() => setContainerForTesting(null))

describe('保存先の切り替え：UTATANE_DATABASE_URL が無いとき', () => {
  const saved = process.env.UTATANE_DATABASE_URL
  beforeEach(() => {
    delete process.env.UTATANE_DATABASE_URL
    setContainerForTesting(null)
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.UTATANE_DATABASE_URL
    else process.env.UTATANE_DATABASE_URL = saved
  })

  it('部品を作る所で 503 utatane_database_not_configured（メモリへ落とさない）', () => {
    expect(() => getContainer({})).toThrow(CoreError)
    try {
      getContainer({})
    } catch (e) {
      expect(e).toMatchObject({ status: 503, code: 'utatane_database_not_configured' })
    }
  })

  it('書く口・見る口・再生の口のどれも 503 で返す', async () => {
    const w = await createVersion(req('POST', { title: 'x' }, A))
    expect(w.status).toBe(503)
    expect((await w.json()).error).toBe('utatane_database_not_configured')

    const r = await getVersion(req('GET'), { params: { id: uuid('10000000', 1) } })
    expect(r.status).toBe(503)
    expect((await r.json()).error).toBe('utatane_database_not_configured')

    const p = await play(req('POST', { idempotencyKey: 'k' }, A), { params: { id: uuid('10000000', 1) } })
    expect(p.status).toBe(503)
    expect((await p.json()).error).toBe('utatane_database_not_configured')
  })

  it('設定があれば、つなぎに行く前に部品はできる（接続は最初の問い合わせのとき）', () => {
    const c = getContainer({ UTATANE_DATABASE_URL: 'postgres://placeholder.invalid:6543/postgres' })
    expect(c.service).toBeInstanceOf(CoreService)
  })
})

describe('API の経路が UTATANE 専用 DB（PGlite・移行ファイル 0001）に書いて読める', () => {
  it('下書き → 貢献 → 公開 → Version を見る → チャンネル → 再生 が DB に残る', async () => {
    const { pg, client } = await freshUtataneDb()
    setContainerForTesting({ service: new CoreService({ repo: new PgRepository(client) }), auth: fakeAuth })

    const { version } = await (await createVersion(req('POST', { title: '春の伴奏' }, A))).json()
    const params = { params: { id: version.id } }
    expect((await addContribution(req('POST', { mode: 'create', roleKindId: 'melody' }, A), params)).status).toBe(201)
    const pub = await publish(req('POST', undefined, A), params)
    expect(pub.status).toBe(200)
    expect((await pub.json()).published).toBe(true)

    const view = await (await getVersion(req('GET'), params)).json()
    expect(view.publicationState).toBe('public')
    expect(view.participants.map((p: { state: string }) => p.state)).toEqual(['host'])

    const ch = await (await channel(req('GET'), { params: { id: A } })).json()
    expect(ch.own.map((x: { versionId: string }) => x.versionId)).toEqual([version.id])

    expect((await (await play(req('POST', { idempotencyKey: 'p1' }), params)).json()).plays).toBe(1)
    expect((await (await play(req('POST', { idempotencyKey: 'p1' }), params)).json()).plays).toBe(1)

    // DB の中に実際に残っていること
    const n = async (q: string) => Number(((await pg.query<{ n: number }>(q)).rows[0] as { n: number }).n)
    expect(await n(`select count(*)::int as n from utatane.versions where published_at is not null`)).toBe(1)
    expect(await n(`select count(*)::int as n from utatane.publish_checks where passed`)).toBe(1)
    expect(await n(`select count(*)::int as n from utatane.publication_events where state = 'public'`)).toBe(1)
    expect(await n(`select count(*)::int as n from utatane.contributions`)).toBe(1)
    expect(await n(`select count(*)::int as n from utatane.plays`)).toBe(1)
  })
})

// ── まとめて書く所が、途中で失敗したら全部戻ること ────────────────────

/** 指定した口を呼ぶと失敗する保存の口（まとまりの中の保存の口も同じように包む） */
function failingAt(target: CoreRepository, method: keyof CoreRepository): CoreRepository {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === 'transaction') {
        return <T>(fn: (r: CoreRepository) => Promise<T>) => t.transaction((inner) => fn(failingAt(inner, method)))
      }
      if (prop === method) {
        return async () => {
          throw new Error(`injected_failure:${String(method)}`)
        }
      }
      const v = Reflect.get(t, prop, receiver)
      return typeof v === 'function' ? v.bind(t) : v
    },
  })
}

const backends: { name: string; make: () => Promise<CoreRepository> }[] = [
  { name: '手元の保存（メモリ）', make: async () => new MemoryRepository() },
  { name: 'Postgres 版（PGlite）', make: async () => new PgRepository((await freshUtataneDb()).client) },
]

describe.each(backends)('まとめて書く所の巻き戻し — $name', ({ make }) => {
  let n = 0
  let t = 0
  const newId = () => uuid('10000000', ++n)
  const now = () => new Date(Date.UTC(2026, 8, 19, 0, 0, t++)).toISOString()
  let repo: CoreRepository

  beforeEach(async () => {
    n = 0
    t = 0
    repo = await make()
  })

  it('公開：公開状態の新版の書き込みで失敗したら、再検証の記録も公開日時も残らない', async () => {
    const ok = new CoreService({ repo, newId, now })
    const v = await ok.createDraft(A, '歌')
    await ok.createContribution({ tyAccountId: A, versionId: v.id, roleKindId: 'vocal' })

    const broken = new CoreService({ repo: failingAt(repo, 'appendPublicationEvent'), newId, now })
    await expect(broken.publish({ tyAccountId: A, versionId: v.id })).rejects.toThrow('injected_failure:appendPublicationEvent')

    expect((await repo.getVersion(v.id))?.publishedAt).toBeNull()
    expect(await repo.listPublishChecks(v.id)).toEqual([])
    expect(await repo.listPublicationEvents(v.id)).toEqual([])

    // 壊れていない口なら、そのあと普通に公開できる
    expect((await ok.publish({ tyAccountId: A, versionId: v.id })).published).toBe(true)
    expect(await repo.listPublishChecks(v.id)).toHaveLength(1)
  })

  it('貢献の作成：Version の中身への追加で失敗したら、貢献も作者も残らない', async () => {
    const ok = new CoreService({ repo, newId, now })
    const v = await ok.createDraft(A, '歌')
    const broken = new CoreService({ repo: failingAt(repo, 'addVersionContribution'), newId, now })
    await expect(broken.createContribution({ tyAccountId: A, versionId: v.id, roleKindId: 'melody' })).rejects.toThrow('injected_failure')

    const holder = await repo.findHolderByAccount(A)
    expect(await repo.listContributionsByHolder(holder!.id)).toEqual([])
    expect((await repo.getVersion(v.id))?.contributions).toEqual([])
  })

  it('許可の返事：Permission の記録で失敗したら、返事の記録も残らない', async () => {
    const ok = new CoreService({ repo, newId, now })
    const va = await ok.createDraft(A, '種')
    const melody = await ok.createContribution({ tyAccountId: A, versionId: va.id, roleKindId: 'melody' })
    await ok.publish({ tyAccountId: A, versionId: va.id })
    const vb = await ok.createDraft(B, '派生')
    await ok.referenceContribution({ tyAccountId: B, versionId: vb.id, contributionId: melody.id })
    const r = await ok.requestPermission({ tyAccountId: B, draftVersionId: vb.id, contributionId: melody.id, idempotencyKey: 'k' })

    const broken = new CoreService({ repo: failingAt(repo, 'insertPermission'), newId, now })
    await expect(broken.respondToPermissionRequest({ tyAccountId: A, requestId: r.id, approve: true })).rejects.toThrow('injected_failure')
    expect((await repo.getPermissionRequest(r.id))?.responses).toEqual([])
    expect(await repo.listPermissionsForDraft(vb.id)).toEqual([])

    // やり直せば通る（返事が1回だけ記録される）
    expect(await ok.respondToPermissionRequest({ tyAccountId: A, requestId: r.id, approve: true })).not.toBeNull()
    expect((await repo.getPermissionRequest(r.id))?.responses).toHaveLength(1)
  })
})
