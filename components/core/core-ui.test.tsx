// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChannelSections, CHANNEL_TITLES } from './ChannelSections'
import { VersionSections } from './VersionSections'
import { VersionTree } from './VersionTree'
import type { TreeView, VersionView } from '@/lib/server/core-service'

afterEach(cleanup)

const view: VersionView = {
  version: {
    id: 'V1',
    hostHolderId: 'h1',
    title: '春の歌',
    createdAt: '2026-09-19T00:00:00Z',
    publishedAt: '2026-09-19T00:00:01Z',
    contributions: [{ contributionId: 'c1', relation: 'created' }, { contributionId: 'c0', relation: 'referenced' }],
    materialIds: [],
  },
  publicationState: 'public',
  plays: 3,
  participants: [
    { rightsHolderId: 'h1', tyAccountId: 'acc-host-0001', state: 'host', roles: ['vocal'] },
    { rightsHolderId: 'h2', tyAccountId: null, state: 'anonymized', roles: ['instrument'] },
  ],
  usedContributions: [
    { contribution: { id: 'c0', roleKindId: 'melody', holderIds: ['h9'], birthVersionId: 'V0', createdAt: '2026-09-18T00:00:00Z' }, birthVersionId: 'V0', via: 'direct' },
  ],
  latestPublishCheck: null,
}

describe('Version の画面の2段', () => {
  it('参加者と、ほかの歌から使われた貢献を分けて出し、金額・割合を出さない', () => {
    const { container } = render(<VersionSections view={view} />)
    expect(screen.getByText('この Version で作った人')).toBeTruthy()
    expect(screen.getByText('この歌が使っている、ほかの歌の貢献')).toBeTruthy()
    expect(screen.getByText('参加者1名（非表示）')).toBeTruthy()
    expect(screen.getByText('メロディ・作曲')).toBeTruthy()
    expect(screen.getByText('生まれた歌を見る').getAttribute('href')).toBe('/versions/V0')
    const text = container.textContent ?? ''
    // 金額・割合の記号と、使わない言葉（ブランドで禁止の語。文字の番号で書く）が出ないこと
    expect(text).not.toMatch(/%|¥|投げ銭/)
  })
})

describe('Version Tree（1段ずつ開く）', () => {
  const tree: TreeView = {
    versionId: 'V1',
    upstream: [
      { generation: 0, entries: [{ contributionId: 'c1', generation: 0, paths: [] }] },
      { generation: 1, entries: [{ contributionId: 'c0', generation: 1, paths: [] }] },
    ],
    downstream: [{ versionId: 'V2', title: '続きの歌', publishedAt: '2026-09-19T00:00:02Z' }],
  }

  it('最初は使った貢献だけ。押すと1段さかのぼる。下流も出る', () => {
    render(<VersionTree tree={tree} />)
    expect(screen.getByText('この歌が使った貢献')).toBeTruthy()
    expect(screen.queryByText('1 つ前の元')).toBeNull()
    fireEvent.click(screen.getByText('もう1段さかのぼる（あと 1 段）'))
    expect(screen.getByText('1 つ前の元')).toBeTruthy()
    expect(screen.getByText('続きの歌').getAttribute('href')).toBe('/versions/V2')
  })
})

describe('チャンネルの4つの区分', () => {
  it('4つの見出しを出し、「使われた作品」に参加・共演の言葉を使わない', () => {
    const { container } = render(
      <ChannelSections
        channel={{
          own: [{ versionId: 'V1', title: '春の歌', publishedAt: 'x' }],
          participated: [],
          used: [{ versionId: 'V3', title: '別の人の歌', publishedAt: 'x', usedRoles: ['melody'] }],
          recruiting: [],
        }}
      />,
    )
    for (const t of Object.values(CHANNEL_TITLES)) expect(screen.getByText(t)).toBeTruthy()
    const used = container.querySelector('section[aria-labelledby="ch-used"]')?.textContent ?? ''
    expect(used).toContain('メロディ・作曲が使われた')
    expect(used).not.toMatch(/参加|共演|feat\./)
  })
})
