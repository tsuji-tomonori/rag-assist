# PR330 main 競合解消

- 状態: done
- タスク種別: 修正
- 作成日時: 2026-05-21 13:38 JST
- 対象ブランチ: `codex/document-group-permissions-ui`
- 対象 PR: #330

## 背景

`origin/main` の更新により、文書管理 UI、権限 hook、useDocuments hook、生成 Web inventory docs に競合が発生した。PR #330 の権限分離修正を維持したまま、main 側で追加されたフォルダ設定モーダル導線と整合させる必要があった。

## 受け入れ条件

- `origin/main` との merge conflict が解消され、実装・docs に conflict marker が残らない。
- PR #330 の権限分離を維持する。
  - フォルダ作成は `rag:group:create`。
  - 共有/フォルダ更新は `rag:group:assign_manager`。
  - 文書アップロードは `rag:doc:write:group`。
- main 側のフォルダ設定モーダル導線と、PR 側の disabled reason / upload shortcut の accessible name を両立する。
- 生成 Web inventory docs を再生成し、docs の競合を手編集で残さない。
- 関連する web/API 型チェック・テスト・lint・docs check が通る。

## なぜなぜ要約

- 確認事実: `DocumentWorkspace`、workspace panel、`useDocuments`、生成 docs で merge conflict が発生していた。
- 推定原因: PR #330 が右ペイン型の文書管理 UI と権限分離を変更していた一方、main 側ではフォルダ設定をモーダル化する変更が進んでいた。
- 根本原因: 同じ文書管理 UI の props 境界と操作導線に対する並行変更。
- 対応方針: main 側のモーダル構造を土台にし、PR #330 の権限分離、disabled reason、create-only refresh 成功扱い、fail-closed な `effectivePermission` 判定を戻す。

## 実施内容

- `DocumentWorkspace` で `canCreateGroup`、`canShareGroup`、`canUpload` を正規化し、旧 props との互換も残した。
- アップロードショートカットの accessible name を `ファイルをアップロード` にし、title は実際の保存先 `uploadDestinationLabel` に寄せた。
- フォルダ作成ショートカットを submit 可否から分離し、クリック時にフォルダ設定モーダルと新規フォルダ名入力へ誘導するよう統合した。
- `useDocuments` のフォルダ作成成功後 refresh failure を、作成失敗扱いにしないよう分離した。
- Web inventory docs を `npm run docs:web-inventory` で再生成した。
- main 側テストの旧ボタン名期待を、新しい accessible name / モーダル導線に合わせて更新した。

## 検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx useDocuments.test.ts App.test.tsx`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api -- api-contract.test.ts`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: pass

## 未対応・リスク

- coverage guard はローカルでは未実行。今回の競合解消では対象単体/contract/lint/docs を優先した。
- PR の GitHub Actions 再実行結果は、この merge commit push 後に確認が必要。
