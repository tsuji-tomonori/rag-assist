# 作業完了レポート

保存先: `reports/working/20260520-2113-pr329-runtime-layout-review-fix.md`

## 1. 受けた指示

- PR #329 の再レビュー結果に基づき、Request changes の blocking 指摘を修正する。
- `MemoRagService` が旧 flat shim 経由で RAG 実装を使い続けないようにする。
- production tree の `export {}` だけの空 module を削除する。
- `packages/contract/src/rag` の placeholder contract を package root から公開しない、または本物の contract にする。
- web / benchmark 側の placeholder は今回 scope から外すか本実装にする。
- 指定された API / contract / web inventory / benchmark 検証を実行し、未実施を実施済みとして書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `MemoRagService.ingest()` を offline ingest service へ委譲する | 高 | 対応 |
| R2 | root `rag/*.ts` の実装を新 layout へ移し shim 化する | 高 | 対応 |
| R3 | production code が旧 shim path を import しないことをテストで固定する | 高 | 対応 |
| R4 | `export {}` だけの production module を削除しテストで固定する | 高 | 対応 |
| R5 | RAG contract placeholder を package root API として公開しない | 高 | 対応 |
| R6 | web / benchmark placeholder を今回の PR scope から外す | 中 | 対応 |
| R7 | 指定検証を実行し、結果を正直に記録する | 高 | 対応 |

## 3. 検討・判断したこと

- contract は今回の API runtime layout 移設 PR で本物の API 契約まで設計すると scope が広がるため、package root export を外して公開 API から除外した。
- web / benchmark の placeholder は本実装にせず、今回の PR から削除して review 観点を API 実装移設に絞った。
- `MemoRagService` は文書管理・reindex・benchmark・admin などの facade として残し、ingest pipeline 本体だけを `offline/pre-retrieval/ingestion/ingest-run.service.ts` へ移した。
- 旧 root files は互換のため re-export shim として残したが、production code からの import は新 layout へ差し替えた。

## 4. 実施した作業

- `MemoRagService.ingest()` の extraction、chunking、embedding、vector put、manifest 作成を `ingest-run.service.ts` へ移設。
- `prompts.ts`、`context-assembler.ts`、`profiles.ts`、`json.ts` の実装を新 layout へ移設し、root は shim 化。
- `buildMemoryCardPrompt` を `offline/generation/prompt-assets/memory-card-prompt.ts` へ分離。
- `apps/api/src/rag/**` の `export {}` だけの空 module を削除。
- `runtime-layout.test.ts` に旧 shim import 禁止、root shim、ingest delegation、empty placeholder 禁止のテストを追加。
- `packages/contract/src/index.ts` から RAG contract root export を削除し、contract package に test script と公開抑止テストを追加。
- `apps/web/src/features/rag/**` と `benchmark/src/rag/**` の placeholder を削除し、web inventory を再生成。
- `apps/api/src/rag/README.md` を、実装が残る実在 module に合わせて更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts` | TypeScript | offline ingestion pipeline 実装 | R1 |
| `apps/api/src/rag/online/generation/prompt/grounded-prompt-builder.ts` | TypeScript | final answer / judge prompt 実装 | R2 |
| `apps/api/src/rag/online/post-retrieval/context-packing/context-packer.ts` | TypeScript | context assembly 実装 | R2 |
| `apps/api/src/rag/_shared/policies/answer-policy.ts` | TypeScript | retrieval / answer policy 実装 | R2 |
| `apps/api/src/rag/_shared/json.ts` | TypeScript | JSON utility 実装 | R2 |
| `apps/api/src/rag/__tests__/runtime-layout.test.ts` | Test | shim / placeholder / delegation regression tests | R3, R4 |
| `packages/contract/src/rag-contract-public-export.test.ts` | Test | RAG placeholder contract の root export 抑止テスト | R5 |
| `docs/generated/web-*.md`, `docs/generated/web-ui-inventory.json` | Generated docs | web placeholder 削除後の inventory | R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | blocking 指摘 1-3 と推奨指摘 4 の scope 整理を実施した |
| 制約遵守 | 5 | 未実施の検証を pass 扱いしていない |
| 成果物品質 | 4 | contract 本実装は後続 scope とし、root export 抑止で安全側に寄せた |
| 説明責任 | 5 | scope 外判断、検証結果、残リスクを明記した |
| 検収容易性 | 5 | 単体テストと generated docs check で確認可能にした |

総合fit: 4.8 / 5.0（約96%）
理由: 指摘された blocking は満たした。contract は本物化ではなく公開抑止を選んだため、後続 PR で contract 設計を行う余地が残る。

## 7. 実行した検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/__tests__/runtime-layout.test.ts`: fail -> root shim regex 修正後 pass
- `npm test -w @memorag-mvp/api`: fail -> runtime-layout test 修正後 pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm test -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` で更新後 pass
- `npm test -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- RAG contract は今回本物化せず、package root export を外して公開 API から除外した。後続 PR で `schemas/chat.ts` と整合する本物の RAG contract を設計する余地がある。
- 削除した web / benchmark placeholder は、必要になった時点で実装とテスト付きで追加する。
- `MemoRagService` には reindex や document lifecycle の facade 実装が残る。今回の目的は ingest pipeline の委譲であり、service 全体の分割は scope 外。
