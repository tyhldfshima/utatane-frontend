// POST /api/v1/permission-requests — 既にある貢献を使うための申請（冪等の鍵つき）
import { json, str, withAuth } from '@/lib/server/http'

export async function POST(request: Request) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    const key = str(body.idempotencyKey) || str(request.headers.get('idempotency-key'))
    if (!key) return json({ error: 'idempotency_key_required' }, 422)
    const r = await service.requestPermission({
      tyAccountId,
      draftVersionId: str(body.draftVersionId),
      contributionId: str(body.contributionId),
      idempotencyKey: key,
      message: str(body.message) || undefined,
    })
    return json({ request: r }, 201)
  })
}
