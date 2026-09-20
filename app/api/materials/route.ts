// GET /api/materials — 自分が置いた素材の一覧。
//
// ★本人の印だけで保管サービスを呼ぶ（合言葉を付けない）。中央が「その印の本人の分」だけを返すので、
//   この口は利用者 id を知る必要が無く、住所（?user_id= のような物）も受け取らない。

import { failureResponse, jsonResponse, requireBearer, storageFailureResponse } from '@/lib/server/materials-api'
import { getStorageClient } from '@/lib/server/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(req: Request): Promise<Response> {
  const auth = requireBearer(req)
  if (!auth.ok) return auth.res

  // ★受け取るのは見せる件数と位置だけ。誰の分かはブラウザに選ばせない。
  const url = new URL(req.url)
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '', 10)
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0

  try {
    const result = await getStorageClient().listOwn(auth.bearer, { limit, offset })
    if (!result.ok) return storageFailureResponse(result)
    return jsonResponse({ materials: result.value }, 200)
  } catch (err) {
    return failureResponse(err)
  }
}
