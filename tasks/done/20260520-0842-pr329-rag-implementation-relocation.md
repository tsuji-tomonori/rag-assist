# PR329 RAG 実装再配置

状態: done

## 背景

PR #329 は RAG の `offline/online` と pipeline stage 別の配置を追加したが、production path の多くが descriptor-only placeholder で、既存 RAG 実装本体は旧フラット path に残っていた。

## 目的

既存 RAG 実装を新しい runtime/pipeline 構成へ移し、旧 path は互換 re-export として残す。

## タスク種別

修正

## なぜなぜ分析サマリ

- 確定事実: PR 本文と `apps/api/src/rag/README.md` は、既存フラット実装を残し、追加 module は descriptor-only と説明していた。
- 確定事実: `apps/api/src/rag/offline/**`、`apps/api/src/rag/online/**`、`apps/api/src/rag/_shared/**` には `status: "planned"` の descriptor-only module が多数あった。
- 推定原因: 初回対応が将来配置の scaffold 作成に寄り、既存実装の移設を完了条件に含めなかった。
- 影響範囲: RAG extraction、chunking、embedding cache、quality、manifest chunk storage、pipeline version、hybrid retrieval、chat RAG orchestration nodes。
- 根本原因: 「配置先を作る」と「既存実装をその配置へ移す」の完了条件が分離され、前者だけで PR を完了扱いにしたこと。
- 対応方針: 既存本体を新 path へ移し、旧 path は re-export shim にする。production path の descriptor-only module は削除または実装 module に置き換える。

## スコープ

- 対象: `apps/api/src/rag/`、`apps/api/src/search/hybrid-search.ts`、`apps/api/src/chat-orchestration/` の RAG 実装移設、関連テスト、README、task/report。
- 対象外: Web placeholder、contract placeholder、benchmark descriptor の全面実装。API production path の blocking 指摘解消を優先した。

## 実施内容

1. 既存 RAG 実装の import/export 依存を確認した。
2. 主要実装を新 path へ移した。
3. 旧 path を re-export shim に置き換えた。
4. 新 path を直接 import する regression test を追加した。
5. README と作業レポートを更新した。
6. API typecheck/test を実行し、失敗した import を修正して再実行した。
7. commit/push し、PR に受け入れ条件確認とセルフレビューをコメントした。

## ドキュメントメンテナンス結果

- `apps/api/src/rag/README.md` を実装移設後の配置説明へ更新した。
- 仕様要件そのものは追加していないため、`docs/` 更新は不要と判断した。

## 受け入れ条件

1. [x] production path 配下の placeholder-only descriptor が削除される、または実装 module に置き換えられる。
2. [x] 旧 path は実処理を持たず、新 path からの re-export か facade 呼び出しだけになる。
3. [x] 既存の RAG 関連テストまたは追加テストが新 path の module を直接 import して通る。
4. [x] `npm test -w @memorag-mvp/api` が通る。
5. [x] `npm run typecheck -w @memorag-mvp/api` が通る。

## 検証結果

- `rg 'status:\\s*"planned"|export const ragComponentDescriptor' apps/api/src/rag -g '!**/*.test.ts'`: 該当なし
- `npm run typecheck -w @memorag-mvp/api`: fail -> import 修正後 pass
- `npm test -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- commit hooks: pass

## PR コメント

- 受け入れ条件確認コメント: `4493184913`
- セルフレビューコメント: `4493186704`

## PR レビュー観点

- RAG の根拠性・認可境界を弱めていないこと: 移設のみで既存ロジックを維持し、API test を通過。
- benchmark 期待語句や dataset 固有値を実装に入れていないこと: 新規追加なし。
- 旧 path 互換性を保ちつつ実装重複を避けていること: 旧 path を re-export shim 化。

## リスク

- 空 module として残した将来配置ファイルは API typecheck 上は安全だが、実処理ではない。新規責務追加時は descriptor ではなく実装とテストを追加する必要がある。
