# 作業完了レポート

保存先: `reports/working/20260501-0136-failure-tests-external-deps.md`

## 1. 受けた指示

- `apps/api/src/adapters` と `apps/api/src/rag/memorag-service.ts` を対象に、外部依存の例外を注入する失敗系テストを追加する。
- Bedrock generate/embed タイムアウト、S3 put/get 失敗、Vector query 失敗、JSON parse 不能レスポンスを対象例として扱う。
- 期待結果として、HTTPステータス・ユーザー向けメッセージ・debug trace の `status/error detail` を明示検証する。
- `MockBedrockTextModel` と store モックに再利用可能な失敗モードを追加する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | MockBedrockTextModel に失敗注入モード追加 | 高 | 対応 |
| R2 | store モックに失敗注入モード追加 | 高 | 対応 |
| R3 | 失敗系テスト追加（Bedrock/Vector/S3/JSON） | 高 | 対応 |
| R4 | debug trace の status/detail 検証 | 高 | 対応 |
| R5 | HTTPステータス検証 | 中 | 一部未対応（既存構造制約） |

## 3. 検討・判断したこと

- 既存構成では `app.ts` が依存注入を外部公開しておらず、HTTP レイヤー単体で失敗注入しづらいため、`MemoRagService` と LangGraph 失敗時挙動（ユーザー向けメッセージと debug trace）を優先検証した。
- 失敗注入の再利用性を高めるため、`MockBedrockTextModel` は constructor オプションで embed/generate/invalid-json を切替可能にした。
- store 側は `createService` ヘルパー経由で objectStore.getText と evidenceVectorStore.query に失敗を注入可能にした。

## 4. 実施した作業

- `MockBedrockTextModel` に fail モード（embed/generate/invalidJsonOnGenerate）を追加。
- `memorag-service.test.ts` に以下の失敗系テストを追加。
  - chat 時の Bedrock embed timeout + vector query 失敗 + debug run 読み出し時の S3 get 失敗。
  - ingest 時の JSON parse 不能レスポンスのフォールバック確認。
  - ingest 時の Bedrock generate timeout の例外伝播確認。
- `createService` ヘルパーを拡張し、textModel 差し替え・vector query 失敗・objectStore get 失敗を注入可能にした。
- 追加テストを含めて API テスト群を実行し、成功を確認。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript | Bedrock モックに失敗注入モード追加 | R1 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts` | TypeScript | 失敗系テスト追加と store モック拡張 | R2, R3, R4 |
| `reports/working/20260501-0136-failure-tests-external-deps.md` | Markdown | 作業完了レポート | レポート要件 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4/5 | 失敗系テストと失敗注入モードは追加したが、HTTPステータスの直接検証は未実装 |
| 制約遵守 | 5/5 | 指定範囲中心に変更し、既存構造を踏まえて実装 |
| 成果物品質 | 4.5/5 | 再利用可能な失敗注入ヘルパー化と debug trace 検証を実施 |
| 説明責任 | 5/5 | 未対応点（HTTP レイヤー）を明示 |
| 検収容易性 | 5/5 | 変更点とテストが明確 |

**総合fit: 4.7 / 5.0（約94%）**

## 7. 未対応・制約・リスク

- 未対応: HTTP ステータスの直接検証（app 依存注入の公開が必要）。
- 制約: 既存 `app.ts` は内部で依存を固定生成しており、テストで failure injection しにくい。
- リスク: 将来 HTTP レイヤーでエラー変換仕様を追加した場合、現状テストだけでは回帰を検知できない。

## 8. 次に改善できること

- `createApp(deps)` を公開して API ルートの失敗注入テストを追加し、HTTP status/message を直接検証する。
