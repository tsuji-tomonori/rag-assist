# ファイル共有モーダル load failure guard 修正

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/331

## 背景

PR #331 の再レビューで、共有情報ロード失敗時に `documentShareInfo === null` のまま保存可能になり、`PUT /documents/{id}/share` に空 grants を送って既存 direct grants を削除し得る blocking 指摘を受けた。

## 目的

共有情報の取得に成功した場合だけ共有設定を保存可能にし、ロード失敗時の空 grants 置き換え保存を UI と submit handler の両方で遮断する。

## スコープ

- Web の `DocumentWorkspace` 共有モーダル state / disabled / submit guard
- ロード失敗時の alert 表示
- ロード失敗から再オープン成功までの UI 単体テスト
- 作業レポート、PR 本文・コメント、task 状態更新

## なぜなぜ分析サマリ

- 問題文: 共有情報ロード失敗後、共有モーダルで理由を入力すると `onShareDocument(documentId, { grants: [], reason })` を呼べる可能性がある。
- 確認済み事実:
  - `useDocuments.onLoadDocumentShare` は `getDocumentShare` 失敗時に `undefined` を返し、例外を再 throw しない。
  - `openDocumentShare` は `undefined` を `null` として扱い、loading を終了する。
  - 保存ボタンの disabled 条件に `documentShareInfo === null` が含まれていない。
  - `PUT /documents/{id}/share` は grants 置き換え API であり、空 grants は既存 direct grants 削除を意味する。
- 推定原因:
  - loading と stale response の race は対策したが、load failure と「direct grants が本当に空」の状態を UI state 上で区別していなかった。
  - submit handler が UI disabled だけに依存し、share info 未取得時の防御を持っていなかった。
- 根本原因:
  - 共有設定更新の前提である「現在の共有情報を正常取得済み」という安全条件が、保存可否と submit handler の契約に組み込まれていなかった。
- 対応方針:
  - `documentShareInfo === null` をロード未成功として扱い、読み込み終了後も保存不可にする。
  - ロード失敗時は alert で再オープンを促す。
  - submit handler に `!documentShareInfo` guard を追加し、UI をすり抜けても保存しない。
  - ロード失敗、保存抑止、再オープン成功、空 grants 誤送信抑止を回帰テストで固定する。

## 作業計画

1. `DocumentWorkspace` の共有モーダル保存条件を確認する。
2. ロード失敗 alert、保存 disabled 条件、submit guard を実装する。
3. UT-UI-DOC-SHARE-LOAD-FAIL-001〜004 相当の単体テストを追加する。
4. 変更範囲に見合う Web test/typecheck/lint/inventory check と coverage を実行する。
5. 作業レポートを残し、commit / push する。
6. PR 本文と PR コメントを更新し、task を done に移す。

## ドキュメント保守計画

- durable docs の恒久仕様変更はないため README/docs の手書き更新は不要見込み。
- UI alert 文言追加に伴い web inventory の freshness を確認し、必要なら再生成する。
- PR 本文へ load failure guard 修正と検証結果を反映する。

## 受け入れ条件

- [ ] UT-UI-DOC-SHARE-LOAD-FAIL-001: `onLoadDocumentShare` が `undefined` を返すと、共有設定取得失敗 alert が表示され、保存ボタンは disabled である。
- [ ] UT-UI-DOC-SHARE-LOAD-FAIL-002: `onLoadDocumentShare` が `undefined` を返すと、理由を入力して保存を試みても `onShareDocument` は呼ばれない。
- [ ] UT-UI-DOC-SHARE-LOAD-FAIL-003: `undefined` 後にモーダルを閉じて再度開き、次は share info が正常取得されると、正常取得された direct grants が表示され保存できる。
- [ ] UT-UI-DOC-SHARE-LOAD-FAIL-004: docA の share info 取得失敗時、理由入力後も `onShareDocument(docA, { grants: [] })` は呼ばれない。
- [ ] 変更範囲に見合う Web test/typecheck/lint/inventory check と coverage が pass する。
- [ ] 作業レポートを `reports/working/` に保存する。
- [ ] PR 本文と PR コメントに日本語で結果を反映する。

## 検証計画

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`
- `npm run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `npm run docs:web-inventory:check`
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`
- `git diff --check`

## PR レビュー観点

- ロード失敗と direct grants 空状態を混同しないこと。
- UI disabled と submit handler の両方で fail-closed になっていること。
- 本番 UI に架空データや demo fallback を出していないこと。

## リスク

- `documentShareInfo === null` は初期/読み込み中/失敗の複数状態を表すため、loading と組み合わせた条件を間違えると成功時も保存できなくなる。
- E2E smoke は別途環境準備が必要な可能性がある。

## 実施結果

- `DocumentWorkspace` の共有モーダルに、共有設定取得失敗時の alert を追加した。
- 保存ボタンの disabled 条件に `documentShareInfo === null` を追加した。
- `onDocumentShareSubmit` に `!documentShareInfo` guard を追加し、UI disabled をすり抜けても保存しないようにした。
- 共有設定取得失敗、保存抑止、再オープン成功、空 grants 誤送信抑止の回帰テストを追加した。
- UI alert 文言追加に伴い web inventory を再生成した。

## 検証結果

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`: pass（64 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `git diff --check`: pass
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`: pass（280 tests、C0 statements 91.07%、C1 branches 86.33%、functions 90.06%、lines 94.5%）

## 受け入れ条件確認

- [x] UT-UI-DOC-SHARE-LOAD-FAIL-001: `onLoadDocumentShare` が `undefined` を返すと、共有設定取得失敗 alert が表示され、保存ボタンは disabled である。根拠: 追加テスト「共有モーダルは共有設定取得失敗時に alert を表示し保存を無効化する」。
- [x] UT-UI-DOC-SHARE-LOAD-FAIL-002: `onLoadDocumentShare` が `undefined` を返すと、理由を入力して保存を試みても `onShareDocument` は呼ばれない。根拠: 追加テスト「共有モーダルは共有設定取得失敗時に理由を入力しても保存しない」。
- [x] UT-UI-DOC-SHARE-LOAD-FAIL-003: `undefined` 後にモーダルを閉じて再度開き、次は share info が正常取得されると、正常取得された direct grants が表示され保存できる。根拠: 追加テスト「共有モーダルは取得失敗後に再オープンして成功すると取得済み grants を保存できる」。
- [x] UT-UI-DOC-SHARE-LOAD-FAIL-004: docA の share info 取得失敗時、理由入力後も `onShareDocument(docA, { grants: [] })` は呼ばれない。根拠: 追加テスト「共有モーダルは既存 direct grant がある文書の取得失敗時に空 grants を送信しない」。
- [x] 変更範囲に見合う Web test/typecheck/lint/inventory check と coverage が pass する。根拠: 上記検証結果。
- [x] 作業レポートを `reports/working/` に保存する。根拠: `reports/working/20260522-1127-document-share-load-fail-guard.md`。
- [x] PR 本文と PR コメントに日本語で結果を反映する。根拠: GitHub App で PR 本文、受け入れ条件コメント、セルフレビューコメントを更新済み。

## PR コメント結果

- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み
- PR 本文更新: load failure guard、最新ローカル検証、作業レポートを反映済み
