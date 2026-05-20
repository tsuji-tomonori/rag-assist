# 作業完了レポート

保存先: `reports/working/20260521-0125-legacy-explicit-child-boundary.md`

## 1. 受けた指示

- 主な依頼: PR 327 再レビューの should fix として、`FolderPolicy` 親 + legacy explicit private child の検索漏洩リスクを修正する。
- 成果物: `FolderPermissionService` の explicit boundary 修正、単体テスト、検索経路回帰テスト、PR コメント。
- 条件: 前回の `folderId/folderIds` scope 正規化を維持し、未実施検証を実施済み扱いしない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `hasExplicitPolicy: true` / `policyId` なし child が親 `FolderPolicy` を継承しない | 高 | 対応 |
| R2 | `hasExplicitPolicy: false` / `policyId` なし child も legacy explicit boundary として親を継承しない | 高 | 対応 |
| R3 | `searchRag` で legacy explicit private child 文書が reader に返らない | 高 | 対応 |
| R4 | 既存の親共有継承と `folderId/folderIds` scope 正規化を維持する | 高 | 対応 |
| R5 | 対象 API test、typecheck、diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `document-group-permissions.ts` の意味論に合わせ、`hasExplicitPolicy !== undefined || policyId` を explicit boundary として扱うのが妥当と判断した。
- `policyId` がない explicit marker は親 policy へ進ませず、既存の `legacyDefaultPolicy(folder)` 評価に落とすことで legacy private child の遮断を維持した。
- `hasExplicitPolicy === undefined && !policyId` の子だけ親の effective permission を継承する既存期待は維持した。
- 外部 API や UI 仕様の追加変更ではなく AC-FOLDER-008 の既存期待への修正なので、README / docs 更新は不要と判断した。

## 4. 実施した作業

- `FolderPermissionService.resolvePolicyContext` で、`hasExplicitPolicy` 定義済みまたは `policyId` ありを explicit boundary として扱うよう修正した。
- `hasExplicitPolicy: true` / `policyId` なし child が parent `FolderPolicy` を継承しない単体テストを追加した。
- `hasExplicitPolicy: false` / `policyId` なし child も legacy explicit boundary として扱う単体テストを追加した。
- `searchRag` で legacy explicit private child の文書が parent policy reader に返らない回帰テストを追加した。
- 最新 `origin/main` 取り込みで `apps/api/src/search/hybrid-search.ts` が再エクスポートへ変わったため、検索認可修正を実体の `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts` へ移植して競合を解消した。
- 対象 API test、API typecheck、`git diff --check` を実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/folders/folder-permission-service.ts` | TypeScript | explicit boundary 判定修正 | R1-R2 |
| `apps/api/src/folders/folder-permission-service.test.ts` | TypeScript test | `hasExplicitPolicy: true/false` の parent policy 継承遮断テスト | R1-R2 |
| `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts` | TypeScript | 移動後の hybrid search 実装で `FolderPermissionService` と `folderScopeIds` を使う検索認可へ更新 | R3-R4 |
| `apps/api/src/search/hybrid-search.test.ts` | TypeScript test | 検索経路の legacy explicit private child 漏洩防止テスト | R3-R4 |
| `tasks/do/20260521-0123-legacy-explicit-child-boundary.md` | Markdown | task と受け入れ条件 | workflow 要件 |
| `reports/working/20260521-0125-legacy-explicit-child-boundary.md` | Markdown | 本作業レポート | report 要件 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された service 単体の true/false と searchRag 回帰を追加した。 |
| 制約遵守 | 5 | 前回 scope 正規化を維持し、未実施検証を実施済み扱いしていない。 |
| 成果物品質 | 5 | document group helper と FolderPermissionService の explicit boundary 意味論を揃えた。 |
| 説明責任 | 5 | task md と本レポートに判断理由、検証、docs 不要判断を記録した。 |
| 検収容易性 | 5 | 検証コマンドと pass 結果を明示した。 |

総合fit: 5.0 / 5.0（約100%）

## 7. 実行した検証

- `npm run test -w @memorag-mvp/api -- --test-name-pattern "legacy explicit|child without explicit policy inherits nearest parent explicit policy|service inherits parent document group sharing"`: pass。最新 `origin/main` 取り込み後に再実行し、307 tests。
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder-scoped search|semantic-only search includes folderId|folder policy documents|document group|search"`: pass。最新 `origin/main` 取り込み後に再実行し、307 tests。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: 長い `--test-name-pattern` を 1 コマンドにまとめた初回実行は Node test runner が `ENAMETOOLONG` で失敗したため、検証対象を 2 コマンドに分割して再実行した。
- リスク: 最新 push 後の CI 結果は別途確認が必要。
