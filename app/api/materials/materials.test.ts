import { describe, it, expect, afterEach } from 'vitest'
import { POST as presign } from './presign/route'
import { GET as listMaterials } from './route'
import { GET as play } from './[id]/play/route'
import {
  UTATANE_NAMESPACE,
  createStorageClient,
  setStorageClient,
  storageConfigFromEnv,
  StorageNotConfigured,
  type StorageClient,
} from '@/lib/server/storage'
import { MAX_BYTES, isValidSizeBytes, validateFileName } from '@/lib/materials/rules'

// 素材の口の試験。★外（保管サービス）は差し替えて、1回も呼ばない。
// 守る事：本人の場所にだけ置ける／ブラウザから他人の利用者 id を送っても使われない／
//         他人の素材の読む用 URL は断られる／未ログインは 401。

const BEARER = 'Bearer ty-token-of-someone'

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

/** 呼ばれた内容を控える、差し替え用の保管サービス。 */
function spyClient(overrides: Partial<StorageClient> = {}) {
  const calls: { op: string; bearer: string; input?: unknown }[] = []
  const client: StorageClient = {
    async requestUpload(bearer, input) {
      calls.push({ op: 'requestUpload', bearer, input })
      return { ok: true, value: { uploadUrl: 'https://r2.example/put?sig=1', fileId: 'file-1' } }
    },
    async listOwn(bearer, page) {
      calls.push({ op: 'listOwn', bearer, input: page })
      return {
        ok: true,
        value: [
          {
            id: 'file-1',
            fileName: 'take1.wav',
            mimeType: 'audio/wav',
            sizeBytes: 2048,
            createdAt: '2026-09-20T01:00:00.000Z',
          },
        ],
      }
    },
    async readUrl(bearer, fileId) {
      calls.push({ op: 'readUrl', bearer, input: fileId })
      return { ok: true, value: { url: 'https://r2.example/get?sig=2', expiresInSec: 900 } }
    },
    ...overrides,
  }
  restore = setStorageClient(client)
  return calls
}

const postPresign = (body: unknown, headers: Record<string, string> = { Authorization: BEARER }) =>
  presign(new Request('http://localhost/api/materials/presign', { method: 'POST', headers, body: JSON.stringify(body) }))

const getList = (url = 'http://localhost/api/materials', headers: Record<string, string> = { Authorization: BEARER }) =>
  listMaterials(new Request(url, { headers }))

const getPlay = (id: string, headers: Record<string, string> = { Authorization: BEARER }) =>
  play(new Request(`http://localhost/api/materials/${id}/play`, { headers }), { params: { id } })

const good = { file_name: 'take1.wav', content_type: 'audio/wav', size_bytes: 2048 }

describe('未ログインは断る（保管サービスを呼ばない）', () => {
  it('印が無いと、置く・一覧・再生のどれも 401', async () => {
    const calls = spyClient()
    for (const res of [await postPresign(good, {}), await getList(undefined, {}), await getPlay('file-1', {})]) {
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized', reason: 'login_required' })
    }
    expect(calls).toHaveLength(0)
  })

  it('印の形が違う（Bearer でない・中身が空）でも 401', async () => {
    const calls = spyClient()
    expect((await postPresign(good, { Authorization: 'ty-token' })).status).toBe(401)
    expect((await postPresign(good, { Authorization: 'Bearer ' })).status).toBe(401)
    expect(calls).toHaveLength(0)
  })
})

describe('本人の場所にだけ置ける', () => {
  it('保管サービスへ渡すのは、ファイル名・種類・大きさだけ（印はそのまま渡す）', async () => {
    const calls = spyClient()
    const res = await postPresign(good)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      uploadUrl: 'https://r2.example/put?sig=1',
      fileId: 'file-1',
      contentType: 'audio/wav',
    })
    expect(calls).toEqual([
      { op: 'requestUpload', bearer: BEARER, input: { fileName: 'take1.wav', contentType: 'audio/wav', sizeBytes: 2048 } },
    ])
  })

  it('★ブラウザが利用者 id・住所・名前空間・置き場を本文に書いても、1つも使われない', async () => {
    const calls = spyClient()
    const res = await postPresign({
      ...good,
      user_id: '00000000-0000-4000-8000-000000000000',
      owner_user_id: '00000000-0000-4000-8000-000000000000',
      app_id: 'kenzokun',
      key: 'utatane/someone-else/evil.wav',
      r2_key: 'utatane/someone-else/evil.wav',
      bucket: 'tyhld-public',
      visibility: 'public',
      tenant_id: '00000000-0000-4000-8000-000000000001',
    })
    expect(res.status).toBe(200)
    expect(calls[0].input).toEqual({ fileName: 'take1.wav', contentType: 'audio/wav', sizeBytes: 2048 })
  })

  it('★ブラウザが X-End-User-Id を付けても、保管サービスへ転送しない', async () => {
    const seen: Record<string, string>[] = []
    restore = setStorageClient(
      createStorageClient({ baseUrl: 'https://storage.example', appKey: 'secret-app-key' }, async (_url, init) => {
        seen.push((init?.headers ?? {}) as Record<string, string>)
        return new Response(JSON.stringify({ uploadUrl: 'u', file_id: 'f' }), { status: 200 })
      }),
    )
    const res = await presign(
      new Request('http://localhost/api/materials/presign', {
        method: 'POST',
        headers: { Authorization: BEARER, 'X-End-User-Id': '00000000-0000-4000-8000-000000000000' },
        body: JSON.stringify(good),
      }),
    )
    expect(res.status).toBe(200)
    expect(Object.keys(seen[0]).map((k) => k.toLowerCase())).not.toContain('x-end-user-id')
  })

  it('区画の決まりどおりの本文を組み立てる（非公開・utatane・ファイル名だけ）', async () => {
    const bodies: unknown[] = []
    const client = createStorageClient(
      { baseUrl: 'https://storage.example', appKey: 'secret-app-key' },
      async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')))
        return new Response(JSON.stringify({ uploadUrl: 'u', file_id: 'f' }), { status: 200 })
      },
    )
    await client.requestUpload(BEARER, { fileName: 'take1.wav', contentType: 'audio/wav', sizeBytes: 2048 })
    expect(bodies[0]).toEqual({
      app_id: UTATANE_NAMESPACE,
      file_name: 'take1.wav',
      content_type: 'audio/wav',
      mime_type: 'audio/wav',
      bucket: 'tyhld-private',
      visibility: 'private',
      size_bytes: 2048,
    })
  })
})

describe('合言葉（X-App-Key）の扱い', () => {
  it('置く口にだけ付き、一覧・再生には付けない', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = []
    const client = createStorageClient(
      { baseUrl: 'https://storage.example', appKey: 'secret-app-key' },
      async (url, init) => {
        seen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
        return new Response(JSON.stringify({ uploadUrl: 'u', file_id: 'f', files: [], url: 'g', expires_in_sec: 900 }), {
          status: 200,
        })
      },
    )
    await client.requestUpload(BEARER, { fileName: 'a.wav', contentType: 'audio/wav', sizeBytes: 1 })
    await client.listOwn(BEARER)
    await client.readUrl(BEARER, 'file-1')
    expect(seen[0].headers['X-App-Key']).toBe('secret-app-key')
    expect(seen[1].headers['X-App-Key']).toBeUndefined()
    expect(seen[2].headers['X-App-Key']).toBeUndefined()
    // 印はどの呼び出しにも付く
    for (const call of seen) expect(call.headers.Authorization).toBe(BEARER)
  })

  it('★合言葉はブラウザへの答えに入らない', async () => {
    restore = setStorageClient(
      createStorageClient({ baseUrl: 'https://storage.example', appKey: 'secret-app-key' }, async () => {
        return new Response(JSON.stringify({ uploadUrl: 'u', file_id: 'f' }), { status: 200 })
      }),
    )
    const text = await (await postPresign(good)).text()
    expect(text).not.toContain('secret-app-key')
    expect(text).not.toContain('X-App-Key')
  })
})

describe('ファイル名と大きさの決まり（保管サービスを呼ぶ前に断る）', () => {
  it('区画の外へ出る名前・隠しファイル・区切り文字は断る', async () => {
    const calls = spyClient()
    for (const name of ['../escape.wav', '..', 'a/b.wav', '/abs.wav', 'a\\b.wav', '.hidden', 'x..wav', '', ' a.wav']) {
      const res = await postPresign({ ...good, file_name: name })
      expect(res.status, name).toBe(400)
    }
    expect(calls).toHaveLength(0)
  })

  it('大きさが決まりの外なら断る', async () => {
    const calls = spyClient()
    for (const size of [0, -1, 1.5, MAX_BYTES + 1, '2048', null]) {
      expect((await postPresign({ ...good, size_bytes: size })).status).toBe(400)
    }
    expect((await postPresign({ ...good, size_bytes: MAX_BYTES })).status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it('決まりそのもの（画面とサーバーで同じ物を使う）', () => {
    expect(validateFileName('take1.wav')).toBeNull()
    expect(validateFileName('../a.wav')).toBe('invalid_file_name')
    expect(validateFileName('a'.repeat(201))).toBe('file_name_too_long')
    expect(validateFileName('')).toBe('missing_file_name')
    expect(isValidSizeBytes(MAX_BYTES)).toBe(true)
    expect(isValidSizeBytes(MAX_BYTES + 1)).toBe(false)
  })
})

describe('一覧', () => {
  it('本人の分が返る（誰の分かはブラウザに選ばせない）', async () => {
    const calls = spyClient()
    const res = await getList('http://localhost/api/materials?user_id=00000000-0000-4000-8000-000000000000&app_id=kenzokun')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { materials: { id: string }[] }
    expect(body.materials.map((m) => m.id)).toEqual(['file-1'])
    // 保管サービスへ渡るのは、見せる件数と位置だけ
    expect(calls).toEqual([{ op: 'listOwn', bearer: BEARER, input: { limit: 50, offset: 0 } }])
  })

  it('見せる件数は 100 までにそろえる', async () => {
    const calls = spyClient()
    await getList('http://localhost/api/materials?limit=9999')
    expect(calls[0].input).toEqual({ limit: 100, offset: 0 })
  })
})

describe('再生（読む用の短い住所）', () => {
  it('本人の素材なら住所が返る', async () => {
    spyClient()
    const res = await getPlay('file-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://r2.example/get?sig=2', expiresInSec: 900 })
  })

  it('★他人の素材は断られる（中央の 403 をそのまま返す）', async () => {
    spyClient({
      async readUrl() {
        return { ok: false, status: 403, error: 'forbidden' }
      },
    })
    const res = await getPlay('someone-elses-file')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
  })

  it('止められている人の素材も断られる（理由を持ち帰る）', async () => {
    spyClient({
      async readUrl() {
        return { ok: false, status: 403, error: 'forbidden', reason: 'access_suspended' }
      },
    })
    const res = await getPlay('file-1')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden', reason: 'access_suspended' })
  })
})

describe('設定と、中央が答えないとき', () => {
  it('設定が無ければ 503（どこかの既定へ落とさない）', async () => {
    restore = setStorageClient(null)
    const res = await postPresign(good)
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string; reason: string; missing: string[] }
    expect(body.error).toBe('not_ready')
    expect(body.reason).toBe('storage_not_configured')
    expect(body.missing.length).toBeGreaterThan(0)
  })

  it('設定の読み取りは、足りない物を名指しする', () => {
    expect(() => storageConfigFromEnv({})).toThrow(StorageNotConfigured)
    expect(() => storageConfigFromEnv({ UTATANE_STORAGE_URL: 'https://s.example' })).toThrow(StorageNotConfigured)
    const cfg = storageConfigFromEnv({ UTATANE_STORAGE_URL: 'https://s.example/', UTATANE_STORAGE_APP_KEY: 'k' })
    expect(cfg).toEqual({ baseUrl: 'https://s.example', appKey: 'k' })
  })

  it('中央の内部の誤り（500）は、詳しい理由を出さずに 502 にする', async () => {
    spyClient({
      async requestUpload() {
        return { ok: false, status: 500, error: 'internal_error', reason: 'db_insert_failed' }
      },
    })
    const res = await postPresign(good)
    expect(res.status).toBe(502)
  })
})
