# 性能テスト履歴 UI と成果物 DL 制御の整理

## 保存先

`reports/tasks/20260506-2004-benchmark-ui-history-dl-control.md`

## 背景

PR #129 では、性能テスト画面で結果サマリーや必要な API/データセクションが検収上のノイズになっていた。また、失敗履歴で成果物 DL ボタンが押せる表示になっている一方で、実際には成果物が存在せず DL できない問題があった。

## 目的

性能テスト画面を履歴確認に集中できる構成へ整理し、実行ステータスに応じて成果物 DL 操作の可否を UI 上で明確にする。

## 対象範囲

- `memorag-bedrock-mvp/apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/features/benchmark.css`
- `memorag-bedrock-mvp/apps/web/src/App.test.tsx`
- `memorag-bedrock-mvp/apps/web/src/shared/utils/downloads.ts`
- `memorag-bedrock-mvp/apps/web/src/shared/utils/downloads.test.ts`

## 方針

- 画面上部から「結果サマリー」と「必要なAPI/データ」に相当するセクションを削除する。
- 平均応答時間、回答可能性正解率、検索recall、確認質問F1 の KPI は、成功履歴があっても未計測表示になるため削除する。
- 履歴一覧は実行内容、ステータス、実行時刻、主要メトリクス、DL 操作を一覧で比較しやすい構成にする。
- `succeeded` 以外の履歴では report / summary / results の成果物 DL ボタンを非活性にする。
- CodeBuild ログは成果物とは別扱いで、ログ URL がある場合は失敗履歴でも操作可能にする。

## 必要情報

- 実行履歴の `status`
- 実行履歴の `codeBuildLogUrl`
- 成果物種別: `report`, `summary`, `results`, `logs`
- Web UI テストで確認できる表示文言とボタン状態

## 実行計画

1. 既存 UI の結果サマリー、必要な API/データ、KPI カードの表示箇所を特定する。
2. 履歴一覧の構造を再設計し、実行履歴ごとに必要情報を横断確認できる表示へ変更する。
3. `status` と `codeBuildLogUrl` に基づいて DL ボタンの活性状態を分岐する。
4. Web UI テストで失敗履歴の成果物 DL 非活性と、CodeBuild ログの活性を確認する。

## ドキュメントメンテナンス計画

- UI 操作説明が README または運用ドキュメントに存在する場合は、CodeBuild ログ DL と失敗時の成果物 DL 制御を追記する。
- 画面構成変更のみで API 契約に影響しない記述は、UI 側 task の範囲では追加しない。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-UI-001 | 性能テスト画面から結果サマリーセクションが削除されている。 |
| AC-UI-002 | 性能テスト画面から必要な API/データセクションが削除されている。 |
| AC-UI-003 | 平均応答時間から確認質問F1までの KPI が画面上に残っていない。 |
| AC-UI-004 | 失敗履歴では report / summary / results の DL ボタンが非活性である。 |
| AC-UI-005 | `codeBuildLogUrl` がある履歴では、失敗履歴でも CodeBuild ログの DL 操作が可能である。 |
| AC-UI-006 | 履歴が実行内容、ステータス、時刻、メトリクス、操作を一覧で確認できる。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-UI-001 | PASS | PR #129 の `BenchmarkWorkspace.tsx` でサマリーカード群を削除済み。 |
| AC-UI-002 | PASS | PR #129 の `BenchmarkWorkspace.tsx` で必要な API/データ案内を削除済み。 |
| AC-UI-003 | PASS | PR #129 で平均応答時間、回答可能性正解率、検索recall、確認質問F1 の KPI 表示を削除し、実行ステータス件数へ置換済み。 |
| AC-UI-004 | PASS | PR #129 の `App.test.tsx` で失敗履歴の成果物 DL ボタンが disabled であることを確認済み。 |
| AC-UI-005 | PASS | PR #129 の `App.test.tsx` で失敗履歴でも CodeBuild ログを開けることを確認済み。 |
| AC-UI-006 | PASS | `benchmark.css` と `BenchmarkWorkspace.tsx` で履歴行の情報密度と操作領域を整理済み。 |

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- --run App.test.tsx api.test.ts shared/utils/downloads.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`

## PRレビュー観点

- 失敗履歴の成果物 DL ボタンが見た目だけでなく実際に disabled になっているか。
- CodeBuild ログ DL が report / summary / results と同じステータス条件に縛られていないか。
- 履歴表示がスマートフォン幅でも折り返し崩れしないか。

## 未決事項・リスク

- 実 AWS 環境で失敗した CodeBuild 実行履歴からログ URL を開く確認は未実施。PR #129 では UI テストと API/infra の静的検証で確認している。
