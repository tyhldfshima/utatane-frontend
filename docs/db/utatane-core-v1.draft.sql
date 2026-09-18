-- ============================================================
-- UTATANE 中核（Version／Contribution／Material／Permission・Consent／Version Graph）DDL 案 v1
-- ★未適用。★まだ貼らない。
--   貼る先の DB はまだ作られていない（設計文書 docs/design/utatane-core-db-api-v1.md の要判断 D-1）。
--   D-1 が決まったら、この下の「貼る先」を書き入れて出し直す。職人は流さない。
--
-- 貼る先：未作成（案＝新しい Supabase プロジェクト「utatane」・東京リージョン）
-- ref：未作成
-- URL：未作成（作成後に Supabase の SQL Editor の URL を書き入れる）
--
-- 書き方の約束：比較の記号・山かっこは使わない（貼り間違い防止）。
-- 消さない・上書きしない表（履歴・許諾・再検証・公開状態・Revenue Rule の版）は
-- 更新と削除をトリガーで止める。公開済み Version の中身は書き換えさせない。
-- 金額・分配率はこの DDL に入れない（Revenue Rule の本体は jsonb で、値は③で決める）。
-- ============================================================


-- ============================================================
-- 1. 事前確認（貼る前に実行。結果が 0 であること）
-- ============================================================
select count(*) as utatane_schema_exists
from information_schema.schemata
where schema_name = 'utatane';


-- ============================================================
-- 2. 適用
-- ============================================================
begin;

create schema utatane;

-- 追記だけの表で、更新・削除を止める
create function utatane.forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'append_only_table: %', tg_table_name;
end;
$$;

-- ── 役割（貢献の種類）：行で足す ─────────────────────────────
create table utatane.role_natures (
  id text primary key                        -- work / performance / recording / finishing
);
insert into utatane.role_natures (id) values ('work'), ('performance'), ('recording'), ('finishing');

create table utatane.role_kinds (
  id text primary key,                       -- lyrics / melody / arrangement / vocal / guitar / recording / mix …
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
  ('video', 'work', '映像');

-- ── 権利者とアカウント（別の持ち物） ─────────────────────────
create table utatane.rights_holders (
  id uuid primary key default gen_random_uuid(),
  ty_account_id uuid unique,                 -- TY アカウント。無い権利者もいる
  central_beneficiary_id uuid unique,        -- 中央の受取人 id（未連携なら null）
  created_at timestamptz not null default now()
);

create table utatane.account_state_events (
  id bigint generated always as identity primary key,
  ty_account_id uuid not null,
  state text not null check (state in ('active', 'withdrawn', 'suspended', 'unreachable', 'death_reported')),
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now()
);
create trigger account_state_events_append_only before update or delete on utatane.account_state_events
  for each row execute function utatane.forbid_update_delete();

create table utatane.rights_state_events (
  id bigint generated always as identity primary key,
  rights_holder_id uuid not null references utatane.rights_holders (id),
  state text not null,                       -- active / succession_in_progress / succeeded / unknown_holder …（増やせる）
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now()
);
create trigger rights_state_events_append_only before update or delete on utatane.rights_state_events
  for each row execute function utatane.forbid_update_delete();

-- UTATANE 固有のプロフィール（TY アカウントの共通プロフィールの上書き値だけ）
create table utatane.profiles (
  ty_account_id uuid primary key,
  artist_name text,
  bio text,
  avatar_file_id uuid,                       -- 中央の保管サービスの file id
  updated_at timestamptz not null default now()
);

create table utatane.follows (
  follower_ty_account_id uuid not null,
  followee_ty_account_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_ty_account_id, followee_ty_account_id),
  check (follower_ty_account_id is distinct from followee_ty_account_id)
);

-- ── Version ────────────────────────────────────────────────
create table utatane.versions (
  id uuid primary key default gen_random_uuid(),
  host_holder_id uuid not null references utatane.rights_holders (id),
  title text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz                   -- 公開の時点。一度入れたら変えない
);

-- 公開済みの Version は題名と公開日時を変えない
create function utatane.guard_version_update() returns trigger
language plpgsql as $$
begin
  if old.published_at is not null then
    raise exception 'published_version_is_immutable';
  end if;
  return new;
end;
$$;
create trigger versions_guard before update on utatane.versions
  for each row execute function utatane.guard_version_update();
create trigger versions_no_delete before delete on utatane.versions
  for each row execute function utatane.forbid_update_delete();

-- ── 貢献と由来 ──────────────────────────────────────────────
create table utatane.contributions (
  id uuid primary key default gen_random_uuid(),
  role_kind_id text not null references utatane.role_kinds (id),
  birth_version_id uuid not null references utatane.versions (id),
  description text,
  created_at timestamptz not null default now()
);
create trigger contributions_append_only before update or delete on utatane.contributions
  for each row execute function utatane.forbid_update_delete();

create table utatane.contribution_holders (
  contribution_id uuid not null references utatane.contributions (id),
  rights_holder_id uuid not null references utatane.rights_holders (id),
  primary key (contribution_id, rights_holder_id)
);
create trigger contribution_holders_append_only before update or delete on utatane.contribution_holders
  for each row execute function utatane.forbid_update_delete();

-- 由来（子は親を元にした）。全世代たどれる。世代の数は持たない
create table utatane.contribution_derivations (
  child_id uuid not null references utatane.contributions (id),
  parent_id uuid not null references utatane.contributions (id),
  kind text not null,                        -- modified_from / based_on …（増やせる）
  created_at timestamptz not null default now(),
  primary key (child_id, parent_id, kind),
  check (child_id is distinct from parent_id)
);

-- 時間の順（親が先）と、輪にならないことを確かめる
create function utatane.guard_derivation() returns trigger
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
create trigger contribution_derivations_guard before insert on utatane.contribution_derivations
  for each row execute function utatane.guard_derivation();
create trigger contribution_derivations_append_only before update or delete on utatane.contribution_derivations
  for each row execute function utatane.forbid_update_delete();

-- ── 再利用ポリシー（貢献の現在の設定・版つき） ─────────────────
create table utatane.reuse_policy_versions (
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
create trigger reuse_policy_versions_append_only before update or delete on utatane.reuse_policy_versions
  for each row execute function utatane.forbid_update_delete();

-- ── 共作の承認方式（全員承認／代表者への委任。どちらか1人は持たない） ──────
create table utatane.coauthor_approval_methods (
  contribution_id uuid not null references utatane.contributions (id),
  seq integer not null,
  method text not null check (method in ('all', 'delegated')),
  delegate_holder_id uuid references utatane.rights_holders (id),
  effective_at timestamptz not null default now(),
  recorded_by uuid,
  primary key (contribution_id, seq),
  check ((method = 'all') = (delegate_holder_id is null))
);
create trigger coauthor_approval_methods_append_only before update or delete on utatane.coauthor_approval_methods
  for each row execute function utatane.forbid_update_delete();

create table utatane.coauthor_delegation_consents (
  contribution_id uuid not null,
  method_seq integer not null,
  delegator_holder_id uuid not null references utatane.rights_holders (id),
  consented_at timestamptz not null default now(),
  primary key (contribution_id, method_seq, delegator_holder_id),
  foreign key (contribution_id, method_seq) references utatane.coauthor_approval_methods (contribution_id, seq)
);
create trigger coauthor_delegation_consents_append_only before update or delete on utatane.coauthor_delegation_consents
  for each row execute function utatane.forbid_update_delete();

-- ── 素材と出どころ ──────────────────────────────────────────
create table utatane.materials (
  id uuid primary key default gen_random_uuid(),
  storage_file_id uuid not null,             -- 中央の保管サービスの file id
  uploaded_by uuid not null references utatane.rights_holders (id),
  created_at timestamptz not null default now()
);
create trigger materials_append_only before update or delete on utatane.materials
  for each row execute function utatane.forbid_update_delete();

create table utatane.material_embodiments (
  material_id uuid not null references utatane.materials (id),
  contribution_id uuid not null references utatane.contributions (id),
  primary key (material_id, contribution_id)
);
create trigger material_embodiments_append_only before update or delete on utatane.material_embodiments
  for each row execute function utatane.forbid_update_delete();

create table utatane.material_provenance (
  material_id uuid not null references utatane.materials (id),
  seq integer not null,
  kind text not null,                        -- self_made / co_made / licensed / from_utatane_material / external_material / includes_ai …
  source_material_id uuid references utatane.materials (id),
  evidence jsonb not null default '{}',
  declared_by uuid not null references utatane.rights_holders (id),
  declared_at timestamptz not null default now(),
  primary key (material_id, seq)
);
create trigger material_provenance_append_only before update or delete on utatane.material_provenance
  for each row execute function utatane.forbid_update_delete();

-- ── Version の中身（公開後は書き換えない） ───────────────────
create table utatane.version_contributions (
  version_id uuid not null references utatane.versions (id),
  contribution_id uuid not null references utatane.contributions (id),
  relation text not null check (relation in ('created', 'referenced')),
  primary key (version_id, contribution_id)
);
create table utatane.version_materials (
  version_id uuid not null references utatane.versions (id),
  material_id uuid not null references utatane.materials (id),
  primary key (version_id, material_id)
);

create function utatane.guard_version_content() returns trigger
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
create trigger version_contributions_guard before insert or update or delete on utatane.version_contributions
  for each row execute function utatane.guard_version_content();
create trigger version_materials_guard before insert or update or delete on utatane.version_materials
  for each row execute function utatane.guard_version_content();

create table utatane.version_participants (
  version_id uuid not null references utatane.versions (id),
  rights_holder_id uuid not null references utatane.rights_holders (id),
  primary key (version_id, rights_holder_id)
);
create table utatane.participant_events (
  id bigint generated always as identity primary key,
  version_id uuid not null,
  rights_holder_id uuid not null,
  state text not null check (state in ('invited', 'requested', 'accepted', 'declined', 'left', 'anonymized')),
  recorded_by uuid,
  at timestamptz not null default now(),
  foreign key (version_id, rights_holder_id) references utatane.version_participants (version_id, rights_holder_id)
);
create trigger participant_events_append_only before update or delete on utatane.participant_events
  for each row execute function utatane.forbid_update_delete();

-- ── 許諾ルール・申請・募集・個別の許諾 ─────────────────────────
create table utatane.permission_rules (
  version integer primary key,
  r2_on_policy_tightened text not null check (r2_on_policy_tightened in ('undecided', 'survives', 'expires', 'grantor_chooses')),
  effective_from timestamptz not null default now(),
  recorded_by uuid
);
insert into utatane.permission_rules (version, r2_on_policy_tightened) values (1, 'undecided');
create trigger permission_rules_append_only before update or delete on utatane.permission_rules
  for each row execute function utatane.forbid_update_delete();

create table utatane.recruitments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references utatane.versions (id),
  preapproved boolean not null default false,
  message text,
  created_by uuid not null references utatane.rights_holders (id),
  opened_at timestamptz not null default now()
);
create table utatane.recruitment_contributions (
  recruitment_id uuid not null references utatane.recruitments (id),
  contribution_id uuid not null references utatane.contributions (id),
  role_kind_id text references utatane.role_kinds (id),
  primary key (recruitment_id, contribution_id)
);
create table utatane.recruitment_events (
  id bigint generated always as identity primary key,
  recruitment_id uuid not null references utatane.recruitments (id),
  kind text not null check (kind in ('closed', 'reopened')),
  recorded_by uuid,
  at timestamptz not null default now()
);
create trigger recruitment_events_append_only before update or delete on utatane.recruitment_events
  for each row execute function utatane.forbid_update_delete();

create table utatane.permission_requests (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references utatane.contributions (id),
  requester_holder_id uuid not null references utatane.rights_holders (id),
  draft_version_id uuid not null references utatane.versions (id),
  message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (requester_holder_id, idempotency_key)
);
create table utatane.permission_request_responses (
  id bigint generated always as identity primary key,
  request_id uuid not null references utatane.permission_requests (id),
  responder_holder_id uuid not null references utatane.rights_holders (id),
  answer text not null check (answer in ('approved', 'declined', 'expired')),
  message text,
  at timestamptz not null default now()
);
create trigger permission_request_responses_append_only before update or delete on utatane.permission_request_responses
  for each row execute function utatane.forbid_update_delete();

create table utatane.permissions (
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
create trigger permissions_append_only before update or delete on utatane.permissions
  for each row execute function utatane.forbid_update_delete();

create table utatane.permission_grantors (
  permission_id uuid not null references utatane.permissions (id),
  holder_id uuid not null references utatane.rights_holders (id),
  primary key (permission_id, holder_id)
);
create trigger permission_grantors_append_only before update or delete on utatane.permission_grantors
  for each row execute function utatane.forbid_update_delete();

create table utatane.permission_events (
  id bigint generated always as identity primary key,
  permission_id uuid not null references utatane.permissions (id),
  kind text not null check (kind in ('granted', 'revoked', 'kept_on_policy_change', 'revoked_on_policy_change')),
  actor_holder_id uuid references utatane.rights_holders (id),
  at timestamptz not null default now()
);
create trigger permission_events_append_only before update or delete on utatane.permission_events
  for each row execute function utatane.forbid_update_delete();

-- ── 公開時の再検証（公開の試みごとに1件・消さない） ────────────────
create table utatane.publish_checks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references utatane.versions (id),
  checked_at timestamptz not null default now(),
  permission_rule_version integer not null references utatane.permission_rules (version),
  passed boolean not null,
  result jsonb not null                      -- 貢献ごとの判定・使った Permission・素材の問題
);
create trigger publish_checks_append_only before update or delete on utatane.publish_checks
  for each row execute function utatane.forbid_update_delete();

-- ── 公開状態（履歴つきの新版） ─────────────────────────────────
create table utatane.publication_events (
  version_id uuid not null references utatane.versions (id),
  seq integer not null,
  state text not null check (state in ('public', 'private', 'anonymized', 'suspended')),
  reason text not null,
  recorded_by uuid,
  effective_from timestamptz not null default now(),
  primary key (version_id, seq)
);
create trigger publication_events_append_only before update or delete on utatane.publication_events
  for each row execute function utatane.forbid_update_delete();

-- ── Revenue Rule（版つき。値は③で決める） ────────────────────────
create table utatane.revenue_rule_versions (
  id uuid primary key default gen_random_uuid(),
  scope_version_id uuid references utatane.versions (id),
  revenue_kind text not null,                -- typ_gift / purchase …（増やせる）
  version_no integer not null,
  effective_from timestamptz not null,
  body jsonb not null,                       -- 範囲・重み・道の数え方・素材の中の分け方・端数 など（値は③）
  recorded_by uuid,
  created_at timestamptz not null default now(),
  unique (scope_version_id, revenue_kind, version_no)
);
create trigger revenue_rule_versions_append_only before update or delete on utatane.revenue_rule_versions
  for each row execute function utatane.forbid_update_delete();

create table utatane.revenue_rule_approvals (
  revenue_rule_version_id uuid not null references utatane.revenue_rule_versions (id),
  holder_id uuid not null references utatane.rights_holders (id),
  approved_at timestamptz not null default now(),
  primary key (revenue_rule_version_id, holder_id)
);
create trigger revenue_rule_approvals_append_only before update or delete on utatane.revenue_rule_approvals
  for each row execute function utatane.forbid_update_delete();

-- ── 再生 ────────────────────────────────────────────────────
create table utatane.plays (
  id bigint generated always as identity primary key,
  version_id uuid not null references utatane.versions (id),
  listener_ty_account_id uuid,
  source text,                               -- どのチャンネル・画面から聴かれたか
  idempotency_key text not null,
  played_at timestamptz not null default now(),
  unique (version_id, idempotency_key)
);
create trigger plays_append_only before update or delete on utatane.plays
  for each row execute function utatane.forbid_update_delete();

-- ── 読み書きはサーバ（UTATANE の API）だけ：行の単位の守りを有効にし、公開の鍵には何も許さない ──
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'utatane' loop
    execute format('alter table utatane.%I enable row level security', t.tablename);
  end loop;
end;
$$;
revoke all on schema utatane from anon, authenticated;

commit;


-- ============================================================
-- 3. 事後確認
-- ============================================================
-- 表の数（35 であること）
select count(*) as utatane_tables
from information_schema.tables
where table_schema = 'utatane';

-- 行の単位の守りが無効の表（0 件であること）
select tablename
from pg_tables
where schemaname = 'utatane' and rowsecurity is false;

-- 初期の行（役割 8・性質 4・許諾ルール 1）
select
  (select count(*) from utatane.role_kinds) as role_kinds,
  (select count(*) from utatane.role_natures) as role_natures,
  (select count(*) from utatane.permission_rules) as permission_rules;


-- ============================================================
-- 4. 貼る先の確認（最後の列を見て、意図した DB に貼ったかを確かめる）
-- ============================================================
select
  current_database() as pasted_database,
  current_user as pasted_by,
  (select count(*) from information_schema.schemata where schema_name = 'utatane') as utatane_schema,
  now() as pasted_at;
