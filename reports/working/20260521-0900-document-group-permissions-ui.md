# 作業完了レポート

保存先: `reports/working/20260521-0900-document-group-permissions-ui.md`

## 1. 受けた指示

- 画面右上の `+` がフォルダ作成ではなくアップロードショートカットであることを明確にする。
- 保存先未選択時のアップロード disabled 理由を UI に表示する。
- Web 側のフォルダ作成、共有更新、文書アップロード権限を API permission と同じ粒度に分離する。
- 親フォルダの `effectivePermission` と入力 validation を守る単体テストを維持・追加する。
- `POST /document-groups` の `rag:group:create`、親フォルダ full、canonical path 重複制約を API route test で固定する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 右上ショートカットを「ファイルをアップロード」として表示 | 高 | 対応 |
| R2 | 保存先未選択時の disabled 理由を表示 | 高 | 対応 |
| R3 | `canCreateGroup` / `canShareGroup` / `canUpload` に UI 権限を分離 | 高 | 対応 |
| R4 | 親フォルダ readOnly/full と入力 validation のテストを維持 | 高 | 対応 |
| R5 | API route test で group create 制約を固定 | 高 | 対応 |
| R6 | 実施した検証だけを報告 | 高 | 対応 |

## 3. 検討・判断したこと

- API の `POST /document-groups` は既に `rag:group:create` を要求していたため、API 実装変更ではなく route-level contract test の追加を中心にした。
- Durable docs は `docs/3_設計_DES/41_API_API/DES_API_001.md` と `docs/generated/openapi/post-document-groups.md` に既に権限が明記されているため更新不要と判断した。
- 本番 UI に架空フォルダや demo fallback は追加せず、disabled / empty / permission state と実データ由来の表示だけにした。

## 4. 実施した作業

- `usePermissions` に `canCreateDocumentGroups` と `canShareDocumentGroups` を追加し、文書管理画面の表示判定にも含めた。
- `useDocuments` と `DocumentWorkspace` の props を `canCreateGroup`、`canShareGroup`、`canUpload` に分離した。
- 右上ショートカットを download icon + `aria-label="ファイルをアップロード"` に変更し、別ボタンとして `フォルダを作成` を追加した。
- 保存先未選択、権限不足、管理権限不足などの disabled reason helper を追加し、UI 表示と `aria-describedby` に反映した。
- Web 単体テストと API contract test を追加・更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | TSX | 権限分離と disabled reason 算出 | R1-R4 |
| `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx` | TSX | アップロード導線明確化、フォルダ作成 focus 導線追加 | R1-R2 |
| `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx` | TSX | 権限別 disabled と理由表示 | R2-R4 |
| `apps/web/src/app/hooks/usePermissions.ts` / `useDocuments.ts` | TS | 権限分離 | R3 |
| `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` | test | UI 導線、権限分離、親フォルダ、validation のテスト | R1-R4 |
| `apps/api/src/contract/api-contract.test.ts` | test | group create route の 403/400 contract test | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | ユーザー提示の完了条件を実装・テストへ反映した |
| 制約遵守 | 5 | 既存 worktree と分離し、未実施検証を実施済み扱いしていない |
| 成果物品質 | 4 | 既存 UI の詳細設計を大きく変えずに最小範囲で解消した |
| 説明責任 | 5 | 初回 API test の一過性失敗と再実行 pass を記録した |
| 検収容易性 | 5 | 受け入れ条件に対応するテストを追加した |

総合fit: 4.8 / 5.0（約96%）

## 7. 実行した検証

- `npm ci`: pass。worktree に依存関係がなく、初回 typecheck が `tsc: not found` で失敗したため実行。
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web`: 初回 fail -> テスト期待値修正後 pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api`: 初回既存 contract SSE test が fail -> 再実行 pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- `npm ci` 実行時に既存依存の audit finding が 5 件出たが、今回の権限/UI 修正範囲外のため依存更新は行っていない。
- API test 初回失敗は追加した group create route test ではなく既存 SSE contract の一過性失敗だった。再実行では全 309 件 pass。
- PR 作成後に受け入れ条件コメントとセルフレビューコメントを追加し、task md を `done` に移動する必要がある。
