# 意味単位チャンク化

## 背景

現状のチャンク化は structured block と page break を扱う一方で、長い text block 内は主に文字数、段落境界、文末記号で分割している。overlap も文字数ベースのため、チャンクの開始位置が文や箇条書きの途中になる場合がある。

## 目的

RAG の根拠 chunk が意味的に読みやすい単位になるよう、見出し、段落、箇条書き、文、表、コード、図表などの境界を優先してチャンク化する。

## Scope

- `memorag-bedrock-mvp/apps/api/src/rag/chunk.ts` のチャンク分割ロジック
- チャンク化に関する API unit test
- chunker version
- README のチャンク化方針説明

## Out of Scope

- embedding model / dimensions の変更
- 検索 ranking や回答生成 prompt の変更
- 既存 index の自動 reindex migration
- API route / 認証認可の変更

## Plan

1. text を semantic unit に分解する内部処理を追加する。
2. semantic unit を `chunkSize` 以内に pack して chunk を作る。
3. overlap を文や箇条書きの途中から始めない unit-based overlap にする。
4. table / code / figure などの structured block は atomic chunk を維持する。
5. 長すぎる意味単位のみ fallback split する。
6. `CHUNKER_VERSION` と README を更新する。
7. targeted test と typecheck を実行する。

## Documentation Maintenance Plan

- `memorag-bedrock-mvp/README.md` の注意点に、意味単位優先チャンク化と巨大単位 fallback の方針を追記する。
- API route や環境変数は変更しないため、API examples / operations docs は更新不要と判断する。

## 受け入れ条件

- [ ] AC1: チャンク化が段落、文、箇条書きなどの意味境界を優先する。
- [ ] AC2: overlap が文や箇条書きの途中から始まらない。
- [ ] AC3: PDF page break segment をまたいで chunk が結合されない。
- [ ] AC4: table / code / figure block は原則 atomic chunk として保持される。
- [ ] AC5: 長すぎる意味単位は `chunkSize` に収まるよう fallback split される。
- [ ] AC6: `CHUNKER_VERSION` が更新され、再 index 対象を識別できる。
- [ ] AC7: 変更に見合う API test と typecheck が通る。
- [ ] AC8: README にチャンク化方針の変更が反映される。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`

## PR Review Points

- 意味単位分割が benchmark 固有値や dataset 固有分岐に依存していないこと。
- chunk metadata、manifest、vector metadata の互換性を壊していないこと。
- docs と実装が同期していること。
- 認証認可境界に影響がないこと。

## Risks

- チャンク境界の変更により既存 index とは chunk hash / id / vector が変わるため、既存文書には reindex が必要になる。
- 文字数ベースより chunk 数が増える文書があり、embedding コストや検索候補数に影響する可能性がある。

## 状態

in_progress
