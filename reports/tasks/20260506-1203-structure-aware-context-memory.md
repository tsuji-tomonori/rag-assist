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

## 必要情報

- 前提タスク:
  - `reports/tasks/20260506-1203-rag-policy-profile.md`
  - `reports/tasks/20260506-1203-structured-fact-planning.md`
- 固定値の例:
  - `memorag-service.ts` の section cards `12`、concept terms `8`
  - `context-assembler.ts` の token budget `3000`、snippet max `1800`

## 実行計画

1. manifest または chunk metadata から使える構造情報を整理する。
2. document statistics 型を定義する。
3. memory card 生成で section / concept 件数を document statistics に基づき決める。
4. context assembly で coverage / diversity / section metadata を加味する。
5. fixed anchor の役割を fallback に下げる。
6. 長文、table、list、section 多めの文書に対するテストを追加する。
7. debug trace に context selection reason を残す。

## 受け入れ条件

- memory card 生成件数が固定 slice だけに依存しない。
- context assembly が section metadata や diversity を selection reason に使う。
- 質問 complexity または profile により context budget を調整できる。
- 既存の回答生成テストが通る。
- debug trace で context selection の理由を確認できる。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/rag/text-processing.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/rag/prompts.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts`
- `git diff --check`

## 未決事項・リスク

- context diversity を強めると、top score の根拠を落とす可能性がある。
- memory card 数を増やすと embedding cost と検索 noise が増える。
- document statistics の保存場所を manifest にする場合、既存 manifest との後方互換が必要。
