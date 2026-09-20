// 見本の読み口。lib/preview/sample.ts の見本を、画面の読み口（port.ts）の形にして返す。
// ★ここは見本だけを扱う。本物とつなぐ便では、同じ形の別の読み口を作り、index.ts で差し替える。

import { recruitmentText } from '@/lib/preview/model'
import {
  CONSENTS,
  CREATE_OPTIONS,
  DRAFTS,
  GIFT,
  HOME,
  INBOX,
  ME,
  PROFILE,
  SONGS,
  VIEWER,
  findSong,
  hrefSong,
} from '@/lib/preview/sample'
import type {
  ConsentView,
  CreateOption,
  DraftView,
  GiftSettings,
  HomeSection,
  InboxGroup,
  MeView,
  PersonRef,
  PublicProfileView,
  SongView,
  UiDataSource,
} from './port'

/** 「参加できる歌」の段だけ、募集中の役割を2段目に出す */
function homeNote(songId: string, recruitNote: boolean): string {
  const song = SONGS[songId]
  if (!song) return ''
  if (!recruitNote) return song.byline
  const roles = recruitmentText(song.recruitment)
  return roles ? `募集中：${roles}` : ''
}

export const sampleSource: UiDataSource = {
  isSample: true,

  async getViewer(): Promise<PersonRef> {
    return VIEWER
  },

  async listHome(): Promise<HomeSection[]> {
    return HOME.map((sec) => ({
      key: sec.key,
      title: sec.title,
      icon: sec.icon,
      items: sec.songIds
        .filter((id) => SONGS[id])
        .map((id) => ({
          songId: id,
          title: SONGS[id].title,
          note: homeNote(id, 'recruitNote' in sec && sec.recruitNote === true),
        })),
    }))
  },

  async getSong(id: string): Promise<SongView | null> {
    return findSong(id)
  },

  async getJoinDraftFor(songId: string): Promise<DraftView | null> {
    const d = Object.values(DRAFTS).find((x) => x.parentSongId === songId)
    return d ? { ...d } : null
  },

  async getDraft(id: string): Promise<DraftView | null> {
    const d = DRAFTS[id as keyof typeof DRAFTS]
    return d ? { ...d } : null
  },

  async listInbox(): Promise<InboxGroup[]> {
    return INBOX.map((g) => ({
      key: g.key,
      title: g.title,
      items: g.consentIds
        .map((id) => CONSENTS[id as keyof typeof CONSENTS])
        .filter(Boolean)
        .map((c) => ({
          id: c.id,
          title: c.title,
          note: `${c.hostName}さんから。あなたの名前・届け方を確認して、公開に同意してください`,
          href: `/ui/inbox/consent/${encodeURIComponent(c.id)}#step-3`,
          icon: 'doc' as const,
        })),
    }))
  },

  async getConsent(id: string): Promise<ConsentView | null> {
    const c = CONSENTS[id as keyof typeof CONSENTS]
    if (!c) return null
    return {
      id: c.id,
      title: c.title,
      hostName: c.hostName,
      yourName: VIEWER.displayName,
      yourRole: c.yourRole,
      delivery: c.delivery.map((d) => ({ ...d })),
    }
  },

  async getMe(): Promise<MeView> {
    return {
      viewer: VIEWER,
      drafts: ME.drafts.map((d) => ({ ...d })),
      contributions: ME.contributions.map((x) => ({ ...x })),
      notAdopted: ME.notAdopted.map((x) => ({ ...x })),
      listenLater: ME.listenLater.map((x) => ({ ...x })),
    }
  },

  async getPublicProfile(holderId: string): Promise<PublicProfileView | null> {
    if (holderId !== VIEWER.holderId) return null
    return {
      holderId: VIEWER.holderId,
      displayName: VIEWER.displayName,
      roleLabels: [...PROFILE.roleLabels],
      created: PROFILE.created.map((x) => ({ ...(x as { songId: string; title: string }) })),
      joined: PROFILE.joined.map((x) => ({ ...x })),
      usedIn: PROFILE.usedIn.map((x) => ({ ...(x as { songId: string; title: string; note: string }) })),
    }
  },

  async getGiftSettings(): Promise<GiftSettings> {
    return { amounts: [...GIFT.amounts], balance: GIFT.balance, balanceAtLabel: GIFT.balanceAtLabel }
  },

  async listCreateOptions(): Promise<CreateOption[]> {
    return CREATE_OPTIONS.map((o) => ({ ...o }))
  },
}

