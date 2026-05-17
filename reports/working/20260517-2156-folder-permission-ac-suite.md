# 作業完了レポート

保存先: `reports/working/20260517-2156-folder-permission-ac-suite.md`

## 1. 受けた指示

- 主な依頼: フォルダ権限を仕様通りに完全化する計画と、AC-FOLDER-001〜010 を判定可能な受け入れテスト一覧に基づいて実装を進める。
- 成果物: フォルダ権限 AC のテスト補強、検索/RAG の最新 folder permission 再確認、task md、作業レポート、PR。
- 条件: `FolderPolicy / GroupMembership / EffectiveFolderPermission` を中心に、親継承、子 explicit policy、full 0 禁止、共有解除後の即時検索除外を重視する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | AC-FOLDER-001〜010 を受け入れ条件として扱う | 高 | 対応 |
| R2 | 既存 `DocumentGroup` 互換を保ちながら Folder 権限 model を使う | 高 | 対応 |
| R3 | 共有解除後に embedding 再計算なしで RAG 検索から除外する | 高 | 対応 |
| R4 | Local / DynamoDB の path lock 回帰を確認する | 高 | 対応 |
| R5 | API / UI / migration 全量実装 | 高 | 今回 PR の範囲外として明記 |

## 3. 検討・判断したこと

- `main` には PR-1〜PR-3 相当の基盤が既に入っていたため、今回の主対象は AC を検収しやすくする test gate と、未連携だった search path の差し替えに絞った。
- 検索の認可は vector metadata ではなく、manifest 読み込み後に `FolderPermissionService` で再確認する実装にした。これにより group membership 削除だけで検索対象から外れる。
- UI、migration、監査 API は未実装の後続範囲であり、今回の完了条件には含めなかった。
- `docs/` は既存 ADR と仕様が今回方針を既に説明しているため、公開仕様の追加更新は不要と判断した。

## 4. 実施した作業

- `apps/api/src/search/hybrid-search.ts` の lexical index 構築と vector hit filter で `FolderPermissionService` を使うように変更した。
- `apps/api/src/search/hybrid-search.test.ts` に、group membership 削除後に再インデックスなしで folder policy 文書が検索から除外されるテストを追加した。
- `apps/api/src/adapters/local-document-group-store.test.ts` に、AC-FOLDER-001〜003 を明示する path uniqueness テストを追加した。
- `tasks/do/20260517-2156-folder-permission-ac-suite.md` を作成し、受け入れ条件と検証結果を記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/search/hybrid-search.ts` | TypeScript | 検索時の manifest 権限確認を `FolderPermissionService` に統合 | AC-FOLDER-010 |
| `apps/api/src/search/hybrid-search.test.ts` | Test | group membership 削除後の即時検索除外テスト | AC-FOLDER-010 |
| `apps/api/src/adapters/local-document-group-store.test.ts` | Test | path uniqueness の AC 明示テスト | AC-FOLDER-001〜003 |
| `tasks/do/20260517-2156-folder-permission-ac-suite.md` | Markdown | task、受け入れ条件、検証結果 | Worktree Task PR Flow |
| `reports/working/20260517-2156-folder-permission-ac-suite.md` | Markdown | 作業完了レポート | Post Task Work Report |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4 | AC-FOLDER のテストゲートと AC-FOLDER-010 の実装を進めた。API/UI/migration 全量は今回 PR 範囲外。 |
| 制約遵守 | 5 | 専用 worktree、task md、検証、レポートの repo workflow に従った。 |
| 成果物品質 | 4 | 検索の lexical / vector 両方を最新 permission service に寄せ、回帰テストを追加した。 |
| 説明責任 | 5 | 実施範囲、未対応範囲、検証結果を task/report に明記した。 |
| 検収容易性 | 4 | AC 対応 test と検証コマンドを明記した。 |

総合fit: 4.4 / 5.0（約88%）

理由: AC-FOLDER-001〜010 のうち、今回の PR で store / service / search の主要ゲートを補強した。一方、ユーザーが提示した完全化計画全体の API、監査、migration、UI、chat citation/debug E2E は後続 PR の範囲として残るため満点ではない。

## 7. 実行した検証

- `npm ci`: pass。依存関係未インストールのため実行。`npm audit` は既存依存の 1 moderate / 3 high を報告。
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder|document group|search"`: pass。277 tests。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- API route、UI、migration/backfill、監査ログ API は今回 PR では未実装。
- `MemoRagService` の文書一覧・preview・scope assert には legacy helper が残る。今回の変更は `searchRag` の lexical / vector 検索経路が対象。
- `npm audit` の既存依存脆弱性は今回の範囲外で未対応。
