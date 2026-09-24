import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, GhostButton, Icon, ScreenFrame, StateView, giftGate } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { measure } from '@/lib/measure'
import { hrefSong, uiData } from '@/lib/ui-data'

// ② ありがとうを贈る（C 量を選ぶ → D 贈る前の確認 → E 結果）。UTATANE のシート。
// ★仮の形：TYP の口（贈る）とはまだつながない。量の札・残高・1回の上限は読み口から来る
//   （本物は中央の設定と TYP の口。上限を読む口はまだ無い＝設計書 §4）。
// ★確認は D の1回だけ（D が確認の画面）。取り消せないことを D で言い切る。
// ★Y4 完成後の見せ方は、components/ui/y4.ts の Y4_PHASE の1か所だけで切り替わる
//   （giftGate が note を返したら、その一文を出す）。画面の中に別の分かれ道を作らない。

// state＝贈る操作の途中の見せ方（sending＝贈っています／error＝贈る前に止まった）。
// r＝結果の見せ方（checking／failed／paused）。★本物の答えは TYP の口とつなぐ便で入る。
type Search = { step?: string; amount?: string; r?: string; state?: string }

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
        ) : gate.kind === 'checking' ? (
          // C 結果を確認しています（設計書 §3 C）。★［確認へ］は出さない
          <StateView kind="checking" title={COPY.giftPending} message={COPY.giftPendingBlock} />
        ) : (
          <StateView kind="empty" message={'reason' in gate ? gate.reason : 'この歌には、いま贈れません。'} />
        )}
      </ScreenFrame>
    )
  }
  const { amounts, balance, balanceAtLabel, perGiftLimit } = await uiData().getGiftSettings()
  // ★Y4 完成後の一文（giftGate が返す）。Y4_PHASE が 'after-acceptance' のときだけ付く
  const y4Note = gate.note
  const amount = amounts.includes(Number(searchParams.amount)) ? Number(searchParams.amount) : null
  const step = searchParams.step === 'confirm' && amount ? 'confirm' : searchParams.step === 'result' && amount ? 'result' : 'amount'
  const receivers = song.gift.receivableCount

  if (step === 'amount') {
    // C 利用不可（足りない・上限）。設計書 §3 C の2つの文言を出し分ける
    const tooMuch = amount !== null && amount > balance
    const overLimit = amount !== null && amount > perGiftLimit
    const blockReason = tooMuch
      ? `TYP が足りません。いまは ${balance.toLocaleString('ja-JP')} TYP まで贈れます。`
      : overLimit
        ? COPY.giftOverLimit
        : null
    return (
      <Sheet title={song.title}>
        <ScreenFrame
          presentation="sheet"
          title={`${song.title}に関わった人へ、ありがとうを贈ります`}
          primary={
            amount && !blockReason
              ? { kind: 'action', label: '確認へ', href: `${base}?step=confirm&amount=${amount}` }
              : { kind: 'unavailable', label: '確認へ', reason: blockReason ?? '量を選んでください。' }
          }
          secondary={<GhostButton label={COPY.close} href={songHref} />}
        >
          <div data-screen="thanks-amount" data-block={blockReason ? (tooMuch ? 'short' : 'over-limit') : 'none'}>
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
              量の札と1回の上限は見本値です（仮の形：本物は中央の設定から読みます）。
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
    // D 読み込み中（設計書 §3 D「［贈る］を押せない『贈っています』に置き換える」）
    const sending = searchParams.state === 'sending'
    // D エラー（設計書 §3 D）。贈る前に止まったので、主ボタンは出さない
    const blocked = searchParams.state === 'error'
    const detail = (
      <>
        <dl className={s.kv}>
          <dt>贈る先</dt>
          <dd>{song.title}</dd>
          <dt>量</dt>
          <dd>{amount} TYP</dd>
          <dt>届く人</dt>
          <dd style={{ fontWeight: 400 }}>この歌に関わった{receivers}人に、決めてある分け方で届きます</dd>
        </dl>
        {y4Note ? (
          <p className={s.card} role="note" data-part="y4-note">
            <Icon name="info" size="s" /> {y4Note}。
          </p>
        ) : null}
      </>
    )
    if (blocked) {
      return (
        <Sheet title={song.title}>
          <ScreenFrame presentation="sheet" title="贈る前の確認" secondary={<GhostButton label={COPY.back} href={`${base}?amount=${amount}`} />}>
            <div data-screen="thanks-confirm" data-state="error">
              {detail}
              <StateView kind="empty" message={COPY.giftBlocked} />
              <p className={s.card} role="note">
                <Icon name="info" size="s" /> {COPY.giftIrreversible}
              </p>
            </div>
          </ScreenFrame>
        </Sheet>
      )
    }
    return (
      <Sheet title={song.title}>
        <ScreenFrame
          presentation="sheet"
          title="贈る前の確認"
          primary={
            sending
              ? { kind: 'busy', label: COPY.giftSending }
              : { kind: 'action', label: '贈る', icon: 'gift', href: `${base}?step=result&amount=${amount}` }
          }
          secondary={sending ? undefined : <GhostButton label={COPY.back} href={`${base}?amount=${amount}`} />}
        >
          <div data-screen="thanks-confirm" data-state={sending ? 'sending' : 'normal'}>
            {detail}
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
  // ★計測の操作点 M-7（TYP）：ありがとうが届いた時点（正本 §4）。
  //   届かなかったとき（failed・paused）と、結果が分からないとき（checking）は鳴らさない。
  if (!r) measure().mark('M-7')
  return (
    <Sheet title={song.title}>
      <ScreenFrame presentation="sheet" primary={{ kind: 'action', label: COPY.close, href: songHref }}>
        <div data-screen="thanks-result" data-result={r ?? 'done'}>
          {r === 'checking' ? (
            <StateView kind="checking" message="通信が途中で切れました。二重に贈ることはありません。結果がわかったら、お知らせと TYポイントの履歴でお伝えします。" />
          ) : r === 'failed' ? (
            <StateView kind="empty" title="贈れませんでした" message="TYP が足りませんでした。TYP は減っていません。" />
          ) : r === 'paused' ? (
            // E 利用不可（いま止まっている）（設計書 §3 E）
            <StateView kind="empty" title={COPY.giftPausedTitle} message={COPY.giftPausedBody} />
          ) : (
            <div className={s.done} role="status">
              <span className={s.ring}>
                <Icon name="check" size="l" />
              </span>
              <h1 style={{ fontSize: 21, margin: 0 }}>ありがとうを届けました</h1>
              <p>{amount} TYP を贈りました。</p>
              {y4Note ? (
                <p className={s.sub} data-part="y4-note">
                  {y4Note}。
                </p>
              ) : null}
            </div>
          )}
        </div>
      </ScreenFrame>
    </Sheet>
  )
}
