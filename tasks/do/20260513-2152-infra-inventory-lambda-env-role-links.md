# infra inventory lambda env role links

- 状態: do
- タスク種別: 機能追加
- 作成日時: 2026-05-13 21:52 JST

## 背景

Lambda の `environment` が JSON 文字列として 1 セルに出ており読みづらい。また `role` が `GetAtt:...Arn` の文字列だけで、作成された IAM Role 詳細へ辿れない。

## 目的

Lambda 詳細の可読性を上げるため、environment variables を key/value 表として別記し、role は生成済み IAM Role 詳細へのリンクにする。

## 受け入れ条件

- [ ] Lambda 詳細ファイルで `environment` が key/value 表として別章表示される。
- [ ] Lambda の `role` が IAM Role 詳細ファイルの該当論理IDへリンクする。
- [ ] `npm run docs:infra-inventory:check` が pass する。

## 検証計画

- `npm run docs:infra-inventory`
- `npm run docs:infra-inventory:check`
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`
- `git diff --check`

## 実施結果

- `npm run docs:infra-inventory`: pass。Lambda environment を別表化し、role link を生成。
- `npm run docs:infra-inventory:check`: pass。
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`: pass。
- `git diff --check`: pass。
