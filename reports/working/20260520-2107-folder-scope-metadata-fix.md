# 作業完了レポート

保存先: `reports/working/20260520-2107-folder-scope-metadata-fix.md`

## 1. 受けた指示

- 主な依頼: PR 327 のレビュー指摘である `folderId/folderIds` metadata の scoped search 不整合を修正する。
- 成果物: `manifestMatchesScope` の修正、lexical / semantic-only の単体回帰テスト、PR 327 への追加 commit とコメント。
- 形式・条件: 完了条件として提示された単体テスト観点を満たす。実施していない検証は実施済み扱いしない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `folderId` の manifest が一致 folder scope で検索される | 高 | 対応 |
| R2 | `folderIds` の manifest が一致 folder scope で検索される | 高 | 対応 |
| R3 | `folderId` の manifest が scope 外では検索されない | 高 | 対応 |
| R4 | semantic-only 経路でも `folderId` manifest が一致 folder scope で検索される | 高 | 対応 |
| R5 | 認可判定と scope 判定で folder scope id 正規化を揃える | 高 | 対応 |
| R6 | 対象テストと差分チェックを実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 問題の直接原因は、`canAccessManifest` が `folderIds/folderId/groupIds/groupId` を見る一方で、`manifestMatchesScope` が `groupIds/groupId` しか見ていないことだった。
- `scope.mode === "groups"` は既存互換として folder scope 指定にも使われているため、`groupIds/groupId` の既存挙動を残したまま `folderIds/folderId` を優先する正規化 helper に寄せた。
- 外部 API、UI、永続化 schema の変更ではなく検索内部の判定整合修正のため、README / docs 更新は不要と判断した。
- semantic-only テストでは vector hit 側に folder id を置かず、documentId から取得した manifest の `folderId` で scope 判定されることを確認した。

## 4. 実施した作業

- `folderScopeIds` helper を追加し、`canAccessManifest` と `manifestMatchesScope` で共有した。
- `folderId` metadata の folder-scoped include テストを追加した。
- `folderIds` metadata の folder-scoped include テストを追加した。
- scope 外の `folderId` manifest が除外されるテストを追加した。
- semantic-only search で `folderId` manifest が一致 folder scope で返るテストを追加した。
- 作業前 task md に受け入れ条件と軽量 RCA を記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/search/hybrid-search.ts` | TypeScript | folder scope id 正規化 helper と scope 判定修正 | R1-R5 |
| `apps/api/src/search/hybrid-search.test.ts` | TypeScript test | `folderId/folderIds` の lexical / semantic-only 回帰テスト | R1-R4 |
| `tasks/do/20260520-2104-folder-scope-metadata-fix.md` | Markdown | 作業 task、受け入れ条件、RCA | workflow 要件 |
| `reports/working/20260520-2107-folder-scope-metadata-fix.md` | Markdown | 作業完了レポート | report 要件 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された `folderId/folderIds`、scope 外除外、semantic-only をすべてテスト化した。 |
| 制約遵守 | 5 | 既存 PR branch の worktree で作業し、未実施検証を実施済み扱いしていない。 |
| 成果物品質 | 5 | 認可と scope 判定の重複ロジックを helper に集約し、既存互換を維持した。 |
| 説明責任 | 5 | task md と本レポートに原因、判断、検証、docs 不要判断を記録した。 |
| 検収容易性 | 5 | 完了条件に対応するテスト名と検証コマンドを明示した。 |

総合fit: 5.0 / 5.0（約100%）

## 7. 実行した検証

- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder-scoped search|semantic-only search includes folderId|folder policy documents"`: pass。281 tests。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: 作業前の `git ls-remote` は sandbox のネットワーク制限で失敗したため、既に存在していた PR 327 worktree を対象に作業した。
- リスク: PR branch がリモートで追加更新されていた場合の差分は push 時または GitHub 上で確認が必要。
