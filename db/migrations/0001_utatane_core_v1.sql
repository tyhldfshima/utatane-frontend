-- ============================================================
-- UTATANE 中核 v1（Version／Contribution／Material／Permission・Consent／Version Graph）
-- 移行ファイル 0001（確定版）
--
-- 貼る先：Supabase プロジェクト utatane（東京）
-- ref：ivnwrocykestkvemejwg
-- URL：https://supabase.com/dashboard/project/ivnwrocykestkvemejwg/sql/new
-- ★中央（tyhld-platform）には貼らない。貼る前に db/paste/01_precheck.sql、貼った後に db/paste/03_postcheck.sql。
--
-- ・音楽データだけを持つ。ポイント台帳・残高・取引・報酬の表は持たない（point.ty-hld.com の責務）。
--   中央を指すのは rights_holders.central_beneficiary_id（id の参照）と materials.storage_file_id（中央の保管）だけ。
-- ・全表で行の単位の守り（RLS）を有効にし、ブラウザ用のロール（anon・authenticated）には何も配らない。
--   読み書きは UTATANE のサーバが DB への接続（環境変数 UTATANE_DATABASE_URL）で行う。
-- ・2回流しても壊れない（if not exists・create or replace・トリガーは作り直し・初期の行は重ねない）。
-- ・消さない・上書きしない表は、更新と削除をトリガーで止める。公開済み Version の中身は書き換えさせない。
-- ・金額・分配率は入れない（Revenue Rule の本体は jsonb。値は③で決める）。
-- ・書き方の約束：比較の記号・山かっこは使わない（貼り間違い防止）。
-- ============================================================

begin;

create schema if not exists utatane;

-- 追記だけの表で、更新・削除を止める
create or replace function utatane.forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'append_only_table: %', tg_table_name;
end;
$$;

-- ── 役割（貢献の種類）：行で足す ─────────────────────────────
create table if not exists utatane.role_natures (
  id text primary key                        -- work / performance / recording / finishing
);
insert into utatane.role_natures (id) values ('work'), ('performance'), ('recording'), ('finishing')
  on conflict (id) do nothing;

create table if not exists utatane.role_kinds (
  id text primary key,                       -- lyrics / melody / arrangement / vocal / instrument / recording / mix / video …
  nature text not null references utatane.role_natures (id),
  label text not null,
  created_at timestamptz not null default now()
);
insert into utatane.role_kinds (id, nature, label) values
  ('lyrics', 'work', '詞'),
  ('melody', 'work', 'メロディ・作曲'),
  ('arrangement', 'work', '編曲'),
  ('vocal', 'performance', '歌唱'),
  ('instrument', 'performance', '楽器演奏'),
  ('recording', 'recording', '音源・録音'),
  ('mix', 'finishing', 'MIX・マスタリング'),
  ('video', 'work', '映像')
  on conflict (id) do nothing;

-- ── 権利者とアカウント（別の持ち物） ─────────────────────────
create table if not exists utatane.rights_holders (
  id uuid primary key default gen_random_uuid(),
  ty_account_id uuid unique,                 -- TY アカウント。無い権利者もいる
  central_beneficiary_id uuid unique,        -- 中央の受取人 id（未連携なら null）
  created_at timestamptz not null default now()
);

create table if not exists utatane.account_state_events (
  id bigint generated always as identity primary key,
  ty_account_id uuid not null,
  state text not null check (state in ('active', 'withdrawn', 'suspended', 'unreachable', 'death_reported')),
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now()
);

create table if not exists utatane.rights_state_events (
  id bigint generated always as identity primary key,
  rights_holder_id uuid not null references utatane.rights_holders (id),
  state text not null,                       -- active / succession_in_progress / succeeded / unknown_holder …（増やせる）
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now()
);

-- UTATANE 固有のプロフィール（TY アカウントの共通プロフィールの上書き値だけ）
create table if not exists utatane.profiles (
  ty_account_id uuid primary key,
  artist_name text,
  bio text,
  avatar_file_id uuid,                       -- 中央の保管サービスの file id
  updated_at timestamptz not null default now()
);

create table if not exists utatane.follows (
  follower_ty_account_id uuid not null,
  followee_ty_account_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_ty_account_id, followee_ty_account_id),
  check (follower_ty_account_id is distinct from followee_ty_account_id)
);

-- ── Version ────────────────────────────────────────────────
create table if not exists utatane.versions (
  id uuid primary key default gen_random_uuid(),
  host_holder_id uuid not null references utatane.rights_holders (id),
  title text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz                   -- 公開の時点。一度入れたら変えない
);

-- 公開済みの Version は題名と公開日時を変えない
create or replace function utatane.guard_version_update() returns trigger
language plpgsql as $$
begin
  if old.published_at is not null then
    raise exception 'published_version_is_immutable';
  end if;
  return new;
end;
$$;

-- ── 貢献と由来 ──────────────────────────────────────────────
create table if not exists utatane.contributions (
  id uuid primary key default gen_random_uuid(),
  role_kind_id text not null references utatane.role_kinds (id),
  birth_version_id uuid not null references utatane.versions (id),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists utatane.contribution_holders (
  contribution_id uuid not null references utatane.contributions (id),
  rights_holder_id uuid not null references utatane.rights_holders (id),
  primary key (contribution_id, rights_holder_id)
);

-- 由来（子は親を元にした）。全世代たどれる。世代の数は持たない
create table if not exists utatane.contribution_derivations (
  child_id uuid not null references utatane.contributions (id),
  parent_id uuid not null references utatane.contributions (id),
  kind text not null,                        -- modified_from / based_on …（増やせる）
  created_at timestamptz not null default now(),
  primary key (child_id, parent_id, kind),
  check (child_id is distinct from parent_id)
);

-- 時間の順（親が先）と、輪にならないことを確かめる
create or replace function utatane.guard_derivation() returns trigger
language plpgsql as $$
declare
  child_at timestamptz;
  parent_at timestamptz;
  makes_cycle boolean;
begin
  select created_at into child_at from utatane.contributions where id = new.child_id;
  select created_at into parent_at from utatane.contributions where id = new.parent_id;
  if sign(extract(epoch from (child_at - parent_at))) is distinct from 1 then
    raise exception 'derivation_not_earlier';
  end if;
  with recursive ancestors(id) as (
    select d.parent_id from utatane.contribution_derivations d where d.child_id = new.parent_id
    union
    select d.parent_id from utatane.contribution_derivations d join ancestors a on d.child_id = a.id
  )
  select exists (select 1 from ancestors where id = new.child_id) into makes_cycle;
  if makes_cycle then
    raise exception 'derivation_would_create_cycle';
  end if;
  return new;
end;
$$;

-- ── 再利用ポリシー（貢献の現在の設定・版つき） ─────────────────
create table if not exists utatane.reuse_policy_versions (
  contribution_id uuid not null references utatane.contributions (id),
  version_no integer not null,
  holder_id uuid references utatane.rights_holders (id),  -- null＝作者全員に同じ設定
  mode text not null check (mode in ('free', 'approval', 'forbidden')),
  scope text not null check (scope in ('any_version', 'this_version_only', 'named_holders')),
  named_holder_ids uuid[] not null default '{}',
  effective_at timestamptz not null default now(),
  recorded_by uuid,
  primary key (contribution_id, version_no)
);

-- ── 共作の承認方式（全員承認／代表者への委任。どちらか1人は持たない） ──────
create table if not exists utatane.coauthor_approval_methods (
  contribution_id uuid not null references utatane.contributions (id),
  seq integer not null,
  method text not null check (method in ('all', 'delegated')),
  delegate_holder_id uuid references utatane.rights_holders (id),
  effective_at timestamptz not null default now(),
  recorded_by uuid,
  primary key (contribution_id, seq),
  check ((method = 'all') = (delegate_holder_id is null))
);

create table if not exists utatane.coauthor_delegation_consents (
  contribution_id uuid not null,
  method_seq integer not null,
  delegator_holder_id uuid not null references utatane.rights_holders (id),
  consented_at timestamptz not null default now(),
  primary key (contribution_id, method_seq, delegator_holder_id),
  foreign key (contribution_id, method_seq) references utatane.coauthor_approval_methods (contribution_id, seq)
);

-- ── 素材と出どころ ──────────────────────────────────────────
create table if not exists utatane.materials (
  id uuid primary key default gen_random_uuid(),
  storage_file_id text not null,             -- 中央の保管サービスの file id
  uploaded_by uuid not null references utatane.rights_holders (id),
  created_at timestamptz not null default now()
);

create table if not exists utatane.material_embodiments (
  material_id uuid not null references utatane.materials (id),
  contribution_id uuid not null references utatane.contributions (id),
  primary key (material_id, contribution_id)
);

create table if not exists utatane.material_provenance (
  material_id uuid not null references utatane.materials (id),
  seq integer not null,
  kind text not null,                        -- self_made / co_made / licensed / from_utatane_material / external_material / includes_ai …
  source_material_id uuid references utatane.materials (id),
  evidence jsonb not null default '{}',
  declared_by uuid not null references utatane.rights_holders (id),
  declared_at timestamptz not null default now(),
  primary key (material_id, seq)
);

-- ── Version の中身（公開後は書き換えない） ───────────────────
create table if not exists utatane.version_contributions (
  version_id uuid not null references utatane.versions (id),
  contribution_id uuid not null references utatane.contributions (id),
  relation text not null check (relation in ('created', 'referenced')),
  added_at timestamptz not null default now(),
  primary key (version_id, contribution_id)
);
create table if not exists utatane.version_materials (
  version_id uuid not null references utatane.versions (id),
  material_id uuid not null references utatane.materials (id),
  added_at timestamptz not null default now(),
  primary key (version_id, material_id)
);

create or replace function utatane.guard_version_content() returns trigger
language plpgsql as $$
declare
  vid uuid;
begin
  if tg_op = 'DELETE' then vid := old.version_id; else vid := new.version_id; end if;
  if exists (select 1 from utatane.versions v where v.id = vid and v.published_at is not null) then
    raise exception 'published_version_is_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create table if not exists utatane.version_participants (
  version_id uuid not null references utatane.versions (id),
  rights_holder_id uuid not null references utatane.rights_holders (id),
  primary key (version_id, rights_holder_id)
);
create table if not exists utatane.participant_events (
  id bigint generated always as identity primary key,
  version_id uuid not null,
  rights_holder_id uuid not null,
  state text not null check (state in ('invited', 'requested', 'accepted', 'declined', 'left', 'anonymized')),
  recorded_by uuid,
  at timestamptz not null default now(),
  foreign key (version_id, rights_holder_id) references utatane.version_participants (version_id, rights_holder_id)
);

-- ── 許諾ルール・申請・募集・個別の許諾 ─────────────────────────
create table if not exists utatane.permission_rules (
  version integer primary key,
  r2_on_policy_tightened text not null check (r2_on_policy_tightened in ('undecided', 'survives', 'expires', 'grantor_chooses')),
  effective_from timestamptz not null default now(),
  recorded_by uuid
);
-- 許諾ルール R2 は決まるまで版1＝undecided（安全側）
insert into utatane.permission_rules (version, r2_on_policy_tightened) values (1, 'undecided')
  on conflict (version) do nothing;

create table if not exists utatane.recruitments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references utatane.versions (id),
  preapproved boolean not null default false,
  message text,
  created_by uuid not null references utatane.rights_holders (id),
  opened_at timestamptz not null default now()
);
create table if not exists utatane.recruitment_contributions (
  recruitment_id uuid not null references utatane.recruitments (id),
  contribution_id uuid not null references utatane.contributions (id),
  role_kind_id text references utatane.role_kinds (id),
  primary key (recruitment_id, contribution_id)
);
create table if not exists utatane.recruitment_events (
  id bigint generated always as identity primary key,
  recruitment_id uuid not null references utatane.recruitments (id),
  kind text not null check (kind in ('closed', 'reopened')),
  recorded_by uuid,
  at timestamptz not null default now()
);

create table if not exists utatane.permission_requests (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references utatane.contributions (id),
  requester_holder_id uuid not null references utatane.rights_holders (id),
  draft_version_id uuid not null references utatane.versions (id),
  message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (requester_holder_id, idempotency_key)
);
create table if not exists utatane.permission_request_responses (
  id bigint generated always as identity primary key,
  request_id uuid not null references utatane.permission_requests (id),
  responder_holder_id uuid not null references utatane.rights_holders (id),
  answer text not null check (answer in ('approved', 'declined', 'expired')),
  message text,
  at timestamptz not null default now()
);

create table if not exists utatane.permissions (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references utatane.contributions (id),
  grantee_holder_id uuid not null references utatane.rights_holders (id),
  draft_version_id uuid not null references utatane.versions (id),
  basis text not null check (basis in ('request_approval', 'recruitment_preapproval', 'policy_free', 'delegated_approval')),
  policy_version_no_at_grant integer not null,
  permission_rule_version_at_grant integer not null references utatane.permission_rules (version),
  request_id uuid references utatane.permission_requests (id),
  recruitment_id uuid references utatane.recruitments (id),
  created_at timestamptz not null default now()
);

create table if not exists utatane.permission_grantors (
  permission_id uuid not null references utatane.permissions (id),
  holder_id uuid not null references utatane.rights_holders (id),
  primary key (permission_id, holder_id)
);

create table if not exists utatane.permission_events (
  id bigint generated always as identity primary key,
  permission_id uuid not null references utatane.permissions (id),
  kind text not null check (kind in ('granted', 'revoked', 'kept_on_policy_change', 'revoked_on_policy_change')),
  actor_holder_id uuid references utatane.rights_holders (id),
  at timestamptz not null default now()
);

-- ── 公開時の再検証（公開の試みごとに1件・消さない） ────────────────
create table if not exists utatane.publish_checks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references utatane.versions (id),
  checked_at timestamptz not null default now(),
  permission_rule_version integer not null references utatane.permission_rules (version),
  passed boolean not null,
  result jsonb not null                      -- 貢献ごとの判定・使った Permission・素材の問題
);

-- ── 公開状態（履歴つきの新版） ─────────────────────────────────
create table if not exists utatane.publication_events (
  version_id uuid not null references utatane.versions (id),
  seq integer not null,
  state text not null check (state in ('public', 'private', 'anonymized', 'suspended')),
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now(),
  primary key (version_id, seq)
);

-- ── Revenue Rule（版つき。値は③で決める） ────────────────────────
create table if not exists utatane.revenue_rule_versions (
  id uuid primary key default gen_random_uuid(),
  scope_version_id uuid references utatane.versions (id),
  revenue_kind text not null,                -- typ_gift / purchase …（収益の種類の名前。残高ではない）
  version_no integer not null,
  effective_from timestamptz not null,
  body jsonb not null,                       -- 範囲・重み・道の数え方・素材の中の分け方・端数 など（値は③）
  recorded_by uuid,
  created_at timestamptz not null default now(),
  unique (scope_version_id, revenue_kind, version_no)
);

create table if not exists utatane.revenue_rule_approvals (
  revenue_rule_version_id uuid not null references utatane.revenue_rule_versions (id),
  holder_id uuid not null references utatane.rights_holders (id),
  approved_at timestamptz not null default now(),
  primary key (revenue_rule_version_id, holder_id)
);

-- ── 再生 ────────────────────────────────────────────────────
create table if not exists utatane.plays (
  id bigint generated always as identity primary key,
  version_id uuid not null references utatane.versions (id),
  listener_ty_account_id uuid,
  source text,                               -- どのチャンネル・画面から聴かれたか
  idempotency_key text not null,
  played_at timestamptz not null default now(),
  unique (version_id, idempotency_key)
);

-- ── トリガー（2回流しても重ならないよう、作り直す） ─────────────────
do $$
declare
  t text;
begin
  -- 追記だけの表（更新・削除を止める）
  foreach t in array array[
    'account_state_events', 'rights_state_events', 'contributions', 'contribution_holders',
    'contribution_derivations', 'reuse_policy_versions', 'coauthor_approval_methods',
    'coauthor_delegation_consents', 'materials', 'material_embodiments', 'material_provenance',
    'participant_events', 'permission_rules', 'recruitment_events', 'permission_request_responses',
    'permissions', 'permission_grantors', 'permission_events', 'publish_checks', 'publication_events',
    'revenue_rule_versions', 'revenue_rule_approvals', 'plays'
  ] loop
    execute format('drop trigger if exists %I on utatane.%I', t || '_append_only', t);
    execute format(
      'create trigger %I before update or delete on utatane.%I for each row execute function utatane.forbid_update_delete()',
      t || '_append_only', t);
  end loop;
end;
$$;

drop trigger if exists versions_guard on utatane.versions;
create trigger versions_guard before update on utatane.versions
  for each row execute function utatane.guard_version_update();
drop trigger if exists versions_no_delete on utatane.versions;
create trigger versions_no_delete before delete on utatane.versions
  for each row execute function utatane.forbid_update_delete();

drop trigger if exists contribution_derivations_guard on utatane.contribution_derivations;
create trigger contribution_derivations_guard before insert on utatane.contribution_derivations
  for each row execute function utatane.guard_derivation();

drop trigger if exists version_contributions_guard on utatane.version_contributions;
create trigger version_contributions_guard before insert or update or delete on utatane.version_contributions
  for each row execute function utatane.guard_version_content();
drop trigger if exists version_materials_guard on utatane.version_materials;
create trigger version_materials_guard before insert or update or delete on utatane.version_materials
  for each row execute function utatane.guard_version_content();

-- ── 読み書きはサーバだけ：全表で RLS を有効にし、公開の鍵のロールには何も配らない ──
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'utatane' loop
    execute format('alter table utatane.%I enable row level security', t.tablename);
  end loop;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema utatane from anon';
    execute 'revoke all on all tables in schema utatane from anon';
    execute 'revoke all on all sequences in schema utatane from anon';
    execute 'revoke all on all functions in schema utatane from anon';
    execute 'alter default privileges in schema utatane revoke all on tables from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema utatane from authenticated';
    execute 'revoke all on all tables in schema utatane from authenticated';
    execute 'revoke all on all sequences in schema utatane from authenticated';
    execute 'revoke all on all functions in schema utatane from authenticated';
    execute 'alter default privileges in schema utatane revoke all on tables from authenticated';
  end if;
end;
$$;

commit;
