// GET /api/v1/versions/{id}/tree — 由来（上流・世代ごと）と下流の1段（下書きは参加者だけ）
import { json, optionalViewer, withoutAuth } from '@/lib/server/http'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const viewer = await optionalViewer(request)
  return withoutAuth(async ({ service }) => json(await service.getTree(params.id, viewer)))
}
