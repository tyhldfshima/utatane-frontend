-- ============================================================
-- UTATANE 専用 DB：① 事前確認（貼る前に実行・読むだけ）
-- 貼る先：Supabase プロジェクト utatane（東京）
-- ref：ivnwrocykestkvemejwg
-- URL：https://supabase.com/dashboard/project/ivnwrocykestkvemejwg/sql/new
-- ★中央（tyhld-platform）で実行すると no_central_profiles_table と no_central_files_table が false になる。
--   その場合は貼る先を間違えているので、② 適用へ進まない。
-- ============================================================
select
  (select count(*) from information_schema.schemata where schema_name = 'utatane') as utatane_schema_count,
  -- 期待：0（初めて貼るとき）。1 なら既に適用済み（② は2回流しても壊れないので、流し直してもよい）
  to_regclass('public.profiles') is null as no_central_profiles_table,
  -- 期待：true（中央の TY Auth DB にある表が無い＝UTATANE の DB）
  to_regclass('public.files') is null as no_central_files_table,
  -- 期待：true（同上）
  exists (select 1 from pg_roles where rolname = 'anon') as has_anon_role,
  -- 期待：true（Supabase のブラウザ用のロール。② で何も配らないようにする相手）
  exists (select 1 from pg_roles where rolname = 'authenticated') as has_authenticated_role;
  -- 期待：true
