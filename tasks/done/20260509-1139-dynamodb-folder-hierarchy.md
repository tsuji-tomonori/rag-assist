# DynamoDB folder hierarchy management

状態: done

## 背景

ファイルアップロード UI がフォルダ階層と共有を扱うようになったが、現状のバックエンドは document group を S3 object store 上の単一 JSON ledger として保存している。S3 はフラットな object store として扱い、フォルダ階層・共有・文書所属は DynamoDB 側で管理できるようにする必要がある。

## 目的

- S3 object key から UI フォルダ階層を推定しない。
- document group / folder の階層・共有情報を DynamoDB backed store で管理する。
- 既存 API 互換性を保ちながら、DynamoDB 未設定の local 開発では local store を使う。

## スコープ

- API 型、store adapter、service、route 周辺の document group 管理。
- CDK table / environment / IAM の追加。
- 関連 API / infra / web test と必要 docs の更新。

## スコープ外

- 大規模な UI 再設計。
- 既存 S3 ledger から本番 DynamoDB への実データ移行実行。
- S3 object key の既存レイアウト変更。

## 実装計画

1. `DocumentGroup` に階層管理用の optional field を追加する。
2. `DocumentGroupStore` interface を追加し、local JSON store と DynamoDB store を実装する。
3. `MemoragService` の document group ledger 操作を store dependency に差し替える。
4. API request schema に `parentGroupId` を追加し、既存 `/document-groups` API 互換を維持する。
5. CDK に document groups table、環境変数、IAM grant、snapshot/test を追加する。
6. docs と generated OpenAPI を更新する。
7. 関連テスト、typecheck、diff check を実行する。

## ドキュメント保守計画

- API schema が変わるため OpenAPI generated docs を更新する。
- 運用上の保存責務が変わるため `memorag-bedrock-mvp/docs/OPERATIONS.md` に S3/DynamoDB の責務分離を追記する。

## 受け入れ条件

- [x] AC1: S3 upload object key はフォルダ階層を表現せず、物理保存先としてのみ利用される。
- [x] AC2: document group / folder の階層・共有情報が DynamoDB backed store で保存・取得・更新できる。
- [x] AC3: local 開発では DynamoDB なしでも document group 管理が動く。
- [x] AC4: document group への書き込み・読み取り・共有更新の既存認可境界を弱めない。
- [x] AC5: API / infra / docs の関連テストと typecheck が pass する、または未実施理由が明記される。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- document-groups`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- contract/api-contract.test.ts security/access-control-policy.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- DynamoDB table key 設計が階層 lookup と groupId lookup に十分か。
- S3 object key に UI 階層・共有の意味を持ち込んでいないか。
- 共有・manager・SYSTEM_ADMIN の既存判定を弱めていないか。
- local store と DynamoDB store の挙動差がないか。

## リスク

- 既存本番環境に `document-groups/groups.json` がある場合、別途 migration が必要。
- 既存 UI は `groupId` 名称のままなので、API 互換を優先して内部的に folder semantics を持たせる。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/225
- 受け入れ条件コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。

## 実行した検証

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
