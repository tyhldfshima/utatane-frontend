'use client'
// components/AudioPlayer.tsx — グローバル音楽プレイヤー
// Phase1視聴キャッシュバック用の再生記録送信付き

import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { api } from '@/lib/api'

export function AudioPlayer() {
  const { currentVersion, isPlaying, currentTime, duration,
          volume, pause, resume, setCurrentTime, setDuration } = usePlayerStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const playStartRef = useRef<number>(0)
  const reportedRef = useRef(false)

  // バージョン切替時にsrc変更・再生開始
  useEffect(() => {
    if (!audioRef.current || !currentVersion) return
    audioRef.current.src = currentVersion.audio_url
    audioRef.current.load()
    audioRef.current.play().catch(() => {})
    playStartRef.current = Date.now()
    reportedRef.current = false
  }, [currentVersion?.id])

  // 再生/一時停止同期
  useEffect(() => {
    if (!audioRef.current) return
    isPlaying ? audioRef.current.play().catch(() => {}) : audioRef.current.pause()
  }, [isPlaying])

  // 音量同期
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Phase1 視聴キャッシュバック: 80%再生で記録送信
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentVersion || reportedRef.current) return
    setCurrentTime(audio.currentTime)
    const pct = audio.currentTime / audio.duration
    if (pct >= 0.8) {
      reportedRef.current = true
      api.recordPlay(currentVersion.id, Math.floor(audio.currentTime)).catch(() => {})
    }
  }, [currentVersion?.id])

  if (!currentVersion) return null

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-4 z-50">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={pause}
      />

      {/* 楽曲情報 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{currentVersion.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {currentVersion.melody_work.creator.name} × {currentVersion.lyrics_work.creator.name}
        </p>
      </div>

      {/* 再生コントロール */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          onClick={() => isPlaying ? pause() : resume()}
          className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          {isPlaying ? (
            <span className="flex gap-0.5">
              <span className="w-1 h-4 bg-gray-800 rounded-sm" />
              <span className="w-1 h-4 bg-gray-800 rounded-sm" />
            </span>
          ) : (
            <span className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-gray-800 ml-0.5" />
          )}
        </button>

        {/* シークバー */}
        <div className="flex items-center gap-2 w-64">
          <span className="text-xs text-gray-400 w-8">{fmt(currentTime)}</span>
          <input
            type="range" min={0} max={duration || 1} step={0.1}
            value={currentTime}
            onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = +e.target.value }}
            className="flex-1 h-1 accent-purple-500"
          />
          <span className="text-xs text-gray-400 w-8">{fmt(duration)}</span>
        </div>
      </div>

      {/* 音量 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-gray-400">
          <path d="M8 1.5L4.5 5H2v6h2.5L8 14.5V1.5z"/>
          <path d="M11 5a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
        <input type="range" min={0} max={1} step={0.05}
          value={volume}
          onChange={(e) => usePlayerStore.getState().setVolume(+e.target.value)}
          className="w-16 h-1 accent-purple-500"
        />
      </div>
    </div>
  )
}
