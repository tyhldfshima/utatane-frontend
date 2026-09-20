import React from 'react'
import { notFound } from 'next/navigation'
import { Icon, ScreenFrame } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// 公開プロフィール（M9）。ほかの人から見える形。人宛てに贈る操作・TYP・フォローは置かない。
// 中身は読み口から来る（lib/ui-data）。
export default async function ProfilePage() {
  const viewer = await uiData().getViewer()
  const profile = await uiData().getPublicProfile(viewer.holderId)
  if (!profile) notFound()
  return (
    <ScreenFrame back={{ href: '/ui/me', label: '自分の管理画面へ' }}>
      <div data-screen="profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={s.jacket} style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 26, fontWeight: 700 }}>
            {profile.displayName.slice(0, 1)}
          </span>
          <div>
            <h1 style={{ fontSize: 21, margin: 0 }}>{profile.displayName}</h1>
            {profile.roleLabels.map((r) => (
              <span key={r} className={s.mark}>
                <Icon name="mic" size="s" />
                {r}
              </span>
            ))}
          </div>
        </div>
        <p className={s.sub}>ほかの人から見える形です。</p>

        <h2 className={s.section}>つくった歌</h2>
        {profile.created.length === 0 ? (
          <p className={s.sub}>まだありません。</p>
        ) : (
          profile.created.map((x) => (
            <a key={x.songId} className={s.row} href={hrefSong(x.songId)} data-song={x.songId}>
              <span className={s.rowText}>
                <b>{x.title}</b>
              </span>
              <Icon name="right" size="s" />
            </a>
          ))
        )}

        <h2 className={s.section}>参加した歌</h2>
        {profile.joined.length === 0 ? (
          <p className={s.sub}>まだありません。</p>
        ) : (
          profile.joined.map((x) => (
            <div key={`${x.title}-${x.roleLabel}`} className={s.row}>
              <span className={s.rowText}>
                <b>{x.title}</b>
                <span className={s.mark}>
                  <Icon name="mic" size="s" />
                  {x.roleLabel}
                </span>
              </span>
            </div>
          ))
        )}

        <h2 className={s.section}>貢献が使われた歌</h2>
        {profile.usedIn.length === 0 ? (
          <p className={s.sub}>まだありません。</p>
        ) : (
          profile.usedIn.map((x) => (
            <a key={x.songId} className={s.row} href={hrefSong(x.songId)} data-song={x.songId}>
              <span className={s.rowText}>
                <b>{x.title}</b>
                <span className={s.sub}>{x.note}</span>
              </span>
              <Icon name="right" size="s" />
            </a>
          ))
        )}
      </div>
    </ScreenFrame>
  )
}
