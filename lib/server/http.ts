// lib/server/http.ts — API の口の共通の形（本人確認・失敗の返し方）
//
// 失敗は `{ error: 'コード' }`（lib/api.ts の ApiError と同じ形）。

import { AuthFailure } from './auth'
import { getContainer } from './container'
import { CoreError, type CoreService } from './core-service'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function toResponse(e: unknown): Response {
  if (e instanceof AuthFailure) return json({ error: e.code }, e.status)
  if (e instanceof CoreError) return json({ error: e.code, detail: e.detail ?? null }, e.status)
  if (e instanceof SyntaxError) return json({ error: 'invalid_json' }, 400)
  return json({ error: 'internal_error' }, 500)
}

type Handler = (ctx: { service: CoreService; tyAccountId: string; body: Record<string, unknown> }) => Promise<Response>

/** 本人確認が要る口 */
export async function withAuth(request: Request, handler: Handler): Promise<Response> {
  try {
    const { service, auth } = getContainer()
    const tyAccountId = await auth.verify(request.headers.get('authorization'))
    const text = request.method === 'GET' ? '' : await request.text()
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    return await handler({ service, tyAccountId, body })
  } catch (e) {
    return toResponse(e)
  }
}

/** だれでも見られる口（公開の画面） */
export async function withoutAuth(handler: (ctx: { service: CoreService }) => Promise<Response>): Promise<Response> {
  try {
    return await handler({ service: getContainer().service })
  } catch (e) {
    return toResponse(e)
  }
}

/** 見る人（ログインしていれば TY アカウント id・していなければ null）。トークンが不正なら null として扱う */
export async function optionalViewer(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization')
  if (!header) return null
  try {
    return await getContainer().auth.verify(header)
  } catch (e) {
    // 本人が分からない・DB の設定が無い、はどちらも「見る人なし」として続ける（DB の設定が無いことは本体の口が 503 で返す）
    if (e instanceof AuthFailure || e instanceof CoreError) return null
    throw e
  }
}

export const str =(v: unknown): string => (typeof v === 'string' ? v : '')
export const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
