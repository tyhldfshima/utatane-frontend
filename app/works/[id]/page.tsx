'use client'
// app/works/[id]/page.tsx
// 収益ダッシュボード + バージョンツリー + コラボ起点 の3役

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

// ── 型 ─────────────────────────────────────────────────────

type WorkType = 'melody' | 'lyrics'
type ReuseMode = 'open' | 'exclusive'

interface Creator {
  id: string
  name: string
  avatar_url?: string
}

interface VersionStat {
  id: string
  title: string
  play_count: number
  typ_received: number       // このバージョンで受け取ったTYP合計
  purchase_revenue: number   // このバージョンの購入収益（自分の取り分）
  musician?: Creator
  partner_work?: {           // 組み合わさった詞 or 曲
    id: string
    title: string
    creator: Creator
    type: WorkType
  }
  created_at: string
  audio_url?: string
}

interface WorkDetail {
  id: string
  type: WorkType
  title: string
  creator: Creator
  reuse_mode: ReuseMode
  bpm?: number
  key?: string
  file_url: string
  collab_message?: string
  created_at: string
  // 集計
  versions: VersionStat[]
  total_plays: number
  total_typ: number
  total_revenue: number      // 自分の取り分合計
}

// ── モックデータ ────────────────────────────────────────────

const MOCK_MELODY: WorkDetail = {
  id: 'melody-1',
  type: 'melody',
  title: '春のバラード',
  creator: { id: 'me', name: '山田 花', avatar_url: '' },
  reuse_mode: 'open',
  bpm: 72,
  key: 'D major',
  file_url: '/audio/sample.mp3',
  collab_message: 'ゆっくりとした春の情景に合う詞を書いていただける方を募集中です。',
  created_at: '2024-10-01T00:00:00Z',
  total_plays: 1930,
  total_typ: 450,
  total_revenue: 4320,
  versions: [
    {
      id: 'v1', title: '春のバラード — 桜散る頃',
      play_count: 1240, typ_received: 320, purchase_revenue: 3600,
      partner_work: { id: 'lyr-1', title: '桜散る頃', type: 'lyrics', creator: { id: 'u1', name: '田中 蓮' } },
      musician: { id: 'u2', name: '佐藤 葵' },
      created_at: '2024-10-15T00:00:00Z',
    },
    {
      id: 'v2', title: '春のバラード — 光の中で',
      play_count: 480, typ_received: 90, purchase_revenue: 720,
      partner_work: { id: 'lyr-2', title: '光の中で', type: 'lyrics', creator: { id: 'u3', name: '鈴木 海' } },
      musician: { id: 'u4', name: '中村 奏' },
      created_at: '2024-11-02T00:00:00Z',
    },
    {
      id: 'v3', title: '春のバラード — 旅立ちの朝',
      play_count: 210, typ_received: 40, purchase_revenue: 0,
      partner_work: { id: 'lyr-3', title: '旅立ちの朝', type: 'lyrics', creator: { id: 'u5', name: '高橋 悠' } },
      created_at: '2024-12-10T00:00:00Z',
    },
  ],
}

const MOCK_LYRICS: WorkDetail = {
  id: 'lyrics-1',
  type: 'lyrics',
  title: '夜の散歩道',
  creator: { id: 'me', name: '山田 花', avatar_url: '' },
  reuse_mode: 'open',
  file_url: '/lyrics/sample.txt',
  collab_message: '夜の静けさを表現できる、ゆったりめのメロディを募集しています。',
  created_at: '2024-09-20T00:00:00Z',
  total_plays: 860,
  total_typ: 180,
  total_revenue: 1440,
  versions: [
    {
      id: 'v4', title: '夜の散歩道 — ピアノver.',
      play_count: 620, typ_received: 140, purchase_revenue: 1200,
      partner_work: { id: 'mel-1', title: '夜のピアノ', type: 'melody', creator: { id: 'u6', name: '西村 陽' } },
      musician: { id: 'u7', name: '伊藤 さくら' },
      created_at: '2024-10-05T00:00:00Z',
    },
    {
      id: 'v5', title: '夜の散歩道 — アコギver.',
      play_count: 240, typ_received: 40, purchase_revenue: 240,
      partner_work: { id: 'mel-2', title: '月夜のアコギ', type: 'melody', creator: { id: 'u8', name: '松本 颯' } },
      created_at: '2024-11-20T00:00:00Z',
    },
  ],
}

// ── 小コンポーネント ────────────────────────────────────────

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-medium text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-purple-600 font-medium">{sub}</div>}
    </div>
  )
}

function Avatar({ creator, size = 28 }: { creator: Creator; size?: number }) {
  return (
    <div className="rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {creator.name[0]}
    </div>
  )
}

// バーのセグメント（役割ごとの収益割合）
function RevenueBar({ type }: { type: WorkType }) {
  // 自分が持つシェア
  const myShare = type === 'melody' ? 20 : 20
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1.5">
        <div className="bg-purple-500" style={{ width: `${myShare}%` }} title={`あなた ${myShare}%`} />
        <div className="bg-green-400" style={{ width: '20%' }} title="パートナー 20%" />
        <div className="bg-orange-400" style={{ width: '30%' }} title="ミュージシャン 30%" />
        <div className="bg-amber-300" style={{ width: '5%' }} title="視聴者 5%" />
        <div className="bg-gray-200" style={{ width: '25%' }} title="PF 25%" />
      </div>
      <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
        <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />あなた {myShare}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />パートナー 20%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1" />演奏者 30%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-gray-200 mr-1" />PF 25%</span>
      </div>
    </div>
  )
}

// バージョンカード（ツリー内）
function VersionRow({ ver, myShare, isOwner }: { ver: VersionStat; myShare: number; isOwner: boolean }) {
  const myRevenue = Math.round(ver.purchase_revenue)
  return (
    <Link href={`/versions/${ver.id}`}
      className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-purple-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 leading-snug mb-1">{ver.title}</p>
          {/* パートナー */}
          {ver.partner_work && (
            <Link href={`/works/${ver.partner_work.id}`}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                ver.partner_work.type === 'melody'
                  ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                {ver.partner_work.type === 'melody' ? '曲' : '詞'}
              </span>
              {ver.partner_work.title}
              <span className="text-gray-400">by {ver.partner_work.creator.name}</span>
            </Link>
          )}
          {/* ミュージシャン */}
          {ver.musician && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <span>🎤</span> {ver.musician.name}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {new Date(ver.created_at).toLocaleDateString('ja-JP', { month:'short', day:'numeric' })}
        </span>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">{ver.play_count.toLocaleString()}</p>
          <p className="text-xs text-gray-400">再生</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-amber-600">{ver.typ_received.toLocaleString()}</p>
          <p className="text-xs text-gray-400">TYP</p>
        </div>
        <div className="text-center">
          {isOwner ? (
            <>
              <p className="text-sm font-medium text-teal-600">¥{myRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400">取り分</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                ¥{Math.round(ver.purchase_revenue / (myShare / 100) * myShare / 100 ).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">購入収益</p>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── メインページ ───────────────────────────────────────────

export default function WorkDetailPage() {
  const params  = useParams()
  const { user } = useAuthStore()

  // ID によってモックを切り替え（実際はAPI）
  const work: WorkDetail = params.id === 'lyrics-1' ? MOCK_LYRICS : MOCK_MELODY
  const isOwner  = !user || user.id === work.creator.id   // デモ用に常にオーナー表示
  const myShare  = 20   // 作曲 or 作詞のシェア
  const isMelody = work.type === 'melody'

  const [reuseMode, setReuseMode] = useState<ReuseMode>(work.reuse_mode)
  const [playing, setPlaying]     = useState(false)

  // 「この曲を使う」「この詞を使う」ボタン押下
  const handleUse = () => {
    // uploadページに遷移し、work.id をパラメータとして渡す
    window.location.href = `/upload?base_work_id=${work.id}&base_type=${work.type}`
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6 pb-28">

      {/* ── 作品ヘッダー ─────────────────────────────── */}
      <div className="mb-6">

        {/* タイプバッジ */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            isMelody ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
          }`}>
            {isMelody ? '🎵 曲' : '📝 詞'}
          </span>
          {work.bpm && <span className="text-xs text-gray-400">{work.bpm} BPM</span>}
          {work.key && <span className="text-xs text-gray-400">{work.key}</span>}
        </div>

        <h1 className="text-2xl font-medium text-gray-900 mb-3">{work.title}</h1>

        {/* クリエイター */}
        <Link href={`/profile/${work.creator.id}`}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-700 mb-4">
          <Avatar creator={work.creator} size={26} />
          {work.creator.name}
        </Link>

        {/* 試聴ボタン（曲のみ） */}
        {isMelody && (
          <button onClick={() => setPlaying(!playing)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors mb-4 ${
              playing
                ? 'bg-purple-700 text-white'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}>
            {playing ? (
              <><span className="text-base">⏸</span> 再生中</>
            ) : (
              <><span className="text-base">▶</span> 伴奏を試聴</>
            )}
          </button>
        )}

        {/* コラボメッセージ */}
        {work.collab_message && (
          <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed mb-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-400 mb-1.5">
              {isMelody ? '作曲者より' : '作詞者より'}
            </p>
            {work.collab_message}
          </div>
        )}

        {/* 再利用設定（オーナーのみ） */}
        {isOwner && (
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-gray-500">コラボ受入</span>
            <button onClick={() => setReuseMode(reuseMode === 'open' ? 'exclusive' : 'open')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                reuseMode === 'open' ? 'bg-teal-500' : 'bg-gray-200'
              }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                reuseMode === 'open' ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`} />
            </button>
            <span className="text-xs text-gray-500">
              {reuseMode === 'open' ? 'オープン（誰でも使える）' : '停止中'}
            </span>
          </div>
        )}
      </div>

      {/* ── 収益サマリー（オーナーのみ） ──────────────── */}
      {isOwner && (
        <div className="bg-gradient-to-br from-purple-50 to-teal-50 rounded-2xl p-5 mb-6 border border-purple-100">
          <p className="text-xs font-medium text-purple-600 mb-4">この作品からの収益（あなたの取り分）</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatPill
              label="総再生"
              value={work.total_plays.toLocaleString()}
            />
            <StatPill
              label="受け取ったTYP"
              value={work.total_typ.toLocaleString()}
              sub={`+${work.total_typ} TYP`}
            />
            <StatPill
              label="購入収益"
              value={`¥${work.total_revenue.toLocaleString()}`}
              sub={`${myShare}% 分`}
            />
          </div>
          <RevenueBar type={work.type} />
        </div>
      )}

      {/* ── バージョンツリー ──────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-900">
            バージョン一覧
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {work.versions.length} バージョン
            </span>
          </h2>
        </div>

        {/* ツリー線付きリスト */}
        <div className="relative">
          {/* 縦線 */}
          {work.versions.length > 1 && (
            <div className="absolute left-4 top-6 bottom-6 w-px bg-purple-100" />
          )}

          <div className="space-y-3">
            {work.versions.map((ver, i) => (
              <div key={ver.id} className="relative flex gap-3">
                {/* ノード */}
                <div className="flex-shrink-0 w-8 flex flex-col items-center z-10">
                  <div className={`w-2.5 h-2.5 rounded-full mt-5 ${
                    i === 0 ? 'bg-purple-500' : 'bg-purple-200'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <VersionRow ver={ver} myShare={myShare} isOwner={isOwner} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── コラボ起点ボタン ──────────────────────────── */}
      {!isOwner && reuseMode === 'open' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
          <div className="max-w-xl mx-auto">
            <button onClick={handleUse}
              className="w-full py-4 rounded-2xl bg-purple-600 text-white font-medium text-sm shadow-lg hover:bg-purple-700 active:scale-98 transition-all">
              {isMelody
                ? 'この曲に詞をつける →'
                : 'この詞に曲をつける →'}
            </button>
          </div>
        </div>
      )}

      {/* オーナー向け：新規コラボ募集テキスト */}
      {isOwner && reuseMode === 'open' && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            {isMelody ? '作詞家を' : '作曲家を'}募集中 — 誰でもこの{isMelody ? '曲に詞を' : '詞に曲を'}つけられます
          </p>
        </div>
      )}
    </main>
  )
}
