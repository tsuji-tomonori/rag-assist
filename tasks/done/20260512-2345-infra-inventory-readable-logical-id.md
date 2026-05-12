# infra inventory readable logical id

- 状態: done
- タスク種別: 機能追加
- 作成日時: 2026-05-12 23:45 JST

## 背景

resource type 別詳細ファイルでは、設定章タイトルが CloudFormation のハッシュ付き `Logical ID` になっており、人が読むには分かりにくい。Logical ID 一覧も、読みやすい論理IDと実際の Logical ID の対応が見えない。

## 目的

詳細ファイルを人が読みやすくするため、論理ID（ハッシュを落とした人間向け名称）と CloudFormation Logical ID を併記し、各設定章タイトルを論理IDにする。

## 受け入れ条件

- [x] `Logical ID 一覧` が `論理ID` と `Logical ID` を示す。
- [x] 各種設定値の章タイトルが論理IDになっている。
- [x] 章内に実際の `Logical ID` が確認できる。
- [x] `npm run docs:infra-inventory:check` が pass する。

## 検証計画

- `npm run docs:infra-inventory`
- `npm run docs:infra-inventory:check`
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`
- `git diff --check`

## 実施結果

- `npm run docs:infra-inventory`: pass。詳細ファイルの一覧と章タイトルを再生成。
- `npm run docs:infra-inventory:check`: pass。
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`: pass。
- `git diff --check`: pass。
