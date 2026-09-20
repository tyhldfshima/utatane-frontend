// 素材（音源など）の決まり。画面とサーバーの両方が同じ物を使う（2か所に書かない）。
//
// ★正本は保管サービス側（services/storage/src/lib/area.ts の validateAreaFileName と
//   src/lib/upload-params.ts の MAX_BYTES）。ここはその写しで、利用者に早く理由を伝えるためだけに置く。
//   ここを通っても、最後に断るかどうかを決めるのは保管サービス（中央）。ここだけを直して通す作りにしない。
//
// ★住所（キー）の先頭 utatane/{利用者}/ は中央が作る。画面もサーバーも作らない・送らない。

/** ファイル名の長さの上限（キーの末尾に入る）。 */
export const FILE_NAME_MAX = 200

/** 1つの素材の大きさの上限（100 MB）。 */
export const MAX_BYTES = 104_857_600

/** 断る理由（保管サービスが返す名前と同じ）。 */
export type FileNameProblem = 'missing_file_name' | 'file_name_too_long' | 'invalid_file_name'

function hasControlCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * 置ける名前かを見る（通すなら null）。
 * ★区切り文字（/ \）・制御文字・先頭の「.」・「..」を含む名前は、置き換えずに断る
 *   （住所の先頭や区切りを、呼び手に作らせないため）。
 */
export function validateFileName(name: unknown): FileNameProblem | null {
  if (typeof name !== 'string' || name.length === 0) return 'missing_file_name'
  if (name.length > FILE_NAME_MAX) return 'file_name_too_long'
  if (/[/\\]/.test(name) || hasControlCharacter(name)) return 'invalid_file_name'
  if (name.startsWith('.') || name.includes('..')) return 'invalid_file_name'
  if (name.trim() !== name || name.trim().length === 0) return 'invalid_file_name'
  return null
}

/** 置ける大きさか。 */
export function isValidSizeBytes(size: unknown): size is number {
  return typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= MAX_BYTES
}

/** 断る理由 → 画面に出す言葉（設計書 §5 の言い方にそろえる）。 */
export const PROBLEM_TEXT: Record<FileNameProblem | 'invalid_size_bytes', string> = {
  missing_file_name: 'ファイルを選んでください。',
  file_name_too_long: 'ファイルの名前が長すぎます。短くしてから、もう一度お試しください。',
  invalid_file_name:
    'このファイルの名前は使えません。「/」「\\」「..」を含む名前と、「.」で始まる名前は置けません。名前を変えてから、もう一度お試しください。',
  invalid_size_bytes: '1つの素材に置けるのは 100 MB までです。',
}

/** 大きさの表示（1.2 MB のような形）。 */
export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
}
