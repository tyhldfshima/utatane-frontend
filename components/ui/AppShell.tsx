'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './Icon'
import styles from './shell.module.css'

// 新しい画面の枠（ワイヤー第2版・えふさん確定 Y2）。
// スマホ：上の帯（ロゴ｜TYポイント・鈴）・下タブ4つ（ホーム｜＋つくる｜対応待ち｜自分）・再生バー。
// PC：左の縦メニュー（同じ4つ＋TYポイント）・下の再生バー。
// ★「自分」に TYポイントの残高・入口は置かない。TYポイントは別のタブで開き、再生を止めない。

export const POINT_URL = 'https://point.ty-hld.com'

type Tab = { href: string; label: string; icon: IconName; match: (p: string) => boolean; badge?: number }

export const TABS: Tab[] = [
  { href: '/ui', label: 'ホーム', icon: 'home', match: (p) => p === '/ui' || p.startsWith('/ui/songs') },
  { href: '/ui/create', label: '＋つくる', icon: 'plus', match: (p) => p.startsWith('/ui/create') || p.startsWith('/ui/drafts') },
  { href: '/ui/inbox', label: '対応待ち', icon: 'inbox', match: (p) => p.startsWith('/ui/inbox'), badge: 1 },
  { href: '/ui/me', label: '自分', icon: 'user', match: (p) => p.startsWith('/ui/me') },
]

export function AppShell({ children, sampleNote }: { children: React.ReactNode; sampleNote?: string }) {
  const pathname = usePathname() ?? '/ui'
  return (
    <div className={styles.shell} data-ui="shell">
      <header className={styles.top}>
        <a className={styles.logo} href="/ui">UTATANE</a>
        <span className={styles.topRight}>
          <a className={styles.iconLink} href={POINT_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="point" />
            TYポイント
          </a>
          <span className={styles.iconLink} aria-label="通知">
            <Icon name="bell" />
          </span>
        </span>
      </header>

      <nav className={styles.rail} aria-label="メニュー">
        <a className={styles.logo} href="/ui">UTATANE</a>
        {TABS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className={`${styles.railLink} ${t.match(pathname) ? styles.railOn : ''}`}
            aria-current={t.match(pathname) ? 'page' : undefined}
          >
            <Icon name={t.icon} />
            {t.label === '＋つくる' ? 'つくる' : t.label}
            {t.badge ? <span className={styles.badge}>{t.badge}</span> : null}
          </a>
        ))}
        <a className={styles.railLink} href={POINT_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="point" />
          TYポイント
          <Icon name="external" size="s" />
        </a>
      </nav>

      {sampleNote ? (
        <p className={styles.band} role="note">
          {sampleNote}
        </p>
      ) : null}

      <main className={styles.main}>{children}</main>

      <div className={styles.player} role="region" aria-label="再生">
        <Icon name="note" />
        <div className={styles.playerText}>
          <b>港の灯り</b>
          <br />
          <span>あさひ ほか3人</span>
        </div>
        <button type="button" className={styles.playerBtn}>
          <Icon name="pause" size="s" />
          停止
        </button>
      </div>

      <nav className={styles.tabs} aria-label="下のタブ">
        {TABS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className={`${styles.tab} ${t.match(pathname) ? styles.tabOn : ''}`}
            aria-current={t.match(pathname) ? 'page' : undefined}
          >
            <Icon name={t.icon} />
            <span>
              {t.label} {t.badge ? <span className={styles.badge}>{t.badge}</span> : null}
            </span>
          </a>
        ))}
      </nav>
    </div>
  )
}
