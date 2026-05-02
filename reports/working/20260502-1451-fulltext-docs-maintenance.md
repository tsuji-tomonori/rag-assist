# 全文検索 hybrid retriever ドキュメント整備レポート

## 受けた指示

- Athena は必要なところだけに留め、本懐である全文検索のより良い実装が通常チャット経路まで届いているか見直す。
- 別ブランチで作業を進め、push と PR 作成を行う。
- 追加で、要求、アーキテクチャ、設計もメンテする。

## 要件整理

- 通常の `POST /chat` が vector-only evidence search のままでは、`POST /search` の hybrid retrieval 改善が本線の回答品質へ反映されない。
- 要求は 1 要件 1 ファイルで管理し、集約ファイルは索引として同期する。
- Athena はオンライン全文検索 API ではなく、分析、評価、batch index 生成、低頻度 fallback に限定する方針と整合させる。

## 検討・判断

- 新規機能要求 `FR-026` を追加し、通常チャットの `search_evidence` が lightweight lexical retrieval、S3 Vectors semantic search、RRF を統合した hybrid retriever を使う条件を明文化した。
- `FR-023` と `NFR-012` は既存ファイルがあるが索引やトレーサビリティから漏れていたため、今回の範囲で整合させた。
- 設計は実装済みの `retrievalDiagnostics` の shape に合わせ、agent 側は `indexVersions` / `aliasVersions` の配列として扱うように記述した。

## 実施作業

- `REQ_FUNCTIONAL_026.md` を追加し、チャット回答経路への hybrid retriever 統合要件と受け入れ条件を定義した。
- `REQUIREMENTS.md` と `REQ_CHANGE_001.md` の索引・トレーサビリティへ `FR-023`、`FR-026`、`NFR-012` を反映した。
- `ARCHITECTURE.md`、`ARC_VIEW_001.md`、`ARC_ADR_001.md`、`ARC_QA_001.md` を更新し、通常チャット本線での lexical / semantic / RRF 構成と Athena の限定的位置づけを反映した。
- `DES_HLD_001.md`、`DES_DATA_001.md`、`DES_API_001.md`、`DES_API_002.md` を更新し、Hybrid Retriever、retrieval diagnostics、debug trace 出力規則を設計に反映した。
- `REQ_ACCEPTANCE_001.md` に通常チャットの hybrid evidence 検索シナリオを追加した。

## 成果物

- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_026.md`
- `memorag-bedrock-mvp/docs/REQUIREMENTS.md`
- `memorag-bedrock-mvp/docs/ARCHITECTURE.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/21_受入基準_ACCEPTANCE/REQ_ACCEPTANCE_001.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
- `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_002.md`

## 指示への fit 評価

- 要求、アーキテクチャ、設計のいずれも、PR #75 の実装済み hybrid retriever 統合に合わせて更新した。
- Athena は本線検索 API ではなく補助・分析用途に限定する判断を ADR に反映した。
- 実装変更は追加していないため、今回の追加作業はドキュメント整合に集中している。

## 検証

- `git diff --check`: Pass
- `git ls-files -m -o --exclude-standard -z | xargs -0 pre-commit run --files`: Pass

## 未対応・制約・リスク

- 今回は docs-only 追加のため、API typecheck/test/build は再実行していない。PR #75 のコード実装時には API typecheck、API tests、lint、API build、`git diff --check` を実行済み。
- `retrievalDiagnostics` の schema は現行実装に合わせて記載したが、将来の search metrics 増加時は `DES_DATA_001.md` と `DES_API_002.md` の追記が必要になる。
