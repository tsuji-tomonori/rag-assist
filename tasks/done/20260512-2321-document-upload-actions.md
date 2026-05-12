# アップロード完了後アクション導線改善

## 状態

done

## 背景

直近レビューで、アップロード完了後パネルが「この資料に質問できます」などの静的な span に留まり、アップロード直後の主要導線である「詳細を開く」「この資料に質問する」「フォルダ内で表示」に直接進めない点が指摘された。

## 目的

アップロード完了直後に、実際に作成された documentId / manifest に基づいて詳細確認、文書スコープ質問、フォルダ表示へ進めるようにする。

## タスク種別

機能追加

## スコープ

- 対象: 文書アップロード hook、DocumentWorkspace、アップロード完了パネル、関連テスト。
- 対象外: backend upload API 変更、実ブラウザ visual regression、AWS 実環境操作。

## 実装計画

1. `uploadDocumentFile` / `ingestDocument` / `onUploadDocumentFile` の戻り値を確認し、成功時の manifest を UI へ返す。
2. `DocumentWorkspace` で最後にアップロード完了した document を保持する。
3. 完了パネルに「詳細を開く」「この資料に質問する」「フォルダ内で表示」の実ボタンを追加する。
4. documentId が取得できない場合は架空の導線を出さず、既存の正直な完了表示に留める。
5. component/hook tests と typecheck/inventory/lint を実行する。

## ドキュメントメンテナンス計画

- UI インベントリ generated docs の更新有無を確認する。
- API/運用手順の変更がなければ durable docs は更新不要とする。
- 作業レポートを `reports/working/` に残す。

## 受け入れ条件

- アップロード成功時に hook が `DocumentManifest` を呼び出し側へ返す。
- アップロード完了パネルに実 documentId に紐づく「詳細を開く」ボタンが表示され、drawer が開く。
- `onAskDocument` が渡されている場合、「この資料に質問する」ボタンでアップロード済み文書を渡せる。
- 「フォルダ内で表示」でアップロード先フォルダを選択できる。
- documentId / manifest がない場合は架空ボタンを表示しない。
- 関連 tests、web typecheck、web inventory check、web lint、`git diff --check` が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `npm --prefix memorag-bedrock-mvp exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `git diff --check`

## PR レビュー観点

- 本番 UI に架空 documentId や demo fallback を出していないか。
- アップロード完了後の action が実 manifest と権限状態に基づいているか。
- 既存のアップロード進捗・失敗表示を壊していないか。

## リスク

- upload API の戻り値 shape と hook の戻り値型がずれると、完了導線が表示できない。
- 完了後 action state が古い document を指し続けないようにする必要がある。

## 完了結果

- PR: #283
- 受け入れ条件: PR コメントで確認済み。
- セルフレビュー: PR コメントで実施済み。
