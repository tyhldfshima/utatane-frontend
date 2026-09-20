import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, Icon, ScreenFrame, SecondaryButton } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { hrefSong, uiData } from '@/lib/ui-data'

// W6 この歌が生まれた流れ（Version Tree）。上下・優劣を付けない。見られない歌は印だけ出し、線は消さない。
export default async function TreePage({ params }: { params: { id: string } }) {
  const song = await uiData().getSong(params.id)
  if (!song) notFound()
  return (
    <ScreenFrame back={{ href: hrefSong(song.id), label: '歌の画面へ' }} title="この歌が生まれた流れ">
      <div data-screen="tree">
        <h2 className={s.section}>この歌が受け継いだ物</h2>
        {song.lineage.length === 0 ? (
          <p className={s.sub}>この歌は、何も受け継いでいない最初の歌です。</p>
        ) : (
          song.lineage.map((l) => (
            <div key={l.label} className={s.row}>
              <Icon name={l.icon} />
              <span className={s.rowText}>{l.label}</span>
            </div>
          ))
        )}
        <div className={s.card} style={{ borderColor: 'var(--u-teal)', borderWidth: 2, background: 'var(--u-tint)' }}>
          <span className={s.mark}>
            <Icon name="note" size="s" />
            いまの歌
          </span>
          <p>
            <b>{song.title}</b>
            <br />
            <span className={s.sub}>{song.byline}</span>
          </p>
        </div>
        <h2 className={s.section}>この歌から生まれた歌</h2>
        {song.children.length === 0 ? (
          <p className={s.sub}>この歌から生まれた歌は、まだありません。</p>
        ) : (
          song.children.map((c, i) =>
            c.visible && c.songId ? (
              <a key={c.songId} className={s.row} href={hrefSong(c.songId)} data-child={c.songId}>
                <span className={s.jacket}>
                  <Icon name="branch" />
                </span>
                <span className={s.rowText}>
                  <b>{c.title}</b>
                  <span className={s.sub}>{c.inherited}</span>
                </span>
                <Icon name="right" size="s" />
              </a>
            ) : (
              <div key={`hidden-${i}`} className={s.row}>
                <span className={s.jacket}>
                  <Icon name="info" />
                </span>
                <span className={`${s.status} ${s.statusMuted}`}>いまは見られない歌</span>
              </div>
            ),
          )
        )}
        <SecondaryButton label={COPY.growTitle} icon="branch" href={`${hrefSong(song.id)}/grow`} />
      </div>
    </ScreenFrame>
  )
}
