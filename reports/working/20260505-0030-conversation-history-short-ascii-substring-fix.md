# 作業完了レポート

保存先: `reports/working/20260505-0030-conversation-history-short-ascii-substring-fix.md`

## 1. 受けた指示

- 主な依頼: 会話履歴あいまい検索 PR の追加レビュー指摘 1 件を全量対応する。
- 対象指摘: `PR` / `UI` / `AI` のような短い ASCII 1 語 query が単語内部の raw substring で誤ヒットする。
- 成果物: 修正コード、追加テスト、追加 commit、PR 更新。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 短い ASCII 1 語 query では raw substring / compact substring match を使わない | 高 | 対応 |
| R2 | token 一致または `-` / `_` subtoken 一致は許可する | 高 | 対応 |
| R3 | prefix は 3 文字以上、typo fuzzy は 4 文字以上の制約を維持する | 中 | 対応 |
| R4 | `PR` / `UI` の単語内部誤ヒット回帰テストを追加する | 高 | 対応 |

## 3. 検討・判断したこと

- 短い ASCII 1 語 query は誤ヒットしやすいため、phrase-level `normalizedText.includes()` と compact substring match の対象外にした。
- ASCII term は非 ASCII と処理を分け、field token と `-` / `_` subtoken の一致を優先し、prefix / fuzzy は従来より厳しめの長さ制限を維持した。
- 日本語 n-gram や複数語 ASCII 完全一致の既存挙動には影響しないよう、短い ASCII 単一 primary term の場合だけ分岐した。

## 4. 実施した作業

- `scoreField` に短い ASCII 1 語 query 判定を追加した。
- ASCII term 用の dictionary に field token と `-` / `_` subtoken を含め、raw substring ではなく token/subtoken match で評価するようにした。
- `PR` が `approval`、`UI` が `guide` に当たらない regression test を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/web/src/features/history/utils/conversationHistorySearch.ts` | TypeScript | 短い ASCII 1 語 query の raw substring 誤ヒットを抑制 | 指摘対応 |
| `memorag-bedrock-mvp/apps/web/src/features/history/utils/conversationHistorySearch.test.ts` | Test | `PR` / `UI` の単語内部誤ヒット回帰テスト | 回帰防止 |

## 6. 検証

| コマンド | 結果 | 備考 |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- conversationHistorySearch.test.ts` | pass | 10 tests passed |
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- App.test.tsx` | pass | 36 tests passed |
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass | TypeScript typecheck pass |
| `git diff --check` | pass | whitespace/error marker なし |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | 指摘 1 件を実装修正とテストで対応 |
| 制約遵守 | 5/5 | Phase 1 の UI 側検索境界を維持 |
| 成果物品質 | 5/5 | targeted test、UI 回帰、typecheck を実行 |
| 説明責任 | 5/5 | 修正理由と検証を記録 |
| 検収容易性 | 5/5 | 変更範囲とコマンドを明示 |

総合fit: 5.0 / 5.0（100%）

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: Phase 1 の UI 側検索であるため、検索対象は API 取得済み履歴に限定される。
