# ドキュメントフォルダ作成 UI 設定拡張

## 状態

in_progress

## 背景

ドキュメント管理の P0 / P1 改善で、アップロード先明示、取り込み進捗、操作単位 loading、確認ダイアログ、文書一覧検索、詳細 drawer、共有設定 validation が追加された。次の改善として、フォルダ作成時点で公開範囲や共有先を指定できるようにし、作成後に private のまま残る運用ミスを減らす。

## 目的

- 新規フォルダ作成を名前のみから設定込みに拡張する。
- 作成時に説明、親フォルダ、公開範囲、shared groups、manager IDs を指定できるようにする。
- 作成後にそのフォルダへ移動し、アップロード先にも設定できる導線を追加する。

## スコープ

- 対象: `DocumentWorkspace`、`useDocuments` の create group 入力型、関連 CSS / tests / generated docs。
- API が既に受け付ける `description`, `parentGroupId`, `sharedGroups`, `managerUserIds` を UI から渡す。
- Cognito group / role 候補 API がないため、架空候補の multi-select は作らない。

## 実装計画

1. 既存の group 作成フォーム、API 型、テストを確認する。
2. `onCreateGroup` の入力型を API に合わせて拡張する。
3. フォルダ作成フォームに説明、親フォルダ、公開範囲、shared groups、manager IDs、作成後移動を追加する。
4. shared groups / manager IDs の重複・空値 validation と作成 preview を追加する。
5. 作成後移動が有効な場合、新規作成された group へ選択・アップロード先を移動する。
6. 対象テストを追加・更新し、generated docs を再生成する。
7. 検証、レポート、commit、PR、PR コメントまで完了する。

## ドキュメント保守計画

- UI 変更に伴い `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- README / 運用 docs の恒久更新が必要ない場合は、作業レポートに理由を記録する。

## 受け入れ条件

- [x] フォルダ名、説明、親フォルダ、公開範囲を指定してフォルダ作成できる。
- [x] 公開範囲 `shared` の場合、shared groups を作成 payload に含められる。
- [x] manager user IDs を作成 payload に含められる。
- [x] shared groups / manager IDs の空 token と重複を validation できる。
- [x] 作成前に公開範囲、親フォルダ、共有先、管理者、作成後移動の preview が表示される。
- [x] 作成後移動が有効な場合、新規 group へ閲覧フォルダとアップロード先が移動する。
- [x] 既存の文書一覧検索、詳細 drawer、共有更新、upload / delete / reindex 導線が破綻しない。
- [x] 本番 UI に架空 group / user / manager を表示しない。
- [x] 対象テスト、web typecheck、web lint、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## PR レビュー観点

- 作成 payload が API 型と一致し、既存の private name-only 作成も壊れないこと。
- 候補 API がない値を架空リストで補っていないこと。
- validation が送信前に誤入力を止めること。
- 作成後移動が upload destination と selected folder の状態を矛盾させないこと。

## リスク

- 作成 API が返す group ID に依存して作成後移動するため、hook の create 処理で返却値を扱う必要がある。
- Cognito group / manager user の実在確認は API 更新時の backend validation に依存する。
