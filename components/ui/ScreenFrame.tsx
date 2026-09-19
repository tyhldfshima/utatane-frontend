import React from 'react'
import { BusyButton, PrimaryButton, UnavailableButton, type ActionProps } from './Button'
import { Icon } from './Icon'
import styles from './ui.module.css'

// 画面の枠（docs/design/utatane-focus-screens-spec.md §2-1）。
// ★主ボタンは primary に1つだけ渡す。部品の側で1つしか置けない作り（配列を受け取らない）。
// ★戻る道（back）は、通常の画面では必須。シートは閉じる・戻るを secondary に入れる。

export type PrimarySlot =
  | ({ kind: 'action' } & ActionProps)
  | { kind: 'busy'; label: string }
  | { kind: 'unavailable'; label: string; reason: string }

type Common = {
  title?: string
  /** 画面の主ボタン（1つだけ）。無い画面は省く。 */
  primary?: PrimarySlot
  /** 主ボタンの下に並べる副ボタン・控えめなボタン */
  secondary?: React.ReactNode
  children?: React.ReactNode
}

type PageFrame = Common & {
  presentation?: 'page'
  /** 戻る道（通常の画面では必須） */
  back: { href: string; label: string }
}

type SheetFrame = Common & {
  presentation: 'sheet'
  back?: never
}

export type ScreenFrameProps = PageFrame | SheetFrame

function Primary({ slot }: { slot: PrimarySlot }) {
  if (slot.kind === 'busy') return <BusyButton label={slot.label} />
  if (slot.kind === 'unavailable') return <UnavailableButton label={slot.label} reason={slot.reason} />
  const { kind: _kind, ...action } = slot
  return <PrimaryButton {...action} />
}

export function ScreenFrame(props: ScreenFrameProps) {
  const isSheet = props.presentation === 'sheet'
  return (
    <section className={isSheet ? styles.sheet : styles.screen} data-ui={isSheet ? 'sheet' : 'screen'}>
      {!isSheet && props.back ? (
        <a className={styles.back} href={props.back.href} data-ui="back">
          <Icon name="left" size="s" />
          {props.back.label}
        </a>
      ) : null}
      {props.title ? <h2 className={styles.title}>{props.title}</h2> : null}
      {props.children}
      {props.primary || props.secondary ? (
        <div className={styles.actions}>
          {props.primary ? <Primary slot={props.primary} /> : null}
          {props.secondary}
        </div>
      ) : null}
    </section>
  )
}
