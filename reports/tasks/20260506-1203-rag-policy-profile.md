# RAG Policy / Profile 基盤の導入

保存先: `reports/tasks/20260506-1203-rag-policy-profile.md`

## 背景

RAG / 判定周辺では、`topK`、score 閾値、RRF weight、BM25 parameter、query expansion、domain anchors、invalid answer rule などがコード内に散在している。これらは運用上のデフォルトとして必要なものもあるが、コーパス、tenant、document type、benchmark suite ごとに調整しにくい。

## 目的

RAG の検索・回答・判定方針を profile として集約し、固定値を直接コードへ埋め込む箇所を減らす。後続タスクが domain-specific rule を profile 側へ移せる土台を作る。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/config.ts`
- `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- API schema / debug trace / docs / tests

## 方針

- `RetrievalProfile`、`AnswerPolicy`、`FactExtractionPolicy`、`EvaluatorProfile` のような設定単位を定義する。
- まずは既存挙動を再現する `default` profile を作り、既存値は profile default へ移す。
- profile version を debug trace と benchmark result に残し、後続の calibration と比較を可能にする。
- profile の選択は最初は明示 input または config default に留め、tenant / collection 自動選択は別段階にする。

## 必要情報

- 前回調査レポート: `reports/working/20260506-1157-rag-rule-hardcode-review.md`
- 固定値が集中している箇所:
  - `config.ts`
  - `hybrid-search.ts`
  - `agent/graph.ts`
  - `context-assembler.ts`
- 既存の pipeline version 管理: `memorag-bedrock-mvp/apps/api/src/rag/pipeline-versions.ts`

## 実行計画

1. 現在の固定値を棚卸しし、profile に移す対象と残す対象を分ける。
2. profile 型と `default` profile を追加する。
3. search / agent / context assembly が profile を参照するようにする。
4. debug trace に profile 名と version を追加する。
5. 既存 API の後方互換性を保つため、input 未指定時は既存同等の `default` を使う。
6. 既存テストを更新し、profile 経由でも同じ挙動になることを確認する。
7. docs に profile の目的、選択方法、変更時の注意を追加する。

## 受け入れ条件

- 既存の主要な RAG 固定パラメータが `default` profile から参照されている。
- profile 未指定時の外部 API 挙動が既存と互換である。
- debug trace から使用 profile を確認できる。
- profile を切り替えるための型または設定入口が存在する。
- 関連テストが更新され、既存 RAG / search / agent の主要テストが通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

## 未決事項・リスク

- profile を API input として公開するか、内部 config のみにするかは要判断。
- tenant / collection 単位の profile 永続化は別途設計が必要。
- 既存 benchmark の比較では profile version 差分を考慮する必要がある。
