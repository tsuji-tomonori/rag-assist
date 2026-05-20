# PR326 resource permission fix

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

PR #326 はフォルダ操作の機能権限を分離したが、レビューで resource-level permission の不足と CI gate 失敗が指摘された。現在の PR branch は `origin/main` に対して `DIRTY` で、merge 前に競合解消も必要。

## 目的

`rag:group:create` と `rag:group:assign_manager` の境界、およびフォルダごとの `full` 実効権限を Web/API の作成・編集・アップロード経路で守る。

## なぜなぜ分析サマリ

- confirmed: PR #326 は `rag:group:create` / `rag:group:assign_manager` / `rag:document:write` の feature-level permission を分けている。
- confirmed: レビュー指摘では、作成 payload に `managerUserIds` / `sharedGroupIds` / 共有系 `visibility` が入る経路、アップロード先選択、共有/編集 submit が resource-level `full` を十分に見ていない。
- confirmed: PR #326 は `origin/main` に対して merge conflict 状態。
- inferred: 権限分離の初回修正が UI 表示可否中心で、API payload と対象グループ単位の実効権限を同時に固定するテストが不足していた。
- root cause: feature-level permission と resource-level permission の両方を要求する操作について、型/API response/UI submit guard/test の境界条件が一体で定義されていなかった。
- remediation: `effectivePermission` を API/Web 型と response に追加し、作成 payload の共有系フィールドとアップロード/編集/共有操作を `full` 実効権限で制御し、単体テストで拒否/許可ケースを固定する。
- open_question: CI gate の失敗が今回差分由来か artifact 集計由来かは、修正後の checks で再確認する。

## スコープ

- PR branch の `origin/main` 競合解消。
- API の document group response / create validation / resource permission 判定。
- Web の group create / upload / edit/share UI と submit guard。
- 指摘 1〜3 の単体テスト追加。
- PR 本文またはコメントで検証結果と未検証事項を日本語で報告。

## ドキュメント保守方針

API response と UI 権限制御の挙動が変わるため、既存 docs/generated に差分が出る場合は PR 差分に合わせる。恒久 docs の更新要否は実装後に検索して判断する。

## 受け入れ条件

- [x] PR branch が `origin/main` と競合しない。
- [x] `canCreateDocumentGroups=true` かつ `canShareDocumentGroups=false` では、新規グループ作成時に管理者・共有先・共有 visibility を指定できず、submit payload に含まれない。
- [x] `canCreateDocumentGroups=true` かつ `canShareDocumentGroups=true` では、新規グループ作成時に `managerUserIds` / `sharedGroupIds` を payload に含められる。
- [x] API 側で、作成 payload に管理者・共有先・共有系 visibility が含まれる場合は `rag:group:assign_manager` 相当の権限が必要。
- [x] upload dialog では `effectivePermission === "full"` のグループだけが選択可能または submit 可能。
- [x] `canUploadDocuments=false` または `canWriteDocuments=false` では、`effectivePermission === "full"` のグループがあってもアップロードできない。
- [x] 共有/編集操作は `canShareDocumentGroups && group.effectivePermission === "full"` の場合だけ実行できる。
- [x] 関連する Web/API 単体テストと型チェックが pass する。
- [x] PR に受け入れ条件確認コメントとセルフレビューコメントを日本語で追加する。

## 検証計画

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run typecheck -w @memorag-mvp/web`
- API 変更が入る場合: `npm run test -w @memorag-mvp/api`
- API 変更が入る場合: `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## 検証結果

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace App useDocuments`: pass
- `npm run test:coverage -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run build -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/api -- access-control-policy`: pass（API workspace の node:test 全体が実行され 287 件 pass）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: fail -> 修正後 pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: fail -> 修正後 pass
- `npm run docs:web-inventory:check`: pass
- `npm run docs:openapi:check`: pass
- `git diff --cached --check`: pass
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" apps docs tasks --glob '!reports/**'`: pass

## 受け入れ条件確認メモ

- PR branch は `origin/main` を merge し、コード・docs の conflict marker は解消済み。
- 新規グループ作成は `canShareGroups=false` 時に共有/管理者/visibility を UI で disabled にし、component/hook 双方で payload から除外する。
- API route は create payload に legacy sharing fields が含まれる場合、`rag:group:assign_manager` を追加要求する。
- upload / share / edit は `effectivePermission === "full"` を submit 条件または候補条件に含める。
- PR に受け入れ条件確認コメントとセルフレビューコメントを投稿済み。

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- `effectivePermission` 追加により既存 mock/test fixture の更新漏れが起きやすい。
- CI gate の失敗理由が GitHub Actions artifact 側の場合、ローカル検証だけでは完全再現できない可能性がある。
