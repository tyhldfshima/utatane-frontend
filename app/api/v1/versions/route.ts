// POST /api/v1/versions — 下書きの Version を作る
import { json, str, withAuth } from '@/lib/server/http'

export async function POST(request: Request) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    const v = await service.createDraft(tyAccountId, str(body.title))
    return json({ version: v }, 201)
  })
}
