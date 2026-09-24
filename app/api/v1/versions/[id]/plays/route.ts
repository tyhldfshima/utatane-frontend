// POST /api/v1/versions/{id}/plays — 再生を記録する（冪等の鍵つき・ログインしていなくてもよい）
import { AuthFailure } from '@/lib/server/auth'
import { getContainer } from '@/lib/server/container'
import { json, str, withoutAuth } from '@/lib/server/http'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let tyAccountId: string | null = null
  const header = request.headers.get('authorization')
  if (header) {
    try {
      tyAccountId = await getContainer().auth.verify(header)
    } catch (e) {
      if (e instanceof AuthFailure) return json({ error: e.code }, e.status)
      throw e
    }
  }
  const text = await request.text()
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  return withoutAuth(async ({ service }) =>
    json(
      await service.recordPlay({
        versionId: params.id,
        tyAccountId,
        idempotencyKey: str(body.idempotencyKey) || str(request.headers.get('idempotency-key')),
        source: str(body.source) || undefined,
      }),
    ),
  )
}
