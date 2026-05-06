# 文書構造に基づく Context / Memory Budget

保存先: `reports/tasks/20260506-1203-structure-aware-context-memory.md`

## 背景

memory card 生成と context assembly では、summary 文字数、keywords 件数、section cards 件数、concept terms 件数、snippet budget、prefix 幅などが固定されている。文書長、章数、table / list / code 比率、質問 complexity によって必要な memory / context は変わる。

## 目的

文書構造と質問特性に応じて memory card と context snippet の量・選択基準を調整し、固定件数依存を減らす。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/chunk.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/text-extract.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- text processing / graph / prompts tests

## 方針

- section 数、chunk 数、chunk kind、heading density などの document statistics を manifest または runtime で利用する。
- context selection は keyword anchor だけでなく、section metadata、claim coverage、diversity、引用可能性を使う。
- memory card 生成件数は fixed slice ではなく、文書の section / concept 分布から決める。
- token budget は profile から取得し、質問 complexity に応じて調整する。
- diversity は top evidence の置換ではなく tie-breaker / MMR 補助として扱い、最高信頼度の引用候補を必ず保持する。
- v1 の dynamic budget は既存 default の上限を超えない範囲で導入し、cost / noise 増加を抑える。
- document statistics は manifest の optional field とし、既存 manifest は runtime fallback で読めるようにする。

## 必要情報

- 前提タスク:
  - `reports/tasks/20260506-1203-rag-policy-profile.md`
  - `reports/tasks/20260506-1203-structured-fact-planning.md`
- 固定値の例:
  - `memorag-service.ts` の section cards `12`、concept terms `8`
  - `context-assembler.ts` の token budget `3000`、snippet max `1800`
- 関連要求・設計:
  - `FR-002`, `FR-004`, `FR-005`, `FR-015`, `FR-020`
  - `SQ-001`, `NFR-010`, `NFR-012`
  - `ASR-TRUST-001`, `ASR-GUARD-001`, `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. manifest または chunk metadata から使える構造情報を整理する。
2. document statistics 型を定義する。
3. memory card 生成で section / concept 件数を document statistics に基づき決める。
4. context assembly で coverage / diversity / section metadata を加味する。
5. fixed anchor の役割を fallback に下げる。
6. 長文、table、list、section 多めの文書に対するテストを追加する。
7. 既存 manifest 欠落時の fallback と新 manifest optional field の後方互換テストを追加する。
8. debug trace に context selection reason を残す。
9. docs に manifest / reindex / cost / rollback の影響を記載する。

## 受け入れ条件

- memory card 生成件数が固定 slice だけに依存しない。
- context assembly が section metadata や diversity を selection reason に使う。
- 質問 complexity または profile により context budget を調整できる。
- dynamic budget は default では既存上限を超えず、cost / latency 増加が PR 本文で説明されている。
- 既存 manifest が optional `documentStatistics` を持たなくても ingestion / chat が壊れない。
- context selection reason が trace に残り、raw prompt や過剰な chunk text を通常利用者へ露出しない。
- 既存の回答生成テストが通る。
- debug trace で context selection の理由を確認できる。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/rag/text-processing.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/rag/prompts.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/graph.test.ts`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`
- RAG 品質差分がある場合: `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、optional manifest / trace field と内部 selection 改善なら `patch`、新しい profile option や manifest schema を利用者が選べるなら `minor` を推奨する。
- PR 本文に docs / manifest / reindex 要否、cost / latency 影響、未確認 benchmark、rollback 方針を書く。
- citations が実際の retrieved chunk を指し、diversity 強化で主要根拠を落としていないか確認する。
- document manifest、chunk、memory card、evidence index の整合性と後方互換を確認する。
- debug trace に context selection reason があり、通常利用者へ raw chunk text や ACL metadata を過剰露出しないか確認する。
- table / list / long document / sparse section の regression test があるか確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: diversity は top evidence を置き換える主判定ではなく、tie-breaker / MMR 補助にする。
- 決定事項: v1 の dynamic budget は既存 default の上限を超えない範囲で導入する。
- 決定事項: document statistics は manifest の optional field とし、既存 manifest は runtime fallback で読む。
- リスク: dynamic budget を広げる次段階では embedding cost、latency、search noise を benchmark と cost report で確認する必要がある。
