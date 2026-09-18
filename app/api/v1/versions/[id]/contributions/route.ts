// POST /api/v1/versions/{id}/contributions — 新しい貢献を作る（mode=create）か、既存の貢献を参照する（mode=reference）
import { json, str, strArray, withAuth } from '@/lib/server/http'
import type { DerivationKind } from '@/lib/domain/types'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    if (body.mode === 'reference') {
      await service.referenceContribution({ tyAccountId, versionId: params.id, contributionId: str(body.contributionId) })
      return json({ ok: true }, 201)
    }
    const derivedFrom = Array.isArray(body.derivedFrom)
      ? (body.derivedFrom as { parentId?: unknown; kind?: unknown }[]).map((d) => ({
          parentId: str(d.parentId),
          kind: (str(d.kind) || 'based_on') as DerivationKind,
        }))
      : []
    const c = await service.createContribution({
      tyAccountId,
      versionId: params.id,
      roleKindId: str(body.roleKindId),
      coAuthorTyAccountIds: strArray(body.coAuthorTyAccountIds),
      derivedFrom,
    })
    return json({ contribution: c }, 201)
  })
}
