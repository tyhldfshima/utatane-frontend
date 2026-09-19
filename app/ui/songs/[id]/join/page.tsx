import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { recruitmentText } from '@/lib/preview/model'
import { DRAFTS, findSong, hrefSong } from '@/lib/preview/sample'

// B この歌の制作に参加する（えふさん確定 ②③）。
// 1 何で参加するか（募集されている役割から選ぶ。歌う人だけではない）→ 2 送る → 3 送りました
// ★送った物は、主催が入れるまで Contribution にしない（既存の決まり）。

type Search = { step?: string; role?: string }

export default function JoinPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const song = findSong(params.id)
  if (!song) notFound()
  const back = { href: hrefSong(song.id), label: '歌の画面へ' }
  const r = song.recruitment
  if (!recruitmentText(r) || !r) {
    return (
      <ScreenFrame back={back} title={COPY.joinTitle}>
        <StateView kind="empty" message="この歌は、いま参加を募集していません。" />
      </ScreenFrame>
    )
  }
  const draft = DRAFTS['minato-join']
  const role = r.roles.find((x) => x.roleKindId === searchParams.role)
  const step = searchParams.step === 'submit' && role ? 'submit' : searchParams.step === 'sent' && role ? 'sent' : 'role'
  const base = `${hrefSong(song.id)}/join`
  const steps = (
    <ol className={s.steps} aria-label="ステップ">
      <li aria-current={step === 'role' ? 'step' : undefined}>1 何で参加するか</li>
      <li aria-current={step === 'submit' ? 'step' : undefined}>2 送る</li>
      <li aria-current={step === 'sent' ? 'step' : undefined}>3 送りました</li>
    </ol>
  )

  if (step === 'role') {
    return (
      <ScreenFrame back={back} title={COPY.joinTitle}>
        <div data-screen="join-role">
          {steps}
          <p>
            {r.hostName}さんの制作に加わります。あなたが送った物は、主催が入れると、この歌の制作に入ります。
          </p>
          <dl className={s.kv}>
            <dt>制作の題名</dt>
            <dd>
              {song.id === draft.parentSongId ? draft.title : song.title}
              <br />
              <span className={s.sub} style={{ fontWeight: 400 }}>
                {draft.titleNote}
              </span>
            </dd>
          </dl>
          <h2 className={s.section}>何で参加しますか</h2>
          <p className={s.sub}>募集されている役割から選びます。</p>
          {r.roles.map((x) => (
            <a key={x.roleKindId} className={s.choice} href={`${base}?step=submit&role=${encodeURIComponent(x.roleKindId)}`} data-role={x.roleKindId}>
              <Icon name="join" />
              {x.roleLabel}で参加
              <Icon name="right" size="s" />
            </a>
          ))}
        </div>
      </ScreenFrame>
    )
  }

  if (step === 'submit' && role) {
    return (
      <ScreenFrame
        back={{ href: base, label: '何で参加するかへ戻る' }}
        title={`${role.roleLabel}を送る`}
        primary={{ kind: 'action', label: `${role.roleLabel}を送る`, icon: 'send', href: `${base}?step=sent&role=${encodeURIComponent(role.roleKindId)}` }}
        secondary={<GhostButton label="やめる" href={hrefSong(song.id)} />}
      >
        <div data-screen="join-submit">
          {steps}
          <div className={s.card} role="note">
            <b>送る物（仮の形）</b>
            <p className={s.sub}>見本のファイル「{role.roleLabel}_1」。ファイルを選ぶ所は、保存の場所とつなぐ便で作ります。</p>
          </div>
          <p>送った物は、主催が入れると、この歌の制作に入ります。</p>
        </div>
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame
      back={back}
      primary={{ kind: 'action', label: '制作中の歌を見る', icon: 'right', href: `/ui/drafts/${draft.id}?sent=${encodeURIComponent(role!.roleKindId)}` }}
    >
      <div data-screen="join-sent">
        {steps}
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
