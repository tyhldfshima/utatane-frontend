# UTATANE の素材（音源など）を保管サービスに置き・読み・再生する

- 日付：2026-09-20
- 正本の順：えふさん確定 ＞ 保管サービスの実装（TYHLD-platform `services/storage`）＞ この文書。
- 保管サービス側の設計：同リポジトリの `services/storage/README.md`（利用者ごとの区画 `utatane/{user_id}/…`）。
- 画面の設計書：[utatane-focus-screens-spec.md](utatane-focus-screens-spec.md)（§3 の状態の枠に合わせる）。

## 1. えふさん確定（2026-09-19・1文字も変えない）

> Storage要件：本人の utatane/{user_id}/... だけにアップロードできること、任意user_idを選べないこと、privateのままであること、短期署名URL、他人の素材を勝手に読めないこと。

> UTATANE×Storage受入：UTATANE素材処理実装後、本物の認証ユーザーで upload → read/playback → 権限のない別ユーザー拒否までPASS

## 2. 決めたこと

### 2-1 どこを通るか

| 物 | 通り道 |
|---|---|
| 置く許可（署名つき住所）をもらう | ブラウザ → UTATANE のサーバー（`POST /api/materials/presign`）→ 保管サービス `POST /v1/presigned-url` |
| 素材そのもの | ブラウザ → 署名つき住所（R2）へ直接 PUT。★UTATANE のサーバーは通らない |
| 一覧 | ブラウザ → `GET /api/materials` → 保管サービス `GET /v1/files?app_id=utatane` |
| 再生（読む住所） | ブラウザ → `GET /api/materials/{番号}/play` → 保管サービス `GET /v1/files/{番号}` |

### 2-2 誰の物になるか（★任意の user_id を選べない理由）

- 住所の先頭 `utatane/{user_id}/` は**中央（保管サービス）が作る**。UTATANE は作らない・送らない。
- `{user_id}` は、中央が検証した TY の印（JWT）の `sub`。
- UTATANE のサーバーは、ブラウザから**利用者 id を受け取らない**。`X-End-User-Id` も付けない。
- ブラウザが本文に `user_id`・`key`・`app_id`・`bucket` などを書いても、口は読まない（使う値を1つずつ取り出しているため、ほかの値は外へ出ない）。
- ★守りは二重になっている。UTATANE が渡さないこと（1枚目）と、中央が印からしか決めないこと（2枚目）。

### 2-3 非公開のまま

- 区画のファイルは常に `bucket=tyhld-private`・`visibility=private`。UTATANE の口はこの2つを固定で送り、ブラウザには選ばせない。
- 公開の配信（CDN）は使わない。読むときは毎回、短い時間だけ有効な署名つき住所をもらう。

### 2-4 他人の素材を勝手に読めない

- 一覧と再生では、UTATANE のサーバーは**合言葉（X-App-Key）を付けない**。本人の印だけで中央を呼ぶ。
- 中央は、合言葉が無ければ「持ち主本人か」だけで判断する（`services/storage/src/lib/area.ts` の `decideRead`）。他人の素材の番号を書いて呼んでも 403。
- ★合言葉を付けると「持ち主以外の分も出す」道が開く。誰に聴かせてよいかを UTATANE が権利から決められるようになるまで、その道は使わない。使うときは、UTATANE 側で Contribution・公開済み Version の権利を確かめてから出す（次の便）。

### 2-5 合言葉の置き場

- `UTATANE_STORAGE_APP_KEY` は**サーバーの中だけ**。`NEXT_PUBLIC_` を付けない＝ブラウザへ送られない。
- 答えにも入れない（試験で固めている）。

### 2-6 消すこと

- 中央は区画のファイルの削除を誰にも配っていない（`deletion_not_granted`）。この便でも削除の口は作らない。
- 退会しても素材を自動で全部消す作りは入れない（Contribution の権利・公開済み Version・保持義務を確かめて決める）。

## 3. 設定（環境変数）

| 名前 | 置き場 | 中身 |
|---|---|---|
| `UTATANE_STORAGE_URL` | Vercel（サーバー側のみ） | `https://storage.ty-hld.com`（開発は `https://storage-dev.ty-hld.com`） |
| `UTATANE_STORAGE_APP_KEY` | Vercel（サーバー側のみ・秘密） | UTATANE の合言葉（Bitwarden「UTATANE 合言葉（X-App-Key）」） |

- どちらかが無ければ、既定へ落とさずに `503 not_ready / storage_not_configured` を返す（`lib/api.ts` の `api_url_not_configured` と同じ作法）。

## 4. まだ待っている物

| 待つ物 | 何に依存して待つのか |
|---|---|
| ★画面が実際に動くこと（本物の TY アカウントで置く・読む） | 中央ログイン（TY アカウント）が UTATANE に入ること＝**PR #4**（未合流・NPM_TOKEN の区切り待ち）と、その環境変数。いまの main には TY のログインが無いので、画面は「ログインしてください」で止まる |
| ブラウザから署名つき住所への直接 PUT | 保管サービス側の R2 の CORS に UTATANE の元を入れること（`tyhld-private`・`tyhld-private-dev`）。記録は TYHLD-platform の `services/storage/r2-cors/` にあるが、Cloudflare へはまだ入れていない |
| 素材を「歌に送る」「Version に入れる」 | UTATANE 本体のデータ（Contribution・提出物）＝PR #4〜#6 |
| 他の人へ聴かせる（公開後の聴き手・参加者） | 権利の確かめ方を決めること（2-4 の後半） |

## 5. 画面（自分の素材）

- 住所：`/ui/materials`（「自分」→「自分の素材」）。
- 状態（設計書 §3 の枠をそのまま使う）：
  - 未ログイン … 主ボタンは押せない形＋理由の一文「この画面を使うには、TY アカウントでログインしてください。」
  - 読み込み中 … `StateView kind="loading"`
  - 空 … 「まだ素材がありません。［素材を置く］から、音のファイルを置けます。」
  - エラー … `StateView kind="error"` ＋［もう一度］
  - 置いている間 … 主ボタンを「置いています」に変えて押せなくする（二重に置かない）
  - 一覧 … ファイル名・大きさ・置いた日と［再生］
- 主ボタンは1画面に1つ（［素材を置く］）。戻る道は「自分の管理画面へ」。
