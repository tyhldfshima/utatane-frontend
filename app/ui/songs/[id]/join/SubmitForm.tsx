'use client'

import React, { useState } from 'react'
import { COPY, GhostButton, Icon, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { joinRoleText } from '@/lib/preview/model'
import type { MyMaterialView } from '@/lib/ui-data'

// B 送る（設計書 §3 B）。置いた素材（§3 K 自分の素材）から、送る物を選ぶ。
// ・素材が1つも無いときは、K の空の文言と［素材を置く］への道を出す。
// ・選ぶまでは送れない（押せない主ボタンと理由の一文）。
// ★送る操作そのものは仮のまま。本物の送信は、UTATANE 本体のデータとつなぐ便で作る。

export const MATERIAL_REQUIRED_REASON = '送る物を1つ選んでください。'
export const NO_MATERIAL_MESSAGE = 'まだ素材がありません。［素材を置く］から、音のファイルを置けます。'
export const MATERIALS_HREF = '/ui/materials'

export function SubmitForm({
  action,
  roleLabel,
  roleKindId,
  auto,
  hostName,
  draft,
  back,
  cancelHref,
  materials,
}: {
  /** 送るときに開く住所（?step=sent が付く） */
  action: string
  roleLabel: string
  roleKindId: string
  /** 募集が1つで、役割を自動で選んだか */
  auto: boolean
  hostName: string
  /** 参加した先の制作中の歌（募集が1つのときだけ出す） */
  draft: { title: string; titleNote: string | null } | null
  back: { href: string; label: string }
  cancelHref: string
  materials: MyMaterialView[]
}) {
  const [picked, setPicked] = useState<string>('')
  const empty = materials.length === 0
  const reason = empty ? NO_MATERIAL_MESSAGE : picked ? null : MATERIAL_REQUIRED_REASON

  return (
    <ScreenFrame
      back={back}
      title={auto ? COPY.joinTitle : `${roleLabel}を送る`}
      primary={
        reason
          ? { kind: 'unavailable', label: `${roleLabel}を送る`, reason }
          : { kind: 'action', label: `${roleLabel}を送る`, icon: 'send', submitsForm: 'join-submit-form' }
      }
      secondary={<GhostButton label={COPY.cancel} href={cancelHref} />}
    >
      <div data-screen="join-submit" data-auto-role={auto ? 'true' : 'false'} data-picked={picked || 'none'}>
        <ol className={s.steps} aria-label="ステップ">
          <li>1 {joinRoleText(roleLabel)}</li>
          <li aria-current="step">2 送る</li>
          <li>3 送りました</li>
        </ol>
        <span className={s.mark} data-part="join-role">
          <Icon name="join" size="s" />
          {joinRoleText(roleLabel)}
        </span>
        {auto ? (
          <p>
            {hostName}さんの制作に加わります。いま募集しているのは「{roleLabel}」なので、{joinRoleText(roleLabel)}します。
          </p>
        ) : null}
        {auto && draft ? (
          <dl className={s.kv}>
            <dt>制作の題名</dt>
            <dd>
              {draft.title}
              <br />
              <span className={s.sub} style={{ fontWeight: 400 }}>
                {draft.titleNote}
              </span>
            </dd>
          </dl>
        ) : null}

        <form id="join-submit-form" method="get" action={action}>
          <input type="hidden" name="step" value="sent" />
          <input type="hidden" name="role" value={roleKindId} />
          {empty ? (
            <div className={s.card} role="note" data-part="materials-empty">
              <b>送る物</b>
              <p className={s.sub}>{NO_MATERIAL_MESSAGE}</p>
              <GhostButton label="素材を置く" icon="plus" href={MATERIALS_HREF} />
            </div>
          ) : (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }} data-part="materials">
              <legend className={s.section}>送る物</legend>
              {materials.map((m) => (
                <label key={m.id} className={s.choice} data-material={m.id}>
                  <input
                    type="radio"
                    name="material"
                    value={m.id}
                    checked={picked === m.id}
                    onChange={() => setPicked(m.id)}
                  />
                  <span>
                    {m.label}
                    <span className={s.sub}>
                      {' '}
                      {m.sizeLabel}・{m.placedAtLabel}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </form>
        <p>送った物は、主催が入れると、この歌の制作に入ります。</p>
        <p className={s.sub} data-provisional="join-send">
          仮の形：送る操作は、まだ相手に届きません。本物の送信は、UTATANE 本体のデータとつなぐ便で作ります。
        </p>
      </div>
    </ScreenFrame>
  )
}
