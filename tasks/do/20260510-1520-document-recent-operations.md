# ドキュメント最近の操作 UI 拡張

## 状態

in_progress

## 背景

ドキュメント管理 UI はアップロード、フォルダ作成、共有更新、削除、reindex stage / cutover / rollback などの運用操作を扱う。一方、右ペインの「最近の更新」は最新 3 文書だけを表示しており、運用者が文書以外の変更や reindex 状態を追いにくい。

## 目的

- 「最近の更新」を「最近の操作」に拡張する。
- 文書、フォルダ、reindex migration、現在セッションの操作要求を、実データに基づく操作イベントとして表示する。
- API に監査ログ endpoint がない値は架空データで補わず、未取得または要求済みとして表示する。

## スコープ

- 対象: `DocumentWorkspace`、関連 CSS / tests / generated Web UI inventory。
- API route / backend store の追加は行わない。
- 永続的な監査ログではなく、画面が受け取る props と現在セッション内の操作要求を使う。

## 実装計画

1. 現在の「最近の更新」表示と操作 handler を確認する。
2. 実データから操作イベントを生成する helper を追加する。
3. upload / create group / share / delete / reindex 系の現在セッション操作要求を記録する。
4. 右ペインを「最近の操作」に変更し、種別、対象、時刻、操作者、結果を表示する。
5. 永続監査ログが未提供であることを UI 上で短く示す。
6. 対象テストと generated docs を更新する。
7. 検証、レポート、commit、PR、PR コメントまで完了する。

## ドキュメント保守計画

- UI 変更に伴い `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- 永続的な API / 運用手順変更はないため、README / 運用 docs は必要性を確認し、不要なら作業レポートに理由を記録する。

## 受け入れ条件

- [x] 「最近の更新」が「最近の操作」として表示される。
- [x] 文書更新、フォルダ作成・更新、reindex stage / cutover / rollback が実データから表示される。
- [x] upload / folder create / share / delete / reindex の現在セッション操作要求が表示される。
- [x] 操作者、対象、時刻、結果が表示され、未取得値は架空値で補わない。
- [x] 表示件数が多すぎないよう最新順に制限される。
- [x] 操作がない場合は正直な空状態を表示する。
- [x] 既存の文書一覧、共有更新、upload / delete / reindex 導線が破綻しない。
- [x] 対象テスト、web typecheck、web lint、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## PR レビュー観点

- API にない監査ログや操作者を架空表示していないこと。
- 既存操作 handler の呼び出し順や確認ダイアログ挙動を壊していないこと。
- reindex migration の status と表示ラベルが一致していること。
- generated docs が実装と同期していること。

## リスク

- 永続監査ログではないため、過去の全操作や失敗履歴を完全には表現できない。
- 現在セッション操作要求は callback が例外を握りつぶす場合、API 成否までは判定できない。
