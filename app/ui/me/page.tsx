import React from 'react'
import { Icon } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { VIEWER, hrefSong } from '@/lib/preview/sample'

// 自分（えふさん確定：最初に自分用の管理画面、そこから公開プロフィールへ）。
// ★TYポイント・TYP の残高と入口は置かない（941be1bd）。
export default function MePage() {
  return (
    <div style={{ padding: '12px 16px' }} data-screen="me">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>自分</h1>
      <a className={s.card} href="/ui/me/profile" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--u-ink)', textDecoration: 'none' }} data-link="profile">
        <span className={s.jacket} style={{ borderRadius: '50%' }}>
          {VIEWER.displayName.slice(0, 1)}
        </span>
        <span className={s.rowText}>
          <b>{VIEWER.displayName}</b>
          <span className={s.sub}>公開プロフィールを見る（ほかの人から見える形）</span>
        </span>
        <Icon name="right" size="s" />
      </a>
      <h2 className={s.section}>
        <Icon name="doc" />
        下書き
      </h2>
      <div className={s.row}>
        <span className={s.rowText}>
          <b>「港の灯り」から育てた歌</b>
          <span className={s.sub}>まだ誰にも公開されていません</span>
        </span>
      </div>
      <h2 className={s.section}>
        <Icon name="mic" />
        自分の貢献
      </h2>
      <div className={s.row}>
        <span className={s.rowText}>
          <b>雨のあとで</b>
          <span className={s.mark}>
            <Icon name="mic" size="s" />
            ボーカル
          </span>
        </span>
      </div>
      <h2 className={s.section}>
        <Icon name="send" />
        採用されなかった送り物
      </h2>
      <div className={s.row}>
        <span className={s.rowText}>
          <b>コーラス 別案（港の灯り）</b>
          <span className={`${s.status} ${s.statusMuted}`}>今回は見送られました</span>
        </span>
      </div>
      <h2 className={s.section}>
        <Icon name="clock" />
        あとで聴く
      </h2>
      <a className={s.row} href={hrefSong('minato')}>
        <span className={s.rowText}>
          <b>港の灯り</b>
          <span className={s.sub}>あさひ ほか3人</span>
        </span>
        <Icon name="right" size="s" />
      </a>
    </div>
  )
}
