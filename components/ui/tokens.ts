// 色と文字の決まり（docs/design/utatane-focus-screens-spec.md §2）。
// えふさん確定：Teal は案B（#0A7C74）・文字は案1（ゴシック）。新しい色は足さない。

export const COLORS = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#1C2424',
  sub: '#5B6664',
  line: '#D5DCDA',
  teal: '#0A7C74',
  tint: '#E0EFED',
  onTeal: '#FFFFFF',
  offBg: '#E4E8E6',
  offInk: '#3E4846',
} as const

export const FONT_FAMILY =
  '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif'

export const SIZES = {
  /** 押せる物の最小の高さ（指で押せる大きさ） */
  minTouch: 44,
  /** 主ボタン・ボタンの高さ */
  button: 52,
  bodyFont: 16,
  headFont: 21,
} as const

// ---- コントラスト比（WCAG の計算） ----

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 文字は 4.5 以上、アイコン・枠・線は 3.0 以上（設計書 §2-2 の組み合わせ）。 */
export const CONTRAST_PAIRS: ReadonlyArray<{
  name: string
  fg: string
  bg: string
  min: 4.5 | 3
}> = [
  { name: '本文と背景', fg: COLORS.ink, bg: COLORS.bg, min: 4.5 },
  { name: '補足と背景', fg: COLORS.sub, bg: COLORS.bg, min: 4.5 },
  { name: '補足と白', fg: COLORS.sub, bg: COLORS.surface, min: 4.5 },
  { name: '主ボタンの白い文字と Teal', fg: COLORS.onTeal, bg: COLORS.teal, min: 4.5 },
  { name: 'Teal と背景（アイコン・枠・下線）', fg: COLORS.teal, bg: COLORS.bg, min: 3 },
  { name: '本文と薄い Teal', fg: COLORS.ink, bg: COLORS.tint, min: 4.5 },
  { name: 'Teal と薄い Teal（印の中のアイコン）', fg: COLORS.teal, bg: COLORS.tint, min: 3 },
  { name: '押せないボタンの文字と面', fg: COLORS.offInk, bg: COLORS.offBg, min: 4.5 },
  { name: 'Teal と線', fg: COLORS.teal, bg: COLORS.line, min: 3 },
]

/** 部品の CSS が読む変数。UtataneTheme がこの値を置く。 */
export const CSS_VARS: Record<string, string> = {
  '--u-bg': COLORS.bg,
  '--u-surface': COLORS.surface,
  '--u-ink': COLORS.ink,
  '--u-sub': COLORS.sub,
  '--u-line': COLORS.line,
  '--u-teal': COLORS.teal,
  '--u-tint': COLORS.tint,
  '--u-on-teal': COLORS.onTeal,
  '--u-off-bg': COLORS.offBg,
  '--u-off-ink': COLORS.offInk,
  '--u-font': FONT_FAMILY,
  '--u-min-touch': `${SIZES.minTouch}px`,
  '--u-button': `${SIZES.button}px`,
  '--u-body': `${SIZES.bodyFont}px`,
  '--u-head': `${SIZES.headFont}px`,
}
