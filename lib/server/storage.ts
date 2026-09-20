// 保管サービス（storage.ty-hld.com）を呼ぶ、★サーバー側だけの口。
//
// 決まり（2026-09-19 えふさん確定 A-1・保管サービスの報告 6992ea66）：
// ・合言葉（X-App-Key）は★サーバーの中だけで持つ。ブラウザへ出さない・返さない。
// ・住所の先頭 utatane/{利用者}/ は★中央が作る。ここからは「ファイル名の部分」しか渡さない。
// ・利用者は★中央が印（TY の JWT）から決める。ブラウザの申告の利用者 id は渡さない（X-End-User-Id を付けない）。
// ・読む・一覧は★印だけで呼ぶ（合言葉を付けない）。付けると「持ち主以外の分も出す」道が開くため、
//   付けない方を既定にして、持ち主の確認を中央に任せる（他人の素材は中央が 403 で断る）。
// ・置く（署名つき住所の発行）だけは、名前空間が予約されているので合言葉が要る（付けないと 403 namespace_reserved）。
//
// ★@tyhld/* の部品は使わない（この口は NPM_TOKEN に依存しない）。素の fetch だけで呼ぶ。

/** この製品の名乗り（保管サービスの apps.id・名前空間）。 */
export const UTATANE_NAMESPACE = 'utatane'

/** 区画のファイルは常に非公開。 */
const AREA_BUCKET = 'tyhld-private'
const AREA_VISIBILITY = 'private'

export type StorageConfig = {
  baseUrl: string
  appKey: string
}

/** 設定が無いとき。★どこかの既定へ落とさない（lib/api.ts の api_url_not_configured と同じ作法）。 */
export class StorageNotConfigured extends Error {
  readonly code = 'storage_not_configured'
  constructor(public readonly missing: string[]) {
    super('storage_not_configured')
  }
}

export function storageConfigFromEnv(env: Record<string, string | undefined> = process.env): StorageConfig {
  const baseUrl = env.UTATANE_STORAGE_URL
  const appKey = env.UTATANE_STORAGE_APP_KEY
  const missing: string[] = []
  if (!baseUrl) missing.push('UTATANE_STORAGE_URL')
  if (!appKey) missing.push('UTATANE_STORAGE_APP_KEY')
  if (missing.length > 0) throw new StorageNotConfigured(missing)
  return { baseUrl: baseUrl!.replace(/\/+$/, ''), appKey: appKey! }
}

/** 保管サービスの答え。断りはそのまま持ち帰り、口の側で利用者の言葉に変える。 */
export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; reason?: string }

export type UploadTicket = {
  /** ブラウザがここへ直接 PUT する（短い時間だけ有効）。 */
  uploadUrl: string
  /** 置いた後、読む・再生に使う番号。 */
  fileId: string
}

export type MaterialFile = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export type ReadTicket = {
  url: string
  expiresInSec: number
}

export type StorageClient = {
  /** 置く許可（署名つき住所）をもらう。★合言葉＋本人の印の両方で呼ぶ。 */
  requestUpload(
    bearer: string,
    input: { fileName: string; contentType: string; sizeBytes: number },
  ): Promise<StorageResult<UploadTicket>>
  /** 自分が置いた素材の一覧。★本人の印だけで呼ぶ（中央が本人の分だけ返す）。 */
  listOwn(bearer: string, page?: { limit?: number; offset?: number }): Promise<StorageResult<MaterialFile[]>>
  /** 読む（再生）用の短い時間だけ有効な住所。★本人の印だけで呼ぶ（他人の物は中央が断る）。 */
  readUrl(bearer: string, fileId: string): Promise<StorageResult<ReadTicket>>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** キー（utatane/{利用者}/YYYY/MM/{uuid}/{ファイル名}）から、画面に出す名前だけを取り出す。 */
function fileNameOfKey(key: unknown): string {
  if (typeof key !== 'string' || key.length === 0) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] ?? ''
}

async function readResult<T>(res: Response, pick: (body: Record<string, unknown>) => T): Promise<StorageResult<T>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof body.error === 'string' ? body.error : 'storage_error',
      ...(typeof body.reason === 'string' ? { reason: body.reason } : {}),
    }
  }
  return { ok: true, value: pick(body) }
}

export function createStorageClient(cfg: StorageConfig, fetchImpl: FetchLike = fetch): StorageClient {
  return {
    async requestUpload(bearer, input) {
      const res = await fetchImpl(`${cfg.baseUrl}/v1/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ★合言葉はここだけ。置く口は名前空間が予約されているので要る。
          'X-App-Key': cfg.appKey,
          // ★本人の印はそのまま渡す。中央がこの印から利用者を決める。
          Authorization: bearer,
        },
        body: JSON.stringify({
          app_id: UTATANE_NAMESPACE,
          // ★ファイル名の部分だけ。住所の先頭・区切りは渡さない。
          file_name: input.fileName,
          content_type: input.contentType,
          mime_type: input.contentType,
          bucket: AREA_BUCKET,
          visibility: AREA_VISIBILITY,
          size_bytes: input.sizeBytes,
        }),
      })
      return readResult(res, (body) => ({
        uploadUrl: String(body.uploadUrl ?? ''),
        fileId: String(body.file_id ?? ''),
      }))
    },

    async listOwn(bearer, page = {}) {
      const q = new URLSearchParams({ app_id: UTATANE_NAMESPACE })
      if (page.limit !== undefined) q.set('limit', String(page.limit))
      if (page.offset !== undefined) q.set('offset', String(page.offset))
      const res = await fetchImpl(`${cfg.baseUrl}/v1/files?${q.toString()}`, {
        method: 'GET',
        // ★合言葉は付けない。本人の印だけで呼び、中央に本人の分だけを返させる。
        headers: { Authorization: bearer },
      })
      return readResult(res, (body) => {
        const rows = Array.isArray(body.files) ? body.files : []
        return rows.map((row) => {
          const r = row as Record<string, unknown>
          return {
            id: String(r.id ?? ''),
            fileName: fileNameOfKey(r.key),
            mimeType: String(r.mime_type ?? 'application/octet-stream'),
            sizeBytes: typeof r.size_bytes === 'number' ? r.size_bytes : 0,
            createdAt: String(r.created_at ?? ''),
          }
        })
      })
    },

    async readUrl(bearer, fileId) {
      const res = await fetchImpl(`${cfg.baseUrl}/v1/files/${encodeURIComponent(fileId)}`, {
        method: 'GET',
        // ★合言葉は付けない。他人の素材なら中央が 403 で断る。
        headers: { Authorization: bearer },
      })
      return readResult(res, (body) => ({
        url: String(body.url ?? ''),
        expiresInSec: typeof body.expires_in_sec === 'number' ? body.expires_in_sec : 0,
      }))
    },
  }
}

// ── 差し替えの1か所 ────────────────────────────────────────
// ★試験では、外（保管サービス）を呼ばずに差し替える。

let override: StorageClient | null = null

/** 口が使う保管サービスの呼び先。設定が無ければ StorageNotConfigured を投げる。 */
export function getStorageClient(): StorageClient {
  if (override) return override
  return createStorageClient(storageConfigFromEnv())
}

/** 試験で差し替える。戻す手を返す。 */
export function setStorageClient(client: StorageClient | null): () => void {
  const before = override
  override = client
  return () => {
    override = before
  }
}
