# Benchmark CodeBuild timeout 延長

状態: do

## 背景

CodeBuild build `BenchmarkProject1593465D-pFhEYBpuOoZu:436d9960-398b-4a56-aeaf-62d722de84d6` が 2026-05-07 の benchmark 実行で `BUILD_TIMED_OUT` となった。対象 build は `BUILD` phase が約 41 分 55 秒で timeout しており、全量 benchmark や corpus seed を含む実行では現在の運用上限に余裕が不足している。

## 目的

benchmark runner の CodeBuild timeout を延長し、Step Functions 側の全体 timeout と運用文書も整合させる。

## スコープ

- `memorag-bedrock-mvp` の benchmark CodeBuild / Step Functions timeout 設定
- 関連する infra test / snapshot
- 運用文書の timeout 説明

## 対象外

- benchmark 評価ロジックの変更
- RAG 検索・回答品質の変更
- dataset 固有の期待語句や分岐追加

## 作業計画

1. benchmark CodeBuild project と Step Functions の timeout 設定を確認する。
2. CodeBuild timeout を長時間 benchmark 向けに延長する。
3. Step Functions timeout を CodeBuild timeout より長くし、状態機械側で先に切れないようにする。
4. infra test / snapshot と運用文書を更新する。
5. 変更範囲に応じた検証を実行する。
6. レポート、commit、push、PR、PR コメント、task done 移動まで完了する。

## ドキュメント保守方針

CodeBuild / Step Functions の運用上限が変わるため、`memorag-bedrock-mvp/docs/OPERATIONS.md` に timeout とコスト・キャンセル運用の注意を追記する。

## 受け入れ条件

- AC1: benchmark CodeBuild project の timeout が既存値より延長されている。
- AC2: benchmark Step Functions state machine の timeout が CodeBuild timeout より長く、runner 全体を包める。
- AC3: infra test / snapshot が timeout 変更と整合している。
- AC4: 運用文書に延長後 timeout と長時間 run の注意が記載されている。
- AC5: 変更範囲に見合う検証が実行され、未実施項目は理由付きで記録されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`

## PR セルフレビュー観点

- docs と実装の timeout 値が同期していること。
- infra snapshot が意図した差分だけであること。
- benchmark 固有値や RAG 品質ロジックを変更していないこと。
- 長時間 run のコスト・キャンセル運用リスクを説明していること。

## リスク

- timeout 延長により、失敗 run が長く残った場合の CodeBuild コストが増える。
- 実 AWS 環境での build 再実行は認証・AWS 権限・外部 dataset download に依存するため、ローカル検証だけでは本番 timeout 解消を完全には保証できない。
