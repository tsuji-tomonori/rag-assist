# PR326 effectivePermission fail-closed fix

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

PR #326 の再レビューで、Web 側の `effectivePermission` 未設定時に `full` 扱いする fail-open 判定が残っていると指摘された。サーバー側は防御されているが、UI 表示・操作ガード・テスト fixture の安全性として merge 前に fail-closed へ寄せる必要がある。

## 目的

Web UI のフォルダ管理判定を `effectivePermission === "full"` のみに限定し、`effectivePermission` 欠落時に upload/delete/reindex/share/edit が有効化されないことを単体テストで固定する。

## なぜなぜ分析サマリ

- confirmed: `DocumentGroup.effectivePermission` は optional 型で定義されている。
- confirmed: `canManageDocumentGroup` と `canUploadToGroup` は `effectivePermission === undefined` を full 相当として扱っている。
- confirmed: 再レビューでは、この fail-open 判定が UI 権限表示とテスト安全性の問題として指摘された。
- inferred: 過去 fixture や古い response との互換性を意識して optional を許容したが、UI 操作ガードまで同じ互換判断を使ったため fail-open になった。
- root cause: API response の後方互換性と UI 操作ガードの安全側判定を分離できていなかった。
- remediation: UI 操作ガードでは `effectivePermission === "full"` のみを full と扱い、既存許可 fixture には `effectivePermission: "full"` を明示し、欠落 fixture の拒否テストを追加する。
- open_question: 型を必須化する場合の影響範囲は大きくなり得るため、本タスクでは実行時 UI guard の fail-closed とテスト固定を優先する。

## スコープ

- `DocumentWorkspace` の `canManageDocumentGroup` を fail-closed に変更。
- `DocumentDetailPanel` の upload 候補判定を fail-closed に変更。
- `DocumentWorkspace.test.tsx` に `effectivePermission` 欠落時の拒否ケースを追加。
- 必要な既存 fixture に `effectivePermission: "full"` を明示。
- 変更に伴う generated docs 更新の要否を確認。

## ドキュメント保守方針

恒久 docs の挙動説明は既存の権限分離方針と一致するため原則不要。Web inventory generated docs に差分が出た場合は再生成する。

## 受け入れ条件

- [x] `canManageDocumentGroup` は `effectivePermission === "full"` のみ true を返す。
- [x] `canUploadToGroup` は `effectivePermission === "full"` のみ true を返す。
- [x] `effectivePermission` 欠落フォルダは upload 候補に出ない。
- [x] `effectivePermission` 欠落フォルダでは削除・再インデックス・共有更新操作が disabled になり、対象 handler が呼ばれない。
- [x] 既存の許可系 fixture は必要に応じて `effectivePermission: "full"` を明示する。
- [x] 関連 Web 単体テスト、typecheck、lint、docs check が pass する。
- [x] PR に受け入れ条件確認コメントとセルフレビューコメントを日本語で追加する。

## 検証計画

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `npm run docs:web-inventory:check`
- `git diff --check`

## 検証結果

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`: fail -> fixture/test 修正後 pass（57 tests）
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace App`: pass（110 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `npm run test:coverage -w @memorag-mvp/web`: fail -> App fixture 修正後 pass（34 files, 264 tests; C0 91.24%, C1 86.2%）
- `git diff --check`: pass

## 受け入れ条件確認メモ

- `canManageDocumentGroup` と `canUploadToGroup` は `effectivePermission === "full"` のみ true を返す。
- `effectivePermission` 欠落 fixture は upload 候補に出ず、upload input/submit は disabled のまま。
- `effectivePermission` 欠落フォルダの文書削除・再インデックス・共有更新は disabled で handler が呼ばれない。
- 許可系 fixture は `effectivePermission: "full"` を明示した。
- PR に受け入れ条件確認コメントとセルフレビューコメントを投稿済み。

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- 古い fixture や API mock が `effectivePermission` を持たない場合、許可系テストが fail する可能性がある。
- `effectivePermission` が欠落する実 API response が存在する場合、UI は安全側に倒れて操作不可になる。
