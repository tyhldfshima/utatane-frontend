import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { joinRoleText, recruitmentText, resolveJoinRole } from '@/lib/preview/model'
import { hrefSong, uiData } from '@/lib/ui-data'
import { SubmitForm } from './SubmitForm'

// B この歌の制作に参加する（えふさん確定 ②③・2026-09-19 追補）。
// 募集が複数：1 何で参加するか（募集されている役割から選ぶ。歌う人だけではない）→ 2 送る → 3 送りました
// 募集が1つ：選ぶ操作だけを省き、その役割を自動で選んで「送る」へ進む。どの画面にも「〇〇で参加」は出す。
// ★送った物は、主催が入れるまで Contribution にしない（既存の決まり）。

// state＝送る操作の途中の見せ方（sending＝送っています／error＝送れませんでした）。
// ★本物の送る口は PR #4 の合流の後。いまは見せ方だけを設計書どおりにしておく。
type Search = { step?: string; role?: string; state?: string }

export default async function JoinPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const song = await uiData().getSong(params.id)
  if (!song) notFound()
  const songBack = { href: hrefSong(song.id), label: '歌の画面へ' }
  const r = song.recruitment
  if (!recruitmentText(r) || !r) {
    return (
      <ScreenFrame back={songBack} title={COPY.joinTitle}>
        <StateView kind="empty" message="この歌は、いま参加を募集していません。" />
      </ScreenFrame>
    )
  }
  const draft = await uiData().getJoinDraftFor(song.id)
  const resolved = resolveJoinRole(r, searchParams.role)
  const role = resolved?.role ?? null
  const auto = resolved?.autoSelected ?? false
  const base = `${hrefSong(song.id)}/join`
  const step: 'role' | 'submit' | 'sent' =
    searchParams.step === 'sent' && role ? 'sent' : (searchParams.step === 'submit' || auto) && role ? 'submit' : 'role'
  const roleQuery = role ? `&role=${encodeURIComponent(role.roleKindId)}` : ''

  const steps = (
    <ol className={s.steps} aria-label="ステップ">
      <li aria-current={step === 'role' ? 'step' : undefined}>1 {role ? joinRoleText(role.roleLabel) : '何で参加するか'}</li>
      <li aria-current={step === 'submit' ? 'step' : undefined}>2 送る</li>
      <li aria-current={step === 'sent' ? 'step' : undefined}>3 送りました</li>
    </ol>
  )
  const roleMark = role ? (
    <span className={s.mark} data-part="join-role">
      <Icon name="join" size="s" />
      {joinRoleText(role.roleLabel)}
    </span>
  ) : null

  if (step === 'role') {
    return (
      <ScreenFrame back={songBack} title={COPY.joinTitle}>
        <div data-screen="join-role">
          {steps}
          <p>
            {r.hostName}さんの制作に加わります。あなたが送った物は、主催が入れると、この歌の制作に入ります。
          </p>
          {draft ? (
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
          <h2 className={s.section}>何で参加しますか</h2>
          <p className={s.sub}>募集されている役割から選びます。</p>
          {r.roles.map((x) => (
            <a key={x.roleKindId} className={s.choice} href={`${base}?step=submit&role=${encodeURIComponent(x.roleKindId)}`} data-role={x.roleKindId}>
              <Icon name="join" />
              {joinRoleText(x.roleLabel)}
              <Icon name="right" size="s" />
            </a>
          ))}
        </div>
      </ScreenFrame>
    )
  }

  if (step === 'submit' && role) {
    const submitBack = auto ? songBack : { href: base, label: '何で参加するかへ戻る' }
    const retryHref = `${base}?step=submit${roleQuery}`

    // B 読み込み中（設計書 §3 B「押せない『送っています』」・主ボタンは置かない）
    if (searchParams.state === 'sending') {
      return (
        <ScreenFrame back={submitBack} title={auto ? COPY.joinTitle : `${role.roleLabel}を送る`} primary={{ kind: 'busy', label: COPY.joinSending }}>
          <div data-screen="join-sending">
            {steps}
            {roleMark}
          </div>
        </ScreenFrame>
      )
    }

    // B エラー（設計書 §3 B「送れませんでした。通信がつながりませんでした。」［もう一度］［やめる］・主ボタンはもう一度）
    if (searchParams.state === 'error') {
      return (
        <ScreenFrame
          back={submitBack}
          title={auto ? COPY.joinTitle : `${role.roleLabel}を送る`}
          primary={{ kind: 'action', label: COPY.retry, icon: 'refresh', href: retryHref }}
          secondary={<GhostButton label={COPY.cancel} href={hrefSong(song.id)} />}
        >
          <div data-screen="join-error">
            {steps}
            {roleMark}
            <StateView kind="error" title={COPY.joinSendErrorTitle} message={COPY.networkErrorShort} />
          </div>
        </ScreenFrame>
      )
    }

    // ★送る物は、自分が置いた素材（§3 K）から選ぶ。選ぶまで送れない
    const materials = await uiData().listMyMaterials()
    return (
      <SubmitForm
        action={base}
        roleLabel={role.roleLabel}
        roleKindId={role.roleKindId}
        auto={auto}
        hostName={r.hostName}
        draft={auto && draft ? { title: draft.title, titleNote: draft.titleNote } : null}
        // 募集が1つのときは選ぶ画面が無いので、戻る先は歌の画面
        back={submitBack}
        cancelHref={hrefSong(song.id)}
        materials={materials}
      />
    )
  }

  return (
    <ScreenFrame
      back={songBack}
      primary={
        draft
          ? { kind: 'action', label: '制作中の歌を見る', icon: 'right', href: `/ui/drafts/${draft.id}?sent=${encodeURIComponent(role!.roleKindId)}` }
          : undefined
      }
    >
      <div data-screen="join-sent">
        {steps}
        {roleMark}
        <div className={s.done} role="status">
          <span className={s.ring}>
            <Icon name="check" size="l" />
          </span>
          <h1 style={{ fontSize: 21, margin: 0 }}>送りました</h1>
          <p>まだこの歌には入っていません。主催が入れると、「この歌に入りました」に変わります。</p>
        </div>
      </div>
    </ScreenFrame>
  )
}
