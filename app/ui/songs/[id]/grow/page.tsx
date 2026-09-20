import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { ADD_OPTIONS, NEW_WITHOUT_INHERIT_HREF, canProceedInherit, splitSelection } from '@/lib/preview/model'
import { hrefSong, uiData } from '@/lib/ui-data'
import { InheritForm } from './InheritForm'

// 新しい Version として育てる（えふさん確定 ④⑤⑥・2026-09-19 追補）。
// 1 何を受け継ぎますか（元の歌に実在する物だけ・自由に使えます／承認が必要／利用できません）
//   ★最低1つ選ぶまで次へ進めない。0件は「何も受け継がず、新しくつくる」で ＋つくる の新規作成へ。
//   →（承認が必要を選んだとき）使わせてとお願いする（★仮の形：申請の画面は次の便）
// 2 今回あなたは何を加えますか（大きな区分だけ・あとから足せる）→ 制作中の歌（下書き）

type Search = { step?: string; take?: string | string[]; ask?: string }

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : (v ?? '').split(',')).filter(Boolean)

export default async function GrowPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const song = await uiData().getSong(params.id)
  if (!song) notFound()
  const base = `${hrefSong(song.id)}/grow`
  // ★何を受け継げるか・その可否は読み口（lib/ui-data）が lib/domain の effectiveMode で出す
  const candidates = song.inherit
  const picked = splitSelection(candidates, list(searchParams.take))
  // お願い中の物（承認が必要）は「受け継ぐ物」に数える。住所に書かれていても、実在して承認が必要な物だけ。
  const asked = splitSelection(candidates, list(searchParams.ask)).needsApproval
  const takeFree = picked.free.map((c) => c.id).join(',')
  const takeAsk = [...picked.needsApproval, ...asked].map((c) => c.id).filter((v, i, a) => a.indexOf(v) === i).join(',')
  const chosenCount = picked.free.length + picked.needsApproval.length + asked.length
  const wantsNext = searchParams.step === 'next' || searchParams.step === 'add'
  const steps = (current: 1 | 2) => (
    <ol className={s.steps} aria-label="ステップ">
      <li aria-current={current === 1 ? 'step' : undefined}>1 何を受け継ぐか</li>
      <li aria-current={current === 2 ? 'step' : undefined}>2 何を加えるか</li>
    </ol>
  )

  // ★0件では次へ進めない（住所で直接開いても、何を受け継ぐかへ戻す）
  if (wantsNext && canProceedInherit(chosenCount)) {
    // 承認が必要な物を選んだとき：お願い（仮の形）
    if (searchParams.step === 'next' && picked.needsApproval.length > 0) {
      const onlyApproval = picked.free.length === 0
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
          secondary={
            onlyApproval ? (
              // お願いをやめると受け継ぐ物が0件になる＝派生にならないので、この道は出さない
              <GhostButton label="選び直す" href={base} />
            ) : (
              <GhostButton label="お願いせずに続ける" href={`${base}?step=add&take=${encodeURIComponent(takeFree)}`} />
            )
          }
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
            {onlyApproval ? (
              <p className={s.sub}>選んだ物がすべて承認の要る物なので、お願いをやめると受け継ぐ物が無くなります。</p>
            ) : null}
          </div>
        </ScreenFrame>
      )
    }

    // 2 何を加えるか
    const q = (add?: string) =>
      `/ui/drafts/new?from=${encodeURIComponent(song.id)}&take=${encodeURIComponent(takeFree)}&ask=${encodeURIComponent(
        asked.map((c) => c.id).join(','),
      )}${add ? `&add=${add}` : ''}`
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
  if (candidates.every((c) => !c.selectable)) {
    return (
      <ScreenFrame
        back={back}
        title={COPY.growTitle}
        secondary={<GhostButton label="何も受け継がず、新しくつくる" icon="plus" href={NEW_WITHOUT_INHERIT_HREF} />}
      >
        <StateView kind="empty" message="この歌から受け継げる物は、いまありません。" />
      </ScreenFrame>
    )
  }
  return <InheritForm songTitle={song.title} action={base} backHref={hrefSong(song.id)} candidates={candidates} />
}
