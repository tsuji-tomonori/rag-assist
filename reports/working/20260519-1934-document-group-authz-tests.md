# 作業完了レポート

保存先: `reports/working/20260519-1934-document-group-authz-tests.md`

## 1. 受けた指示

- `document-groups` を仕様上の folder として扱い、API / Web の権限テストを実装する。
- 失敗ケースから実装修正箇所を洗い出し、実装する。
- API `apps/api` の `tsx --test`、Web `apps/web` の Vitest / Playwright E2E を前提に確認する。
- P0 として、API の document group / document 操作 / search / chat 権限、Web の readOnly UI handler guard、API 403 の permission error 表示、親共有継承と子の個別ポリシー優先を優先する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | API の document group / document / search / chat 権限回帰テストを追加 | 高 | 対応 |
| R2 | 親共有継承と子の個別ポリシー優先を実装・テスト | 高 | 対応 |
| R3 | Web の readOnly / delete / reindex 権限で handler が呼ばれないことをテスト | 高 | 対応 |
| R4 | API 403 を Web が permission error として扱うことを確認 | 高 | 既存 `useDocuments` テストと error classifier により確認 |
| R5 | 対象テストと typecheck を実行 | 高 | 対応 |
| R6 | 作業レポートを残す | 高 | 対応 |

## 3. 検討・判断したこと

- API の実行経路では `FolderPermissionService` と別に `MemoRagService` / search / chat retrieval が従来の同期 helper を持っていたため、親共有継承の実装差分は共通 helper に切り出して揃えた。
- 子 group は `visibility`、`sharedUserIds`、`sharedGroups`、`managerUserIds` が指定された場合に legacy 明示ポリシーとして扱い、指定なしの child は parent の権限を継承する方針にした。
- suspended / deleted account は active account 前提の権限判定に合わせ、document group permission helper で `none` として扱うようにした。
- Web は UI disabled だけに依存せず、`useDocuments` の delete handler に `canDeleteDocuments` guard を追加した。
- OpenAPI の route shape は変更していないため generated OpenAPI は更新していない。挙動差分は `docs/spec-recovery/09_gap_analysis.md` に最小追記した。

## 4. 実施した作業

- `apps/api/src/folders/document-group-permissions.ts` を追加し、`none/readOnly/full` の同期 document group permission helper を実装した。
- `MemoRagService`、`search/hybrid-search.ts`、`chat-orchestration/nodes/retrieve-memory.ts` の document group 判定を共通 helper に変更した。
- `createDocumentGroup` / `updateDocumentGroupSharing` で legacy 明示ポリシーを設定し、親共有継承と child override を表現した。
- API test に、親共有継承、child explicit private override、inactive account、readOnly writable 拒否、search / chat scope 403、検索漏えい防止のケースを追加した。
- Web hook と component test に、delete / reindex 権限なしで API handler が呼ばれないケースを追加した。
- `docs/spec-recovery/09_gap_analysis.md` に今回解消した gap と残る課題を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/folders/document-group-permissions.ts` | TypeScript | document group 権限 helper | API 権限実装に対応 |
| `apps/api/src/rag/memorag-service.test.ts` | Test | parent inheritance / child override / search / chat 権限テスト | API P0 に対応 |
| `apps/web/src/features/documents/hooks/useDocuments.test.ts` | Test | delete 権限なし guard | Web P0 に対応 |
| `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` | Test | disabled action handler 非呼び出し | Web P0 に対応 |
| `docs/spec-recovery/09_gap_analysis.md` | Markdown | gap 状態更新 | Docs maintenance に対応 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4 | P0 の主要経路を実装・検証した。P1/P2 と Playwright E2E は今回の変更範囲では未実施。 |
| 制約遵守 | 5 | worktree / task md / report / 実施済み検証のみ記載のルールに従った。 |
| 成果物品質 | 4 | 権限 helper を共通化し、API/Web の targeted test を追加した。 |
| 説明責任 | 5 | 実施内容、未実施、制約、残リスクを記録した。 |
| 検収容易性 | 4 | 変更ファイルと検証コマンドを明記した。 |

総合fit: 4.4 / 5.0（約88%）

理由: P0 の主要な API/Web 権限境界は実装・検証済み。P1/P2 と Playwright E2E の通し検証は未実施のため満点ではない。

## 7. 実行した検証

- `npm ci`: pass。検証依存を worktree にインストール。`npm audit` は 5 vulnerabilities を報告したが、今回の変更範囲外。
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "document group"`: pass。npm script の引数展開により API test 277 件が実行された。
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass。3 files / 56 tests。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/search/hybrid-search.test.ts`: pass。64 tests。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- Playwright E2E は未実施。今回の変更は service / hook / component の targeted regression が中心で、E2E 用の複数ユーザー fixture とサーバー起動までは範囲外とした。
- P1/P2 の canonicalPath move 詳細、async agent writeback、audit log、a11y focus などは既存テストまたは今後の追加対象。
- `FolderPermissionService` の policy store ベース実装と今回の legacy document group helper はまだ完全統合ではない。将来的には async permission service への一本化を検討できる。
