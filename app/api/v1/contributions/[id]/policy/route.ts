// POST /api/v1/contributions/{id}/policy — 再利用ポリシーの新しい版（上書きしない）
import { json, str, strArray, withAuth } from '@/lib/server/http'
import type { ReuseMode, ReuseScope } from '@/lib/domain/types'

const MODES: ReuseMode[] = ['free', 'approval', 'forbidden']
const SCOPES: ReuseScope[] = ['any_version', 'this_version_only', 'named_holders']

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    const mode = str(body.mode) as ReuseMode
    const scope = (str(body.scope) || 'any_version') as ReuseScope
    if (!MODES.includes(mode) || !SCOPES.includes(scope)) return json({ error: 'invalid_policy' }, 422)
    const r = await service.setPolicy({ tyAccountId, contributionId: params.id, mode, scope, namedTyAccountIds: strArray(body.namedTyAccountIds) })
    return json(r, 201)
  })
}
