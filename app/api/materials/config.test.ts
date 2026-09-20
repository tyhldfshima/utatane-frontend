import { describe, it, expect, afterEach, vi } from 'vitest'
import { POST as presign } from './presign/route'
import { GET as listMaterials } from './route'
import { GET as play } from './[id]/play/route'
import { setStorageClient, storageConfigFromEnv, StorageNotConfigured } from '@/lib/server/storage'

// 素材の保存先の設定が無いときの決まり（棚卸し 4aabfd55 の便2）。
//
// ★守る事：設定（UTATANE_STORAGE_URL・UTATANE_STORAGE_APP_KEY）が無いとき、
//   **どこかの既定の住所へ落ちず**に storage_not_configured で止まる。
//   既定へ落ちると、気づかないまま「別の場所」へ音声が送られる。
//   だから「503 が返る」だけでなく、**外への通信が1回も起きない**ことまで見る。
//
// ★この便は試験だけ。app・lib・components の本体は1文字も変えていない。

const BEARER = 'Bearer ty-token-of-someone'
const good = { file_name: 'take1.wav', content_type: 'audio/wav', size_bytes: 2048 }

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** 差し替えを外して、本物の getStorageClient（＝設定を読む道）を通す。 */
function useRealClientPath() {
  restore = setStorageClient(null)
}

/** 設定の環境変数を空にする（この試験の間だけ）。 */
function clearStorageEnv() {
  vi.stubEnv('UTATANE_STORAGE_URL', '')
  vi.stubEnv('UTATANE_STORAGE_APP_KEY', '')
}

const postPresign = () =>
  presign(
    new Request('http://localhost/api/materials/presign', {
      method: 'POST',
      headers: { Authorization: BEARER },
      body: JSON.stringify(good),
    }),
  )
const getList = () => listMaterials(new Request('http://localhost/api/materials', { headers: { Authorization: BEARER } }))
const getPlay = () =>
  play(new Request('http://localhost/api/materials/file-1/play', { headers: { Authorization: BEARER } }), {
    params: { id: 'file-1' },
  })

const ROUTES: [string, () => Promise<Response>][] = [
  ['置く（presign）', postPresign],
  ['一覧（GET /api/materials）', getList],
  ['再生（GET /api/materials/:id/play）', getPlay],
]

describe('設定が無いとき、既定へ落ちずに止まる（3つの口すべて）', () => {
  for (const [name, call] of ROUTES) {
    it(`${name}：503 not_ready / storage_not_configured を返し、足りない名前を出す`, async () => {
      useRealClientPath()
      clearStorageEnv()
      const res = await call()
      expect(res.status).toBe(503)
      const body = (await res.json()) as { error: string; reason: string; missing: string[] }
      expect(body.error).toBe('not_ready')
      expect(body.reason).toBe('storage_not_configured')
      // ★足りない物を名指しする（人が何を入れればよいか分かる）
      expect(body.missing).toEqual(
        expect.arrayContaining(['UTATANE_STORAGE_URL', 'UTATANE_STORAGE_APP_KEY']),
      )
    })

    it(`${name}：★外へ1回も通信しない（既定の住所へ落ちていない証拠）`, async () => {
      useRealClientPath()
      clearStorageEnv()
      // ★もし既定の住所へ落ちる作りなら、ここで fetch が呼ばれる。
      // ★呼ばれたら外へ出てしまうので、呼ばれても外へ出ない形にしてから数える。
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 500 }))
      const res = await call()
      expect(res.status).toBe(503)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }

  it('★秘密の値を答えに混ぜない（名前だけを出す）', async () => {
    useRealClientPath()
    // 片方だけ入っている（＝合言葉が入っている）状態でも、値は答えに出さない
    vi.stubEnv('UTATANE_STORAGE_URL', '')
    vi.stubEnv('UTATANE_STORAGE_APP_KEY', 'super-secret-app-key')
    const res = await postPresign()
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).not.toContain('super-secret-app-key')
    // 足りないのは住所の方だけ、と名指しする
    const body = JSON.parse(text) as { missing: string[] }
    expect(body.missing).toEqual(['UTATANE_STORAGE_URL'])
  })
})

describe('設定の読み取りそのもの', () => {
  it('★空文字は「入っている」と数えない（既定へ落ちる入口をふさぐ）', () => {
    expect(() => storageConfigFromEnv({ UTATANE_STORAGE_URL: '', UTATANE_STORAGE_APP_KEY: '' })).toThrow(
      StorageNotConfigured,
    )
    expect(() => storageConfigFromEnv({ UTATANE_STORAGE_URL: '', UTATANE_STORAGE_APP_KEY: 'k' })).toThrow(
      StorageNotConfigured,
    )
    expect(() => storageConfigFromEnv({ UTATANE_STORAGE_URL: 'https://s.example', UTATANE_STORAGE_APP_KEY: '' })).toThrow(
      StorageNotConfigured,
    )
  })

  it('足りない物だけを名指しする（両方・片方それぞれ）', () => {
    const missingOf = (env: Record<string, string | undefined>) => {
      try {
        storageConfigFromEnv(env)
        return null
      } catch (err) {
        return err instanceof StorageNotConfigured ? err.missing : null
      }
    }
    expect(missingOf({})).toEqual(['UTATANE_STORAGE_URL', 'UTATANE_STORAGE_APP_KEY'])
    expect(missingOf({ UTATANE_STORAGE_URL: 'https://s.example' })).toEqual(['UTATANE_STORAGE_APP_KEY'])
    expect(missingOf({ UTATANE_STORAGE_APP_KEY: 'k' })).toEqual(['UTATANE_STORAGE_URL'])
  })

  it('★両方そろったときだけ通る。住所の末尾の / は落とす', () => {
    expect(storageConfigFromEnv({ UTATANE_STORAGE_URL: 'https://s.example//', UTATANE_STORAGE_APP_KEY: 'k' })).toEqual({
      baseUrl: 'https://s.example',
      appKey: 'k',
    })
  })
})
