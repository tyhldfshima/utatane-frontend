# UTATANE 本体① 中核の DB/API 設計 v1（④）— Version／Contribution／Material／Permission・Consent／Version Tree

- 版：v1（2026-09-19）
- 置き場：`docs/design/utatane-core-db-api-v1.md`（このファイル）
- 前提として読んだもの
  - 商品仕様：`docs/product/utatane-product-spec-v1.md`・`-addendum-1.md`・`-addendum-2.md`（ブランチ docs/product-spec-v1）
  - 中央（TYHLD-platform main 47a654a）：`docs/02-architecture/typ-funds-and-rights-flow.md`（③）・`typ-questions-for-experts.md`・`typ-sales-channels-japan.md`
  - 中央の決まり：ADR-005（TY Auth DB の置き場・1プロダクト＝1DB）・ADR-025（パッケージ方式と API 方式）・`packages/auth`・`packages/storage` の package.json・`docs/05-projects/utatane.md`
  - 便の報告：ウォレット画面の体験設計（b09360de）・旧 Railway の /api 経路を外した便（6b518439）
- 置き場に依存しない中核の決まりの実装：`lib/domain/`（試験つき）。TYP の中央とつなぐ所の形：`lib/integrations/typ.ts`
- DDL 案（未適用）：`docs/db/utatane-core-v1.draft.sql`

## 0. えふさん確定（2026-09-19・原文のまま）

> UTATANE本体も止めず、TYポイントと並行して進めます。 UTATANE本体：Version / Contribution / Permission・Consent / Version Tree / 投稿・参加・派生 / 再生 / プロフィールなど、音楽コラボの中核を実装へ進める。 UTATANEはすでに正本3本がmainに入っています。ここからは設計資料を増やし続けるより、④のDB/API設計 → 実装へ移すべき段階です。TYポイント側と接続する箇所だけインターフェースを切って、両方を並行開発します。 重要なのは、「専門家回答待ち＝UTATANE開発停止」にしないことです。

---

## 1. 結論：置き場と、パッケージ方式か API 方式か

| 領域 | 使うもの | 方式 | 根拠 |
|---|---|---|---|
| 認証 | `@tyhld/auth`（TY JWT の検証） | パッケージ | ADR-025「各プロダクト内で完結する判断→パッケージ」。実例が @tyhld/auth。検証は UTATANE のサーバの中で行う |
| 素材の置き場（音源・譜面・詞のファイル） | `@tyhld/storage` → 中央の保管サービス（R2） | API | ADR-025 の実例（Storage Service/R2）。UTATANE の表には中央の file id だけを持つ |
| TYP（残高・贈る・受け取り・分配の算定） | 中央（point.ty-hld.com） | API | ③：残高の正本は中央だけ。UTATANE は「贈る」を中央へ頼み、算定に使う Version の写しを返すだけ（4章） |
| テナント | 使わない | — | UTATANE は一般の利用者が相手で、会社単位の区切りが無い |
| ★UTATANE 固有のデータ（Version・Contribution・素材の結び・許諾・Revenue Rule の版・再生・プロフィールの上書き） | ★UTATANE 専用の DB（案：新しい Supabase プロジェクト「utatane」・東京） | UTATANE のサーバ（utatane-frontend の Next.js の Route Handlers）だけが読み書き | ADR-005 P1・P5（1プロダクト＝1DB。TY Auth DB には「プロダクト固有データ」を置かない）。ADR-025（プロダクト固有の判断はプロダクトに残す）。③ §1（UT 固有領域） |

### 1-1. ★要判断 D-1（先頭）：新しい本番 DB が要る

→ ★2026-09-19 えふさん承認：UTATANE 専用の Supabase（東京）を新設する。TYポイント中央基盤とは分離（8章）。DB ができるまでは、DB に依存しない所（API の口・画面・型・試験）を手元の保存で進める（9章）。

- 旧ウタタネの Postgres（Railway）は削除済み。UTATANE 固有のデータの置き場は、いまどこにも無い。
- 推し：**UTATANE 専用の Supabase プロジェクトを新しく作る**（名前 utatane・東京リージョン・プランは運用判断）。スキーマは `utatane`。行の単位の守り（RLS）を全部の表で有効にし、公開の鍵（anon・authenticated）には何も許さない。読み書きは UTATANE のサーバが service role の鍵で行う。
- 別案と、推さない理由：
  - 中央 DB（tyhld-platform）に `utatane` スキーマを置く：ADR-005 §3.2「プロダクト固有データは格納しない」と食い違う。
  - 中央に UTATANE 用のサービス（Hono）を立てて中央 DB に置く：ADR-025 の「プロダクト固有の判断はプロダクトに残す」と食い違い、中央の窓口の障害が UTATANE の中核に波及する。
- えふさんの手番（決まったら）：①Supabase プロジェクトを作る → ②`docs/db/utatane-core-v1.draft.sql` の「貼る先」を書き入れた版を職人が出し直す → ③えふさんが貼る（事前確認 → 適用 → 事後確認 → 貼る先の確認列）→ ④Vercel の utatane に接続の値を入れる（職人は値に触らない）。

### 1-2. サーバの形

- utatane-frontend の Next.js（App Router）の Route Handlers を API にする（Vercel の関数・Node）。旧 Express（utatane-backend）は使わない。
- ブラウザからの呼び出しは `lib/api.ts` の `apiUrl` を1か所で付け替える（6b518439 で作った所）。同じ住所の `/api/v1/...` を指すようにする。
- メンテナンス表示（MAINTENANCE_MODE）は外さない。中核の API も、メンテナンス中は middleware が 503 を返す。

---

## 2. データの形（表の一覧）

DDL の全文は `docs/db/utatane-core-v1.draft.sql`（35 表）。★金額・分配率は入れない。

| まとまり | 表 | 中身・決まり |
|---|---|---|
| 役割 | role_natures／role_kinds | 性質（work・performance・recording・finishing）と役割の行。★行で足す（固定の一覧にしない） |
| 権利者とアカウント | rights_holders／account_state_events／rights_state_events | 権利者はアカウントとは別（ty_account_id は無くてもよい）。中央の受取人 id を持てる。アカウント状態と権利状態は別の履歴（追記だけ）。退会・死亡の届出で権利状態は変わらない |
| プロフィール | profiles／follows | TY アカウントの共通プロフィールの上書き値だけ（ADR-005 §3.2） |
| Version | versions | 公開の日時を一度入れたら、題名と公開日時を変えない（トリガー） |
| 貢献 | contributions／contribution_holders | 1つの貢献に作者1人以上。追記だけ |
| 由来（Version Graph） | contribution_derivations | 子 → 親（改変元・基にした元）。★全世代たどる。世代の数は持たない。★親が先に生まれていること・輪にならないことをトリガーで確かめる |
| 再利用ポリシー（①） | reuse_policy_versions | 貢献ごと（共作で作者ごとに違う希望なら作者ごと）の版。自由／申請して承認／使えない × どの Version でも／この Version だけ／指定した人だけ。初期値は「申請→承認」（確定4：行が無ければ承認） |
| 共作の承認方式 | coauthor_approval_methods／coauthor_delegation_consents | 全員承認か代表者への委任だけ（どちらか1人は入らない）。委任は権利者1人ずつの同意の記録 |
| 素材 | materials／material_embodiments／material_provenance | 素材は中央の file id。どの貢献を収めているか。★出どころの申告（自作・共同制作・許諾済み・UTATANE 内の素材から・外部の素材・AI を含む…）と根拠 |
| Version の中身 | version_contributions／version_materials | 新しく作った貢献と参照した貢献、使う素材。★公開後は足す・消す・変えるができない（トリガー） |
| 参加 | version_participants／participant_events | 招待・申し出・承認・辞退・抜けた・匿名化の履歴 |
| 許諾ルール | permission_rules | 版つき。版1＝R2 未確定（undecided）。R1（公開時点で有効な許諾が必須）はコードの決まり |
| 申請・募集 | permission_requests（冪等の鍵）／permission_request_responses／recruitments（事前承認の印）／recruitment_contributions／recruitment_events | 申請への返事は権利者1人ずつの記録 |
| 個別の許諾（②） | permissions／permission_grantors／permission_events | 誰が・誰へ・どの下書きについて・どの貢献を・根拠・成立時のポリシーの版と許諾ルールの版。状態は追記の事件で表す（取り消し・残す・ポリシー変更での取り消し） |
| 公開時の再検証（③） | publish_checks | 公開の試みごとに1件。結果（貢献ごとの判定・使った Permission・素材の問題）を jsonb で残す |
| 公開状態 | publication_events | 履歴つきの新版（公開・非公開・匿名化・一時停止） |
| Revenue Rule | revenue_rule_versions／revenue_rule_approvals | 版つき・適用開始日つき。本体は jsonb で、値（範囲・重み・道の数え方・PF・端数）は③で決める |
| 再生 | plays | 冪等の鍵つき（同じ再生を2回数えない） |

---

## 3. API（UTATANE のサーバ・/api/v1）

- 認証：`Authorization: Bearer`（TY JWT）を `@tyhld/auth` で検証。権利者はトークンの TY アカウントから引く。
- 変更の口はすべて冪等の鍵（`Idempotency-Key`）を受ける。
- 失敗は `{ error: 'コード' }` の形（いまの lib/api.ts の ApiError に合わせる）。

| 区分 | 口 | 中身 |
|---|---|---|
| 投稿（Version） | POST /versions | 下書きの Version を作る |
| | POST /versions/{id}/contributions | 新しい貢献を作る（役割・作者）か、既存の貢献を参照する。公開済みなら 409 |
| | POST /versions/{id}/materials | 使う素材を足す。出どころの申告が無い素材は 422 |
| | POST /versions/{id}/publish | 公開時の再検証（`revalidateForPublish`）→ 記録（publish_checks）→ 通れば公開。通らなければ 409 と判定の中身 |
| | POST /versions/{id}/publication | 公開状態の新しい版（非公開・匿名化など） |
| | GET /versions/{id} | Version・参加者・使った貢献・公開状態 |
| Version Tree | GET /versions/{id}/lineage | 由来の全世代（貢献ごとに一意・当たった道の全部・世代） |
| | GET /versions/{id}/tree | 上流（元）と下流（この Version の貢献を使う Version）。1段ずつ開く |
| 貢献 | GET /contributions/{id} | 貢献・作者・由来・「この貢献が使われた Version（直接・その先）」 |
| | POST /contributions/{id}/policy | 再利用ポリシーの新しい版。厳しくしたとき、成立済みで未公開の許諾の一覧を返す（残す／取り消すを選ぶ画面のため） |
| | POST /contributions/{id}/coauthor-method／delegations | 共作の承認方式と委任の同意 |
| 素材 | POST /materials | 中央の保管サービスに置いた file id・収める貢献・出どころの申告 |
| 参加 | POST /versions/{id}/participants／…/responses | 招待・申し出・承認・辞退 |
| 許諾 | POST /permission-requests | 申請（届く先は貢献の作者。共作なら全員、委任があれば代表者） |
| | POST /permission-requests/{id}/responses | 承認・見送り（期限切れは自動で「承認されなかった」。自動承認しない） |
| | POST /permissions/{id}/events | 取り消し・ポリシー変更時の「残す／取り消す」 |
| 募集 | POST /recruitments／…/join／…/close | 事前承認の募集では、参加の成立で Permission を1件記録（`permissionFromRecruitment`） |
| 再生 | POST /versions/{id}/plays | 冪等の鍵つき |
| プロフィール・チャンネル | GET /profiles/{tyAccountId}／PUT /profiles/me | UTATANE の上書き値 |
| | GET /profiles/{tyAccountId}/channel?section=own,participated,used,recruiting | 自分の作品／参加作品／自分の貢献が使われた作品／コラボ募集中（データはコピーせず関係から並べる） |
| Revenue Rule | POST /versions/{id}/revenue-rules／…/approvals | 版の追加と、受け取る人の承認。値は③ |
| 中央から呼ばれる口 | GET /internal/v1/versions/{id}/distribution-snapshot | 4章。中央のサービスの認証（サービス同士の鍵）だけで呼べる |

---

## 4. TYP の中央とのインターフェース（形だけ・`lib/integrations/typ.ts`）

★TYP の台帳・残高・購入・出金はここで作らない。

### 4-1. UTATANE → 中央（`TypCentralClient`）

- `giftToVersion({ idempotencyKey, versionId, amount, message })`：Version へ TYP を贈る。冪等の鍵は端末で「贈る」画面を開いたときの UUID（ウォレット画面の体験設計 5章）。
- `lookupOperation(idempotencyKey)`：通信が切れたとき、同じ鍵で「記録されたか」を確かめる。
- 中央の口が決まるまでの既定 `typCentralNotConfigured`：呼ぶと `typ_central_not_configured` で失敗する（どこかの住所へ落とさない）。
- 残高・履歴・「なぜ届いたか」の明細の口は、中央の API の形が出た便で足す（ウォレット画面の体験設計 10章の項目）。

### 4-2. 中央 → UTATANE（分配の写し `DistributionSnapshot`）

- 中央は贈与を算定するときに、UTATANE の `GET /internal/v1/versions/{id}/distribution-snapshot` を呼ぶ（または贈与の時点で写しを受け取って保存する：どちらにするかは要判断 D-3）。
- 写しの中身（`buildDistributionSnapshot` が作る）：
  - `revenueRuleVersionId`：贈与の時点でその Version に適用されていた Revenue Rule の版（★値の中身は中央が Rule の版で読む。UTATANE は割合を計算しない）
  - `publishCheckedAt`・`usedPermissionIds`：公開時の再検証と、そこで使った Permission（③ §5-1 の許諾の写し）
  - 貢献ごと：役割・性質・作者（権利者 id と ★中央の受取人 id＝beneficiary）・世代・当たった道の全部・この Version で作った貢献か
- ★受取人（beneficiary）の渡し方：UTATANE の権利者に中央の受取人 id を結んでおき（rights_holders.central_beneficiary_id）、写しにそのまま載せる。未連携なら null で渡し、中央側で保留にする（③ §5-3）。アカウント id は受取人の代わりに使わない。
- 公開時の再検証に通っていない Version の写しは作らない（`version_not_revalidated`）。

---

## 5. 実装した中核の決まり（`lib/domain/`・置き場に依存しない）

| ファイル | 決まり |
|---|---|
| types.ts | 箱の型（貢献・素材・Version・許諾・ポリシー・許諾ルール・履歴）。役割・由来の種類・出どころの種類は文字列の id（足せる） |
| lineage.ts | `requiredContributionsOf`（直接の参照＋素材が収める貢献）・`traceVersionLineage`（全世代・貢献は一意・道は全部残す・輪の守り）・`canAddDerivation`（時間の順・輪にならない） |
| coauthor.ts | `evaluateCoauthorConsent`（全員承認／委任。委任は全員の同意がそろって有効。代表者自身の利用は委任の外。代表者が動けない状態なら委任は移らず止まる） |
| permissions.ts | `policyFor`・`effectiveMode`（この Version だけ・指定した人だけを畳む。初期値は承認）・`permissionValidity`（許諾ルール R2：未確定の間は「残す」の記録が無ければ不通過）・`evaluateContributionUse`・`permissionFromRecruitment`（募集の事前承認） |
| publish.ts | `revalidateForPublish`（公開時の再検証の記録を作る）・`checkMaterials`（出どころの申告が必須。UTATANE 内の素材から作った素材は元の貢献を全部収めていること） |
| history.ts | `appendVersion`（追記だけ・時間が前へ進むこと）・`versionAt`（その時点の版）・`assertContentEditable`（公開済みは変えない） |
| ../integrations/typ.ts | `TypCentralClient`・`typCentralNotConfigured`・`buildDistributionSnapshot` |

試験（vitest）：`lib/domain/core.test.ts`（25件）・`lib/integrations/typ.test.ts`（3件）。商品仕様のケース 46・48・50・58・59・61・62・63・64・65 を試験の形で通している。

DDL 案は、使い捨ての手元の Postgres（PGlite・本番ではない）で流して確かめた：35 表・全表の RLS 有効・由来の時間の順・公開済み Version の中身の変更の拒否・追記だけの表の更新と削除の拒否・「どちらか1人」の承認方式の拒否。

---

## 6. 次の便で実装する範囲

1. D-1 の後：DB の接続（サーバだけ）と、3章の API の Route Handlers（下書き → 貢献 → 素材 → 公開の再検証 → 公開）。`lib/domain` をそのまま呼ぶ。
2. 認証：`@tyhld/auth` の導入（Node 24 が前提：`engines`。GitHub Packages から入れる設定の確認）。
3. 画面：投稿（種・参加・派生）・Version の画面（参加者と使われた貢献の2段）・Version Tree（1段ずつ開く）・再生（冪等）・プロフィールとチャンネル（4つの区分）。いまの画面（曲×詞の固定・役割3つ・投稿の未接続）を置き換える。
4. 素材：`@tyhld/storage` での置き場への上げ下ろしと、出どころの申告の画面。
5. 中央の TYP の API の形が出たら、`TypCentralClient` の本物と、分配の写しの口。

---

## 7. 要判断（★2026-09-19 えふさん承認で決着）

| 番号 | 問い | 答え（えふさん承認・CC1 の推しどおり） |
|---|---|---|
| D-1 | UTATANE 専用の DB を作るか | 作る。UTATANE 専用の Supabase（東京）を新設（作るのはえふさん）。TYポイント中央基盤とは分離 |
| D-2 | 権利者と中央の受取人を結ぶ時点 | 初めて貢献を作ったとき（`CoreService.createContribution` で `BeneficiaryRegistry.ensureBeneficiary` を呼ぶ） |
| D-3 | 分配の写しの渡し方 | 贈与の時点で UTATANE が中央へ渡す |
| D-4 | 自前の認証を外す時期 | 本体②（この便）で外した。@tyhld/auth に切り替え |
| D-5 | 許諾ルール R2 | 決まるまで版1＝undecided（安全側） |
| D-6 | package-lock.json | 記録に入れる。CI は npm ci |

---

## 8. ★責務分離（えふさん確定 2026-09-19）

> UTATANE DB → 曲、Version、Contribution、許諾、参加者など音楽データ
> point.ty-hld.com 中央基盤 → ポイント台帳、残高、取引、由来、reversal、報酬など

| 置き場 | 持つもの | 持たないもの |
|---|---|---|
| UTATANE DB（専用 Supabase・東京） | 役割（種類の表）・権利者（アカウントとは別）・アカウント状態と権利状態の履歴・プロフィールの上書き値・フォロー・Version・公開状態の履歴・貢献・作者・貢献の由来（Version Graph）・再利用ポリシー・共作の承認方式と委任・素材の結び（file id）と出どころ・Version の中身・参加者と参加の履歴・許諾ルール・申請と返事・募集・個別の許諾（Permission/Consent）・公開時の再検証・Revenue Rule の版と承認（Rule 本体は UT：③ §1 #5）・再生 | ポイント台帳・残高・取引・贈与・ロット・reversal（打ち消し）・算定・円建て報酬・出金・受取人の本体・税務と本人確認 |
| point.ty-hld.com（中央） | ポイント台帳・残高・取引（付与・贈る・受け取る・打ち消し・失効）・取引の由来（origin）・reversal・冪等・算定・報酬・受取人（beneficiary）の本体 | 音楽データ（Version・貢献・許諾・参加者） |
| つなぎ目 | UTATANE は中央の id だけを参照として持つ（`rights_holders.central_beneficiary_id`）。中央は UTATANE の Version の写し（`DistributionSnapshot`）を贈与の時点で受け取る（D-3） | 相手の DB を直接読まない |

### 8-1. DDL 案の点検（2026-09-19）

- `docs/db/utatane-core-v1.draft.sql` の 35 表を点検した。ポイント・残高・取引・報酬・台帳の表は**混ざっていない**（外した表は無し）。
- 中央を指すのは `rights_holders.central_beneficiary_id`（中央の受取人 id を参照として持つだけ）と、`revenue_rule_versions.revenue_kind` の値の名前（`typ_gift` など。収益の種類の名前で、残高ではない）だけ。
- 素材のファイルは中央の保管サービスの file id を参照として持つだけ（`materials.storage_file_id`）。

---

## 9. 本体②で作ったもの（DB に依存しない所）

### 9-1. 保存の口（リポジトリの型）

- `lib/server/repository.ts`：`CoreRepository`（音楽データの読み書きの口）。ポイント・残高・報酬の口は持たない。
- `lib/server/memory-repository.ts`：試験用の手元の保存（メモリ）。★本番の保存ではない（プロセスが終われば消える）。
- `lib/server/container.ts`：API の口が使う保存を決める**1か所**。DB ができたら、ここで Supabase 版の保存に差し替える。
- `lib/server/core-service.ts`：`CoreService`＝保存の口から集めて lib/domain の決まりに渡し、結果を保存する。DB ができても変えない。

### 9-2. API の口（Route Handlers・`app/api/v1`）

| 口 | 本人確認 | 中身 |
|---|---|---|
| POST /versions | 要 | 下書き |
| GET /versions/{id} | 任意（下書きは参加者だけ） | Version・参加者・使われた貢献・公開状態 |
| POST /versions/{id}/contributions | 要（主催） | 新しい貢献（mode=create・由来つき可・一緒に作った人を招く）か既存の参照（mode=reference） |
| POST /versions/{id}/materials | 要（主催） | 素材（出どころの申告が無ければ 422） |
| POST /versions/{id}/participants | 要（招かれた人） | 参加の承認・辞退 |
| POST /versions/{id}/publish | 要（主催） | 公開時の再検証 → 記録 → 公開。通らなければ 409 publish_check_failed と判定の中身 |
| GET /versions/{id}/tree | 任意（下書きは参加者だけ） | 由来（世代ごと）と下流の1段（公開済みだけ） |
| POST /versions/{id}/plays | 任意 | 再生（冪等の鍵） |
| POST /contributions/{id}/policy | 要（作者） | 再利用ポリシーの新しい版 |
| POST /permission-requests | 要 | 申請（冪等の鍵） |
| POST /permission-requests/{id}/responses | 要（作者） | 承認なら Permission を記録（共作は1人ずつ・委任の代表者は delegated_approval） |
| GET /profiles/{id}/channel | 任意（本人だけ自分の下書きも） | 自分の作品／参加作品／自分の貢献が使われた作品／コラボ募集中（公開済みだけ） |
| GET /role-kinds | 不要 | 役割の一覧 |
| GET /auth/callback | — | 中央ログインの戻り口（`@tyhld/auth/callback`） |

- 本人確認：`lib/server/auth.ts`（`@tyhld/auth` の `authenticateBearer`・ES256＋JWKS）。設定が無ければ 503 auth_not_configured。
- メンテナンス表示中は middleware が /api を 503 で返す（変えていない）。

### 9-3. 画面

- `/upload`：種を置く／ほかの歌から作る（使う貢献を選び、申請を送ってから公開を確かめる）。参加は Version の画面で承認する。
- `/versions/{id}`：参加者と使われた貢献の2段・Version Tree（1段ずつ開く）・再生（画面を開いた1回を1つの鍵）・「この歌から作る」。「TYP を贈る」は中央の API が来るまで押せない（準備中）。金額・分配率は出さない。
- `/profile/{id}`：チャンネルの4つの区分。
- `/login`：Google（TY アカウント）だけ。メールとパスワードは外した（ADR-006）。

---

## 10. DB ができた後の便で書き入れる所

| 所 | 書き入れること |
|---|---|
| `docs/db/utatane-core-v1.draft.sql` の冒頭 | 貼る先の名前・ref・URL（未作成 → 実際の値） |
| `lib/server/`（新しいファイル） | `CoreRepository` の Supabase 版（service role の鍵はサーバの環境変数から読む） |
| `lib/server/container.ts` | `new MemoryRepository()` を Supabase 版に差し替える（1行） |
| Vercel の環境変数（えふさん） | UTATANE DB の URL と service role の鍵（名前は Supabase 版を作る便で決める） |
| `lib/integrations/typ.ts` の既定 | 中央の API の形が出たら、`BeneficiaryRegistry` と `TypCentralClient` の本物に差し替える |
