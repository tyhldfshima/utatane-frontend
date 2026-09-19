// lib/server/pg-client.ts — UTATANE 専用 DB（Supabase・東京）への接続（サーバだけ）
//
// ・接続文字列は環境変数 UTATANE_DATABASE_URL から読む（値はここに書かない・画面へ出さない）。
//   Supabase の接続の画面の「Transaction pooler」（ポート 6543）の文字列を想定。
// ・ブラウザ用の鍵（anon）や Data API は使わない。スキーマ utatane は API に出さない。
// ・まとめて書く口（transaction）は、Pool から1つの接続を借りて begin → commit／rollback する。
//   Transaction pooler でも、1つのまとまりの間は同じ接続が使われる。

import { Pool, type PoolClient } from 'pg'
import type { SqlClient } from './pg-repository'

export const UTATANE_DATABASE_URL_ENV = 'UTATANE_DATABASE_URL'

let pool: Pool | null = null

function fromConnection(c: Pool | PoolClient): SqlClient['query'] {
  return async <R>(text: string, params?: unknown[]) => {
    const r = await c.query(text, params)
    return { rows: r.rows as R[] }
  }
}

export function utataneSqlClientFromEnv(env: Record<string, string | undefined> = process.env): SqlClient {
  const url = env[UTATANE_DATABASE_URL_ENV]
  if (!url) throw new Error('utatane_database_not_configured')
  if (!pool) pool = new Pool({ connectionString: url, max: 5 })
  const p = pool
  return {
    query: fromConnection(p),
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const conn = await p.connect()
      try {
        await conn.query('begin')
        const result = await fn({ query: fromConnection(conn) })
        await conn.query('commit')
        return result
      } catch (e) {
        await conn.query('rollback')
        throw e
      } finally {
        conn.release()
      }
    },
  }
}
