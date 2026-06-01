# ParentFolderIndex による folder tree query

状態: todo
タスク種別: 機能追加

## 背景

PR #321 では必須の `AdminCanonicalPathIndex` を追加し、`ParentFolderIndex` は current API / UI が parent query を使わないためスコープ外にした。大規模 folder tree で全 group を取得して client 側で tree 化する方式は、件数増加時に重くなる。

## 目的

DynamoDB に `ParentFolderIndex` を追加し、指定 parent 配下の direct child folder を効率よく取得できる API / store / UI query へ移行する。

## 対象範囲

- `infra/lib/memorag-mvp-stack.ts`
- DynamoDB DocumentGroupsTable GSI
- `DocumentGroupStore`
- Local / DynamoDB stores
- folder listing API
- Web folder tree lazy loading または paginated loading
- infra snapshot / API / Web tests

## 含まない

- `AdminCanonicalPathIndex` の置き換え。
- folder search 全体の全文検索化。

## 昇華メタ情報

- 優先度: P2。大規模 folder tree の UX / query scale task。
- 依存関係: `parentPathPk` backfill、folder tree lazy loading 方針、GSI deploy plan。
- 推奨 PR 分割:
  - PR 1: CDK GSI と store query。
  - PR 2: API pagination / child listing endpoint。
  - PR 3: Web lazy loading / search state。
- 成功指標: direct children を parent key で query し、全 group load を避けられる。

## 実装設計メモ

- GSI key は root parent 表現を `ROOT` に統一し、PR #321 の `parentPathPk` と合わせる。
- sort key は `normalizedName#groupId` にして同名衝突と安定 order を両立する。
- UI lazy loading では selected folder path の ancestors を展開できる必要がある。
- folder search が全 tree を必要とする場合、search API との役割分担を決める。

## 追加確認観点

- move / rename 後に ParentFolderIndex key が stale にならない。
- root children と nested children の query が同じ response shape を返す。
- GSI backfill 中の rollout 手順が PR に明記される。

## 未確定点

- API を existing list endpoint に pagination 追加するか、children endpoint を新設するか。

## 実行計画

1. `parentPathPk = tenantId#adminPrincipalType#adminPrincipalId#parentGroupId` の key 設計を再確認する。
2. root parent 表現を `ROOT` などに統一する。
3. CDK に `ParentFolderIndex` を追加する。
4. store に `listChildrenByParent` を追加する。
5. API / UI が direct children を取得できるようにする。
6. 既存全件 list UI から lazy loading または paginated loading へ移行する。
7. infra snapshot と tests を更新する。

## ドキュメント保守計画

- infra inventory / snapshot を更新する。
- API schema が変わる場合は OpenAPI docs を更新する。
- UI 操作が変わる場合は Web inventory を更新する。

## 受け入れ条件

- DynamoDB table に `ParentFolderIndex` が追加される。
- root と non-root の child folder を parent key で query できる。
- child folder の sort key が `normalizedName#groupId` など安定順を持つ。
- folder tree UI が必要以上に全 group を取得しない。
- create / rename / move 時に `parentPathPk` と index sort key が整合する。
- 既存 folder tree 表示と canonical path 表示が退行しない。

## 検証計画

- `npm test -w @memorag-mvp/infra`
- `task cdk:test`
- `npm run test -w @memorag-mvp/api -- document-group`
- `npm run test -w @memorag-mvp/web -- DocumentFolderTree DocumentWorkspace`
- `npm run docs:infra-inventory:check`
- `git diff --check`

## PR レビュー観点

- GSI 追加に伴う deploy / backfill 影響が PR 本文に明記されていること。
- parent move / rename で index key が stale にならないこと。
- UI lazy loading が selection / search / upload destination を壊さないこと。

## リスク

- GSI 追加は deploy 時に DynamoDB backfill が走るため、大規模 table では rollout 計画が必要。
