// GET /api/v1/versions/{id} — Version・参加者・使われた貢献・公開状態（下書きは参加者だけ）
import { json, optionalViewer, withoutAuth } from '@/lib/server/http'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const viewer = await optionalViewer(request)
  return withoutAuth(async ({ service }) => json(await service.getVersionView(params.id, viewer)))
}
