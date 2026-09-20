'use client'

import React, { useState } from 'react'
import { COPY, GhostButton, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { NEW_WITHOUT_INHERIT_HREF, canProceedInherit, type InheritCandidate } from '@/lib/preview/model'

// 1 何を受け継ぎますか（えふさん確定 ⑤・2026-09-19 追補）。
// ★最低1つ選ぶまで［次へ］は押せない（理由の一文つき）。0件は Version の派生ではない。
// ★「何も受け継がず、新しくつくる」は ＋つくる の新規作成へ送る（元の歌との親子は作らない）。

export const INHERIT_REQUIRED_REASON = '受け継ぐ物を1つ以上選んでください。'

export function InheritForm({
  songTitle,
  action,
  askAction,
  backHref,
  candidates,
  initialSelected = [],
}: {
  songTitle: string
  action: string
  /** 承認が必要な物を選んだときの送り先（使わせてとお願いする） */
  askAction: string
  backHref: string
  candidates: InheritCandidate[]
  initialSelected?: string[]
}) {
  const [selected, setSelected] = useState<string[]>(
    initialSelected.filter((id) => candidates.some((c) => c.id === id && c.selectable)),
  )
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => (on ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id)))
  const ok = canProceedInherit(selected.length)
  // ★承認が必要な物を1つでも選んだら、お願いの画面へ送る（判定は候補が持つ mode ＝ effectiveMode の結果）
  const needsApproval = candidates.some((c) => selected.includes(c.id) && c.mode === 'approval')

  return (
    <ScreenFrame
      back={{ href: backHref, label: '歌の画面へ' }}
      title={COPY.growTitle}
      primary={
        ok
          ? { kind: 'action', label: '次へ', icon: 'right', submitsForm: 'inherit-form' }
          : { kind: 'unavailable', label: '次へ', reason: INHERIT_REQUIRED_REASON }
      }
      secondary={<GhostButton label="何も受け継がず、新しくつくる" icon="plus" href={NEW_WITHOUT_INHERIT_HREF} />}
    >
      <div data-screen="grow-inherit" data-selected={selected.length}>
        <ol className={s.steps} aria-label="ステップ">
          <li aria-current="step">1 何を受け継ぐか</li>
          <li>2 何を加えるか</li>
        </ol>
        <p>「{songTitle}」の一部を受け継いで、あなたが主催する新しい Version をつくります。元の歌は変わりません。</p>
        <form id="inherit-form" method="get" action={needsApproval ? askAction : action} data-ask={needsApproval ? 'true' : 'false'}>
          {needsApproval ? null : <input type="hidden" name="step" value="next" />}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={s.section}>何を受け継ぎますか？</legend>
            {candidates.map((c) => (
              <label
                key={c.id}
                className={`${s.choice} ${c.selectable ? '' : s.choiceOff}`}
                data-candidate={c.id}
                data-mode={c.mode}
              >
                <input
                  type="checkbox"
                  name="take"
                  value={c.id}
                  disabled={!c.selectable}
                  checked={selected.includes(c.id)}
                  onChange={(e) => toggle(c.id, e.currentTarget.checked)}
                  aria-describedby={`st-${c.id}`}
                />
                <span>{c.label}</span>
                <span className={s.choiceStatus} id={`st-${c.id}`}>
                  {c.statusLabel}
                </span>
              </label>
            ))}
          </fieldset>
        </form>
        <p className={s.sub}>
          「利用できません」は選べません。「承認が必要」を選ぶと、次にお願いを送ります。何も受け継がないときは、新しい歌としてつくります。
        </p>
      </div>
    </ScreenFrame>
  )
}
