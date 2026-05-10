# ドキュメント管理ディープリンク化

状態: do

## 背景

ドキュメント管理 UI は client-state の view 切替で動作しており、特定フォルダ、文書、reindex migration、検索条件へ直接遷移する URL がない。既存の P0 / P1 / P2 改善で安全操作、検索、詳細 drawer、最近の操作、モバイルカード表示は入っているため、残る主要な UX 改善として URL と画面状態を同期する。

## 目的

運用者が `/documents` 系 URL を共有でき、リロードや browser back / forward 後も対象フォルダ、文書、migration、検索条件を復元できるようにする。

## タスク種別

機能追加

## スコープ

- `/documents`
- `/documents/groups/:groupId`
- `/documents/:documentId`
- `/documents/reindex-migrations/:migrationId`
- `/documents?status=...`
- `/documents?query=...`

API 追加や server-side routing 設定変更は行わず、既存 SPA の History API で client-side state を同期する。

## 実装計画

1. `useAppShellState` に document route state の parse / push / popstate 同期を追加する。
2. `DocumentWorkspace` に URL 由来の初期状態と状態変更 callback を追加する。
3. フォルダ選択、文書 drawer 表示、migration 選択、検索 / 状態フィルタ変更で URL を更新する。
4. 対象 document / group / migration が存在しない場合は画面を壊さず通常の empty / list 表示へ fallback する。
5. `DocumentWorkspace` と `useAppShellState` の対象テストを追加する。
6. web inventory docs を更新または check する。
7. 検証、作業レポート、commit、PR、受け入れ条件コメントまで完了する。

## ドキュメント保守計画

- UI の URL state が変わるため、generated web inventory を確認する。
- durable docs に client-state route の記載がある場合は更新要否を確認し、必要なら最小更新する。
- API contract は変更しない。

## 受け入れ条件

- [ ] `/documents` でドキュメント管理 view を開ける。
- [ ] `/documents/groups/:groupId` で対象フォルダが選択され、upload destination もその folder に同期される。
- [ ] `/documents/:documentId` で対象文書の詳細 drawer が開く。
- [ ] `/documents/reindex-migrations/:migrationId` で対象 migration が確認できる状態になる。
- [ ] `/documents?query=...` と `/documents?status=...` が文書一覧フィルタへ反映される。
- [ ] フォルダ選択、文書行クリック、migration 操作対象選択、検索 / 状態変更で URL が更新される。
- [ ] browser back / forward で document route state が復元される。
- [ ] 存在しない group / document / migration ID でも架空データを表示せず、壊れない fallback になる。
- [ ] 対象テスト、web typecheck、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useAppShellState`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- URL state と画面 state の同期が無限ループになっていないこと。
- 認可がないユーザーへ `/documents` を開かせても既存 permission fallback を弱めていないこと。
- 存在しない ID を架空表示しないこと。
- 検索 query / status が URL encode/decode されること。

## リスク

- サーバ側 rewrite が未設定の配信環境では、ブラウザ直打ちの deep path が CDN / hosting 設定に依存する可能性がある。この作業では SPA 内の History API 同期までを対象にする。
