# 作業完了レポート

保存先: `reports/working/20260504-1408-conversation-history-review-fixes.md`

## 1. 受けた指示

- 主な依頼: 会話履歴あいまい検索 PR のレビュー指摘 3 件を全量対応する。
- 対象指摘: unmatched favorite の検索結果混入、`retrieved.fileName` の検索対象混入、FR-030 の要求索引未登録。
- 成果物: 修正コード、追加テスト、docs 索引更新、追加 commit、PR 更新。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 検索語に一致しないお気に入り履歴を結果に出さない | 高 | 対応 |
| R2 | favorite は score 加点ではなく同点時 tie-break に限定する | 高 | 対応 |
| R3 | `retrieved` の fileName を検索対象から外す | 中 | 対応 |
| R4 | FR-030 を要求索引とトレーサビリティに登録する | 中 | 対応 |
| R5 | 追加テストと既存 UI 回帰を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `item.isFavorite` の無条件 score 加点を削除し、field match が 0 または弱 n-gram 除外後に 0 となった item は結果採用前に `score: 0` で返すようにした。
- favorite の優先は既存 comparator の tie-break に残し、`AC-FR030-007` の「同程度のスコアではお気に入り」を満たす形にした。
- `retrieved.fileName` を検索対象から外したうえで、複数 ASCII term のうち拡張子のような短い token だけが citation fileName に当たる過剰ヒットも抑制した。
- docs は `README.md`、`docs/REQUIREMENTS.md`、`REQ_CHANGE_001.md` を更新し、FR-030 の L1/L2/L3 分類を追跡できるようにした。

## 4. 実施した作業

- `searchConversationHistory` の scoring を修正し、unmatched favorite が検索結果に復活しないようにした。
- `citationFileNames` を `result.citations` の fileName のみに限定した。
- unmatched favorite と `retrieved.pdf` 除外の regression test を追加した。
- 機能要求分類索引、要求一覧、変更管理トレーサビリティへ FR-030 を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/web/src/features/history/utils/conversationHistorySearch.ts` | TypeScript | favorite score 削除、retrieved fileName 除外、短い ASCII token の過剰一致抑制 | 指摘 1, 2 に対応 |
| `memorag-bedrock-mvp/apps/web/src/features/history/utils/conversationHistorySearch.test.ts` | Test | unmatched favorite と retrieved fileName 除外のテスト追加 | 指摘 1, 2 の回帰防止 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` | Markdown | FR-030 を 5.3 会話履歴検索として登録 | 指摘 3 に対応 |
| `memorag-bedrock-mvp/docs/REQUIREMENTS.md` | Markdown | L1 主カテゴリ、ファイル一覧、要求トレーサビリティに FR-030 を追加 | 指摘 3 に対応 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md` | Markdown | 機能分類トレーサビリティに FR-030 を追加 | 指摘 3 に対応 |

## 6. 検証

| コマンド | 結果 | 備考 |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- conversationHistorySearch.test.ts` | pass | 8 tests passed |
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- App.test.tsx` | pass | 36 tests passed |
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass | TypeScript typecheck pass |
| `git diff --check` | pass | whitespace/error marker なし |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | レビュー指摘 3 件すべてに対応 |
| 制約遵守 | 5/5 | API/DB/semantic search は追加せず Phase 1 境界を維持 |
| 成果物品質 | 5/5 | 指摘ごとの回帰テストと UI 回帰を実行 |
| 説明責任 | 5/5 | docs と本レポートに変更範囲と検証を記録 |
| 検収容易性 | 5/5 | 対応内容、成果物、コマンドを指摘単位で整理 |

総合fit: 5.0 / 5.0（100%）

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: `task docs:check:changed` はこの repository の Taskfile に存在しないため、docs 検証は `git diff --check` と pre-commit で代替する。
- リスク: Phase 1 の UI 側検索であるため、API が返す最大 20 件を超える全履歴検索は引き続き Phase 2 の対象。
