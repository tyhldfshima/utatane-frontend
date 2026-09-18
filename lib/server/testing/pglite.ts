// lib/server/testing/pglite.ts — 試験用：本物の PostgreSQL（PGlite）に移行ファイルを流す
// ★試験だけで使う。本番の DB には触れない。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import type { SqlClient } from '../pg-repository'

export const MIGRATION_PATH = fileURLToPath(new URL('../../../db/migrations/0001_utatane_core_v1.sql', import.meta.url))

export async function freshUtataneDb(): Promise<{ pg: PGlite; client: SqlClient; migrate: () => Promise<void> }> {
  const pg = new PGlite()
  // Supabase にあるブラウザ用のロールを、試験の DB にも用意する
  await pg.exec('create role anon nologin; create role authenticated nologin;')
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const migrate = async () => {
    await pg.exec(sql)
  }
  await migrate()
  const client: SqlClient = {
    async query<R>(text: string, params?: unknown[]) {
      const r = await pg.query(text, params)
      return { rows: r.rows as R[] }
    },
  }
  return { pg, client, migrate }
}
