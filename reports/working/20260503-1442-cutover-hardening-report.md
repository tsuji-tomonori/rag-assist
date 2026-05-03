# 作業完了レポート

保存先: `reports/working/20260503-1442-cutover-hardening-report.md`

## 1. 受けた指示

- 追加課題として、blue-green cutover の失敗時整合性を本番運用向けに強化する。
- 前回 blocker 解消後の PR に対して、残る非ブロッカー懸念へ対応する。
- 実装、検証、commit、push、PR 更新まで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | staged vector の active 化が途中失敗しても検索露出しない | 高 | 対応 |
| R2 | cutover 失敗時に staged vectors / manifests を staging / active へ復元する | 高 | 対応 |
| R3 | retrieval 後に vector metadata だけでなく manifest lifecycle も確認する | 高 | 対応 |
| R4 | memory card を cutover 時に再生成せず、ingest 時 ledger を再利用する | 中 | 対応 |
| R5 | 実装に合わせて schema / docs / tests を更新する | 中 | 対応 |
| R6 | 関連検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 中間 lifecycle を追加すると既存 schema / UI / migration の影響が広がるため、今回は manifest lifecycle guard と best-effort rollback cleanup を組み合わせた。
- vector metadata の `active` だけでは検索可否を決めず、検索後に `manifests/{documentId}.json` を読み、manifest が active かつ user が access 可能な場合だけ採用する方針にした。
- cutover は staged vectors active re-put、staged manifest active、source manifest superseded の順で進め、途中失敗時は staged を staging、source を active に戻す。
- source vectors の削除は manifest lifecycle guard により安全性が担保されるため、cutover 成否を左右しない best-effort cleanup にした。
- memory card は `memoryCardsObjectKey` に ledger として保存し、cutover re-put 時は ledger を優先して使う。legacy manifest では従来どおり再生成 fallback する。

## 4. 実施した作業

- `DocumentManifest` / OpenAPI schema に `memoryCardsObjectKey` を追加した。
- ingest 時に memory card ledger を `documents/{documentId}/memory-cards.json` へ保存するようにした。
- cutover re-put 時に `memoryCardsObjectKey` から memory card を読み、再生成を避けるようにした。
- `cutoverReindexMigration()` に失敗時復元処理を追加し、partial active put 後の staged vectors を staging に戻すようにした。
- semantic retrieval と memory retrieval に manifest lifecycle / manifest ACL guard を追加した。
- partial active put failure の回帰テスト、memory guard の unit test、schema/docs 更新を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | cutover cleanup、memory card ledger 保存/再利用 | R1, R2, R4 |
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts` | TypeScript | semantic retrieval の manifest lifecycle guard | R1, R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieve-memory.ts` | TypeScript | memory retrieval の manifest lifecycle guard | R1, R3 |
| `memorag-bedrock-mvp/apps/api/src/types.ts` / `schemas.ts` | TypeScript | `memoryCardsObjectKey` schema 追加 | R4, R5 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts` | Test | cutover partial failure 復元テスト | R1, R2 |
| `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` | Markdown | memory card ledger の設計説明 | R5 |

## 6. 検証

| コマンド | 結果 | 補足 |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/api run typecheck` | pass | API typecheck |
| `npm --prefix memorag-bedrock-mvp/apps/api test` | pass | 72 tests |
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass | Web typecheck |
| `npm --prefix memorag-bedrock-mvp/apps/web run test` | pass | 52 tests |
| `git diff --check` | pass | whitespace / conflict marker 形式確認 |
| `task memorag:verify` | pass | lint、workspace typecheck、workspace build |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 追加課題の cutover 失敗時整合性へ直接対応した |
| 制約遵守 | 5 | 既存 lifecycle enum を増やさず、既存 API と互換にした |
| 成果物品質 | 4 | ローカル検証は通過。実 S3 Vectors の partial put 障害注入は未検証 |
| 説明責任 | 5 | 判断、変更、検証、制約を明記した |
| 検収容易性 | 5 | 失敗時復元テストと manifest guard をコード上で確認できる |

総合fit: 4.8 / 5.0（約96%）

理由: 追加課題に対して実装・テスト・docs を更新した。実 AWS S3 Vectors での障害注入は未実施のため満点ではない。

## 8. 未対応・制約・リスク

- 実 AWS S3 Vectors での partial put / delete failure の障害注入確認は未実施。
- manifest lifecycle guard は retrieval 時に manifest read を追加するため、hit 数が多い場合は cache 前提でも S3 read が増える。必要なら manifest summary cache や lifecycle index を追加する余地がある。
