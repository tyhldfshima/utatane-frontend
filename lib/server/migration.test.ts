// 移行ファイル 0001 の試験（PGlite＝本物の PostgreSQL・本番ではない）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { freshUtataneDb, MIGRATION_PATH } from './testing/pglite'

const PRECHECK_PATH = fileURLToPath(new URL('../../db/paste/01_precheck.sql', import.meta.url))
const POSTCHECK_PATH = fileURLToPath(new URL('../../db/paste/03_postcheck.sql', import.meta.url))

const count = async (pg: Awaited<ReturnType<typeof freshUtataneDb>>['pg'], q: string) =>
  Number(((await pg.query<{ n: number }>(q)).rows[0] ?? { n: -1 }).n)

const TABLES = `select count(*)::int as n from information_schema.tables where table_schema = 'utatane'`
const TRIGGERS = `select count(*)::int as n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'utatane' and not t.tgisinternal`

describe('移行ファイル 0001（utatane）', () => {
  it('表 35・全表で RLS 有効・初期の行（役割 8・性質 4・許諾ルール 1＝undecided）', async () => {
    const { pg } = await freshUtataneDb()
    expect(await count(pg, TABLES)).toBe(35)
    expect(await count(pg, `select count(*)::int as n from pg_tables where schemaname = 'utatane' and rowsecurity is false`)).toBe(0)
    expect(await count(pg, 'select count(*)::int as n from utatane.role_kinds')).toBe(8)
    expect(await count(pg, 'select count(*)::int as n from utatane.role_natures')).toBe(4)
    expect((await pg.query(`select r2_on_policy_tightened as v from utatane.permission_rules where version = 1`)).rows).toEqual([{ v: 'undecided' }])
    expect(await count(pg, TRIGGERS)).toBe(28)
  })

  it('2回流しても壊れない（表・行・トリガーの数が変わらない）', async () => {
    const { pg, migrate } = await freshUtataneDb()
    await pg.exec(`insert into utatane.rights_holders (id) values ('00000000-0000-4000-8000-000000000001')`)
    await migrate()
    await migrate()
    expect(await count(pg, TABLES)).toBe(35)
    expect(await count(pg, 'select count(*)::int as n from utatane.role_kinds')).toBe(8)
    expect(await count(pg, 'select count(*)::int as n from utatane.permission_rules')).toBe(1)
    expect(await count(pg, 'select count(*)::int as n from utatane.rights_holders')).toBe(1) // 既存の行は残る
    expect(await count(pg, TRIGGERS)).toBe(28)
  })

  it('ブラウザ用のロール（anon・authenticated）は表を読めない・書けない', async () => {
    const { pg } = await freshUtataneDb()
    for (const role of ['anon', 'authenticated']) {
      expect((await pg.query(`select has_schema_privilege('${role}', 'utatane', 'USAGE') as ok`)).rows).toEqual([{ ok: false }])
      await pg.exec(`set role ${role}`)
      await expect(pg.query('select * from utatane.versions')).rejects.toThrow(/permission denied/)
      await expect(pg.query(`insert into utatane.rights_holders (id) values ('00000000-0000-4000-8000-000000000002')`)).rejects.toThrow(/permission denied/)
      await pg.exec('reset role')
    }
  })

  it('DB の側でも守る：公開済み Version の中身・追記だけの表・由来の時間の順', async () => {
    const { pg } = await freshUtataneDb()
    await pg.exec(`
      insert into utatane.rights_holders (id) values ('00000000-0000-4000-8000-00000000000a');
      insert into utatane.versions (id, host_holder_id, title) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'v');
      insert into utatane.contributions (id, role_kind_id, birth_version_id, created_at) values
        ('20000000-0000-4000-8000-000000000001', 'melody', '10000000-0000-4000-8000-000000000001', '2026-01-01'),
        ('20000000-0000-4000-8000-000000000002', 'arrangement', '10000000-0000-4000-8000-000000000001', '2026-02-01');
      insert into utatane.version_contributions (version_id, contribution_id, relation) values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'created');
      update utatane.versions set published_at = now() where id = '10000000-0000-4000-8000-000000000001';
    `)
    await expect(pg.query(`insert into utatane.version_contributions (version_id, contribution_id, relation) values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'created')`)).rejects.toThrow(/published_version_is_immutable/)
    await expect(pg.query(`update utatane.versions set title = 'x'`)).rejects.toThrow(/published_version_is_immutable/)
    await expect(pg.query(`delete from utatane.contributions`)).rejects.toThrow(/append_only_table/)
    await expect(pg.query(`insert into utatane.contribution_derivations (child_id, parent_id, kind) values ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'based_on')`)).rejects.toThrow(/derivation_not_earlier/)
    await expect(pg.query(`insert into utatane.coauthor_approval_methods (contribution_id, seq, method) values ('20000000-0000-4000-8000-000000000001', 1, 'any_one')`)).rejects.toThrow(/check/)
  })

  it('ポイント・残高・報酬の表を持たない（責務分離）', async () => {
    const { pg } = await freshUtataneDb()
    const names = (await pg.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'utatane'`)).rows.map((r) => r.table_name)
    expect(names.filter((n) => /balance|ledger|wallet|reward|payout|point|transaction/.test(n))).toEqual([])
  })

  it('移行ファイル・貼る SQL に比較の記号・山かっこが無い（貼り間違い防止の約束）', () => {
    for (const p of [MIGRATION_PATH, PRECHECK_PATH, POSTCHECK_PATH]) {
      expect(readFileSync(p, 'utf8')).not.toMatch(/[<>]/)
    }
  })

  it('事前確認と事後確認の SQL が、書いてある期待値どおりの結果を返す', async () => {
    // 事前確認：適用の前の DB（Supabase と同じくブラウザ用のロールがある）
    const before = new PGlite()
    await before.exec('create role anon nologin; create role authenticated nologin;')
    const pre = await before.query(readFileSync(PRECHECK_PATH, 'utf8'))
    expect(pre.rows[0]).toMatchObject({
      no_central_profiles_table: true,
      no_central_files_table: true,
      has_anon_role: true,
      has_authenticated_role: true,
    })
    expect(Number((pre.rows[0] as { utatane_schema_count: number }).utatane_schema_count)).toBe(0)

    // 事後確認：適用の後
    const { pg } = await freshUtataneDb()
    const results = await pg.exec(readFileSync(POSTCHECK_PATH, 'utf8'))
    const main = results[0].rows[0] as Record<string, unknown>
    expect(Object.fromEntries(Object.entries(main).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))).toEqual({
      tables: 35,
      tables_without_rls: 0,
      triggers: 28,
      role_kinds: 8,
      role_natures: 4,
      permission_rule_v1: 'undecided',
      permission_rules: 1,
      anon_can_use_schema: false,
      authenticated_can_use_schema: false,
      point_tables: 0,
    })
    expect(results[1].rows[0]).toEqual({ pasted_into_utatane: true })

    // 中央に貼った場合を真似る：public.profiles がある DB では確認列が false になる
    await pg.exec('create table public.profiles (id uuid primary key)')
    const wrong = await pg.exec(readFileSync(POSTCHECK_PATH, 'utf8'))
    expect(wrong[1].rows[0]).toEqual({ pasted_into_utatane: false })
  })
})
