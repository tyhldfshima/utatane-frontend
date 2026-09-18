// GET /api/v1/role-kinds — 貢献の種類（役割）の一覧（行で足す）
import { json, withoutAuth } from '@/lib/server/http'

export async function GET() {
  return withoutAuth(async ({ service }) => json({ roleKinds: await service.listRoleKinds() }))
}
