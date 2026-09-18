-- ============================================================
-- UTATANE 専用 DB：③ 事後確認（② 適用の後に実行・読むだけ）
-- 貼る先：Supabase プロジェクト utatane（東京）
-- ref：ivnwrocykestkvemejwg
-- URL：https://supabase.com/dashboard/project/ivnwrocykestkvemejwg/sql/new
-- 期待値は各列の下のコメント。1つでも違えば切り替えの便へ進まない。
-- ============================================================
select
  (select count(*) from information_schema.tables where table_schema = 'utatane') as tables,
  -- 期待：35
  (select count(*) from pg_tables where schemaname = 'utatane' and rowsecurity is false) as tables_without_rls,
  -- 期待：0（全表で RLS 有効）
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'utatane' and not t.tgisinternal) as triggers,
  -- 期待：28（2回流しても 28 のまま）
  (select count(*) from utatane.role_kinds) as role_kinds,
  -- 期待：8
  (select count(*) from utatane.role_natures) as role_natures,
  -- 期待：4
  (select r2_on_policy_tightened from utatane.permission_rules where version = 1) as permission_rule_v1,
  -- 期待：undecided（許諾ルール R2 は決まるまで安全側）
  (select count(*) from utatane.permission_rules) as permission_rules,
  -- 期待：1
  has_schema_privilege('anon', 'utatane', 'USAGE') as anon_can_use_schema,
  -- 期待：false（ブラウザ用のロールには配らない）
  has_schema_privilege('authenticated', 'utatane', 'USAGE') as authenticated_can_use_schema,
  -- 期待：false
  (select count(*) from information_schema.tables where table_schema = 'utatane'
    and table_name ~ '(balance|ledger|wallet|reward|payout|point)') as point_tables;
  -- 期待：0（ポイント・残高・報酬の表は中央の責務）

-- ── 貼る先の確認列（最後に見る） ──────────────────────────────
-- utatane の表があり、かつ中央にしか無い public.profiles が無い＝UTATANE の DB に貼った。
-- 中央（tyhld-platform）に貼ってしまった場合は false になる。
select
  (to_regclass('utatane.permission_rules') is not null and to_regclass('public.profiles') is null) as pasted_into_utatane;
  -- 期待：true
