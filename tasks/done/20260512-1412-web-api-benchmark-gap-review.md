# web / api / benchmark 実装ベース仕様漏れ確認

- 状態: done
- 作成日時: 2026-05-12 14:12
- 対象: `memorag-bedrock-mvp/apps/web/src`, `memorag-bedrock-mvp/apps/api/src`, `memorag-bedrock-mvp/benchmark`

## 指示

ユーザー指示:

> web/app/benchmaerk すべて確認し、漏れを反映して。/plan

`app` は repository 構成上 `apps/api`、`benchmaerk` は `benchmark` の typo と解釈する。

## 受け入れ条件

- `apps/web/src`、`apps/api/src`、`benchmark` の実装ファイル一覧を起点に未記載候補を再確認する。
- 既存成果物 `.workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md` に漏れを追記する。
- confirmed / inferred / open_question を区別する。
- commit / PR は作成しない。
- 最終回答前に `reports/working/` に作業レポートを残す。

## Done 条件

- 追補ファイルへ web / api / benchmark の追加漏れを反映する。
- 参照した主要ファイルと追加項目数を記録する。
- task を done に移動する。

## 完了結果

- `.workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md` に 11 件を追記した。
- 確認範囲として `apps/web/src` 155 files、`apps/api/src` 139 files、`benchmark` 74 files を記録した。
- 検証として追補ファイルの行数と見出し・追加項目を確認した。
