# ドキュメント管理 UX P1 改善

## 状態

in_progress

## 背景

P0 改善で、保存先フォルダの明示、取り込み進捗、操作単位 loading、破壊的操作の確認ダイアログが追加された。次に、文書数が増えた運用でも対象文書を探しやすく、状態や共有範囲を確認しやすい UI にする。

## 目的

- 文書一覧の検索・フィルタ・ソートを追加する。
- 文書詳細 drawer を追加し、問い合わせや障害対応に必要な ID / 状態を確認しやすくする。
- 共有設定で入力ミスと意図しない共有変更を減らすため、差分 preview と validation を追加する。

## スコープ

- 対象: `DocumentWorkspace`、関連 hook / API 型 / styles / tests / generated docs。
- API が返さない値は固定値で埋めず、「未設定」「利用不可」など正直な表示にする。
- group 候補取得 API がない場合は、既存 document group など実データ由来の候補に限定し、架空 group は表示しない。

## 実装計画

1. 既存の document 型、共有設定、一覧表示、テストを確認する。
2. 文書一覧に検索、種別、状態、所属フォルダ、ソートを追加する。
3. 文書行クリックで開く詳細 drawer を追加する。
4. 共有設定フォームに shared groups の validation と差分 preview を追加する。
5. UI / hook の対象テストを追加・更新する。
6. web inventory docs を再生成する。
7. 必要な検証を実行し、作業レポート、commit、PR、PR コメントまで完了する。

## ドキュメント保守計画

- UI 変更に伴い `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- README / 運用 docs は、既存の UI inventory で十分に同期できる場合は更新しない理由を作業レポートに記録する。

## 受け入れ条件

- [ ] ファイル名検索、種別フィルタ、状態フィルタ、所属フォルダフィルタ、ソートを文書一覧で利用できる。
- [ ] フィルタ結果件数と、該当なし empty state が表示される。
- [ ] 文書行クリックで詳細 drawer が開き、API / props 由来の文書 metadata を表示できる。
- [ ] API が提供しない metadata は架空値で埋めず、未設定または利用不可として表示する。
- [ ] documentId をコピーする操作を提供する。
- [ ] 共有設定で shared groups の差分 preview と重複 / 空値 validation が表示される。
- [ ] 既存の upload / delete / reindex P0 UX が破綻しない。
- [ ] 対象テスト、web typecheck、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments App`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 本番 UI に固定 group / 固定 metadata / demo fallback が混入していないこと。
- 検索・フィルタ・ソートが既存の folder selection と矛盾しないこと。
- drawer の操作が確認ダイアログや row action と競合しないこと。
- 共有差分 preview が実データ由来で、未確認の権限範囲を断定しないこと。

## リスク

- 既存 API に document 詳細専用 endpoint がない場合、表示できる metadata は一覧 payload に限定される。
- group 候補 API がない場合、multi-select ではなく既存入力欄の validation / preview 改善に留める可能性がある。
