import React from 'react'
import { Icon, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { VIEWER } from '@/lib/preview/sample'

// 公開プロフィール（M9）。ほかの人から見える形。人宛てに贈る操作・TYP・フォローは置かない。
export default function ProfilePage() {
  return (
    <ScreenFrame back={{ href: '/ui/me', label: '自分の管理画面へ' }}>
      <div data-screen="profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={s.jacket} style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 26, fontWeight: 700 }}>
            {VIEWER.displayName.slice(0, 1)}
          </span>
          <div>
            <h1 style={{ fontSize: 21, margin: 0 }}>{VIEWER.displayName}</h1>
            <span className={s.mark}>
              <Icon name="mic" size="s" />
              ボーカル
            </span>
          </div>
        </div>
        <p className={s.sub}>ほかの人から見える形です。</p>
        <h2 className={s.section}>つくった歌</h2>
        <p className={s.sub}>まだありません。</p>
        <h2 className={s.section}>参加した歌</h2>
        <div className={s.row}>
          <span className={s.rowText}>
            <b>雨のあとで</b>
            <span className={s.mark}>
              <Icon name="mic" size="s" />
              ボーカル
            </span>
          </span>
        </div>
        <h2 className={s.section}>貢献が使われた歌</h2>
        <p className={s.sub}>まだありません。</p>
      </div>
    </ScreenFrame>
  )
}
