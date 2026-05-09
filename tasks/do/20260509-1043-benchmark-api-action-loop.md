# GitHub Actions benchmark API 実行ループ

## 背景

GitHub Apps / Codex から GitHub Actions の `workflow_dispatch` を起動し、Actions 側で MemoRAG の benchmark API を呼び出す運用にしたい。UI を起動せず、既存の `POST /benchmark-runs` と成果物 download API を使う。

## 目的

ローカルの GitHub Apps / Codex が GitHub Actions run の状態と artifacts だけを見れば、benchmark run ID、最終状態、summary、report、results を確認できるようにする。

## スコープ

- 既存 `.github/workflows/memorag-benchmark-run.yml` の artifact 出力を強化する。
- API 呼び出し、完了待ち、artifact download の shell を workflow 内に閉じる。
- Codex 改善 PR や auto merge の実装は今回の範囲外とする。

## 計画

1. 既存 benchmark workflow の API 起動処理を確認する。
2. 完了時に run metadata を JSON として保存する。
3. `summary.json`、`report.md`、`results.jsonl` を signed URL 経由で取得して workflow artifact にする。
4. README / operations docs に GitHub Apps からの使い方を補足する。
5. YAML / shell の静的検証を行う。

## ドキュメント保守計画

`memorag-bedrock-mvp/docs/OPERATIONS.md` に、GitHub Apps から workflow を dispatch して artifact を読む運用を追記する。API 仕様そのものは変えないため OpenAPI 生成物は更新しない。

## 受け入れ条件

- [x] `memorag-benchmark-run` workflow が benchmark API 完了後に run metadata を artifact として保存する。
- [x] benchmark が `succeeded` の場合、`summary.json`、`report.md`、`results.jsonl` が artifact として保存される。
- [x] benchmark が失敗した場合も、run metadata と可能な logs URL が確認でき、成功扱いにしない。
- [x] GitHub Apps / Codex から `workflow_dispatch` -> run status -> artifact 取得で結果確認できる運用が docs に記載される。
- [x] 変更範囲に対する最小十分な検証を実行し、未実施検証を明記する。

## 検証計画

- `git diff --check`
- workflow YAML の構文・式・shell 変数の目視確認
- 可能なら `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`

## PR レビュー観点

- secret / token を artifact や log に出さない。
- benchmark artifact の URL 取得失敗を成功扱いしない。
- API の認可境界や benchmark dataset 固有分岐を変更しない。
- GitHub Apps から読むべき成果物が deterministic な path になる。

## リスク

- 実際の GitHub Actions 実行には AWS credentials と Secrets Manager secret が必要なため、ローカルでは workflow 実行自体を検証できない可能性がある。
- signed URL の期限内に workflow が download できることを前提にする。

## 状態

implementation_complete_pending_pr

## 実行した検証

- `git diff --check`: pass
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/memorag-benchmark-run.yml"); puts "yaml ok"'`: pass
- `pre-commit run --files .github/workflows/memorag-benchmark-run.yml memorag-bedrock-mvp/docs/OPERATIONS.md tasks/do/20260509-1043-benchmark-api-action-loop.md`: pass

## 未実施検証

- `actionlint .github/workflows/memorag-benchmark-run.yml`: 未実施。ローカルに `actionlint` がないため。
- 実際の `workflow_dispatch`: 未実施。AWS credentials、GitHub environment、Secrets Manager の operator credential が必要な外部実行のため。
