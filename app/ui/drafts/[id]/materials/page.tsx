import React from 'react'
import { notFound } from 'next/navigation'
import { GhostButton, Icon, ScreenFrame, SecondaryButton, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { uiData } from '@/lib/ui-data'
import { ProvenanceForm } from './ProvenanceForm'

// ④ 素材と元の歌：素材の出どころの申告（設計書 utatane-core-db-api-v1.md:60・:154）。
// ★画面の設計書（utatane-focus-screens-spec.md）に、この画面の置き場の指定はない。
//   止まるのは公開の再検証（checkMaterials）なので、公開する前の確認（G）の ④ から入る形にした。
//
// ・一覧：この下書きが使う素材と、出どころの申告の状態（済み／まだ・止まる理由）
// ・?material=<素材> ：その素材の出どころを選ぶ
// ・?material=<素材>&kind=<種類> ：申告して一覧へ戻る（★見本の読み口の中にだけ保存する）
//
// 止まる理由も「済んだか」も、lib/domain の checkMaterials の結果から来る（画面では判断しない）。

type Search = { material?: string; kind?: string; source?: string }

export default async function DraftMaterialsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: Search
}) {
  const base = `/ui/drafts/${encodeURIComponent(params.id)}/materials`
  const publishHref = `/ui/drafts/${encodeURIComponent(params.id)}/publish`

  // 申告する（★本物の保存は PR #4〜#6 待ち。見本の読み口の中にだけ残る）
  let saved: string | null = null
  let view = null
  if (searchParams.material && searchParams.kind) {
    view = await uiData().declareProvenance({
      draftId: params.id,
      materialId: searchParams.material,
      kind: searchParams.kind,
      sourceMaterialId: searchParams.source,
    })
    if (view) saved = searchParams.material
  }
  if (!view) view = await uiData().getDraftMaterials(params.id)
  if (!view) notFound()

  // 1つの素材の出どころを選ぶ
  const picked = saved ? null : view.materials.find((m) => m.id === searchParams.material)
  if (picked) {
    return (
      <ProvenanceForm
        material={picked}
        kinds={view.kinds}
        sourceOptions={view.sourceOptions}
        action={base}
        backHref={base}
      />
    )
  }

  const savedRow = saved ? view.materials.find((m) => m.id === saved) : null
  return (
    <ScreenFrame
      back={{ href: publishHref, label: '公開する前の確認へ' }}
      title={`「${view.title}」④ 素材と元の歌`}
      primary={
        view.done
          ? { kind: 'action', label: '公開する前の確認へ', icon: 'right', href: publishHref }
          : { kind: 'unavailable', label: '公開する前の確認へ', reason: '出どころの申告が済んでいない素材があります。' }
      }
      secondary={view.done ? undefined : <GhostButton label="あとで決める" href={publishHref} />}
    >
      <div data-screen="draft-materials" data-done={view.done ? 'true' : 'false'}>
        {savedRow ? (
          <div className={s.done} role="status" data-part="declared">
            <span className={s.ring}>
              <Icon name="check" size="l" />
            </span>
            <h2 style={{ fontSize: 19, margin: 0 }}>出どころを申告しました</h2>
            <p className={s.sub}>{savedRow.label}／{savedRow.declaredLabel}</p>
          </div>
        ) : null}

        <p>公開する前に、この歌が使う素材の出どころを申告します。申告が無い素材があると、公開に進めません。</p>

        {view.materials.length === 0 ? (
          <StateView kind="empty" message="この歌は、まだ素材を使っていません。" />
        ) : (
          view.materials.map((m) => (
            <div key={m.id} className={s.row} data-material={m.id}>
              <Icon name="wave" />
              <span className={s.rowText}>
                <b>{m.label}</b>
                {m.declaredLabel ? (
                  <span className={s.sub}>
                    出どころ：{m.declaredLabel}
                    {m.sourceLabel ? `（元の素材：${m.sourceLabel}）` : ''}
                  </span>
                ) : null}
                {m.issue ? (
                  <span className={`${s.status} ${s.statusMuted}`} data-issue={m.id}>
                    {m.issue}
                  </span>
                ) : (
                  <span className={`${s.status} ${s.statusDone}`}>
                    <Icon name="check" size="s" />
                    申告済み
                  </span>
                )}
              </span>
              <SecondaryButton
                label={m.declaredLabel ? '申告し直す' : '出どころを申告する'}
                icon="pen"
                href={`${base}?material=${encodeURIComponent(m.id)}`}
              />
            </div>
          ))
        )}
      </div>
    </ScreenFrame>
  )
}
