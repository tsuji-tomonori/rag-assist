# 作業完了レポート

保存先: `reports/working/20260502-1103-history-schema-version-docs.md`

## 1. 受けた指示

- 主な依頼: 会話履歴 DB 永続化に対して、設計書もメンテする。
- 主な依頼: 会話履歴 item にバージョンを付与し、将来スキーマ変更時に区別できるようにする。
- 主な依頼: API/App 側と Web 側で適切なテストを追加する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 会話履歴 item に schema version を持たせる | 高 | 対応 |
| R2 | API/ストアで version 未指定 item を扱えるようにする | 高 | 対応 |
| R3 | Web の保存 payload に version を含める | 高 | 対応 |
| R4 | 設計書へ API・データ・高レベル設計を反映する | 高 | 対応 |
| R5 | API/Web テストを追加・更新する | 高 | 対応 |

## 3. 検討・判断したこと

- 「項目」は会話履歴 item を指すものとして解釈し、`schemaVersion` を item 直下に追加した。
- 現行スキーマは `schemaVersion: 1` とし、API の request schema では未指定時に v1 を補完する設計にした。
- 既存保存済み item への読み取り互換性を考慮し、ローカル/DynamoDB store の返却時にも未指定 version を v1 として正規化する。
- 設計書は `memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md` と SWEBOK-lite の配置に合わせ、既存の DES_HLD/DES_DATA/DES_API を更新した。

## 4. 実施した作業

- `ConversationHistoryItem` に `schemaVersion: 1` を追加。
- `ConversationHistoryStore` の保存 input は version 未指定も許容し、store 側で v1 を補完。
- Web の履歴保存 payload に `schemaVersion: 1` を追加。
- API contract/local store/Web API/Web UI テストで schema version と履歴保存/削除 API 呼び出しを検証。
- `DES_HLD_001.md`、`DES_DATA_001.md`、`DES_API_001.md` を更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/types.ts` | TypeScript | 会話履歴 schema version 定義 | R1 |
| `memorag-bedrock-mvp/apps/api/src/adapters/*conversation-history-store.ts` | TypeScript | version 補完・正規化 | R2 |
| `memorag-bedrock-mvp/apps/web/src/App.tsx` | TypeScript/React | version 付き履歴 payload | R3 |
| `memorag-bedrock-mvp/docs/3_設計_DES/...` | Markdown | 設計書更新 | R4 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | Test | API contract 上の version 検証 | R5 |
| `memorag-bedrock-mvp/apps/web/src/App.test.tsx` | Test | Web UI からの version 付き保存・削除検証 | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 設計書、version、API/Web テストをすべて更新した |
| 制約遵守 | 5 | docs 更新方針と作業レポートルールに従った |
| 成果物品質 | 4 | v1 正規化は実装したが、将来 version 変換ロジック自体は未実装 |
| 説明責任 | 5 | 設計書とレポートに version 方針を記録した |
| 検収容易性 | 5 | CI と個別テストで確認可能 |

総合fit: 4.8 / 5.0（約96%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test`
- `npm --prefix memorag-bedrock-mvp/apps/web test`
- `npm run ci`（`memorag-bedrock-mvp`）
- `git diff --check`

## 8. 未対応・制約・リスク

- `task docs:check:changed` はこの Taskfile に存在しなかったため、代替として `git diff --check` と full CI を実行した。
- 将来 `schemaVersion` を 2 以上に上げる場合は、version ごとの migration または read-time transform を追加する必要がある。
