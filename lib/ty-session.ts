// 画面が「いまログインしている人の TY の印」を1か所から受け取るための継ぎ目。
//
// ★いまの main には中央ログイン（TY アカウント）がまだ無い。入るのは PR #4
//   （認証を @tyhld/auth へ切り替える便）で、そこで stores/authStore.ts が
//   currentAccessToken() を出すようになる（未合流・NPM_TOKEN の区切り待ち）。
//
// ★そのため、ここは stores/authStore.ts に currentAccessToken があればそれを使い、
//   無ければ「ログインしていない」（null）を返す。PR #4 が合流した時点で、
//   この継ぎ目は1文字も直さずに本物へつながる。
// ★印そのものは持たない・保存しない（毎回読み直す）。

type AuthStoreModule = {
  currentAccessToken?: () => Promise<string | null>
}

export async function currentTyAccessToken(): Promise<string | null> {
  try {
    const mod = (await import('@/stores/authStore')) as AuthStoreModule
    if (typeof mod.currentAccessToken !== 'function') return null
    return await mod.currentAccessToken()
  } catch {
    return null
  }
}

/** API を呼ぶときの見出し。印が無ければ null（呼ばずに「ログインしてください」を出す）。 */
export async function authHeader(): Promise<{ Authorization: string } | null> {
  const token = await currentTyAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : null
}
