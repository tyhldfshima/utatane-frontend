import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { ADD_OPTIONS, inheritCandidates, splitSelection } from '@/lib/preview/model'
import { findSong, hrefSong } from '@/lib/preview/sample'

// 新しい Version として育てる（えふさん確定 ④⑤⑥）。
// 1 何を受け継ぎますか（元の歌に実在する物だけ・自由に使えます／承認が必要／利用できません）
//   →（承認が必要を選んだとき）使わせてとお願いする（★仮の形：申請の画面は次の便）
// 2 今回あなたは何を加えますか（大きな区分だけ・あとから足せる）→ 制作中の歌（下書き）

type Search = { step?: string; take?: string | string[]; ask?: string }

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : (v ?? '').split(',')).filter(Boolean)

export default function GrowPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const song = findSong(params.id)
  if (!song) notFound()
  const base = `${hrefSong(song.id)}/grow`
  const candidates = inheritCandidates(song)
  const picked = splitSelection(candidates, list(searchParams.take))
  const takeFree = picked.free.map((c) => c.id).join(',')
  const takeAsk = picked.needsApproval.map((c) => c.id).join(',')
  const steps = (current: 1 | 2) => (
    <ol className={s.steps} aria-label="ステップ">
      <li aria-current={current === 1 ? 'step' : undefined}>1 何を受け継ぐか</li>
      <li aria-current={current === 2 ? 'step' : undefined}>2 何を加えるか</li>
    </ol>
  )

  // 承認が必要な物を選んだとき：お願い（仮の形）
  if (searchParams.step === 'next' && picked.needsApproval.length > 0) {
    return (
      <ScreenFrame
        back={{ href: base, label: '選び直す' }}
        title="使わせてとお願いする"
        primary={{
          kind: 'action',
          label: 'お願いを送って続ける',
          icon: 'hand',
          href: `${base}?step=add&take=${encodeURIComponent(takeFree)}&ask=${encodeURIComponent(takeAsk)}`,
        }}
        secondary={<GhostButton label="お願いせずに続ける" href={`${base}?step=add&take=${encodeURIComponent(takeFree)}`} />}
      >
        <div data-screen="grow-ask" data-provisional="request">
          <p className={s.card} role="note">
            仮の形：お願い（申請）の画面は、UTATANE 本体のデータとつなぐ便で作ります。
          </p>
          <p>次の物は、作った人の承認が必要です。お願いを送り、返事が来たら使えます。</p>
          <ul>
            {picked.needsApproval.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </div>
      </ScreenFrame>
    )
  }

  // 2 何を加えるか
  if (searchParams.step === 'add' || searchParams.step === 'next') {
    // 選べない物（利用できません）は、住所に書かれていても受け継がない
    const take = picked.free.map((c) => c.id).join(',')
    const ask = searchParams.ask ?? ''
    const q = (add?: string) =>
      `/ui/drafts/new?from=${encodeURIComponent(song.id)}&take=${encodeURIComponent(take)}&ask=${encodeURIComponent(ask)}${add ? `&add=${add}` : ''}`
    return (
      <ScreenFrame
        back={{ href: base, label: '何を受け継ぐかへ戻る' }}
        title="今回あなたは何を加えますか"
        secondary={<GhostButton label="あとで決める" href={q()} />}
      >
        <div data-screen="grow-add">
          {steps(2)}
          <p className={s.sub}>ここでは大まかに選ぶだけです。役割は、あとから足したり、仲間を募集したりできます。</p>
          {ADD_OPTIONS.map((o) => (
            <a key={o.id} className={s.choice} href={q(o.id)} data-add={o.id}>
              <Icon name="plus" />
              {o.label}
              <Icon name="right" size="s" />
            </a>
          ))}
        </div>
      </ScreenFrame>
    )
  }

  // 1 何を受け継ぐか
  const back = { href: hrefSong(song.id), label: '歌の画面へ' }
  if (candidates.length === 0) {
    return (
      <ScreenFrame back={back} title={COPY.growTitle}>
        <StateView kind="empty" message="この歌から受け継げる物は、いまありません。" />
      </ScreenFrame>
    )
  }
  return (
    <ScreenFrame
      back={back}
      title={COPY.growTitle}
      primary={{ kind: 'action', label: '次へ', icon: 'right', submitsForm: 'inherit-form' }}
    >
      <div data-screen="grow-inherit">
        {steps(1)}
        <p>「{song.title}」の一部を受け継いで、あなたが主催する新しい Version をつくります。元の歌は変わりません。</p>
        <form id="inherit-form" method="get" action={base}>
          <input type="hidden" name="step" value="next" />
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={s.section}>何を受け継ぎますか？</legend>
            {candidates.map((c) => (
              <label
                key={c.id}
                className={`${s.choice} ${c.selectable ? '' : s.choiceOff}`}
                data-candidate={c.id}
                data-mode={c.mode}
              >
                <input type="checkbox" name="take" value={c.id} disabled={!c.selectable} aria-describedby={`st-${c.id}`} />
                <span>{c.label}</span>
                <span className={s.choiceStatus} id={`st-${c.id}`}>
                  {c.statusLabel}
                </span>
              </label>
            ))}
          </fieldset>
        </form>
        <p className={s.sub}>「利用できません」は選べません。「承認が必要」を選ぶと、次にお願いを送ります。何も受け継がずに進むこともできます。</p>
      </div>
    </ScreenFrame>
  )
}
