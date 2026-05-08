# RAG Policy / Profile 基盤の導入

保存先: `tasks/done/20260506-1203-rag-policy-profile.md`

## 状態

- done

## 着手時チェックリスト

- [x] `origin/main` から専用 worktree を作成する。
- [x] task file を `tasks/todo/` から `tasks/do/` に移動する。
- [x] 既存実装の有無を確認し、不足している受け入れ条件だけを補完対象にする。
- [x] profile 型、default profile、resolver、debug trace、benchmark 出力、docs の不足を補完する。
- [x] API typecheck / test / build / lint と必要な benchmark を実行する。
- [x] 作業レポートを `reports/working/` に作成する。
- [x] commit / push / PR 作成 / 受け入れ条件コメント / セルフレビューコメントを完了する。
- [x] PR コメント後に task を `tasks/done/` へ移動して同一 branch に反映する。

## PR

- https://github.com/tsuji-tomonori/rag-assist/pull/191
- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み

## Done 条件

- 受け入れ条件を満たす実装・テスト・docs 更新が同一 branch に含まれる。
- 実施した検証と未実施検証の理由が task / report / PR に記録される。
- PR が `main` 向けに作成され、受け入れ条件確認コメントとセルフレビューコメントが付く。
- task file が `状態: done` 相当へ更新され、`tasks/done/` に移動済みである。

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
- profile の選択は v1 では内部 config と benchmark suite config に限定し、通常 `/chat` の公開 API input には追加しない。
- tenant / collection 単位の profile 永続化は v1 の対象外とし、将来拡張用に profile resolver の interface だけを分離する。
- profile 関連の trace / benchmark 出力は profile id と version だけを通常表示し、内部 rule、ACL metadata、alias 定義、raw prompt は出さない。

## 必要情報

- 前回調査レポート: `reports/working/20260506-1157-rag-rule-hardcode-review.md`
- 固定値が集中している箇所:
  - `config.ts`
  - `hybrid-search.ts`
  - `agent/graph.ts`
  - `context-assembler.ts`
- 既存の pipeline version 管理: `memorag-bedrock-mvp/apps/api/src/rag/pipeline-versions.ts`
- 関連要求・設計:
  - `FR-014`, `FR-016`, `FR-017`, `FR-018`, `FR-019`, `FR-026`
  - `SQ-001`, `NFR-010`, `NFR-012`, `TC-001`
  - `ASR-GUARD-001`, `ASR-RETRIEVAL-001`, `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. 現在の固定値を棚卸しし、profile に移す対象と残す対象を分ける。
2. profile 型と `default` profile を追加する。
3. search / agent / context assembly が profile を参照するようにする。
4. debug trace に profile 名と version を追加する。
5. 既存 API の後方互換性を保つため、input 未指定時は既存同等の `default` を使う。
6. 既存テストを更新し、profile 経由でも同じ挙動になることを確認する。
7. `memorag-bedrock-mvp/docs` の requirements / architecture / design / operations への影響を確認し、必要な docs を同じ PR で更新する。
8. docs に profile の目的、選択方法、変更時の注意、rollback 方針を追加する。

## ドキュメントメンテナンス計画

- 要求仕様: `FR-014`、`FR-016`、`FR-017`、`FR-018`、`FR-019`、`FR-026`、`SQ-001`、`NFR-010`、`NFR-012`、`TC-001` の受け入れ条件へ、profile id / version、debug trace、benchmark 比較、露出制御の影響を反映するか確認する。
- architecture / design: RAG workflow、Hybrid Retriever、Retrieval Evaluator、Answerability Gate、Debug Trace Store、Benchmark Runner に影響するため、`DES_HLD_001`、該当 DLD、`DES_DATA_001`、`DES_API_001` の更新要否を確認する。
- README / API examples / OpenAPI: 通常 `/chat` の公開 input に profile 指定を追加しない v1 方針なので、API schema 変更がない場合は OpenAPI / API examples は更新不要と PR 本文に明記する。trace / benchmark response に optional field を追加する場合は更新する。
- local verification / operations: profile 切り替え、benchmark 比較、rollback、debug trace 確認の手順を `docs/LOCAL_VERIFICATION.md` または `docs/OPERATIONS.md` に追記する。
- PR 本文: docs 更新ファイル、更新不要と判断した docs、その理由、未実施の benchmark / smoke を明記する。

## 受け入れ条件

- 既存の主要な RAG 固定パラメータが `default` profile から参照されている。
- profile 未指定時の外部 API 挙動が既存と互換である。
- debug trace から使用 profile を確認できる。
- profile を切り替えるための型または設定入口が存在する。
- `/chat` の既存 request / response は profile 未指定で壊れない。
- debug trace / benchmark report に profile id と version が出るが、内部 alias、ACL metadata、raw prompt、機密 chunk text は通常利用者へ露出しない。
- `FR-*` / `NFR-*` / `SQ-*` / `TC-*`、architecture / design docs の更新要否が PR 本文で説明されている。
- 関連テストが更新され、既存 RAG / search / agent の主要テストが通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run lint`
- profile が benchmark に影響する場合: `task benchmark:sample`
- `git diff --check`

## 実施した検証

- `npm --prefix memorag-bedrock-mvp exec -w @memorag-mvp/api -- tsx --test src/contract/schemas.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp exec -w @memorag-mvp/benchmark -- tsx --test run.test.ts search-run.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回は `service executes asynchronous document ingest runs from uploaded object` が event 重複観測で fail。該当 file 単体 pass 後、同じ full test を再実行して pass。
- `npm --prefix memorag-bedrock-mvp exec -w @memorag-mvp/api -- tsx --test src/rag/memorag-service.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `task benchmark:sample`: pass
- `task benchmark:search:sample`: pass
- `git diff --check`: pass

## 実施内容

- `DebugTraceSchema` に `ragProfile` を追加し、OpenAPI / schema contract でも profile id / version を確認できるようにした。
- agent benchmark report に `RAG profile` 行を追加し、debug trace に含まれる RAG profile / retrieval profile / answer policy の id と version を出力するようにした。
- search benchmark report の summary と row details に retrieval profile を出力するようにした。
- profile 出力が内部 rule、raw prompt、ACL metadata、alias 定義を含まないことを schema test / benchmark runner test で確認した。

## PRレビュー観点

- semver は、公開 API を増やさず内部 profile 化だけなら `patch`、profile 選択を config / benchmark suite の新機能として提供するなら `minor` を推奨する。
- PR 本文に背景、変更内容、影響範囲、確認内容、未確認事項、作業レポートへの参照を書く。
- RAG workflow の責務分離を崩さず、retrieval、rerank、answerability gate、citation validation、support verification の責務が混ざっていないことを確認する。
- docs と実装を同期し、`ASR-GUARD-001`、`ASR-RETRIEVAL-001`、`ASR-EVAL-001`、`ASR-SEC-*` に反しないことを確認する。
- RAG 品質では answerable accuracy だけでなく refusal precision、unsupported rate、citation hit rate、debug trace の説明可能性を見る。
- security では debug trace / benchmark artifact / alias / ACL metadata の露出範囲を確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: v1 では通常 `/chat` の公開 API input には profile 指定を追加せず、内部 config と benchmark suite config で選択する。
- 決定事項: tenant / collection 単位の profile 永続化は v1 では実装せず、将来拡張用の resolver interface に留める。
- 決定事項: benchmark 比較は同一 profile id / version 同士を原則とし、不一致の場合は report 上で比較不可または参考値として明示する。
- リスク: profile 化により値の参照経路が増えるため、default profile の回帰テストが不足すると既存挙動差分を見落とす。
