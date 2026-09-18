// POST /api/v1/versions/{id}/materials — 素材を足す（出どころの申告は必須）
import { json, str, strArray, withAuth } from '@/lib/server/http'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAuth(request, async ({ service, tyAccountId, body }) => {
    const p = body.provenance as { kind?: unknown; sourceMaterialId?: unknown; evidence?: unknown } | undefined
    const provenance = p && str(p.kind)
      ? {
          kind: str(p.kind),
          sourceMaterialId: str(p.sourceMaterialId) || undefined,
          evidence: typeof p.evidence === 'object' && p.evidence !== null ? (p.evidence as Record<string, unknown>) : undefined,
        }
      : null
    const m = await service.addMaterial({
      tyAccountId,
      versionId: params.id,
      storageFileId: str(body.storageFileId),
      embodiedContributionIds: strArray(body.embodiedContributionIds),
      provenance,
    })
    return json({ material: m }, 201)
  })
}
