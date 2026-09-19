// lib/server/container.ts — API の口が使う部品の置き場
//
// ★保存は UTATANE 専用 DB（Supabase utatane・スキーマ utatane）。つなぎ方は lib/server/pg-client.ts。
//   接続文字列は環境変数 UTATANE_DATABASE_URL（Vercel は Production だけに登録）。
// ★無いときは既定の保存（メモリ）へ落とさず、503 utatane_database_not_configured で止まる。
//   失敗した部品は覚えておかない（環境変数が入った後の要求で、あらためて作る）。

import { beneficiaryRegistryNotConfigured } from '../integrations/typ'
import { tyAuthVerifierFromEnv, type AuthVerifier } from './auth'
import { CoreError, CoreService } from './core-service'
import { utataneSqlClientFromEnv } from './pg-client'
import { PgRepository } from './pg-repository'

interface Container {
  service: CoreService
  auth: AuthVerifier
}

let current: Container | null = null

export function getContainer(env: Record<string, string | undefined> = process.env): Container {
  if (!current) {
    let repo: PgRepository
    try {
      repo = new PgRepository(utataneSqlClientFromEnv(env))
    } catch (e) {
      if (e instanceof Error && e.message === 'utatane_database_not_configured') {
        throw new CoreError(503, 'utatane_database_not_configured')
      }
      throw e
    }
    current = {
      service: new CoreService({ repo, beneficiaries: beneficiaryRegistryNotConfigured }),
      auth: tyAuthVerifierFromEnv(env),
    }
  }
  return current
}

/** 試験用：部品を差し替える */
export function setContainerForTesting(c: Container | null) {
  current = c
}
