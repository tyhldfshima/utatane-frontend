// 素材の口（app/api/materials）で共通に使う物。
//
// ★ここが守る事（試験で固めている）：
//   1. 本人の印（Authorization: Bearer）が無ければ、保管サービスを呼ばずに 401 を返す。
//   2. ブラウザから来た値のうち、口が使ってよいのは「ファイル名・種類・大きさ」だけ。
//      利用者 id・住所（キー）・名前空間・置き場は、ブラウザから受け取らない（送られても使わない）。
//   3. 合言葉（X-App-Key）と、保管サービスの内部の詳しい理由は、ブラウザへ返さない。

import { StorageNotConfigured, type StorageResult } from './storage'

export type ApiFailure = { body: Record<string, unknown>; status: number }

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * 本人の印を取り出す。★無い・形が違うときは 401（保管サービスを呼ばない）。
 * ★利用者 id は取り出さない。誰なのかを決めるのは中央（印を検証する側）だけ。
 */
export function requireBearer(req: Request): { ok: true; bearer: string } | { ok: false; res: Response } {
  const header = req.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ') || header.slice('Bearer '.length).trim().length === 0) {
    return {
      ok: false,
      res: jsonResponse({ error: 'unauthorized', reason: 'login_required' }, 401),
    }
  }
  return { ok: true, bearer: header }
}

/** 設定が無いときの答え。★既定の住所へ落とさない。 */
export function notConfiguredResponse(err: StorageNotConfigured): Response {
  return jsonResponse({ error: 'not_ready', reason: err.code, missing: err.missing }, 503)
}

/**
 * 保管サービスの断りを、そのまま持ち帰る（状態と名前だけ）。
 * ★detail（内部の理由）は返さない。
 */
export function storageFailureResponse(result: Extract<StorageResult<unknown>, { ok: false }>): Response {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502
  const body: Record<string, unknown> = { error: result.error }
  if (result.reason) body.reason = result.reason
  return jsonResponse(body, status >= 500 ? 502 : status)
}

/** 口の中で投げられた物を答えに変える（設定が無い以外は 502）。 */
export function failureResponse(err: unknown): Response {
  if (err instanceof StorageNotConfigured) return notConfiguredResponse(err)
  return jsonResponse({ error: 'storage_unreachable' }, 502)
}
