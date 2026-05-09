# 作業完了レポート

保存先: `reports/working/20260509-1152-dynamodb-folder-hierarchy.md`

## 1. 受けた指示

- 主な依頼: ファイルアップロードのフォルダ階層化に対して、S3 はフラットな物理保存先として扱い、DynamoDB 側でフォルダ階層・共有を管理できるようにする。
- 条件: `/plan` 後の `go` により実装・検証・PR まで進める。
- リポジトリ条件: worktree task PR flow、受け入れ条件、検証、作業レポート、PR コメントを実施する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | S3 object key に UI フォルダ階層を持たせない | 高 | 対応 |
| R2 | document group / folder 階層と共有を DynamoDB backed store で管理する | 高 | 対応 |
| R3 | local 開発では DynamoDB なしで動作する | 高 | 対応 |
| R4 | 共有・検索・一覧の認可境界を弱めない | 高 | 対応 |
| R5 | 関連 docs / OpenAPI / infra snapshot を更新する | 中 | 対応 |

## 3. 検討・判断したこと

- 既存 API 名は `/document-groups` と `groupId` のまま維持し、互換性を優先した。
- S3 は upload/source/manifest の object store として継続し、`document-groups/groups.json` 直読みは廃止した。
- DynamoDB store と local JSON store を同じ `DocumentGroupStore` interface に揃えた。
- フォルダ移動時は移動対象だけでなく子孫の `ancestorGroupIds` も再計算するようにした。
- OpenAPI 生成で、既存生成物に残っていた benchmark metrics の未反映差分も同時に更新された。生成コマンドの出力として保持する判断にした。

## 4. 実施した作業

- `DocumentGroup` に `parentGroupId` と `ancestorGroupIds` を追加した。
- `DocumentGroupStore`、`LocalDocumentGroupStore`、`DynamoDbDocumentGroupStore` を追加した。
- `MemoRagService`、hybrid search、memory retrieval の document group 読み取りを `documentGroupStore` に差し替えた。
- CDK に `DocumentGroupsTable`、Lambda 環境変数、IAM grant、snapshot/assertion を追加した。
- Web API 型、OpenAPI generated docs、`OPERATIONS.md` を更新した。
- 階層保存、S3 ledger 非使用、子孫 ancestry 更新の回帰テストを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/adapters/*document-group-store.ts` | TypeScript | local / DynamoDB の document group store | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | group 階層・共有管理を store 化 | R1, R2, R4 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript/CDK | `DocumentGroupsTable` と権限追加 | R2 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | S3 と DynamoDB の責務分離を追記 | R5 |
| `tasks/do/20260509-1139-dynamodb-folder-hierarchy.md` | Markdown | 受け入れ条件と作業計画 | workflow |

## 6. 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- memorag-service.test.ts`: pass（API script の glob により 171 tests 実行）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4 | S3 フラット運用と DynamoDB backed folder/share 管理に対応した。 |
| 制約遵守 | 5 | worktree、task md、検証、docs 更新、作業レポートを実施した。 |
| 成果物品質 | 4 | API 互換を保ちつつ store 化した。既存本番 ledger からの移行実行は別途必要。 |
| 説明責任 | 5 | 検証結果と残リスクを明記した。 |
| 検収容易性 | 5 | 受け入れ条件、テスト、PR コメントで確認可能にした。 |

総合fit: 4.6 / 5.0（約92%）

## 8. 未対応・制約・リスク

- 既存本番環境の `document-groups/groups.json` から `DocumentGroupsTable` への実データ migration 実行は未対応。
- DynamoDB `list()` は現時点で scan 実装。group 数が増える場合は owner/parent/tenant GSI を追加する余地がある。
- PR 作成後の GitHub Actions 結果は、PR 作成時点で別途確認する。
