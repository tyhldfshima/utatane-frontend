// lib/core-client.ts — 画面から UTATANE の中核の API（同じ住所の /api/v1）を呼ぶ
//
// ・住所は同じサイトの相対パスだけ（外の住所へは行かない）。
// ・本人確認は中央ログイン（@tyhld/auth）のトークンを毎回読んで Bearer で渡す。保存はしない。
// ・金額・分配率は扱わない。

import { currentAccessToken } from '@/stores/authStore'
import type { Contribution, Id, Material, RoleKind } from '@/lib/domain/types'
import type { PublishCheck } from '@/lib/domain/publish'
import type { ChannelSection, TreeView, VersionView } from '@/lib/server/core-service'
import type { VersionRecord } from '@/lib/server/repository'

export class CoreApiError extends Error {
  constructor(public status: number, public code: string, public body: unknown) {
    super(code)
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.auth !== false) {
    const token = await currentAccessToken()
    if (token) headers.authorization = `Bearer ${token}`
  }
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new CoreApiError(res.status, (data as { error?: string }).error ?? 'unknown_error', data)
  return data as T
}

export type ChannelRow = { versionId: Id; title: string; publishedAt: string | null; usedRoles?: Id[] }
export interface PublishResult {
  published: boolean
  check: PublishCheck
  participationIssues: Id[]
}

export const core = {
  roleKinds: () => call<{ roleKinds: RoleKind[] }>('/role-kinds', { auth: false }),
  createDraft: (title: string) => call<{ version: VersionRecord }>('/versions', { method: 'POST', body: { title } }),
  createContribution: (versionId: Id, body: { roleKindId: Id; coAuthorTyAccountIds?: Id[]; derivedFrom?: { parentId: Id; kind: string }[] }) =>
    call<{ contribution: Contribution }>(`/versions/${versionId}/contributions`, { method: 'POST', body: { mode: 'create', ...body } }),
  referenceContribution: (versionId: Id, contributionId: Id) =>
    call<{ ok: boolean }>(`/versions/${versionId}/contributions`, { method: 'POST', body: { mode: 'reference', contributionId } }),
  addMaterial: (versionId: Id, body: { storageFileId: Id; embodiedContributionIds: Id[]; provenance: { kind: string; sourceMaterialId?: Id } }) =>
    call<{ material: Material }>(`/versions/${versionId}/materials`, { method: 'POST', body }),
  requestPermission: (body: { draftVersionId: Id; contributionId: Id; idempotencyKey: string; message?: string }) =>
    call<{ request: { id: Id } }>('/permission-requests', { method: 'POST', body }),
  /** 公開。再検証に通らなければ 409 でも結果（判定の中身）を返す */
  publish: async (versionId: Id): Promise<PublishResult> => {
    try {
      return await call<PublishResult>(`/versions/${versionId}/publish`, { method: 'POST' })
    } catch (e) {
      if (e instanceof CoreApiError && e.status === 409 && e.code === 'publish_check_failed') return e.body as PublishResult
      throw e
    }
  },
  respondToInvitation: (versionId: Id, accept: boolean) =>
    call<{ ok: boolean }>(`/versions/${versionId}/participants`, { method: 'POST', body: { accept } }),
  version: (id: Id) => call<VersionView>(`/versions/${id}`),
  tree: (id: Id) => call<TreeView>(`/versions/${id}/tree`),
  channel: (tyAccountId: Id) => call<Record<ChannelSection, ChannelRow[]>>(`/profiles/${tyAccountId}/channel`),
  recordPlay: (versionId: Id, idempotencyKey: string, source?: string) =>
    call<{ recorded: boolean; plays: number }>(`/versions/${versionId}/plays`, { method: 'POST', body: { idempotencyKey, source } }),
}

/** 役割の画面の言葉（役割は行で足す。知らない id はそのまま出す） */
export const ROLE_LABELS: Record<string, string> = {
  lyrics: '詞',
  melody: 'メロディ・作曲',
  arrangement: '編曲',
  vocal: '歌唱',
  instrument: '楽器演奏',
  recording: '音源・録音',
  mix: 'MIX・マスタリング',
  video: '映像',
}
export const roleLabel = (id: Id) => ROLE_LABELS[id] ?? id
