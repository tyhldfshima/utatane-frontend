import React from 'react'
import { Icon } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// 自分（えふさん確定：最初に自分用の管理画面、そこから公開プロフィールへ）。
// ★TYポイント・TYP の残高と入口は置かない（941be1bd）。
// 中身は読み口から来る（lib/ui-data）。
export default async function MePage() {
  const me = await uiData().getMe()
  return (
    <div style={{ padding: '12px 16px' }} data-screen="me">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>自分</h1>
      <a className={s.card} href="/ui/me/profile" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--u-ink)', textDecoration: 'none' }} data-link="profile">
        <span className={s.jacket} style={{ borderRadius: '50%' }}>
          {me.viewer.displayName.slice(0, 1)}
        </span>
        <span className={s.rowText}>
          <b>{me.viewer.displayName}</b>
          <span className={s.sub}>公開プロフィールを見る（ほかの人から見える形）</span>
        </span>
        <Icon name="right" size="s" />
      </a>
      <a className={s.row} href="/ui/materials" data-link="materials">
        <span className={s.jacket}>
          <Icon name="wave" />
        </span>
        <span className={s.rowText}>
          <b>自分の素材</b>
          <span className={s.sub}>置いた音のファイル（あなただけが見られます）</span>
        </span>
        <Icon name="right" size="s" />
      </a>

      <h2 className={s.section}>
        <Icon name="doc" />
        下書き
      </h2>
      {me.drafts.length === 0 ? (
        <p className={s.sub}>まだありません。</p>
      ) : (
        me.drafts.map((d, i) => (
          <div key={d.id ?? `draft-${i}`} className={s.row}>
            <span className={s.rowText}>
              <b>{d.title}</b>
              <span className={s.sub}>{d.note}</span>
            </span>
          </div>
        ))
      )}

      <h2 className={s.section}>
        <Icon name="mic" />
        自分の貢献
      </h2>
      {me.contributions.length === 0 ? (
        <p className={s.sub}>まだありません。</p>
      ) : (
        me.contributions.map((c) => (
          <div key={`${c.title}-${c.roleLabel}`} className={s.row}>
            <span className={s.rowText}>
              <b>{c.title}</b>
              <span className={s.mark}>
                <Icon name="mic" size="s" />
                {c.roleLabel}
              </span>
            </span>
          </div>
        ))
      )}

      <h2 className={s.section}>
        <Icon name="send" />
        採用されなかった送り物
      </h2>
      {me.notAdopted.length === 0 ? (
        <p className={s.sub}>まだありません。</p>
      ) : (
        me.notAdopted.map((x) => (
          <div key={x.title} className={s.row}>
            <span className={s.rowText}>
              <b>{x.title}</b>
              <span className={`${s.status} ${s.statusMuted}`}>{x.statusLabel}</span>
            </span>
          </div>
        ))
      )}

      <h2 className={s.section}>
        <Icon name="clock" />
        あとで聴く
      </h2>
      {me.listenLater.length === 0 ? (
        <p className={s.sub}>まだありません。</p>
      ) : (
        me.listenLater.map((x) => (
          <a key={x.songId} className={s.row} href={hrefSong(x.songId)} data-song={x.songId}>
            <span className={s.rowText}>
              <b>{x.title}</b>
              <span className={s.sub}>{x.byline}</span>
            </span>
            <Icon name="right" size="s" />
          </a>
        ))
      )}
    </div>
  )
}
