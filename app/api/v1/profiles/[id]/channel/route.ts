// GET /api/v1/profiles/{tyAccountId}/channel — 自分の作品／参加作品／自分の貢献が使われた作品／コラボ募集中
// だれでも見られる（公開済みだけ）。本人がログインして見るときだけ、自分の下書きも出す。
import { json, optionalViewer, withoutAuth } from '@/lib/server/http'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const viewer = await optionalViewer(request)
  return withoutAuth(async ({ service }) => json(await service.getChannel(params.id, viewer)))
}
