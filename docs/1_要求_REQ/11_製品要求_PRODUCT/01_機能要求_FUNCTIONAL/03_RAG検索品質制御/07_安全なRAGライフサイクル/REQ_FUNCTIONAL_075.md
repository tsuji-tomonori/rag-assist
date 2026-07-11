# FR-075 工程別評価と公開ゲート

- 要件ID: `FR-075`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-075`
- 関連カテゴリ: `4. 回答検証・ガードレール`, `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`

## 要件

- FR-075: システムは、取り込み、検索、根拠選別、生成、引用、認可・攻撃耐性、end-to-end を別々に評価し、versioned な合格条件の論理積で RAG 変更の公開可否を判定すること。

## 根拠と意図

最終回答の平均点だけでは、検索漏れ、根拠喪失、権限漏えい、誤拒否を区別できない。dataset 固有の期待語句や case 分岐を product code へ入れず、実本番経路を評価する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-075` |
| 説明 | stage-level RAG evaluation と promotion gate |
| 根拠 | 品質・安全・性能の退行を原因別に検出する |
| 源泉 | RAG ガイド §7（PDF pp.156–185）、§3.8（PDF pp.93–97） |
| Actor / trigger | RAG policy/model/prompt/index/pipeline を変更・公開するとき |
| 種類 | 機能要求 / evaluation / release |
| 依存関係 | `FR-068`–`FR-074`, `FR-084`, `FR-088`, `FR-089`, benchmark datasets, `SQ-005`–`SQ-015` |
| 衝突 | executable promotion runner は未配線で、product code に固定語句/profile 分岐がある |
| 受け入れ基準 | `AC-FR075-001`, `AC-FR075-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | QA / RAG Quality / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR075-001 工程別・slice 別評価

- Given: versioned dataset に source snapshot と期待 extraction/span、admission/quarantine 結果、正解 document/span、answerability、tenant/role/ACL、基準日時、質問類型、重大度がある
- When: candidate change を評価する
- Then: extraction coverage、parser/OCR accuracy、silent truncation、locator validity、chunk boundary/overlap/structure、manifest integrity、admission/quarantine correctness に加え、retrieval recall/precision、evidence retention、faithfulness、claim-citation support、refusal/false-answer、ACL leak、injection、latency/cost を工程・重要 slice 別に記録する

### AC-FR075-002 promotion gate

- Given: approved threshold profile、current baseline、candidate の変更目的があり、改善を主張する目的には対象 metric/slice/direction/minimum delta の approved improvement criterion があり、評価 dataset の expected field が product runtime input から隔離されている
- When: candidate を promotion 判定する
- Then: production と同じ runtime path/profile で ingest 完全性、approved threshold、non-regression、重要 slice、安全性、性能、費用をすべて満たし、改善を主張する場合だけ対応 criterion も満たしたとき合格とし、中立な security/reliability fix に無関係な改善を必須化せず、silent truncation、published artifact/manifest 不整合、dataset 固有分岐、閾値未承認、critical leak 1 件以上のいずれかがあれば合格扱いにしない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 最終平均だけで検索漏れ、根拠喪失、権限漏えい、誤拒否、性能退行を隠すことを防ぐために必要 |
| 十分性 | OK | extraction/chunk/admission/manifest を含む ingest、retrieval、evidence、generation、citation、security、E2E の工程別・slice 別評価、threshold/non-regression、目的固有 improvement 判定を扱う |
| 理解容易性 | OK | 評価単位、必要 dataset 属性、合格条件の論理積、未承認値の扱いを明示した |
| 一貫性 | OK | 既存 `FR-019` / `FR-045` と `SQ-005`–`SQ-015` を統合し、安全縮退は `FR-089` に分離した |
| 標準・契約適合 | OK | RAG ガイドの stage-level evaluation と SWEBOK の versioned trace/validation に適合する |
| 実現可能性 | OK | versioned dataset/profile、既存 benchmark runner、CI/release report を拡張して実現できる |
| 検証可能性 | OK | executable suite summary、critical slice result、gate decision、production-equivalence check で確認できる |
| ニーズ適合 | OK | 利用者・業務責任者が品質と安全性を満たす RAG 版だけを利用できる |
| 原子性 | OK | RAG change の promotion decision を規定する |
| 実装適合 | partial/NG | benchmark 指標はあるが runner/gate と production equivalence が不足 |
| 合意 | pending | slice、閾値、モデル judge、費用上限が未確定 |

## トレース

- 後方: `FR-019`, `FR-039`, `FR-045`, `FR-047`, `FR-048`, RAG ガイド §7。
- 前方: executable promotion runner、product-source/expected-field taint scan、`SQ-005`–`SQ-015`, CI/release policy。
