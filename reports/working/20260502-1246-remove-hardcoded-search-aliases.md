# 作業完了レポート

保存先: `reports/working/20260502-1246-remove-hardcoded-search-aliases.md`

## 1. 受けた指示

- 検索 API 実装内の具体的な alias 固定値を妥当な内容に修正する。
- 実コードに業務語彙や製品名を hard-code しない形にする。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | hard-coded alias を削除する | 高 | 対応 |
| R2 | alias expansion の仕組み自体は維持する | 中 | 対応 |
| R3 | テストを修正して固定値混入を防ぐ | 高 | 対応 |
| R4 | 設計書へ方針を明記する | 中 | 対応 |

## 3. 検討・判断したこと

- 実装内の具体 alias は tenant や運用ごとに変わるため、検索基盤のデフォルト値として不適切と判断した。
- alias expansion は有用な機能なので削除せず、index-local な alias map を渡された場合だけ使う形にした。
- manifest metadata の `searchAliases` または `aliases` から alias map を取り込めるようにし、default は空にした。
- テストでは caller-provided alias map がある場合だけ expansion されることを確認した。

## 4. 実施した作業

- `hybrid-search.ts` から具体的な alias 定数を削除した。
- `LexicalIndex` に `aliases` を追加し、`buildLexicalIndex` の任意引数として alias map を受けるようにした。
- `getLexicalIndex` で manifest metadata 由来の alias map を merge するようにした。
- `hybrid-search.test.ts` に alias default empty と caller-provided alias の検証を追加した。
- `DES_DLD_002.md` に hard-code 禁止と metadata 由来 alias の方針を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts` | TypeScript | hard-coded alias 削除と metadata/index 由来 alias 対応 | R1, R2 |
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.test.ts` | TypeScript | alias が明示供給時だけ動くテスト | R3 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_002.md` | Markdown | alias hard-code 禁止方針 | R4 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5.0 / 5 | 指摘された固定値を削除し、設計とテストも修正した。 |
| 制約遵守 | 4.5 / 5 | 既存機能を壊さず、metadata/index 由来に限定した。 |
| 成果物品質 | 4.5 / 5 | default empty と明示 alias の両方をテストした。 |
| 説明責任 | 4.5 / 5 | なぜ hard-code しないかを設計書に明記した。 |
| 検収容易性 | 4.5 / 5 | 差分は検索実装、テスト、設計書に限定した。 |

総合fit: 4.6 / 5.0（約92%）

理由: 固定値削除と代替設計は完了した。実運用で alias 辞書をどの ingestion/batch から生成するかは次段階の設計対象として残る。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/search/hybrid-search.test.ts`
- `npm --prefix memorag-bedrock-mvp run lint`
- `npm --prefix memorag-bedrock-mvp/apps/api run build`
- `git diff --check`

## 8. 未対応・制約・リスク

- alias 辞書の管理 API、S3 object、batch 生成処理は未実装。
- manifest metadata の `searchAliases` / `aliases` は暫定の取り込み口であり、永続 lexical index 化時に正式 schema を定義する必要がある。
