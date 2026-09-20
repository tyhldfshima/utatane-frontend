import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { ReactElement } from 'react'
import { sampleSource, setUiDataSource, uiData, type UiDataSource } from '.'
import HomePage from '@/app/ui/page'
import SongPage from '@/app/ui/songs/[id]/page'
import MePage from '@/app/ui/me/page'
import CreatePage from '@/app/ui/create/page'
import InboxPage from '@/app/ui/inbox/page'

// react-dom/server の型は依存に無いので、型を付けて読み込む（package.json を変えない）。
const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

describe('読み口の約束（見本の読み口が、画面の要る形をすべて返す）', () => {
  it('見ている人・ホーム・歌・制作中の歌・対応待ち・自分・量の札・始め方が読める', async () => {
    const d = sampleSource
    expect((await d.getViewer()).displayName).toBe('そら')
    expect((await d.listHome()).length).toBeGreaterThan(0)
    expect((await d.getSong('minato'))?.title).toBe('港の灯り')
    expect(await d.getSong('無い歌')).toBeNull()
    expect((await d.getJoinDraftFor('minato'))?.id).toBe('minato-join')
    expect(await d.getJoinDraftFor('futatabi')).toBeNull()
    expect((await d.getDraft('minato-join'))?.hostName).toBe('あさひ')
    expect((await d.getConsent('ame'))?.yourRole).toBe('ボーカル')
    expect(await d.getConsent('無い物')).toBeNull()
    expect((await d.getMe()).viewer.holderId).toBe('h-sora')
    expect((await d.getPublicProfile('h-sora'))?.displayName).toBe('そら')
    expect(await d.getPublicProfile('h-asahi')).toBeNull()
    expect((await d.getGiftSettings()).amounts).toEqual([100, 300, 500])
    expect((await d.listCreateOptions()).some((o) => o.href)).toBe(true)
  })

  it('対応待ちは、中身が無い段も段として返す（画面が「いまはありません」を出せる）', async () => {
    const groups = await sampleSource.listInbox()
    expect(groups.map((g) => g.key)).toEqual(['consent', 'join', 'submission', 'permission'])
    expect(groups[0].items).toHaveLength(1)
    expect(groups[1].items).toHaveLength(0)
  })

  it('見本の読み口だと分かる印を持つ', () => {
    expect(sampleSource.isSample).toBe(true)
    expect(uiData()).toBe(sampleSource)
  })
})

describe('差し替え（画面を1枚も書き直さずに、中身が変わる）', () => {
  const fake: UiDataSource = {
    isSample: false,
    async getViewer() {
      return { holderId: 'h-test', displayName: 'てすと' }
    },
    async listHome() {
      return [{ key: 'only', title: 'ためしの段', icon: 'note', items: [{ songId: 'x1', title: 'ためしの歌', note: 'ためしの2段目' }] }]
    },
    async getSong(id) {
      if (id !== 'x1') return null
      return {
        id: 'x1',
        title: 'ためしの歌',
        hostName: 'てすと',
        byline: 'てすと ひとり',
        published: true,
        about: 'ためしの説明。',
        contributions: [
          {
            id: 'x1-lyrics',
            roleKindId: 'lyrics',
            roleLabel: '歌詞',
            assetLabel: '歌詞',
            holders: [{ holderId: 'h-test', displayName: 'てすと' }],
            state: 'adopted',
            visible: true,
            reuseMode: 'free',
          },
        ],
        recruitment: null,
        gift: {
          ruleEstablished: true,
          selfIsParticipant: false,
          selfIsRecipient: false,
          receivableCount: 1,
          unreceivableCount: 0,
          pendingResult: false,
        },
        children: [],
        lineage: [],
        credits: [{ holderId: 'h-test', name: 'てすと', roles: ['歌詞'] }],
        inherit: [
          { id: 'x1-lyrics', label: 'てすとさんの歌詞', mode: 'free', statusLabel: '自由に使えます', selectable: true },
        ],
      }
    },
    async getJoinDraftFor() {
      return null
    },
    async getDraft() {
      return null
    },
    async listInbox() {
      return [{ key: 'consent', title: 'ためしの段', items: [] }]
    },
    async getConsent() {
      return null
    },
    async getMe() {
      return {
        viewer: { holderId: 'h-test', displayName: 'てすと' },
        drafts: [],
        contributions: [],
        notAdopted: [],
        listenLater: [],
      }
    },
    async getPublicProfile() {
      return null
    },
    async getGiftSettings() {
      return { amounts: [50], balance: 50, balanceAtLabel: '0時00分 時点' }
    },
    async listCreateOptions() {
      return [{ id: 'only', label: 'ためしの始め方', icon: 'plus', href: null, reason: 'ためし' }]
    },
    async getPublish() {
      return null
    },
    async getDraftMaterials() {
      return null
    },
    async declareProvenance() {
      return null
    },
  }

  it('ホーム・歌・自分・＋つくる・対応待ちが、差し替えた読み口の中身になる', async () => {
    restore = setUiDataSource(fake)
    const home = await render(HomePage)
    expect(home).toContain('ためしの段')
    expect(home).toContain('ためしの歌')
    expect(home).not.toContain('港の灯り')

    const song = await render(SongPage, { params: { id: 'x1' } })
    expect(song).toContain('ためしの歌')
    expect(song).toContain('てすとさん　歌詞')

    expect(await render(MePage)).toContain('てすと')
    expect(await render(CreatePage)).toContain('ためしの始め方')
    expect(await render(InboxPage)).toContain('いまはありません')
  })

  it('戻す手を呼ぶと、元の読み口に戻る', async () => {
    const back = setUiDataSource(fake)
    expect(uiData()).toBe(fake)
    back()
    expect(uiData()).toBe(sampleSource)
    expect(await render(HomePage)).toContain('港の灯り')
  })
})

describe('画面は読み口だけを読む', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') && !e.name.endsWith('.test.tsx')) files.push(full)
    }
  }
  walk(path.join(ROOT, 'app/ui'))

  it('app/ui のどの画面も、見本のデータ（lib/preview/sample）を直に読まない', () => {
    const offenders = files.filter((f) => /from '@\/lib\/preview\/sample'/.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([])
  })

  it('画面が1枚以上あることを確かめる（walk が空振りしていない）', () => {
    expect(files.length).toBeGreaterThan(10)
  })
})
