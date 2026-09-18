// POST /api/v1/versions/{id}/participants — 招かれた人が参加を承認・辞退する
import { json, withAuth } from '@/lib/server/http'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    await service.respondToInvitation({ tyAccountId, versionId: params.id, accept: body.accept === true })
    return json({ ok: true })
  })
}
