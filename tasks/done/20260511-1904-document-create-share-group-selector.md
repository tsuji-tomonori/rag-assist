# 新規フォルダ作成の shared groups 選択 UI 改善

状態: done

## 背景

ドキュメント共有設定では、既存 shared group 候補を checkbox multi-select として選べるようになっている。一方、新規フォルダ作成フォームの `初期 shared groups` はまだカンマ区切り入力が主導で、既存 shared group を選ぶ導線がない。

## 目的

- 新規フォルダ作成時の初期 shared groups も、実データ由来候補から選べるようにする。
- 手入力 fallback、validation、作成 preview、作成 payload は既存挙動を維持する。
- 架空 group や固定 group 候補を本番 UI に出さない。

## タスク種別

機能追加

## スコープ

- `DocumentWorkspace` の create shared group 候補算出。
- `DocumentDetailPanel` の新規フォルダ作成フォーム。
- `DocumentWorkspace` 関連テスト。
- UI 変更に伴う generated web inventory。

## 非スコープ

- Cognito group 一覧 API の新規追加。
- group 名の実在確認 API 追加。
- 共有更新フォーム側の既存 selector 大幅変更。

## 実装計画

1. 既存の共有 group selector と新規フォルダ作成フォームを確認する。
2. create form 用の shared group 候補を、既存 document groups と入力済み値から算出する。
3. 新規フォルダ作成フォームにも候補 checkbox selector を追加する。
4. 候補選択 / 解除が `groupSharedGroups`、validation、preview、submit payload に反映されるようにする。
5. 候補なしの場合は架空候補を表示せず、自由入力が使える状態を維持する。
6. 対象テストと generated web inventory を更新する。

## ドキュメント保守計画

- UI 操作要素が増えるため `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- API / 運用 docs は変更しない。不要理由は作業レポートに記録する。

## 受け入れ条件

- [x] 新規フォルダ作成フォームに、実データ由来の shared group 候補が checkbox multi-select として表示される。
- [x] 候補 checkbox の選択 / 解除が `初期 shared groups` 入力、validation、作成 preview、submit payload に反映される。
- [x] 候補がない場合は架空候補を出さず、自由入力欄だけで編集できる。
- [x] 既存の重複 / 空値 validation と作成 preview が維持される。
- [x] 本番 UI に固定 group、架空 group、固定ユーザー数などの mock fallback を追加しない。
- [x] 対象 web test、typecheck、web inventory check、`git diff --check` が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 候補が実データ由来であり、存在確認済みの Cognito group と誤認させないこと。
- 作成 payload が既存 `onCreateGroup` contract と互換であること。
- validation / preview / disabled condition を弱めていないこと。

## リスク

- Cognito group 一覧 API がないため、候補は「既存フォルダに現れている group」と「現在の入力値」に限定する。存在確認は従来どおり API 作成時に委ねる。

## 完了時の検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`: 初回 fail（依存未展開で `vitest` が見つからず） -> `npm ci` 後 pass
- `npm ci` in `memorag-bedrock-mvp`: pass。npm audit は 3 件の脆弱性を報告したが、依存更新は範囲外。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0` in `memorag-bedrock-mvp`: pass
- `git diff --check`: pass

## PR

- https://github.com/tsuji-tomonori/rag-assist/pull/264
- 受け入れ条件確認コメント: `4419677077`
- セルフレビューコメント: `4419677316`
- semver label: `semver:minor`
