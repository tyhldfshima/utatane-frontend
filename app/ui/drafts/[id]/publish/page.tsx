import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, ConfirmDialog, Icon, ScreenFrame, SecondaryButton, StateView, UnavailableButton, type PrimarySlot } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// G 公開する前の確認（主催が公開する）。設計書 utatane-focus-screens-spec.md:196-208・試作 g-normal〜g-done。
// 5状態：通常（同意を待っている）／同意がそろった／確認の小窓／エラー／完了。
//
// ・取り返しのつかない操作（公開）の確認は、小窓で1回だけ。
// ・ステップの「済」と、進めない理由は、読み口が lib/domain の公開前の再検証
//   （revalidateForPublish・checkMaterials・evaluateCoauthorConsent）から出す。画面では判断しない。
// ・★本物の公開の書き込みは作っていない（PR #4〜#6 待ち）。［公開する］は見本の読み口の中で
//   完了の状態へ進むだけで、歌は公開されない。

// state＝公開の操作の途中の見せ方（error＝公開できませんでした）。
type Search = { confirm?: string; done?: string; state?: string }

export default async function PublishPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const v = await uiData().getPublish(params.id)
  if (!v) notFound()
  const base = `/ui/drafts/${encodeURIComponent(v.draftId)}/publish`
  const materialsHref = `/ui/drafts/${encodeURIComponent(v.draftId)}/materials`
  // ★設計書の戻る先は「制作の画面へ」だが、主催から見た制作中の歌の画面は、まだこのリポにない
  //   （/ui/drafts/[id] は参加した人から見た形）。いまは下書きの置き場＝自分の管理画面へ戻す。
  const back = { href: '/ui/me', label: '自分の管理画面へ' }
  const title = `「${v.title}」公開する前の確認`

  // G 完了（設計書 §3 G「公開しました」「誰でも聴けるようになりました。」）
  // ★同意がそろっていないのに住所で直接開いても、完了にはしない
  if (searchParams.done === '1' && v.ready) {
    const primary: PrimarySlot | undefined = v.publishedSongId
      ? { kind: 'action', label: COPY.publishDoneButton, icon: 'right', href: hrefSong(v.publishedSongId) }
      : undefined
    return (
      <ScreenFrame back={back} primary={primary}>
        <div className={s.done} role="status" data-screen="publish-done">
          <span className={s.ring}>
            <Icon name="check" size="l" />
          </span>
          <h1 style={{ fontSize: 21, margin: 0 }}>{COPY.publishDoneTitle}</h1>
          <p>{COPY.publishDoneBody}</p>
          <p className={s.sub} data-provisional="publish-write">
            仮の形：本物の公開はまだ行われません。公開の書き込みは、UTATANE 本体のデータとつなぐ便で作ります。
          </p>
        </div>
      </ScreenFrame>
    )
  }

  const consents = (
    <>
      <ol className={s.steps} aria-label="ステップ">
        {v.steps.map((step) => (
          <li key={step.key} aria-current={step.key === 'publish' ? 'step' : undefined}>
            {step.label}
            {step.done ? ' 済' : ''}
          </li>
        ))}
      </ol>
      <h2 className={s.section}>⑥ 必要な同意</h2>
      {v.consents.map((line) => (
        <div key={line.holderId} className={s.row} data-consent={line.holderId}>
          <Icon name="user" />
          <span className={s.rowText}>{line.name}さん</span>
          {line.done ? (
            <span className={`${s.status} ${s.statusDone}`}>
              <Icon name="check" size="s" />
              {COPY.consentDone}
            </span>
          ) : (
            <span className={`${s.status} ${s.statusMuted}`}>{COPY.consentYet}</span>
          )}
        </div>
      ))}
      {v.consents.every((line) => line.done) ? null : (
        // ★お願いを送り直す口は、まだありません（申請の画面は次の便）
        <UnavailableButton label={COPY.publishAskAgain} icon="hand" reason="この画面では、まだ使えません（準備中）。" />
      )}
    </>
  )

  // G エラー（設計書 §3 G「公開できませんでした。通信がつながりませんでした。まだ公開されていません。」）
  if (searchParams.state === 'error') {
    return (
      <ScreenFrame back={back} title={title} primary={{ kind: 'action', label: COPY.retry, icon: 'refresh', href: base }}>
        <div data-screen="publish-error">
          {consents}
          <StateView kind="error" title={COPY.publishErrorTitle} message={COPY.publishErrorBody} />
        </div>
      </ScreenFrame>
    )
  }

  const materialsDone = v.steps.find((step) => step.key === 'materials')?.done === true

  // ★同意がそろっていないのに住所で小窓を開こうとしても、開かない
  const confirmOpen = searchParams.confirm === '1' && v.ready
  const primary: PrimarySlot = v.ready
    ? { kind: 'action', label: COPY.publishButton, icon: 'check', href: `${base}?confirm=1` }
    : { kind: 'unavailable', label: COPY.publishButton, reason: v.blockedReasons[0] ?? '' }

  return (
    <>
      <ScreenFrame back={back} title={title} primary={confirmOpen ? undefined : primary}>
        <div data-screen="publish" data-ready={v.ready ? 'true' : 'false'}>
          {consents}
          {v.blockedReasons.map((reason) => (
            <StateView key={reason} kind="empty" message={reason} />
          ))}
          {materialsDone ? null : (
            // ④ 素材と元の歌 が済んでいないときの直し方（素材の出どころの申告）
            <SecondaryButton label="素材の出どころを申告する" icon="pen" href={materialsHref} />
          )}
        </div>
      </ScreenFrame>
      <ConfirmDialog
        open={confirmOpen}
        title={COPY.publishConfirmTitle}
        body={
          <>
            <p>{COPY.publishConfirmBody}</p>
            <p className={s.sub}>{COPY.publishConfirmNote}</p>
          </>
        }
        confirmLabel={COPY.publishButton}
        confirmHref={`${base}?done=1`}
        cancelHref={base}
      />
    </>
  )
}
