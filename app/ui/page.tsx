import React from 'react'
import { Icon, type IconName } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { SONGS, hrefSong } from '@/lib/preview/sample'

// W1 ホーム。段の見出しは線のアイコン（えふさん確定：絵文字は使わない）。
const SECTIONS: { title: string; icon: IconName; songIds: string[]; note?: (id: string) => string }[] = [
  { title: '種', icon: 'seed', songIds: ['yoake'] },
  { title: '参加できる歌', icon: 'join', songIds: ['minato', 'yoake'], note: (id) => recruitNote(id) },
  { title: '枝分かれ', icon: 'branch', songIds: ['futatabi'] },
  { title: '新しい Version', icon: 'newVersion', songIds: ['futari'] },
]

function recruitNote(id: string): string {
  const r = SONGS[id]?.recruitment
  return r ? `募集中：${r.roles.map((x) => x.roleLabel).join('・')}` : ''
}

export default function UiHomePage() {
  return (
    <div style={{ padding: '12px 16px' }} data-screen="home">
      <h1 className={s.section} style={{ fontSize: 21, marginTop: 4 }}>
        ホーム
      </h1>
      {SECTIONS.map((sec) => (
        <section key={sec.title} aria-labelledby={`sec-${sec.icon}`}>
          <h2 className={s.section} id={`sec-${sec.icon}`}>
            <Icon name={sec.icon} />
            {sec.title}
          </h2>
          {sec.songIds.map((id) => {
            const song = SONGS[id]
            if (!song) return null
            return (
              <a key={`${sec.title}-${id}`} className={s.row} href={hrefSong(id)} data-song={id}>
                <span className={s.jacket}>
                  <Icon name="note" />
                </span>
                <span className={s.rowText}>
                  <b>{song.title}</b>
                  <span className={s.sub}>{sec.note ? sec.note(id) : song.byline}</span>
                </span>
                <Icon name="right" size="s" />
              </a>
            )
          })}
        </section>
      ))}
    </div>
  )
}
