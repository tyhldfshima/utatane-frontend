// POST /api/v1/permission-requests/{id}/responses — 作者の返事（承認・見送り）。承認なら Permission を記録する
import { json, withAuth } from '@/lib/server/http'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    const p = await service.respondToPermissionRequest({ tyAccountId, requestId: params.id, approve: body.approve === true })
    return json({ permission: p }, 201)
  })
}
