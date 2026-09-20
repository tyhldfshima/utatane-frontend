'use client'

import React, { useState } from 'react'
import { GhostButton, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import type { DraftMaterialView, ProvenanceKindOption } from '@/lib/ui-data'

// 素材の出どころを申告する（設計書 utatane-core-db-api-v1.md:60・:154）。
// ★種類は固定の一覧にしない。読み口から来た物をそのまま出す。
// ★「UTATANE 内の素材から」を選んだときだけ、元の素材を選ぶ（checkMaterials が元の素材を要る）。

export const KIND_REQUIRED_REASON = '出どころを1つ選んでください。'
export const SOURCE_REQUIRED_REASON = '元の素材を選んでください。'
export const FROM_UTATANE = 'from_utatane_material'

export function ProvenanceForm({
  material,
  kinds,
  sourceOptions,
  action,
  backHref,
}: {
  material: DraftMaterialView
  kinds: ProvenanceKindOption[]
  sourceOptions: { id: string; label: string }[]
  action: string
  backHref: string
}) {
  const [kind, setKind] = useState<string>('')
  const [source, setSource] = useState<string>('')
  const needsSource = kind === FROM_UTATANE
  const reason = !kind ? KIND_REQUIRED_REASON : needsSource && !source ? SOURCE_REQUIRED_REASON : null

  return (
    <ScreenFrame
      back={{ href: backHref, label: '素材と元の歌へ戻る' }}
      title="この素材の出どころを教えてください"
      primary={
        reason
          ? { kind: 'unavailable', label: '申告する', reason }
          : { kind: 'action', label: '申告する', icon: 'check', submitsForm: 'provenance-form' }
      }
      secondary={<GhostButton label="やめる" href={backHref} />}
    >
      <div data-screen="provenance" data-material={material.id} data-kind={kind}>
        <div className={s.row}>
          <span className={s.rowText}>
            <b>{material.label}</b>
            <span className={s.sub}>公開する前に、この素材がどこから来た物かを申告します。</span>
          </span>
        </div>
        <form id="provenance-form" method="get" action={action}>
          <input type="hidden" name="material" value={material.id} />
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={s.section}>出どころ</legend>
            {kinds.map((k) => (
              <label key={k.id} className={s.choice} data-kind-option={k.id}>
                <input
                  type="radio"
                  name="kind"
                  value={k.id}
                  checked={kind === k.id}
                  onChange={() => {
                    setKind(k.id)
                    if (k.id !== FROM_UTATANE) setSource('')
                  }}
                />
                <span>{k.label}</span>
              </label>
            ))}
          </fieldset>
          {needsSource ? (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }} data-part="source">
              <legend className={s.section}>元の素材</legend>
              {sourceOptions.length === 0 ? (
                <p className={s.sub}>元にできる素材が、いまはありません。</p>
              ) : (
                sourceOptions.map((o) => (
                  <label key={o.id} className={s.choice} data-source-option={o.id}>
                    <input
                      type="radio"
                      name="source"
                      value={o.id}
                      checked={source === o.id}
                      onChange={() => setSource(o.id)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))
              )}
            </fieldset>
          ) : null}
        </form>
        <p className={s.sub} data-provisional="provenance-write">
          仮の形：申告は見本の中にだけ残ります。本物の保存は、UTATANE 本体のデータとつなぐ便で作ります。
        </p>
      </div>
    </ScreenFrame>
  )
}
