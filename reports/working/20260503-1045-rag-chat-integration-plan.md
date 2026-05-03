# 作業計画レポート

保存先: `reports/working/20260503-1045-rag-chat-integration-plan.md`

## 1. 受けた指示

- `main` から worktree と branch を作成する。
- GitHub の `tsuji-tomonori/rag-assist`、主に `memorag-bedrock-mvp` の `main` 実装と draft PR #74 を調査する。
- 未実装、弱い点、拡張提案に対応し、設計、実装、テストを一気通貫で行う。
- きりの良いタイミングでテスト確認を行い、git commit と push を行う。
- 完了後に GitHub App を使って `main` 向け PR を作成する。
- 実作業前に計画とタスク分割をレポート化する。

## 2. タスク分割

| ID | タスク | 成果物 | Done 条件 |
|---|---|---|---|
| T1 | 作業用 worktree/branch 作成 | `codex/rag-chat-retrieval-integration` | `main` 起点の worktree で作業している |
| T2 | PR #74 と main 実装調査 | 調査メモ、実装方針 | evaluator / search loop / hybrid search の接続点が特定済み |
| T3 | RAG 本線の検索統合設計 | コード変更方針 | `/chat` が hybrid retriever を使える境界を持つ |
| T4 | 実装 | API コード、必要なテスト | hybrid retrieval、retrieval evaluator、action dispatch、context expansion、trace version 情報が接続済み |
| T5 | docs / reports / status 更新 | docs、作業完了レポート、`.codex/completion-status.json` | 実施内容、検証、制約が記録済み |
| T6 | 検証 | npm/task 実行結果 | 対象テストが通過、未実施は理由つきで記録 |
| T7 | commit / push / PR | commit、remote branch、PR | `main` 向け PR が GitHub App で作成済み |

## 3. 実装方針

- 最重要ギャップである `/chat` RAG loop と hybrid retriever の分断を優先する。
- draft PR #74 の retrieval evaluator は、main にそのまま依存せず、現行 state machine に合う形で統合する。
- `query_rewrite` と `expand_context` は schema だけで終わらせず、search loop executor へ接続する。
- ACL/metadata filter は `/search` と同じ user context を通して chat retrieval にも適用する。
- section-aware chunking や multi-level memory など大きな構造変更は、今回の中核変更に必要な最小単位で trace/version/context expansion の足場を入れ、過大なリスクを避ける。

## 4. 検証方針

- 変更範囲を `git diff --name-only` で確認し、API 変更は `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` を優先する。
- 型や contract への影響がある場合は API typecheck または workspace verify を追加する。
- docs 変更は `git diff --check` と関連 docs check を実行する。
- 検証失敗時は原因を修正し、同じ検証を再実行する。

## 5. 既知の制約

- PR #74 は draft かつ未マージのため、競合や古い前提があれば main に合わせて必要部分だけ取り込む。
- Bedrock や S3 Vectors の実サービスを使う確認は、ローカル環境・資格情報・コスト制約により通常は unit/contract/local store テストで代替する。
- すべての長期提案を完全実装するのではなく、今回の主目的である `/chat` RAG loop 統合に直接効く項目を優先する。
