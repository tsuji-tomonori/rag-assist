# 回答生成周辺の未記載機能・処理再棚卸し

状態: done

## 背景

前回の `.workspace/rag-assist_仕様追加_統合版_未記載機能処理棚卸し.md` について、ユーザーから「ホントに全量? レポートやtaskをもとに、もれている機能がないか網羅的に確認して。特に回答生成回り」と追加確認を受けた。

## 目的

`reports/` と `tasks/` を主な根拠として、特に回答生成、回答不能、引用検証、マルチターン、会話履歴、context / memory、検索評価周辺で前回棚卸しから漏れた項目を追補する。

## タスク種別

調査

## スコープ

- `reports/working/`、`reports/bugs/`、`reports/tasks/`
- `tasks/todo/`、`tasks/do/`、`tasks/done/`
- 回答生成周辺の API / agent / rag / web chat 実装
- `.workspace` への追補レポート出力
- commit / push / PR は実施しない

## 受け入れ条件

- [x] 回答生成周辺の漏れ候補が根拠付きで整理されている。
- [x] 前回棚卸しに含まれていた項目と、今回追補した項目が区別されている。
- [x] `tasks/` と `reports/` の確認範囲が明記されている。
- [x] `.workspace` に追補レポートが作成されている。
- [x] commit / push / PR を実施していない。
- [x] 実施した検証と制約が明記されている。

## 成果物

- `.workspace/rag-assist_仕様追加_統合版_回答生成周辺_未記載追補.md`

## 検証結果

- `git diff --check`: pass
- `rg -n "[[:blank:]]$" .workspace/rag-assist_仕様追加_統合版_回答生成周辺_未記載追補.md tasks/do/20260512-1358-answer-generation-gap-review.md`: pass
- 追補レポートの目視確認: pass

## 制約

- 数百件の reports を逐語的に全件精読したわけではなく、回答生成周辺キーワードで候補を抽出し、該当 task/report と実装を重点確認した。
- `.workspace` は git 管理対象外のため、主成果物は `git status` に表示されない。
