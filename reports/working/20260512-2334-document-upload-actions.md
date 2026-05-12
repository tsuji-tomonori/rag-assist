# アップロード完了後アクション導線改善 作業レポート

## 受けた指示

- 直近マージ後の次改善として、ドキュメント管理 UI/UX の未対応項目を進める。
- 対象改善: アップロード完了後に静的文言ではなく、実際の文書へ進む導線を出す。

## 要件整理

- アップロード成功時に返る `DocumentManifest` を UI に渡す。
- 完了パネルでは実 document に基づき「詳細を開く」「この資料に質問する」「フォルダ内で表示」を提供する。
- manifest がない場合は架空の操作ボタンを表示しない。
- 本番 UI に demo fallback や固定 documentId を混ぜない。

## 検討・判断

- `uploadDocumentFile` はすでに `DocumentManifest` を返していたため、backend/API 変更は不要と判断した。
- `useDocuments.ingestDocument` と `onUploadDocumentFile` の戻り値を manifest 付きに広げ、既存の chat attachment 呼び出しは戻り値を無視できる型へ調整した。
- 完了パネルのボタン表示は `DocumentWorkspace` が最後のアップロード結果として保持した manifest がある場合に限定した。
- Durable docs の更新は不要。UI inventory generated docs は差分が出たため再生成した。

## 実施作業

- `useDocuments` の upload 成功結果を `{ ok: true, document }` に変更。
- `DocumentWorkspace` に最後のアップロード済み document state を追加。
- アップロード完了パネルに実ボタンを追加。
- manifest がない完了状態では案内文だけを表示する fallback に変更。
- `useChatSession` の `ingestDocument` prop 型を戻り値非依存に調整。
- 関連 component/hook tests を追加・更新。
- web UI inventory generated docs を更新。

## 成果物

- `memorag-bedrock-mvp/apps/web/src/features/documents/hooks/useDocuments.ts`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/chat/hooks/useChatSession.ts`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/hooks/useDocuments.test.ts`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `memorag-bedrock-mvp/docs/generated/*`

## 検証

- PASS: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- PASS: `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- PASS: `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- PASS: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0` from `memorag-bedrock-mvp`
- PASS: `git diff --check`

## fit 評価

- 指示に対して、アップロード完了直後の主要導線を実 document manifest ベースに変更できている。
- manifest がない場合に架空ボタンを出さないため、No Mock Product UI の要件にも適合している。

## 未対応・制約・リスク

- 実ブラウザ操作、AWS 実環境操作、visual regression は未実施。
- `npm ci` は repository root に `package-lock.json` がないため失敗し、`memorag-bedrock-mvp` 配下で実行した。
- `npm ci` 後に `npm audit` が 3 件の脆弱性を報告したが、今回変更範囲外として未対応。
