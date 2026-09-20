import React from 'react'
import { notFound } from 'next/navigation'
import { COPY, Icon, ScreenFrame, SecondaryButton, UnavailableButton, giftGate, type PrimarySlot } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { creditText, recruitmentText } from '@/lib/preview/model'
import { hrefSong, uiData } from '@/lib/ui-data'

// A 歌の画面（W2）。
// ・この歌をつくった人：採用され、表示対象の Contribution だけから（えふさん確定 ①）
// ・この歌の制作に参加する：募集があるときだけ。募集内容を先に見せる（②）
// ・新しい Version として育てる：募集とは独立（④）
// ・ありがとうを贈る：giftGate の1つの条件（Y4 暫定）。主ボタンはこの1つだけ。

export default async function SongPage({ params }: { params: { id: string } }) {
  const song = await uiData().getSong(params.id)
  if (!song) notFound()

  // ★つくった人・受け継げる物の判断は読み口（lib/ui-data）が lib/domain で済ませている。画面は受け取るだけ。
  const credits = song.credits
  const recruiting = recruitmentText(song.recruitment)
  const gate = giftGate(song.gift)

  let primary: PrimarySlot | undefined
  let giftNote: React.ReactNode = null
  if (gate.kind === 'available') {
    primary = { kind: 'action', label: COPY.giftButton, icon: 'gift', href: `${hrefSong(song.id)}/thanks` }
  } else if (gate.kind === 'unavailable-y4') {
    // ★Y4 完成までの暫定（Y4_PHASE で外れる）
    giftNote = (
      <div data-provisional="y4">
        <UnavailableButton label={COPY.giftButton} icon="gift" reason={gate.reason} />
      </div>
    )
  } else if (gate.kind === 'checking') {
    primary = { kind: 'unavailable', label: COPY.giftPending, reason: gate.reason }
  } else if (gate.kind === 'unavailable-self') {
    giftNote = (
      <p className={s.card} role="note">
        {gate.reason}
      </p>
    )
  }

  const lead = (
    <div data-screen="song" data-song={song.id}>
      <div className={`${s.jacket} ${s.jacketXL}`}>
        <Icon name="note" size="l" />
      </div>
      <h1 style={{ fontSize: 21, margin: '10px 0 0' }}>{song.title}</h1>
      <p className={s.sub} style={{ margin: 0 }}>
        {song.byline}
      </p>
      <SecondaryButton label="再生" icon="play" />
      {giftNote}
    </div>
  )

  return (
    <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }} lead={lead} primary={primary}>
      {song.grownFrom ? (
        <div className={s.card} data-part="grown-from">
          <span className={s.mark}>
            <Icon name="branch" size="s" />
            育った歌
          </span>
          <p>
            「{song.grownFrom.title}」の{song.grownFrom.inherited}を受け継いで生まれた歌です。元の歌は変わっていません。
          </p>
          <a className={s.row} href={hrefSong(song.grownFrom.songId)}>
            <span className={s.rowText}>元の歌「{song.grownFrom.title}」へ</span>
            <Icon name="right" size="s" />
          </a>
        </div>
      ) : null}

      <h2 className={s.section}>この歌について</h2>
      <p style={{ margin: 0 }}>{song.about}</p>

      <h2 className={s.section}>この歌をつくった人</h2>
      {credits.length === 0 ? (
        <p className={s.sub}>まだ表示できる人がいません。</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-part="credits">
          {credits.map((line) => (
            <li key={line.holderId} className={s.row} data-credit={line.holderId}>
              <Icon name="user" />
              <span className={s.rowText}>{creditText(line)}</span>
            </li>
          ))}
        </ul>
      )}

      {recruiting && song.recruitment ? (
        <section className={s.card} data-part="join-card" aria-labelledby="join-title">
          <h3 id="join-title">{COPY.joinTitle}</h3>
          <p>{song.recruitment.hostName}さんが一緒につくる仲間を募集しています。</p>
          <p>
            <b>募集中：{recruiting}</b>
          </p>
          <SecondaryButton label={COPY.joinButton} icon="join" href={`${hrefSong(song.id)}/join`} />
        </section>
      ) : null}

      <section className={s.card} data-part="grow-card" aria-labelledby="grow-title">
        <h3 id="grow-title">{COPY.growTitle}</h3>
        <p>{COPY.growLead}</p>
        <SecondaryButton label={COPY.growTitle} icon="branch" href={`${hrefSong(song.id)}/grow`} />
      </section>

      <SecondaryButton label="この歌が生まれた流れ" icon="tree" href={`${hrefSong(song.id)}/tree`} />
    </ScreenFrame>
  )
}
