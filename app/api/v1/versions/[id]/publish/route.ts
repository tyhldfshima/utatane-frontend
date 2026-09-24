// POST /api/v1/versions/{id}/publish — 公開時の再検証 → 記録 → 通れば公開。通らなければ 409 と判定の中身
import { json, withAuth } from '@/lib/server/http'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId }) => {
    const r = await service.publish({ tyAccountId, versionId: params.id })
    return json(r.published ? r : { error: 'publish_check_failed', ...r }, r.published ? 200 : 409)
  })
}
