# ドキュメント共有 group 選択 UI 改善

状態: do

## 背景

ドキュメント管理 UI/UX 改善案の P1 として、共有設定を `Cognito group` のカンマ区切り文字入力から選択式へ寄せる提案がある。最新 main では共有差分 preview と重複 / 空値 validation は実装済みだが、入力欄はまだカンマ区切りが主導で、既存共有 group から選ぶ導線がない。

## 目的

API から独立した架空 group 一覧を出さず、既存 `documentGroups[].sharedGroups` と現在の入力値から導ける実データ由来の候補だけを multi-select 風に提示し、共有 group の選択・解除を安全にする。

## タスク種別

機能追加

## スコープ

- `DocumentWorkspace` の共有 group 候補算出。
- `DocumentDetailPanel` の共有設定フォーム。
- `documents.css` の選択 UI スタイル。
- `DocumentWorkspace` 関連テスト。
- generated web inventory。

## 非スコープ

- Cognito group 一覧 API の新規追加。
- group 名の実在確認 API 追加。
- 新規フォルダ作成フォーム側の shared groups 入力変更。

## 実装計画

1. 既存の共有設定フォーム、差分 preview、validation を確認する。
2. 実データ由来の共有 group 候補を算出する。
3. 候補を checkbox multi-select として表示し、クリックで `shareGroups` 文字列へ反映する。
4. 候補がない場合は正直に「候補なし」を表示し、自由入力を継続できるようにする。
5. 既存 validation / diff / submit payload の挙動を維持する。
6. 対象テスト、web typecheck、lint、inventory check、diff check を実行する。

## ドキュメント保守計画

- UI 操作要素が増えるため generated web inventory を更新する。
- API / 運用手順は変更しないため durable docs は更新不要と判断する。

## 受け入れ条件

- [ ] 共有設定フォームに、実データ由来の shared group 候補が checkbox multi-select として表示される。
- [ ] 候補 checkbox の選択 / 解除が `shareGroups` 入力、validation、差分 preview、submit payload に反映される。
- [ ] 候補がない場合は架空候補を出さず、自由入力欄だけで編集できる。
- [ ] 既存の重複 / 空値 validation と共有差分 preview が維持される。
- [ ] 本番 UI に固定 group、架空 group、固定ユーザー数などの mock fallback を追加しない。
- [ ] 対象 web test、typecheck、lint、web inventory check、`git diff --check` が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0` in `memorag-bedrock-mvp`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 候補が実データ由来であり、存在確認済みの Cognito group と誤認させないこと。
- 共有 payload が既存 `onShareGroup` contract と互換であること。
- validation / diff preview / disabled condition を弱めていないこと。

## リスク

- Cognito group 一覧 API がないため、候補は「既存フォルダに現れている group」と「現在の入力値」に限定する。存在確認は従来どおり API 更新時に委ねる。
