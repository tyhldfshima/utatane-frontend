'use client'
// components/SingBottomSheet.tsx
// 「歌ってみる」フロー：ミュージシャン登録確認 or カラオケモード

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  versionId:    string
  versionTitle: string
  audioUrl:     string
  lyrics?:      string     // 歌詞テキスト（あれば）
  onClose:      () => void
}

type Sheet = 'choice' | 'karaoke'

export function SingBottomSheet({ versionId, versionTitle, audioUrl, lyrics, onClose }: Props) {
  const router     = useRouter()
  const { user, addRole } = useAuthStore()
  const [sheet, setSheet]           = useState<Sheet>('choice')
  const [registering, setReg]       = useState(false)
  const [playing, setPlaying]       = useState(false)
  const [elapsed, setElapsed]       = useState(0)
  const [duration, setDuration]     = useState(0)
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const rafRef     = useRef<number>(0)

  const isMusicianAlready = user?.roles?.includes('musician') ?? false

  // ── 音声制御 ─────────────────────────────────────────────

  useEffect(() => {
    if (sheet !== 'karaoke') return
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    audio.onloadedmetadata = () => setDuration(audio.duration)
    audio.onended          = () => { setPlaying(false); setElapsed(0) }
    return () => { audio.pause(); audio.src = ''; cancelAnimationFrame(rafRef.current) }
  }, [sheet, audioUrl])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
    } else {
      audio.play()
      const tick = () => {
        setElapsed(audio.currentTime)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    setPlaying(!playing)
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setElapsed(t)
  }

  // ── ミュージシャン登録 ────────────────────────────────────

  const handleRegister = async () => {
    setReg(true)
    try {
      await addRole('musician')             // PATCH /api/v1/users/me/roles
      router.push(`/upload?type=performance&base_version_id=${versionId}`)
    } finally {
      setReg(false)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  // ── UI ───────────────────────────────────────────────────

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={sheet === 'karaoke' ? undefined : onClose} />

      {/* シート */}
      <div className={`fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl
        transition-all duration-300 safe-bottom ${
          sheet === 'karaoke' ? 'top-12' : ''
        }`}>

        {/* ハンドル */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ─── choice：歌う方法を選ぶ ─────────────────────── */}
        {sheet === 'choice' && (
          <div className="px-6 pt-2 pb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-1">歌ってみる</h2>
            <p className="text-sm text-gray-400 mb-7 leading-relaxed">
              「{versionTitle}」
            </p>

            {/* ミュージシャン登録済みなら直接アップロードへ */}
            {isMusicianAlready ? (
              <button
                onClick={() => router.push(`/upload?type=performance&base_version_id=${versionId}`)}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white text-sm font-medium mb-3 flex items-center justify-center gap-2">
                <span className="text-lg">🎤</span>
                ミュージシャンとして投稿する
              </button>
            ) : (
              <>
                {/* ミュージシャン登録へ */}
                <div className="border border-purple-200 rounded-2xl p-5 mb-3">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-lg">
                      🎤
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-0.5">ミュージシャンとして歌う</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        演奏を投稿して収益を得られます。<br />
                        購入・TYPの <span className="text-orange-600 font-medium">30%</span> があなたに分配されます。
                      </p>
                    </div>
                  </div>
                  <button onClick={handleRegister} disabled={registering}
                    className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50">
                    {registering ? '登録中…' : 'ミュージシャン登録して投稿する'}
                  </button>
                </div>
              </>
            )}

            {/* カラオケモード */}
            <button onClick={() => setSheet('karaoke')}
              className="w-full py-4 rounded-2xl bg-gray-50 text-gray-700 text-sm font-medium flex items-center justify-center gap-2 border border-gray-100">
              <span className="text-lg">🎵</span>
              カラオケとして楽しむ（投稿なし）
            </button>

            <button onClick={onClose}
              className="w-full mt-3 py-2.5 text-xs text-gray-400">
              キャンセル
            </button>
          </div>
        )}

        {/* ─── karaoke：伴奏再生 ＋ 歌詞 ──────────────────── */}
        {sheet === 'karaoke' && (
          <div className="flex flex-col h-full">

            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">{versionTitle}</p>
                <p className="text-xs text-gray-400">カラオケモード</p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                ✕
              </button>
            </div>

            {/* 歌詞エリア */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {lyrics ? (
                <pre className="text-base text-gray-800 leading-loose font-sans whitespace-pre-wrap">
                  {lyrics}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-300">歌詞がありません</p>
                </div>
              )}
            </div>

            {/* プレイヤーコントロール */}
            <div className="px-6 pt-4 pb-8 border-t border-gray-100 bg-white">
              {/* シークバー */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-gray-400 w-8 text-right">{fmt(elapsed)}</span>
                <input type="range" min={0} max={duration || 100} step={0.1}
                  value={elapsed} onChange={seek}
                  className="flex-1 accent-purple-600 h-1" />
                <span className="text-xs text-gray-400 w-8">{fmt(duration)}</span>
              </div>

              {/* 再生ボタン */}
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, elapsed - 10); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4V2L6 5l4 3V6a5 5 0 1 1-5 5H3a7 7 0 1 0 7-7z" fill="currentColor"/>
                    <text x="7.5" y="14" fontSize="5" fill="currentColor" fontFamily="sans-serif">10</text>
                  </svg>
                </button>

                <button onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                  {playing ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="5" width="4" height="14" rx="1.5" fill="white"/>
                      <rect x="14" y="5" width="4" height="14" rx="1.5" fill="white"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5l11 7-11 7V5z" fill="white"/>
                    </svg>
                  )}
                </button>

                <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, elapsed + 10); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4V2l4 3-4 3V6a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z" fill="currentColor"/>
                    <text x="7.5" y="14" fontSize="5" fill="currentColor" fontFamily="sans-serif">10</text>
                  </svg>
                </button>
              </div>

              {/* 後からミュージシャン登録を促す */}
              {!isMusicianAlready && (
                <button onClick={handleRegister}
                  className="w-full mt-5 py-3 rounded-xl bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100">
                  🎤 気に入ったら投稿してみませんか？ → ミュージシャン登録
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
