'use client'

import React from 'react'
import { GhostButton, Icon, ScreenFrame, SecondaryButton, StateView, type PrimarySlot } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { MAX_BYTES, PROBLEM_TEXT, isValidSizeBytes, sizeText, validateFileName } from '@/lib/materials/rules'
import { authHeader } from '@/lib/ty-session'

// 自分の素材（置く → 一覧 → 再生）。設計書 §3 の状態の枠に合わせる。
// ・未ログイン：主ボタンは押せない形＋理由の一文（中央ログインは PR #4 で入る）
// ・読み込み中／空／エラー：StateView
// ・置いている間：主ボタンを「置いています」に変えて押せなくする（二重に置かない）
//
// ★合言葉（X-App-Key）はこの画面に無い。置く・読む・一覧のどれも、UTATANE のサーバーの口
//   （/api/materials）を通す。素材そのものだけが、署名つき住所へ直接 PUT される。
// ★利用者 id は1つも送らない。誰の素材かは、印から中央が決める。

type Material = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }
type Phase = 'loading' | 'signed-out' | 'ready' | 'error'

const SIGNED_OUT_REASON = 'この画面を使うには、TY アカウントでログインしてください。'

function dateText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function MaterialsPanel() {
  const [phase, setPhase] = React.useState<Phase>('loading')
  const [materials, setMaterials] = React.useState<Material[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [playing, setPlaying] = React.useState<{ id: string; url: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    setPhase('loading')
    const head = await authHeader()
    if (!head) {
      setPhase('signed-out')
      return
    }
    try {
      const res = await fetch('/api/materials', { headers: head, cache: 'no-store' })
      if (res.status === 401) {
        setPhase('signed-out')
        return
      }
      if (!res.ok) {
        setPhase('error')
        return
      }
      const body = (await res.json()) as { materials?: Material[] }
      setMaterials(Array.isArray(body.materials) ? body.materials : [])
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // 同じファイルをもう一度選べるように、選んだ記録は毎回消す
    event.target.value = ''
    if (!file) return

    const nameProblem = validateFileName(file.name)
    if (nameProblem !== null) {
      setNotice(PROBLEM_TEXT[nameProblem])
      return
    }
    if (!isValidSizeBytes(file.size)) {
      setNotice(PROBLEM_TEXT.invalid_size_bytes)
      return
    }
    const head = await authHeader()
    if (!head) {
      setPhase('signed-out')
      return
    }

    setNotice(null)
    setUploading(true)
    try {
      const type = file.type && file.type.length > 0 ? file.type : 'application/octet-stream'
      // ★送るのはファイル名・種類・大きさだけ。利用者 id も住所も送らない。
      const ticket = await fetch('/api/materials/presign', {
        method: 'POST',
        headers: { ...head, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, content_type: type, size_bytes: file.size }),
      })
      if (ticket.status === 401) {
        setPhase('signed-out')
        return
      }
      const ticketBody = (await ticket.json().catch(() => ({}))) as { uploadUrl?: string; reason?: string }
      if (!ticket.ok || !ticketBody.uploadUrl) {
        setNotice(
          ticketBody.reason && ticketBody.reason in PROBLEM_TEXT
            ? PROBLEM_TEXT[ticketBody.reason as keyof typeof PROBLEM_TEXT]
            : 'いまは素材を置けませんでした。しばらくしてから、もう一度お試しください。',
        )
        return
      }
      // 署名つき住所へ、素材そのものを直接送る（中身は UTATANE のサーバーを通らない）
      const put = await fetch(ticketBody.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: file,
      })
      if (!put.ok) {
        setNotice('通信がつながりませんでした。もう一度お試しください。')
        return
      }
      setNotice(`「${file.name}」を置きました。`)
      await load()
    } catch {
      setNotice('通信がつながりませんでした。もう一度お試しください。')
    } finally {
      setUploading(false)
    }
  }

  async function onPlay(id: string) {
    const head = await authHeader()
    if (!head) {
      setPhase('signed-out')
      return
    }
    setNotice(null)
    try {
      const res = await fetch(`/api/materials/${encodeURIComponent(id)}/play`, { headers: head, cache: 'no-store' })
      if (res.status === 401) {
        setPhase('signed-out')
        return
      }
      if (res.status === 403) {
        setNotice('この素材は再生できません。あなたが置いた素材だけを再生できます。')
        return
      }
      const body = (await res.json().catch(() => ({}))) as { url?: string }
      if (!res.ok || !body.url) {
        setNotice('いまは再生できませんでした。しばらくしてから、もう一度お試しください。')
        return
      }
      setPlaying({ id, url: body.url })
    } catch {
      setNotice('通信がつながりませんでした。もう一度お試しください。')
    }
  }

  let primary: PrimarySlot | undefined
  if (phase === 'signed-out') {
    primary = { kind: 'unavailable', label: '素材を置く', reason: SIGNED_OUT_REASON }
  } else if (uploading) {
    primary = { kind: 'busy', label: '置いています' }
  } else if (phase === 'ready') {
    primary = { kind: 'action', label: '素材を置く', icon: 'plus', onClick: () => inputRef.current?.click() }
  }

  return (
    <ScreenFrame
      back={{ href: '/ui/me', label: '自分の管理画面へ' }}
      title="自分の素材"
      primary={primary}
      secondary={phase === 'ready' ? <GhostButton label="一覧を読み直す" icon="refresh" onClick={() => void load()} /> : null}
    >
      <div data-screen="materials">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => void onPick(e)}
          style={{ display: 'none' }}
          data-part="file-input"
          aria-hidden="true"
          tabIndex={-1}
        />
        <p className={s.sub}>
          置いた素材は、あなただけが見られます。歌に使うときも、あなたが選ぶまで誰にも渡りません。1つ {sizeText(MAX_BYTES)}{' '}
          までです。
        </p>

        {notice ? (
          <p className={s.card} role="status" data-part="notice">
            <Icon name="info" size="s" /> {notice}
          </p>
        ) : null}

        {phase === 'signed-out' ? (
          <StateView kind="empty" title="ログインしてください" message={SIGNED_OUT_REASON} />
        ) : phase === 'loading' ? (
          <StateView kind="loading" />
        ) : phase === 'error' ? (
          <StateView kind="error" retry={{ onClick: () => void load() }} />
        ) : materials.length === 0 ? (
          <StateView kind="empty" message="まだ素材がありません。［素材を置く］から、音のファイルを置けます。" />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-part="materials">
            {materials.map((m) => (
              <li key={m.id} className={s.row} data-material={m.id}>
                <span className={s.jacket}>
                  <Icon name="wave" />
                </span>
                <span className={s.rowText}>
                  <b>{m.fileName}</b>
                  <span className={s.sub}>
                    {sizeText(m.sizeBytes)}
                    {dateText(m.createdAt) ? `・${dateText(m.createdAt)}` : ''}
                  </span>
                </span>
                <SecondaryButton label="再生" icon="play" onClick={() => void onPlay(m.id)} />
              </li>
            ))}
          </ul>
        )}

        {playing ? (
          <div className={s.card} data-part="player">
            <span className={s.mark}>
              <Icon name="play" size="s" />
              再生中
            </span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={playing.url} controls autoPlay style={{ width: '100%' }} data-part="audio" />
            <p className={s.sub}>再生のための住所は、短い時間だけ使えます。時間が過ぎたら、もう一度［再生］を押してください。</p>
          </div>
        ) : null}
      </div>
    </ScreenFrame>
  )
}
