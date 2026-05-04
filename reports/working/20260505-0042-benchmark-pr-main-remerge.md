# Benchmark seed PR main remerge

## 受けた指示
- PR #102 のレビュー指摘に対し、`clarification-smoke-v1` の handbook seed 漏れと `EMBEDDING_MODEL_ID` の query 未反映を修正する。
- 競合を解消し、main 向け PR を更新する。

## 要件整理
- `standard-agent-v1` / `smoke-agent-v1` / `clarification-smoke-v1` で同じ標準 benchmark corpus を seed する。
- seed と `/benchmark/query` / follow-up query の embedding model を env default で揃える。
- benchmark seed 文書は通常 RAG と文書一覧から隔離する。
- `origin/main` 取り込み時の API 設計ドキュメント競合では、main 側の async chat run 記述と benchmark seed 権限記述を両方残す。

## 実施作業
- `origin/main` を再取り込みし、`DES_API_001.md` の競合を解消した。
- API endpoint 一覧で `/chat-runs` / `/chat-runs/{runId}/events` と、benchmark seed 用 `/documents` 権限の説明を統合した。
- 再現用ローカル API で chat-run SSE が `status` / `final` event を返すことを確認した。

## 検証
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp/infra test`
- `git diff --check`
- `git diff --cached --check`

## Fit 評価
- レビューで要修正とされた 2 点は実装済み。
- main 取り込み時の競合は、両ブランチの API 仕様変更を残す形で解消済み。
- PR 本文更新は merge commit push 後に GitHub App で実施する。

## 未対応・制約・リスク
- 既にデプロイ済み環境に存在する可能性がある古い benchmark seed 文書の cleanup は別作業。
- ローカル mock での clarification benchmark は runner 経路確認が目的で、品質指標そのものは本番同等の評価対象外。
