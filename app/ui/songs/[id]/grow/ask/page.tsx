import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView, type PrimarySlot } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// J 使わせてとお願いする（設計書 utatane-focus-screens-spec.md §3 J・試作 j-ask）。
// 「承認が必要」な物を受け継ぎたいときに、作った人へお願いを送る。
//
// 状態：お願いの内容／送った後／返事待ち／うまくいかなかったとき／承認が必要な物がない
//
// ・「承認が必要」かは lib/domain の effectiveMode の結果から来る（読み口が畳む）。画面で決めない。
// ・選んだ物がすべて承認の要る物のときは、お願いをやめると受け継ぐ物が0件になるので
//   ［お願いせずに続ける］を出さず［選び直す］にする（設計書 J・追補2点）。
// ・★本物の送信は作っていない（PR #4〜#6 待ち）。［お願いを送って続ける］は、
//   見本の読み口の中で返事待ちに進むだけで、相手には届かない。

type Search = { take?: string | string[]; step?: string; state?: string }

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : (v ?? '').split(',')).filter(Boolean)
const join = (ids: string[]) => ids.join(',')

export default async function AskPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const selected = list(searchParams.take)
  const sending = searchParams.step === 'sent' && searchParams.state !== 'error'

  // ★送る＝見本の読み口の中で返事待ちに進むだけ
  const view = sending
    ? await uiData().requestPermission({ songId: params.id, contributionIds: selected })
    : await uiData().getPermissionAsk(params.id, selected)
  if (!view) notFound()

  const growHref = `${hrefSong(view.songId)}/grow`
  const base = `${growHref}/ask?take=${encodeURIComponent(join(selected))}`
  /** お願い中の物も「受け継ぐ物」に数えて、何を加えるかへ進む */
  const nextHref = `${growHref}?step=add&take=${encodeURIComponent(join(view.freeIds))}&ask=${encodeURIComponent(
    join(view.items.map((i) => i.id)),
  )}`
  const backToPick = { href: growHref, label: '選び直す' }

  // 承認が必要な物がない（この道に入らない）
  if (view.items.length === 0) {
    return (
      <ScreenFrame back={backToPick} title={COPY.askTitle}>
        <div data-screen="ask-none">
          <StateView kind="empty" message="選んだ物に、承認が必要な物はありません。そのまま受け継げます。" />
          <GhostButton label="何を受け継ぐかへ戻る" href={growHref} />
        </div>
      </ScreenFrame>
    )
  }

  const rows = (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {view.items.map((item) => (
        <li key={item.id} className={s.row} data-ask={item.id}>
          <Icon name="hand" />
          <span className={s.rowText}>
            <b>{item.label}</b>
            <span className={s.sub}>お願いする相手：{item.holderNames.map((n) => `${n}さん`).join('・')}</span>
          </span>
          <span className={`${s.status} ${item.waiting ? s.statusDone : s.statusMuted}`} data-ask-state={item.id}>
            {item.waiting ? (
              <>
                <Icon name="clock" size="s" />
                {COPY.askWaiting}
              </>
            ) : (
              item.statusLabel
            )}
          </span>
        </li>
      ))}
    </ul>
  )

  // うまくいかなかったとき
  if (searchParams.state === 'error') {
    return (
      <ScreenFrame
        back={backToPick}
        title={COPY.askTitle}
        primary={{ kind: 'action', label: COPY.retry, icon: 'refresh', href: `${base}&step=sent` }}
      >
        <div data-screen="ask-error">
          {rows}
          <StateView kind="error" title={COPY.askSendErrorTitle} message={COPY.networkErrorShort} />
        </div>
      </ScreenFrame>
    )
  }

  // 送った後
  if (sending) {
    return (
      <ScreenFrame back={backToPick} primary={{ kind: 'action', label: '続ける', icon: 'right', href: nextHref }}>
        <div className={s.done} role="status" data-screen="ask-sent">
          <span className={s.ring}>
            <Icon name="send" size="l" />
          </span>
          <h1 style={{ fontSize: 21, margin: 0 }}>{COPY.askSentTitle}</h1>
          <p>{COPY.askReply}</p>
          <p className={s.sub} data-provisional="request-send">
            仮の形：お願いは見本の中にだけ残ります。本物の送信は、UTATANE 本体のデータとつなぐ便で作ります。
          </p>
        </div>
        {rows}
      </ScreenFrame>
    )
  }

  // 返事待ち（もう送ってある）／お願いの内容（まだ送っていない）
  const primary: PrimarySlot = view.waiting
    ? { kind: 'action', label: '続ける', icon: 'right', href: nextHref }
    : { kind: 'action', label: 'お願いを送って続ける', icon: 'hand', href: `${base}&step=sent` }
  return (
    <ScreenFrame
      back={backToPick}
      title={COPY.askTitle}
      primary={primary}
      secondary={
        view.canSkip ? (
          <GhostButton label="お願いせずに続ける" href={`${growHref}?step=add&take=${encodeURIComponent(join(view.freeIds))}`} />
        ) : (
          // お願いをやめると受け継ぐ物が0件になる＝派生にならないので、この道は出さない
          <GhostButton label="選び直す" href={growHref} />
        )
      }
    >
      <div data-screen="ask" data-waiting={view.waiting ? 'true' : 'false'}>
        <p>{view.waiting ? COPY.askWaitingBody : COPY.askBody}</p>
        {rows}
        {view.canSkip ? null : (
          <p className={s.sub}>選んだ物がすべて承認の要る物なので、お願いをやめると受け継ぐ物が無くなります。</p>
        )}
        {view.waiting ? null : (
          <p className={s.sub} data-provisional="request-send">
            仮の形：お願いは見本の中にだけ残ります。本物の送信は、UTATANE 本体のデータとつなぐ便で作ります。
          </p>
        )}
      </div>
    </ScreenFrame>
  )
}
