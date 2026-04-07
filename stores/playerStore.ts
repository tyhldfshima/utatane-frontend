// stores/playerStore.ts
import { create } from 'zustand'
import { Version } from '@/lib/api'

interface PlayerState {
  currentVersion: Version | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  play: (version: Version) => void
  pause: () => void
  resume: () => void
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setVolume: (v: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVersion: null, isPlaying: false, currentTime: 0, duration: 0, volume: 0.8,
  play: (version) => {
    if (get().currentVersion?.id === version.id) set({ isPlaying: true })
    else set({ currentVersion: version, isPlaying: true, currentTime: 0 })
  },
  pause:          () => set({ isPlaying: false }),
  resume:         () => set({ isPlaying: true }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration:    (d) => set({ duration: d }),
  setVolume:      (v) => set({ volume: v }),
}))
