# infra inventory split details

- 状態: done
- タスク種別: 機能追加
- 作成日時: 2026-05-12 23:19 JST

## 背景

既存 PR #278 で AWS リソースインベントリを Markdown/JSON として生成する仕組みを追加した。追加要望として、「リソース別主要設定」以降をリソースごとにファイル分割し、Logical ID ごとに表を分けて、それぞれの設定値を表形式で記載する必要がある。

## 目的

infra inventory の詳細部を読みやすくし、index から resource type 別ファイルへ辿れる構造にする。各 logical id の主要設定値は 1 セル JSON ではなく、設定項目ごとの表として確認できるようにする。

## スコープ

- `memorag-bedrock-mvp/tools/infra-inventory/generate-infra-inventory.mjs` の Markdown 出力構造を変更する。
- `docs/generated/infra-inventory.md` は概要と resource type 別リンクを持つ index にする。
- `docs/generated/infra-inventory/*.md` に resource type 別詳細を生成する。
- 各詳細ファイルでは Logical ID ごとに見出しと設定表を出力する。
- JSON inventory は継続して生成する。

## 受け入れ条件

- [x] `docs/generated/infra-inventory.md` の「リソース別主要設定」以降が type 別詳細ファイルへのリンクになっている。
- [x] `docs/generated/infra-inventory/*.md` が生成され、resource type ごとの詳細を保持する。
- [x] 各詳細ファイルで Logical ID ごとに表が分かれ、設定値が `設定項目` / `値` の表で記載される。
- [x] `npm run docs:infra-inventory:check` が分割ファイルも含めて drift を検出できる。
- [x] README の生成先説明が分割ファイル構造と整合する。

## 検証計画

- `npm run docs:infra-inventory`
- `npm run docs:infra-inventory:check`
- `task docs:infra-inventory:check`
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`
- `git diff --check`

## 実施結果

- `npm run docs:infra-inventory`: pass。`docs/generated/infra-inventory/*.md` を含む分割詳細ファイルを生成。
- `npm run docs:infra-inventory:check`: pass。
- `task docs:infra-inventory:check`: pass。
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`: pass。
- `git diff --check`: pass。

## PRレビュー観点

- index と詳細ファイルのリンクが壊れていないこと。
- stale な詳細ファイルが残らないこと。
- 生成物が大きくなっても、review で構造を追いやすいこと。
