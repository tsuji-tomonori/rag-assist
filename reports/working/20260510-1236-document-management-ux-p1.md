# ドキュメント管理 UX P1 改善 作業レポート

## 受けた指示

- P0 改善後の次の改善として、文書数増加に耐えるドキュメント管理 UI/UX 改善を実施する。
- 計画で止まらず、実装、検証、PR 作成まで進める。

## 要件整理

- 文書一覧に検索、種別フィルタ、状態フィルタ、所属フォルダフィルタ、並び替えを追加する。
- フィルタ結果件数と該当なし empty state を表示する。
- 文書行から詳細 drawer を開き、documentId や lifecycle など確認可能な metadata を表示する。
- API が返さない値は架空値で埋めず、「未設定」「利用不可」として表示する。
- documentId copy 操作を提供する。
- 共有設定に shared groups の差分 preview と validation を追加する。
- 既存の upload / delete / reindex P0 UX を壊さない。

## 検討・判断

- 詳細 drawer は既存 API の `DocumentManifest` と `DocumentGroup` の範囲で構成した。
- file size、ingest run ID、embedding model、memory model は `metadata` に存在する場合だけ表示し、未提供時は「利用不可」とした。
- Cognito group 一覧取得 API は確認できなかったため、架空候補を出す multi-select は作らず、既存入力欄に validation と差分 preview を追加した。
- generated web inventory は UI 変更後に再生成し、手編集のドキュメント更新は避けた。

## 実施作業

- `DocumentWorkspace` に文書検索・フィルタ・ソートバーを追加した。
- 文書行クリック / Enter / Space で開く詳細 drawer を追加した。
- 詳細 drawer に documentId copy、再インデックス、削除導線を追加し、既存確認ダイアログへ接続した。
- 共有設定に空 token / 重複 group validation と、追加 / 削除 / 変更なし preview を追加した。
- documents CSS にフィルタバー、選択行、drawer、共有差分 preview のスタイルを追加した。
- `DocumentWorkspace.test.tsx` に P1 UI のテストを追加・更新した。
- web inventory generated docs を再生成した。

## 成果物

- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `memorag-bedrock-mvp/docs/generated/*`
- `tasks/do/20260510-1224-document-management-ux-p1.md`

## 検証

- `npm ci`
  - pass。補足: npm audit は 3 件の脆弱性を報告したが、依存更新は今回の範囲外。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- App DocumentWorkspace useDocuments`
  - pass。7 files / 77 tests。
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`
  - pass。28 files / 195 tests。最終実行では Statements 91.48%、Branches 86.16%、Functions 90.51%、Lines 94.99%。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
  - pass。
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
  - pass。CI で React hooks の memoization lint が失敗したため、文書フィルタ計算から不要な `useMemo` を外して再確認した。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
  - pass。
- `git diff --check`
  - pass。

## Fit 評価

総合fit: 4.7 / 5.0

- 検索・フィルタ・ソート、詳細 drawer、documentId copy、共有差分 preview / validation は実装済み。
- P0 の upload / delete / reindex 導線は既存確認ダイアログへ接続し、対象テストも通過している。
- Cognito group 候補 API がないため、完全な multi-select 化ではなく入力式の安全性改善に留めた。

## 未対応・制約・リスク

- Cognito group / role 一覧 API がないため、実在 group 候補の multi-select は未実装。
- 抽出テキスト preview、代表チャンク preview、エラー履歴は現行 `DocumentManifest` から取得できないため「利用不可」と表示する。
- `updatedAt` は document metadata に存在する場合だけ表示し、一覧の既存「更新日」は従来どおり `createdAt` ベースの表示を維持した。
