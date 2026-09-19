import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  COLORS,
  CONTRAST_PAIRS,
  contrastRatio,
  COPY,
  ConfirmDialog,
  giftGate,
  GhostButton,
  Icon,
  ICON_NAMES,
  ScreenFrame,
  SecondaryButton,
  StateView,
  UnavailableButton,
  UtataneTheme,
  type StateKind,
} from '@/components/ui'

// 共通の見た目部品の一覧（確認用）。
// ★本番の導線からは入れない：どの画面からもリンクしない。本番の組み立て（production）では 404。
//   手元で npm run dev をして /dev/ui を開いて見る。

export const metadata: Metadata = {
  title: '部品の一覧（確認用）',
  robots: { index: false, follow: false },
}

const box: React.CSSProperties = { maxWidth: 420, margin: '0 auto 32px', padding: '0 16px' }
const card: React.CSSProperties = { border: '1px dashed #9AA5A2', borderRadius: 12, padding: 8, margin: '8px 0', background: '#fff' }

const STATES: { kind: StateKind; message?: string }[] = [
  { kind: 'loading' },
  { kind: 'empty', message: 'まだありません。歌に参加すると、ここに並びます。' },
  { kind: 'error' },
  { kind: 'checking' },
  { kind: 'unavailable-y4' },
  { kind: 'not-ready' },
]

export default function UiCatalogPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const before = giftGate({ ruleEstablished: true, selfIsParticipant: false, selfIsRecipient: false, receivableCount: 2, unreceivableCount: 1, pendingResult: false, phase: 'before-acceptance' })
  const after = giftGate({ ruleEstablished: true, selfIsParticipant: false, selfIsRecipient: false, receivableCount: 2, unreceivableCount: 1, pendingResult: false, phase: 'after-acceptance' })

  return (
    <UtataneTheme>
      <main style={{ padding: '16px 0 48px' }}>
        <div style={box}>
          <h1 style={{ fontSize: 22 }}>部品の一覧（確認用）</h1>
          <p>正本：docs/design/utatane-focus-screens-spec.md。この画面は本番の導線からは入れません。</p>

          <h2>色と文字（Teal 案B・ゴシック）</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(COLORS).map(([name, hex]) => (
              <div key={name} style={{ width: 120 }}>
                <div style={{ height: 36, borderRadius: 8, border: '1px solid #D5DCDA', background: hex }} />
                <small>{name} {hex}</small>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', fontSize: 14, marginTop: 8 }}>
            <tbody>
              {CONTRAST_PAIRS.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{contrastRatio(p.fg, p.bg).toFixed(2)}</td>
                  <td>基準 {p.min}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>ボタン</h2>
          <div style={card}>
            <ScreenFrame
              presentation="sheet"
              title="主ボタン（画面の枠の中だけ）"
              primary={{ kind: 'action', label: COPY.giftButton, icon: 'gift' }}
              secondary={<GhostButton label={COPY.close} />}
            />
          </div>
          <div style={card}>
            <SecondaryButton label="この曲に参加する" icon="join" />
            <SecondaryButton label="新しい Version として育てる" icon="branch" />
            <GhostButton label="やめる" />
          </div>
          <div style={card}>
            <UnavailableButton label="公開する" reason="りくさんの同意を待っています。" />
          </div>
          <div style={card}>
            <ScreenFrame presentation="sheet" primary={{ kind: 'busy', label: '贈っています' }} />
          </div>

          <h2>状態の枠</h2>
          {STATES.map((s) => (
            <div key={s.kind} style={card}>
              <small>{s.kind}</small>
              <StateView kind={s.kind} message={s.message} showDesignMarks retry={{ href: '#' }} />
            </div>
          ))}

          <h2>ありがとうを贈るの出し分け（Y4 の1つの条件）</h2>
          <div style={card}>
            <small>Y4 本番受入の前（今の動き）</small>
            {before.kind === 'unavailable-y4' ? (
              <>
                <span style={{ display: 'inline-block', border: '1px solid #1C2424', borderRadius: 10, padding: '2px 8px', fontSize: 13, fontWeight: 700 }}>{COPY.tagY4Provisional}</span>
                <UnavailableButton label={COPY.giftButton} icon="gift" reason={before.reason} />
              </>
            ) : null}
          </div>
          <div style={card}>
            <small>Y4 本番受入の後（見本・今の動きではありません）</small>
            {after.kind === 'available' ? <p>{after.note}</p> : null}
          </div>

          <h2>確認の小窓</h2>
          <div style={card}>
            <ConfirmDialog
              open
              inline
              title="公開しますか"
              body={<p>公開すると、誰でも聴けるようになります。</p>}
              confirmLabel="公開する"
            />
          </div>

          <h2>線のアイコン</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: COLORS.teal }}>
            {ICON_NAMES.map((name) => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: COLORS.ink, fontSize: 12 }}>
                <span style={{ color: COLORS.teal, display: 'inline-flex' }}>
                  <Icon name={name} />
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </main>
    </UtataneTheme>
  )
}
