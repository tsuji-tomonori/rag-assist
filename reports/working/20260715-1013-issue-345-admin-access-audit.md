# Issue #345 Access / Audit / Query state 作業レポート

## 受けた指示

Issue #345 の全体完了へ向け、管理 UI 再検証で残った P0 の Access / Audit / Query state gap を独立した stacked milestone として実装・検証し、task/commit/PR lifecycle まで進める。

## 要件整理と判断

- role/account lifecycle の最終認可は server に残し、UI は server capability と blocker を表示する。
- user/audit query は tenant scoped な stable cursor、total、as-of/version/source を返し、画面全体ではなく query/row 単位に状態を分離する。
- audit read と export を別 permission とし、export は同一 query の全ページ、redaction、監査記録を強制する。
- deleted/suspended projection は deny-first とし、directory/ledger 読み込みだけで active へ復活させない。
- 既存 ledger は configured tenant へ非破壊移行し、tenant partition と compare-and-swap を維持する。

## 実施作業

- `access:audit:export`、user query schema/page contract、audit export request contract、static access-control policy を追加した。
- admin ledger を tenant partition、CAS、再読検証、legacy migration 対応へ更新した。
- user list に search/status/sort/stable cursor、capability/effective permission/projection evidence を追加した。
- security audit outbox と legacy audit を共通 read model に統合し、success/denied/conflict/failed/pending を query/export 可能にした。
- export に tenant key、redaction、全ページ走査、成功/失敗監査を実装した。
- Web に URL query state、追加読み込み、row-scoped pending/error、safe request reference、export reason と結果 link を接続した。
- concurrency、tenant partition、legacy migration、205 件の cursor 全走査、export failure audit、UI state の regression test を追加した。
- FR/API/data/DLD/UI design、OpenAPI、API-code、Web inventory/traceability を同期した。

## 成果物

- API/store/security policy と contract の Access/Audit 実装
- 管理ユーザー・監査画面の server-driven query/state 実装
- API/Web/E2E regression test
- 正規設計文書と generated documentation
- `tasks/do/20260714-1011-admin-access-audit-state.md`

## 指示への fit 評価

task の受け入れ条件は自動 test と実装差分で満たした。認可境界、tenant 非列挙、deny-first projection、監査の失敗経路、stable cursor と concurrent write を重点確認した。benchmark 期待語句、QA sample 固有値、dataset 固有分岐は実装へ追加していない。

README/deploy/runbook は、利用者向けセットアップや運用コマンドに変更がなく、正本となる FR/API/data/UI design を更新したため変更不要と判断した。

## 検証

- `npm run lint`: 成功（E2E fixture 修正後も再実行）
- API/Web typecheck: 成功
- API full test: 785 tests 成功、失敗 0
- Web full test: 53 files / 390 tests 成功
- Access/Audit 関連 Web test: 67 tests 成功
- 対象 E2E: 5 scenarios 成功。初回に request-count 依存 fixture で 1 件失敗し、明示的な次回失敗 flag へ修正後、対象 scenario を再実行して成功
- workspace build: 成功。Vite の既存 bundle size warning のみ
- `task docs:check`: 成功
- E2E fixture 修正後の `task docs:web-inventory:check`: 成功
- API/docs check の sandbox 内初回実行では `tsx` IPC listen の `EPERM` が発生したが、承認済みの権限委譲で full API test と docs check を再実行し成功

## 未対応・制約・リスク

- 実機スクリーンリーダー、実ブラウザの 400% zoom、実デバイスでの操作確認は未実施であり、達成済みとは扱わない。
- S3 がないローカル環境のため、署名付き export artifact の成功経路は実接続で未確認。全ページ traversal と export failure audit は自動 test 済み。
- `npm install` は既存依存関係に 8 件の vulnerability を報告した。本 milestone では依存更新を行っていない。
- 生成 API-code は service call graph/test reference の再生成により広範囲へ差分が及ぶが、freshness check は成功している。
