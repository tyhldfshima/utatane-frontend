import React from 'react'
import { Icon } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// W1 ホーム。段の見出しは線のアイコン（えふさん確定：絵文字は使わない）。
// 段と歌は読み口から来る（lib/ui-data）。画面に歌の id を書かない。
export default async function UiHomePage() {
  const sections = await uiData().listHome()
  return (
    <div style={{ padding: '12px 16px' }} data-screen="home">
      <h1 className={s.section} style={{ fontSize: 21, marginTop: 4 }}>
        ホーム
      </h1>
      {sections.map((sec) => (
        <section key={sec.key} aria-labelledby={`sec-${sec.key}`}>
          <h2 className={s.section} id={`sec-${sec.key}`}>
            <Icon name={sec.icon} />
            {sec.title}
          </h2>
          {sec.items.map((item) => (
            <a key={`${sec.key}-${item.songId}`} className={s.row} href={hrefSong(item.songId)} data-song={item.songId}>
              <span className={s.jacket}>
                <Icon name="note" />
              </span>
              <span className={s.rowText}>
                <b>{item.title}</b>
                <span className={s.sub}>{item.note}</span>
              </span>
              <Icon name="right" size="s" />
            </a>
          ))}
        </section>
      ))}
    </div>
  )
}
