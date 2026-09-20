import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView, giftGate } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// ② ありがとうを贈る（C 量を選ぶ → D 贈る前の確認 → E 結果）。UTATANE のシート。
// ★仮の形：TYP の口（贈る）とはまだつながない。量の札・残高は読み口から来る（本物は中央の設定と TYP の口）。
// ★確認は D の1回だけ（D が確認の画面）。取り消せないことを D で言い切る。

type Search = { step?: string; amount?: string; r?: string }

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.dim}>
      <p className={s.sub} style={{ margin: '0 16px 80px' }}>
        {title}（歌の画面）
      </p>
      {children}
    </div>
  )
}

export default async function ThanksPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  const song = await uiData().getSong(params.id)
  if (!song) notFound()
  const songHref = hrefSong(song.id)
  const base = `${songHref}/thanks`
  const gate = giftGate(song.gift)
  if (gate.kind !== 'available') {
    // 歌の画面で押せない物は、ここへ直接来ても贈れない
    return (
      <ScreenFrame back={{ href: songHref, label: '歌の画面へ' }} title={COPY.giftButton}>
        {gate.kind === 'unavailable-y4' ? (
          <StateView kind="unavailable-y4" />
        ) : (
          <StateView kind="empty" message={'reason' in gate ? gate.reason : 'この歌には、いま贈れません。'} />
        )}
      </ScreenFrame>
    )
  }
  const { amounts, balance, balanceAtLabel } = await uiData().getGiftSettings()
  const amount = amounts.includes(Number(searchParams.amount)) ? Number(searchParams.amount) : null
  const step = searchParams.step === 'confirm' && amount ? 'confirm' : searchParams.step === 'result' && amount ? 'result' : 'amount'
  const receivers = song.gift.receivableCount

  if (step === 'amount') {
    const tooMuch = amount !== null && amount > balance
    return (
      <Sheet title={song.title}>
        <ScreenFrame
          presentation="sheet"
          title={`${song.title}に関わった人へ、ありがとうを贈ります`}
          primary={
            amount && !tooMuch
              ? { kind: 'action', label: '確認へ', href: `${base}?step=confirm&amount=${amount}` }
              : { kind: 'unavailable', label: '確認へ', reason: tooMuch ? 'TYP が足りません。' : '量を選んでください。' }
          }
          secondary={<GhostButton label={COPY.close} href={songHref} />}
        >
          <div data-screen="thanks-amount">
            <div className={s.amounts} role="group" aria-label="量">
              {amounts.map((a) => (
                <a
                  key={a}
                  className={`${s.amount} ${a === amount ? s.amountOn : ''}`}
                  href={`${base}?amount=${a}`}
                  aria-current={a === amount ? 'true' : undefined}
                  data-amount={a}
                >
                  {a === amount ? '✓ ' : ''}
                  {a} TYP
                </a>
              ))}
              <span className={s.amount} aria-disabled="true" title="準備中">
                その他
              </span>
            </div>
            <p className={s.sub} style={{ margin: 0 }}>
              量の札は見本値です（仮の形：本物は中央の設定から読みます）。
            </p>
            <dl className={s.kv}>
              <dt>あなたの TYP</dt>
              <dd>
                {balance.toLocaleString('ja-JP')} TYP <span className={s.sub}>（{balanceAtLabel}）</span>
              </dd>
            </dl>
          </div>
        </ScreenFrame>
      </Sheet>
    )
  }

  if (step === 'confirm' && amount) {
    return (
      <Sheet title={song.title}>
        <ScreenFrame
          presentation="sheet"
          title="贈る前の確認"
          primary={{ kind: 'action', label: '贈る', icon: 'gift', href: `${base}?step=result&amount=${amount}` }}
          secondary={<GhostButton label={COPY.back} href={`${base}?amount=${amount}`} />}
        >
          <div data-screen="thanks-confirm">
            <dl className={s.kv}>
              <dt>贈る先</dt>
              <dd>{song.title}</dd>
              <dt>量</dt>
              <dd>{amount} TYP</dd>
              <dt>届く人</dt>
              <dd style={{ fontWeight: 400 }}>この歌に関わった{receivers}人に、決めてある分け方で届きます</dd>
            </dl>
            <p className={s.card} role="note">
              <Icon name="info" size="s" /> {COPY.giftIrreversible}
            </p>
          </div>
        </ScreenFrame>
      </Sheet>
    )
  }

  // 結果（仮の形：答えは見本。?r=checking・failed で他の結果の見本）
  const r = searchParams.r
  return (
    <Sheet title={song.title}>
      <ScreenFrame presentation="sheet" primary={{ kind: 'action', label: COPY.close, href: songHref }}>
        <div data-screen="thanks-result" data-result={r ?? 'done'}>
          {r === 'checking' ? (
            <StateView kind="checking" message="通信が途中で切れました。二重に贈ることはありません。結果がわかったら、お知らせと TYポイントの履歴でお伝えします。" />
          ) : r === 'failed' ? (
            <StateView kind="empty" title="贈れませんでした" message="TYP が足りませんでした。TYP は減っていません。" />
          ) : (
            <div className={s.done} role="status">
              <span className={s.ring}>
                <Icon name="check" size="l" />
              </span>
              <h1 style={{ fontSize: 21, margin: 0 }}>ありがとうを届けました</h1>
              <p>{amount} TYP を贈りました。</p>
            </div>
          )}
        </div>
      </ScreenFrame>
    </Sheet>
  )
}
