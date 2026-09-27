# Paw Time API

ワーカーアプリと採用企業アプリの共通APIです。求人、応募、採用判断、勤怠、評価とゲーム報酬を同じ業務トランザクションから扱います。

## 現在の実装

最初の垂直スライスを確認するため、保存先は `MemoryStore` です。開発用の企業コンテキストとして次のヘッダーを要求します。

```text
x-organization-id: org-komorebi
x-actor-id: member-demo
```

このヘッダーは認証ではありません。本番では認証トークンから組織と操作者を解決し、リクエストから渡された組織IDを信用しないでください。

## エンドポイント

- `GET /health`
- `GET /v1/worker/jobs`
- `POST /v1/worker/applications`
- `GET /v1/worker/shifts`
- `GET /v1/worker/letters`、`POST /v1/worker/letters/:id/reply`（スタンプで返事）
- `POST /v1/worker/shifts/:id/attendance`（本人の打刻。店頭タブレットからも使う）
- `POST /v1/worker/applications/:id/withdraw`（辞退。作成済みのシフトはキャンセルになる）
- `GET /v1/worker/invitations`、`POST /v1/worker/invitations/:id/respond`
- `POST /v1/worker/shop-feedback`（お店への匿名の答え）
- `POST /v1/worker/activity`（アプリを開いた、島を訪ねた）
- `GET /v1/business/me`（操作者・権限・店舗）
- `GET /v1/business/members`
- `GET /v1/business/stores`、`PUT /v1/business/stores/:id`（島の見た目：ロゴ・色・ひとこと。店長のみ）
- `GET /v1/business/stores/settings`、`GET|PUT /v1/business/stores/:id/settings`（店ごとの労務設定。PUTは店長のみ）
- `GET|POST /v1/business/jobs`
- `POST /v1/business/jobs/:id/publish`
- `POST /v1/business/jobs/:id/close`
- `POST /v1/business/shifts/:id/urgent-job`（欠勤・キャンセルの枠を【急募】として公開）
- `GET|POST /v1/business/invitations`（過去に働いた人への声かけ）
- `GET /v1/business/applications`
- `POST /v1/business/applications/:id/decision`
- `GET /v1/business/shifts`
- `POST /v1/business/shifts/:id/attendance`（出勤・退勤・休憩開始・休憩終了）
- `GET /v1/business/shifts/:id/attendance`（打刻の履歴。修正前の記録も含む）
- `POST /v1/business/shifts/:id/attendance/corrections`（理由つきの打刻修正）
- `POST /v1/business/shifts/:id/confirm`
- `POST /v1/business/shifts/:id/no-show`
- `GET /v1/business/shifts/:id/attendance-summary`
- `GET /v1/business/attendance-summaries`
- `GET|POST /v1/business/closed-periods`、`DELETE /v1/business/closed-periods/:id`（月次締めと締め解除。店長のみ）
- `GET /v1/business/attendance-events`（組織のすべての打刻。CSV出力や履歴表示に使う）
- `GET|POST /v1/business/evaluations`
- `GET|POST /v1/business/letters`
- `GET /v1/business/shop-feedback/summary?storeId=`（ワーカーの評価のタグ票数と島の目印。5人以上そろった店だけ）
- `GET /v1/business/insights?storeId=&days=`（働いたあとの信号：翌日に開いた率、また来る率、再応募率、直前キャンセル率、埋まる率、求人ごとのKPI。店長のみ）
- `GET /v1/business/audit-logs`（店長のみ）
- `GET /v1/business/workers`（ワーカーごとの勤務履歴）
- `GET /v1/business/world`（お店の島）
- `GET /v1/business/world/rewards`
- `/v1/business/console/*`: 店舗管理画面（apps/employer）用。`org-sunnyside`（SF・USD）と `org-komorebi`（日本・円）の見本データ。today, jobs, wage-check, urgent-reach, applicants, shifts, attendance-log, corrections, threads, faq, reviews, invites, settings。規則（最低賃金、5人未満の非表示、8:00〜21:00 の配信、個人スコアを返さない）は `packages/shop-console` にあり、テストは `test/shop-console.test.ts` と `packages/shop-console/test`。

失敗時は `{ "error": "<code>" }` を返します。`not_found` は404、`forbidden` は403、`invalid_transition`・`capacity_reached`・`period_closed` は409、`invalid_request`・`invalid_time_range`・`store_not_found`・`empty_letter` は400です。

## 権限

`x-actor-id` を組織のメンバー一覧（`GET /me`）で引いて、店長（manager）かスタッフ（staff）かを決めます。知らない操作者はスタッフ扱いです。求人の作成・公開・終了、採用判断、勤怠の確定・欠勤・打刻修正、月次締め、労務設定、改善レポート、監査ログは店長だけが使えます。打刻、評価、手紙はどちらも使えます。

## 保存

何も設定しなければ起動のたびにデモデータに戻ります。`PAW_TIME_DATA_FILE=./data/store.json` を付けるとJSONファイルに、`DATABASE_URL=postgres://...` を付けるとPostgreSQLの `api_snapshots` テーブル（`infra/database/migrations/0004_brush_up.sql`）に、変更のたびに全体を保存し、次の起動で読み戻します。移行SQLにある行ごとのテーブルへ書く段階は、認証で本物のユーザーIDが入ってからです。

## お店の島とワーカーの評価

ワーカーは勤務のあとに、ワーカーアプリと同じ「ひとこと評価」（星1〜5と、当てはまるタグ：時間どおりに帰れる・休憩がとれる・説明がわかりやすい・給料が遅れない・人がやさしい・忙しいけど公平・また働きたい）を送ります。個々の答えはお店に渡りません。5人以上がそろった店だけ、タグごとの票数と、票数で3段（3・8・16票）まで育つ目印（時計台・休憩の木立・道しるべ・給料日の鐘・灯りの小道・つりあいの噴水・おかえりのアーチ）を返します（`GET /shop-feedback/summary`）。定義は `packages/api-contracts/src/shop-island.ts` で、ワーカーアプリの ShopCulture と同じ値です。お店が決められるのは看板のロゴ・色・ひとことだけ（`PUT /stores/:id`）。答えが届くとお店に肉球ポイント（`shop_reviewed`）が入り、同じワーカーが2回目以降の勤務を終えると `worker_returned` が入ります。

## 勤怠

打刻は追記型で、修正は元の打刻を残したまま新しい打刻で置き換えます（`correctionOfEventId`）。勤怠サマリーは実働・休憩・残業・深夜（22時〜5時）を分で返し、休憩ルール（既定は労基法34条：6時間超で45分、8時間超で60分）の不足と、時給×実働に深夜・8時間超の割増（既定25%）を足した概算支給額も計算します。休憩ルール・割増率・実働の丸め単位・締め日は店ごとの設定（`/stores/:id/settings`）で変えられます。締めた月（`closed-periods`）のシフトは打刻・修正・確定・欠勤のどれも `period_closed` で拒否します。開始15分後に出勤が無い、終了60分後に退勤が無いシフトは打刻漏れとして印を付けます。

## 手紙

勤務を終えたシフト（退勤済みまたは確定済み）のワーカーに、企業から短い手紙を送れます。定型文（`packages/api-contracts/src/letters.ts`）か自由文（300文字まで）で、文面はそのままワーカー側に届きます。同じシフトへの最初の1通だけが経験値になります。

## 報酬

経験値の量とレベルは `packages/game-catalog` の定義から計算します。付与は `job_published:<求人ID>` のようなイベントキーごとに1回だけで、同じ操作を繰り返しても二重に付与されません。

起動時のデモデータは `src/infrastructure/seed.ts` にあり、日時は起動時刻を基準に日本時間で作ります。

通信仕様の正本は `packages/api-contracts`、永続化スキーマは `infra/database/migrations` です。
