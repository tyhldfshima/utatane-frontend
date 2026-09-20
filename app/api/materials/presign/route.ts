// POST /api/materials/presign — 素材を置く許可（署名つき住所）をもらう。
//
// ★ブラウザから受け取るのは file_name・content_type・size_bytes の3つだけ。
//   利用者 id・住所（キー）・名前空間・置き場は受け取らない。本文に書かれていても使わない
//   （下で1つずつ取り出しているので、ほかの値は口の外へ出ない）。
// ★住所の先頭 utatane/{利用者}/ は中央が本人の印から作る。ここでは作らない・送らない。
// ★合言葉は lib/server/storage.ts の中だけで付ける。答えにも入れない。

import { isValidSizeBytes, validateFileName } from '@/lib/materials/rules'
import { failureResponse, jsonResponse, requireBearer, storageFailureResponse } from '@/lib/server/materials-api'
import { getStorageClient } from '@/lib/server/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const auth = requireBearer(req)
  if (!auth.ok) return auth.res

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'bad_request', reason: 'invalid_json' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'bad_request', reason: 'body_must_be_object' }, 400)
  }

  // ★使う値はこの3つだけ（取り違えを防ぐため、まとめて展開しない）。
  const fileName = (body as Record<string, unknown>).file_name
  const contentType = (body as Record<string, unknown>).content_type
  const sizeBytes = (body as Record<string, unknown>).size_bytes

  const nameProblem = validateFileName(fileName)
  if (nameProblem !== null) return jsonResponse({ error: 'bad_request', reason: nameProblem }, 400)
  if (!isValidSizeBytes(sizeBytes)) {
    return jsonResponse({ error: 'bad_request', reason: 'invalid_size_bytes' }, 400)
  }

  const type = typeof contentType === 'string' && contentType.length > 0 ? contentType : 'application/octet-stream'

  try {
    const result = await getStorageClient().requestUpload(auth.bearer, {
      fileName: fileName as string,
      contentType: type,
      sizeBytes,
    })
    if (!result.ok) return storageFailureResponse(result)
    return jsonResponse({ uploadUrl: result.value.uploadUrl, fileId: result.value.fileId, contentType: type }, 200)
  } catch (err) {
    return failureResponse(err)
  }
}
