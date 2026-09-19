'use client'

import React, { useEffect, useId, useRef } from 'react'
import { COPY } from './copy'
import { GhostButton, PrimaryButton } from './Button'
import styles from './ui.module.css'

// 取り返しのつかない操作（贈る・公開する・公開に同意する）の前の確認の小窓
// （docs/design/utatane-focus-screens-spec.md §2-1）。確認は1回だけ。
// ★開いたら見出しへ焦点を移す。Escape で閉じる（onCancel）。
// ★主ボタンは確認の1つだけ。戻る道（cancelLabel）を必ず置く。

export type ConfirmDialogProps = {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
  /** 部品一覧で、画面の中にそのまま置くとき true（背景の幕を出さない） */
  inline?: boolean
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = COPY.back,
  onConfirm,
  onCancel,
  inline = false,
}: ConfirmDialogProps) {
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open || inline) return
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, inline, onCancel])

  if (!open) return null
  return (
    <>
      {inline ? null : <div className={styles.backdrop} aria-hidden="true" />}
      <div
        className={inline ? styles.dialog : `${styles.dialog} ${styles.dialogFixed}`}
        role="dialog"
        aria-modal={inline ? undefined : true}
        aria-labelledby={titleId}
        data-ui="confirm"
      >
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        <div>{body}</div>
        <PrimaryButton label={confirmLabel} onClick={onConfirm} />
        <GhostButton label={cancelLabel} onClick={onCancel} />
      </div>
    </>
  )
}
