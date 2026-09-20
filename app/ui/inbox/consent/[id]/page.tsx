import React from 'react'
import { notFound } from 'next/navigation'
import { ConfirmDialog, GhostButton, Icon, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { uiData } from '@/lib/ui-data'

// F 公開する前の確認（参加者の同意）。ステップを縦に並べた1枚（明確なステップ・URL の印つき）。
// 同意の前に確認の小窓を1回。同意しても、すぐには公開されない（主催が公開する）。

type Search = { confirm?: string; done?: string }

export default async function ConsentPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const c = await uiData().getConsent(params.id)
  if (!c) notFound()
  const base = `/ui/inbox/consent/${c.id}`

  if (searchParams.done === '1') {
    return (
      <ScreenFrame back={{ href: '/ui/inbox', label: '対応待ちへ' }} primary={{ kind: 'action', label: '対応待ちへ戻る', href: '/ui/inbox' }}>
        <div className={s.done} role="status" data-screen="consent-done">
          <span className={s.ring}>
            <Icon name="check" size="l" />
          </span>
          <h1 style={{ fontSize: 21, margin: 0 }}>公開に同意しました</h1>
          <p>まだ公開はされていません。みんなの同意がそろうと、主催が公開します。</p>
          <p className={s.sub}>公開される前なら、同意をやめられます。</p>
        </div>
      </ScreenFrame>
    )
  }

  const confirmOpen = searchParams.confirm === '1'
  return (
    <>
      <ScreenFrame
        back={{ href: '/ui/inbox', label: '対応待ちへ' }}
        title={`「${c.title}」を公開する前に、あなたの確認をお願いします`}
        primary={confirmOpen ? undefined : { kind: 'action', label: 'この内容で公開に同意する', icon: 'check', href: `${base}?confirm=1` }}
        secondary={confirmOpen ? undefined : <GhostButton label="同意しない（主催に理由を伝える）" />}
      >
        <div data-screen="consent">
          <ol className={s.steps} aria-label="ステップ">
            <li>
              <a href="#step-1">1 あなたの音</a>
            </li>
            <li>
              <a href="#step-2">2 名前と役割</a>
            </li>
            <li aria-current="step">
              <a href="#step-3">3 届け方</a>
            </li>
            <li>
              <a href="#step-4">4 同意</a>
            </li>
          </ol>
          <h2 className={s.section} id="step-1">
            1　あなたの音
          </h2>
          <span className={`${s.status} ${s.statusDone}`}>
            <Icon name="check" size="s" />
            この歌に入りました
          </span>
          <h2 className={s.section} id="step-2">
            2　あなたの名前と役割
          </h2>
          <div className={s.row}>
            <Icon name="mic" />
            <span className={s.rowText}>{c.yourName}さん　{c.yourRole}</span>
          </div>
          <h2 className={s.section} id="step-3">
            3　届け方
          </h2>
          <p>ありがとうとして TYP が届いたら、この人たちに次のように分かれて届きます。</p>
          {c.delivery.map((d) => (
            <div key={d.name} className={s.row}>
              <Icon name="user" />
              <span className={s.rowText}>
                {d.name}さん（{d.role}）
              </span>
              <span className={s.sub}>{d.note}</span>
            </div>
          ))}
          <h2 className={s.section} id="step-4">
            4　同意
          </h2>
        </div>
      </ScreenFrame>
      <ConfirmDialog
        open={confirmOpen}
        title="公開に同意しますか"
        body={
          <>
            <p>同意しても、すぐには公開されません。みんなの同意がそろうと、主催が公開します。</p>
            <p className={s.sub}>公開される前なら、同意をやめられます。</p>
          </>
        }
        confirmLabel="同意する"
        confirmHref={`${base}?done=1`}
        cancelHref={base}
      />
    </>
  )
}
