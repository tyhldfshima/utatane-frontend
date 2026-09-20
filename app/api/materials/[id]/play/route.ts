// GET /api/materials/{番号}/play — 再生のための、短い時間だけ有効な読む住所をもらう。
//
// ★本人の印だけで保管サービスを呼ぶ（合言葉を付けない）。
//   合言葉を付けると「持ち主以外の分も出す」道になるので、この口では付けない。
//   他人の素材の番号を書いて呼んでも、中央が持ち主を確かめて 403 で断る。
// ★住所は毎回もらい直す（保存しない・使い回さない）。

import { failureResponse, jsonResponse, requireBearer, storageFailureResponse } from '@/lib/server/materials-api'
import { getStorageClient } from '@/lib/server/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = requireBearer(req)
  if (!auth.ok) return auth.res
  if (!params.id) return jsonResponse({ error: 'bad_request', reason: 'missing_id' }, 400)

  try {
    const result = await getStorageClient().readUrl(auth.bearer, params.id)
    if (!result.ok) return storageFailureResponse(result)
    return jsonResponse({ url: result.value.url, expiresInSec: result.value.expiresInSec }, 200)
  } catch (err) {
    return failureResponse(err)
  }
}
