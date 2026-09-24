import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// 完成条件の正本（docs/design/utatane-completion-criteria.md）を見張る試験（棚卸し 4aabfd55 の便1）。
//
// ★基準の正本：devlog「えふさん確定：UTATANE/TYポイント 収束の進め方・計測・リリースゲート・UX受入基準（原文）」
//   （プロジェクト「ウタタネ(utatane.music)」・2026-09-19 13:09・entry af3723e9-a7ef-4e4d-852b-535d5b4c69c1）
//   下の一覧は、その原文の言葉をそのまま写したもの。原文を変えるのはえふさんだけ。
//
// 見る物は3つ：
//   1. 原文の項目が1つも抜けずに文書に載っている
//   2. 文書の表が指す試験（ファイルと見出し）が本当にある（試験が消えたら、文書が嘘になる）
//   3. リリースゲートが1つでも「未」のうちは、メンテナンス表示の仕組みが残っている

const ROOT = path.resolve(__dirname, '../..')
const DOC_PATH = path.join(ROOT, 'docs/design/utatane-completion-criteria.md')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

// ── 原文の項目（1文字も変えない） ─────────────────────────────

const ORDER = [
  '第2版完了',
  '便B＋追補完了',
  '第2版を読んで第3版',
  '全報告を統合したMVP必須判断1枚',
  '私たちで判断',
  'MVP仕様凍結',
  'サイトマップ・状態遷移・責任分界を確定',
  '主要画面ワイヤー',
  'UIデザイン',
  '実装',
]

const DECISION_COLUMNS = ['項目', '現在の推奨', '選択肢', 'MVPへの影響', '今決めないと何が止まるか', '決定']

const RELEASE_GATE = ['利用規約', 'プライバシーポリシー', '投稿・利用許諾', '権利侵害等の申立窓口', '通報窓口']

const UX_CRITERIA = [
  '初めて来た人が説明書なしで「何ができるサービスか」分かるか',
  '曲を聴いてから「参加する」まで迷わないか',
  '「参加」と「素材を使う」を間違えないか',
  '保存／提出／採用／公開を誤認しないか',
  'Version Treeを見て「この歌がどう育ったか」理解できるか',
  'TYPと円を混同しないか',
  '「いいね」と「ありがとう」の違いが分かるか',
  'TYP送信後に「誰にどう届くのか」が理解できるか',
  'スマホ片手でも主要行動が完了するか',
]

const POINT_CRITERIA = [
  'TYポイント共通基盤とTYPを混同しない',
  '交換不能Programを合算して誤認させない',
  '処理中・成功・失敗・結果確認中を区別する',
  '円建て報酬とTYPを混ぜない',
]

const GROWTH_LOOP = '種 → 参加 → Contribution → Version → 公開 → TYP → 次の創作'

const EVENTS = [
  'seed_created',
  'participation_requested',
  'contribution_submitted',
  'contribution_accepted',
  'version_created',
  'version_published',
  'typ_sent',
  'derived_version_created',
]

// ── 文書の読み取り ─────────────────────────────────────────

/** 見出し「## n. 」で区切った節の本文を返す */
function section(doc: string, n: number): string {
  const start = doc.indexOf(`\n## ${n}. `)
  if (start < 0) return ''
  const next = doc.indexOf('\n## ', start + 1)
  return next < 0 ? doc.slice(start) : doc.slice(start, next)
}

/** 表の行（| で始まる行）を、区切り線を除いてセルの配列で返す */
function tableRows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
}

/** UX 表の「見張っている試験」欄から、`ファイル` の「見出し」を拾う */
function citedTests(cell: string): { file: string; title: string } | null {
  const m = cell.match(/^`([^`]+)` の「(.+?)」(?:（|$)/)
  return m ? { file: m[1], title: m[2] } : null
}

/** 試験ファイルの describe( の見出しを全部拾う */
function describeTitles(src: string): string[] {
  return Array.from(src.matchAll(/^describe\('(.+?)',/gm), (m) => m[1])
}

/** ゲートの表で「いま」が「済」でない行が1つでもあるか */
function anyGateOpen(doc: string): boolean {
  const rows = tableRows(section(doc, 2)).filter((r) => /^G-\d+$/.test(r[0]))
  return rows.length === 0 || rows.some((r) => !r[2]?.startsWith('済'))
}

const DOC = readFileSync(DOC_PATH, 'utf8')

// ── 1. 原文の項目が抜けていない ───────────────────────────────

describe('原文の項目が1つも抜けずに載っている', () => {
  it('進め方の順番：10段が、この順のまま表に並ぶ', () => {
    const rows = tableRows(section(DOC, 1)).filter((r) => /^\d+$/.test(r[0]))
    expect(rows.map((r) => r[1])).toEqual(ORDER)
  })

  it('MVP必須判断1枚：列は原文の6つ', () => {
    expect(tableRows(section(DOC, 1))).toContainEqual(DECISION_COLUMNS)
  })

  it('リリースゲート：5つとも、G-1〜G-5 として載っている', () => {
    const rows = tableRows(section(DOC, 2)).filter((r) => /^G-\d+$/.test(r[0]))
    expect(rows.map((r) => r[1])).toEqual(RELEASE_GATE)
  })

  it('UX 受入基準：9つとも、原文のまま X-1〜X-9 として載っている', () => {
    const rows = tableRows(section(DOC, 3)).filter((r) => /^X-\d+$/.test(r[0]))
    expect(rows.map((r) => r[1])).toEqual(UX_CRITERIA)
  })

  it('TYポイント側の UI 受入条件：4つとも載っていて、担当外と書いてある', () => {
    const s = section(DOC, 3)
    for (const c of POINT_CRITERIA) expect(s).toContain(`- ${c}`)
    expect(s).toContain('担当外')
  })

  it('計測：成長ループと8つの概念が載っていて、名前は固定ではないと書いてある', () => {
    const s = section(DOC, 4)
    expect(s).toContain(GROWTH_LOOP)
    const rows = tableRows(s).filter((r) => /^M-\d+$/.test(r[0]))
    expect(rows.map((r) => r[2].replace(/`/g, ''))).toEqual(EVENTS)
    expect(s).toContain('名前は固定ではない')
  })

  it('正本の出どころ（devlog の entry）が書いてある', () => {
    expect(DOC).toContain('af3723e9-a7ef-4e4d-852b-535d5b4c69c1')
  })
})

// ── 2. 表が指す試験が本当にある ───────────────────────────────

describe('UX 表が指す試験が本当にある（試験が消えたら、文書が嘘になる）', () => {
  const rows = tableRows(section(DOC, 3)).filter((r) => /^X-\d+$/.test(r[0]))

  it('「試験」と書いた行は、必ず試験を名指ししている／「人」だけの行は名指ししない', () => {
    for (const r of rows) {
      const cited = citedTests(r[3])
      if (r[2].includes('試験')) expect(cited, `${r[0]} は試験を名指ししていない`).not.toBeNull()
      else expect(r[3], `${r[0]} は「人」なのに試験欄が埋まっている`).toBe('—')
    }
  })

  it('名指しした試験ファイルがあり、その見出しの describe がある', () => {
    const cited = rows.map((r) => citedTests(r[3])).filter((c): c is { file: string; title: string } => c !== null)
    expect(cited.length).toBeGreaterThan(0)
    for (const { file, title } of cited) {
      expect(existsSync(path.join(ROOT, file)), `${file} が無い`).toBe(true)
      expect(describeTitles(read(file)), `${file} に「${title}」が無い`).toContain(title)
    }
  })
})

// ── 3. ゲートが揃うまでメンテナンス表示を残す ─────────────────────

describe('リリースゲートが揃うまで、メンテナンス表示の仕組みを消さない', () => {
  it('ゲートに「未」があるうちは、middleware.ts が MAINTENANCE_MODE で全画面を止められる', () => {
    if (!anyGateOpen(DOC)) return
    const mw = read('middleware.ts')
    expect(mw).toContain('MAINTENANCE_MODE')
    expect(mw).toContain("'/maintenance.html'")
    expect(existsSync(path.join(ROOT, 'public/maintenance.html'))).toBe(true)
  })
})

// ── 空振り確認（壊した文書を渡すと、上の見張りが気づく） ──────────────

describe('★空振り確認', () => {
  it('順番を入れ替えた文書は、順番の見張りに引っかかる', () => {
    const broken = DOC.replace('| 6 | MVP仕様凍結 |', '| 6 | UIデザイン |')
    const rows = tableRows(section(broken, 1)).filter((r) => /^\d+$/.test(r[0]))
    expect(rows.map((r) => r[1])).not.toEqual(ORDER)
  })

  it('ゲートを1つ消した文書は、ゲートの見張りに引っかかる', () => {
    const broken = DOC.replace(/\| G-5 \|.*\n/, '')
    const rows = tableRows(section(broken, 2)).filter((r) => /^G-\d+$/.test(r[0]))
    expect(rows.map((r) => r[1])).not.toEqual(RELEASE_GATE)
  })

  it('ゲートが全部「済」なら「未あり」と数えない／1つでも「未」なら数える', () => {
    const allDone = DOC.replace(/\| 未（リポに無い） \|/g, '| 済（/terms） |')
    expect(anyGateOpen(allDone)).toBe(false)
    expect(anyGateOpen(DOC)).toBe(true)
  })

  it('存在しない見出しを名指ししても、describe の一覧には無い', () => {
    const titles = describeTitles(read('app/ui/ux-wording.test.ts'))
    expect(titles.length).toBeGreaterThan(0)
    expect(titles).not.toContain('⑤ 存在しない見出し')
  })

  it('試験欄の拾い方：補足の括弧つきでも拾え、名指しの無い欄は拾わない', () => {
    expect(citedTests('`a.test.ts` の「見出し」（★補足）')).toEqual({ file: 'a.test.ts', title: '見出し' })
    expect(citedTests('—')).toBeNull()
  })
})
