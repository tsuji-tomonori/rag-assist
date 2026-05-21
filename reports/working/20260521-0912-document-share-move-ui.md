# ドキュメント共有・移動 UI/API 実装レポート

## 受けた指示

現行の「フォルダは共有・検索範囲・管理権限の単位」「文書操作は権限で制御する」設計を維持しつつ、右側カラム廃止、フォルダ操作のモーダル化、ファイル単位共有、ファイル移動を rag-assist に実装する。

## 要件整理

- 右側カラムは廃止し、左フォルダツリーと中央ドキュメント一覧にする。
- フォルダ情報、フォルダ共有、フォルダ名変更、フォルダ移動、アップロードは一覧上部ボタンからモーダルで扱う。
- 文書行に詳細、共有、移動、削除系操作を置き、full 権限が必要な操作は権限で制御する。
- ファイル単位共有はフォルダ権限への加算方式とし、フォルダ由来権限を打ち消さない。
- ファイル移動は対象ファイル full、移動先フォルダ full、理由、optimistic lock を要求し、直接共有は維持する。
- RAG 検索では mode=all に直接共有ファイルを含め、フォルダ指定検索ではフォルダ権限がない直接共有ファイルを含めない。

## 実施作業

- `DocumentShareGrant`、共有 ledger、実効文書権限計算、共有/移動 guard と validator を追加した。
- `GET/PUT /api/documents/{documentId}/share` と `POST /api/documents/{documentId}/move` を追加し、route-level permission と security policy test を更新した。
- 文書一覧と preview/RAG retrieval で直接共有を加味した認可判定を追加した。フォルダ権限なしの直接共有文書は一覧表示時にフォルダ識別子を隠し、所属フォルダを共有文書扱いにした。
- ファイル移動で manifest の folder metadata と local vector metadata を更新し、直接共有 ledger を維持するようにした。
- Web UI から右側カラムを削除し、フォルダ操作/アップロード/ファイル共有/ファイル移動をモーダル化した。
- Web API client/hook に `PUT`、文書共有、文書移動の呼び出しを追加した。
- API 単体テストと UI テストを追加・更新した。
- 追加レビュー指摘への対応として、共有設定取得を full 限定に変更し、`tenantId` による直接共有 grant 分離を保存・検索・権限計算に適用した。
- 文書一覧レスポンスに `currentUserEffectivePermission` と `capabilities` を追加し、Web の行操作可否を backend capabilities 優先に変更した。
- 文書共有モーダルで direct grant の削除を可能にし、継承 grant は削除不可の表示にした。
- 文書移動モーダルで既存一覧ベースの同名ファイル衝突検知を追加した。

## 成果物

- API: `apps/api/src/documents/document-permission-service.ts`
- API routes: `apps/api/src/routes/document-routes.ts`
- RAG/list authorization: `apps/api/src/rag/memorag-service.ts`, `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts`
- Web UI: `apps/web/src/features/documents/components/DocumentWorkspace.tsx`, `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx`
- Web client/hooks: `apps/web/src/features/documents/api/documentsApi.ts`, `apps/web/src/features/documents/hooks/useDocuments.ts`
- Task file: `tasks/do/20260521-0851-document-share-move-ui.md`

## Fit 評価

- AC-DOC-UI-001/002、AC-DOC-ACTION-001/002 は UI テストで確認した。
- AC-DOC-SHARE-001/002/003 は権限計算と共有 API 実装で対応した。
- AC-DOC-SHARE-004/005 は一覧/RAG の認可判定と直接共有時のフォルダ情報マスクで対応した。
- AC-DOC-MOVE-001/002/003/004/005 は move guard、manifest/vector metadata 更新、検索時 DB 再確認で対応した。
- AC-DOC-AUDIT-001 は共有 ledger の audit entry と move audit entry で対応した。

## 検証

- `git diff --check`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api`: pass（310 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web`: pass（234 passed / 29 todo）

## 未対応・制約・リスク

- Web の旧右ペイン前提テスト 29 件は skip から todo に変更した。権限/capabilities の重要観点は新規テストで追加したが、旧フォーム・最近の操作・アップロード完了パネルの観点は新モーダル単位へ再設計する必要がある。
- E2E は未実行。環境起動とユーザー切替シナリオ整備が必要。
- Vector metadata 更新は local vector store に実装した。外部 vector store 実装では `updateMetadataForDocument` の追加対応が必要になる可能性がある。
- Durable docs の明確な更新先はこの作業中に特定できなかったため、API 契約は OpenAPI contract test と route-level policy test で確認した。
