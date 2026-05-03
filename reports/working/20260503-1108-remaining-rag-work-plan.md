# 追加作業計画レポート

保存先: `reports/working/20260503-1108-remaining-rag-work-plan.md`

## 1. 受けた指示

- 以前の回答で未完了とした項目をすべてやり切る。
- 作業を途中で止めない。
- 既存 PR #88 のブランチ上で追加実装、検証、commit、push、PR 更新まで行う。

## 2. Done 条件

| ID | Done 条件 | 検証 |
|---|---|---|
| D1 | embedding cache / dedup / batch concurrency / re-embedding job の MVP 実装 | API unit test、typecheck |
| D2 | section-aware chunking と parent-child metadata の MVP 実装 | text-processing test、agent expand context test |
| D3 | Answer Support 失敗時の supported-only 再生成を最大 1 回で実装 | node unit test |
| D4 | lexical index の immutable artifact publish / load の MVP 実装 | hybrid search test |
| D5 | alias 管理 API、review、audit log、versioned artifact の MVP 実装 | contract / access-control / service test |
| D6 | tokenizer benchmark 比較用の計測 hook を実装 | benchmark/report test または API test |
| D7 | section / document / concept memory と raw chunk drill-down の MVP 実装 | ingest / chat test |
| D8 | ContextAssembler を独立コンポーネント化 | prompts / node unit test |
| D9 | RAG 品質劣化検知 agent / dataset alias 候補出力の MVP 実装 | benchmark test |
| D10 | docs、作業レポート、PR 本文を更新し、検証結果を一致させる | `git diff --check`、`task memorag:verify` |

## 3. Milestones

| Milestone | 内容 | 予定 commit |
|---|---|---|
| M1 | ingest / chunk / memory / embedding / lexical artifact / context assembler / answer repair | `feat(rag)` |
| M2 | alias 管理 API、benchmark 品質劣化検知、tokenizer 比較 | `feat(admin)` または `feat(benchmark)` |
| M3 | docs、reports、completion status、PR 更新 | `docs` / `chore` |

## 4. 判断

- 既存設計を壊さないため、各項目は MVP として小さく実装し、既存 local store / object store / mock model で検証可能にする。
- S3 実サービス、Bedrock 実サービス、OpenSearch、kuromoji.js の本番導入は行わず、artifact / benchmark hook / versioned data model を先に実装する。
- 新規管理 API は既存 admin permission model に沿って route-level permission と access-control policy test を同時更新する。
- 破壊的 migration は避け、既存 manifest / debug trace / document metadata と互換性を保つ。
