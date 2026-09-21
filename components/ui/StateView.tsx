import React from 'react'
import { COPY } from './copy'
import { SecondaryButton } from './Button'
import { Icon } from './Icon'
import styles from './ui.module.css'

// 状態の枠（docs/design/utatane-focus-screens-spec.md §3）。
// 読み込み中・空・エラー・結果を確認しています・利用不可（Y4 暫定）・準備中・★ログインが要る。
// ★文言は設計書の言葉（COPY）を初期値にし、画面ごとの言葉だけ差し替えられる。
// ★「Y4 完成までの暫定」の札は設計の印。本番の画面には出さず、部品一覧（showDesignMarks）でだけ出す。
//   札を出さなくても、data-provisional="y4" で「あとで外す物」と分かるようにしておく。

export type StateKind = 'loading' | 'empty' | 'error' | 'checking' | 'unavailable-y4' | 'not-ready' | 'login-required'

/**
 * ★ログインの行き先（寄せる設計 §3 設計①「戻り先：ログインの後、元の画面へ戻す（?next= で渡す）」）。
 * ★ここは導線だけ。ログインの画面そのものは作らない（`/login` は PR #4 が作り直す）。
 */
export function loginHref(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
}

export type StateViewProps = {
  kind: StateKind
  title?: string
  message?: string
  /** エラー・準備中の［もう一度］ */
  retry?: { href?: string; onClick?: () => void }
  /** 部品一覧でだけ true（設計の印を出す） */
  showDesignMarks?: boolean
  /** ★kind が 'login-required' のときだけ使う。ログインの後に戻ってくる画面の住所 */
  loginNext?: string
}

const DEFAULTS: Record<StateKind, { title?: string; message?: string; live: 'polite' | 'assertive' }> = {
  loading: { message: COPY.loading, live: 'polite' },
  empty: { live: 'polite' },
  error: { message: COPY.networkError, live: 'assertive' },
  checking: { title: COPY.checkingTitle, message: COPY.checkingBody, live: 'polite' },
  'unavailable-y4': { message: COPY.giftUnavailableY4, live: 'polite' },
  'not-ready': { title: COPY.notReadyTitle, message: COPY.notReadyBody, live: 'polite' },
  'login-required': { message: COPY.loginRequired, live: 'polite' },
}

export function StateView({ kind, title, message, retry, showDesignMarks = false, loginNext }: StateViewProps) {
  const d = DEFAULTS[kind]
  const t = title ?? d.title
  const m = message ?? d.message
  const provisional = kind === 'unavailable-y4' ? { 'data-provisional': 'y4' } : {}
  return (
    <div
      className={styles.state}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={d.live}
      data-ui="state"
      data-state={kind}
      {...provisional}
    >
      {kind === 'unavailable-y4' && showDesignMarks ? <span className={styles.tag}>{COPY.tagY4Provisional}</span> : null}
      {kind === 'loading' ? (
        <>
          <span className={styles.srOnly}>{m}</span>
          <span className={styles.skeleton} aria-hidden="true" />
          <span className={styles.skeleton} aria-hidden="true" style={{ width: '70%' }} />
          <span className={styles.skeleton} aria-hidden="true" />
        </>
      ) : (
        <>
          {t ? <h3>{t}</h3> : null}
          {m ? (
            <p className={styles.note}>
              <Icon name={kind === 'checking' ? 'clock' : 'info'} size="s" />
              <span>{m}</span>
            </p>
          ) : null}
          {retry && (kind === 'error' || kind === 'not-ready') ? (
            <SecondaryButton label={COPY.retry} icon="refresh" href={retry.href} onClick={retry.onClick} />
          ) : null}
          {kind === 'login-required' ? (
            <SecondaryButton label={COPY.loginButton} icon="user" href={loginHref(loginNext)} />
          ) : null}
        </>
      )}
    </div>
  )
}
