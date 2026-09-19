import React from 'react'
import { Icon, type IconName } from './Icon'
import styles from './ui.module.css'

// ボタン（docs/design/utatane-focus-screens-spec.md §2-1）。
// ★主ボタンは1画面に1つ。主ボタンは ScreenFrame（画面の主ボタンの枠）と ConfirmDialog（確認の小窓）の
//   中でしか出せない作りにしてある（PrimaryButton はこのフォルダの外へ出さない）。
// ★押せないボタンは、押せない理由の1文を必ず持つ（UnavailableButton の reason は必須）。
// ★どのボタンも高さは var(--u-button)（52px）。押せる物の最小 44px を下回らない。

export type ActionProps = {
  label: string
  icon?: IconName
  /** 画面を移るときはリンク */
  href?: string
  onClick?: () => void
}

type Variant = 'primary' | 'secondary' | 'ghost'

function ActionButton({ label, icon, href, onClick, variant }: ActionProps & { variant: Variant }) {
  const cls = [styles.button, variant === 'primary' ? styles.primary : '', variant === 'ghost' ? styles.ghost : '']
    .filter(Boolean)
    .join(' ')
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {label}
    </>
  )
  if (href) {
    return (
      <a className={cls} href={href} data-ui={variant}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick} data-ui={variant}>
      {inner}
    </button>
  )
}

/** ★このフォルダの中だけで使う（ScreenFrame・ConfirmDialog）。 */
export function PrimaryButton(props: ActionProps) {
  return <ActionButton {...props} variant="primary" />
}

/** 副ボタン（枠だけ Teal）。 */
export function SecondaryButton(props: ActionProps) {
  return <ActionButton {...props} variant="secondary" />
}

/** 控えめなボタン（やめる・戻る・閉じる）。 */
export function GhostButton(props: ActionProps) {
  return <ActionButton {...props} variant="ghost" />
}

// サーバーと画面で同じ id になるよう、文字から決める（数え上げは使わない）。
function stableId(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return `u-reason-${(h >>> 0).toString(36)}`
}

/**
 * 押せないボタン。押せない理由を、ボタンのすぐ下に文字で出す（色だけで伝えない）。
 * 読み上げでも、ボタンと理由が結び付くようにする（aria-describedby）。
 */
export function UnavailableButton({
  label,
  icon,
  reason,
  reasonId,
}: {
  label: string
  icon?: IconName
  reason: string
  /** 同じ画面に2つ置くときの重複を避けるための id（省略可） */
  reasonId?: string
}) {
  const id = reasonId ?? stableId(label + reason)
  return (
    <div data-ui="unavailable">
      <button type="button" className={`${styles.button} ${styles.off}`} disabled aria-describedby={id}>
        {icon ? <Icon name={icon} /> : null}
        {label}
      </button>
      <p className={styles.reason} id={id} role="note">
        <Icon name="info" size="s" />
        <span>{reason}</span>
      </p>
    </div>
  )
}

/** 押した直後の「〇〇しています」（二重押しを防ぐ）。 */
export function BusyButton({ label }: { label: string }) {
  return (
    <button type="button" className={`${styles.button} ${styles.off}`} disabled aria-busy="true" data-ui="busy">
      <Icon name="clock" />
      {label}
    </button>
  )
}
