# 要件定義（1要件1ファイル）

- 要件ID: `FR-014`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `4. 回答検証・ガードレール`
- L2主機能群: `4.1 回答前ガード`
- L3要件: `FR-014`
- 関連カテゴリ: なし


## 要件

- FR-014: 回答生成前に、システムは検索済みチャンクだけで質問へ回答可能かを `ANSWERABLE`、`PARTIAL`、`UNANSWERABLE` のいずれかで判定すること。

## 受け入れ条件（この要件専用）

- AC-FR014-001: 判定結果に `label`、`confidence`、`requiredFacts`、`supportedFacts`、`missingFacts`、`supportingChunkIds`、`reason` が含まれること。
- AC-FR014-002: チャンク0件、上位スコア不足、選択チャンクなしの場合は LLM judge を呼ばずに拒否できること。
- AC-FR014-003: `UNANSWERABLE` の場合、最終回答は `資料からは回答できません。` になること。
- AC-FR014-004: 判定結果は debug trace または state から確認できること。
- AC-FR014-005: `PARTIAL` の場合でも、質問へ直接必要な primary fact が検索済み evidence で支持され、missing / conflicting が secondary または inferred fact に限られる場合は、回答生成へ進めること。
- AC-FR014-006: primary fact が missing または unresolved conflicting の場合は、`PARTIAL` でも回答生成前に拒否できること。

## 要件の源泉・背景

- 源泉: ユーザー提示の PM 方針、現行 `answerability-gate.ts` の実装確認。
- 背景: 現行 gate は chunk 数、score、正規表現ベースの coverage 判定が中心であり、資料外推測を防ぐには弱い。一方で、primary fact が根拠で支持されている場合に secondary / inferred fact の不足だけで hard refusal すると、回答可能な質問を過剰拒否する。

## 要件の目的・意図

- 目的: 資料から回答できない質問に回答しない品質を上げる。
- 意図: Sufficient Context 型の判定を導入し、最終回答前の許可判定を明示する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-014` |
| 説明 | 回答前に evidence の十分性を判定する |
| 根拠 | 社内RAGでは誤回答より不回答の方が望ましい場面がある |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `selectedChunks`、`answerability` state、Bedrock text model |
| 衝突 | LLM judge 呼び出しによる遅延とコスト増 |
| 受け入れ基準 | `AC-FR014-001` から `AC-FR014-006` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版、2026-05-07 primary fact 支持時の `PARTIAL` 継続条件を追加 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 回答禁止品質の中核 |
| 十分性 | OK | 判定結果と拒否動作を含む |
| 理解容易性 | OK | 3値 label で明確 |
| 一貫性 | OK | 既存 `answerability` と整合 |
| 標準・契約適合 | OK | 社内資料根拠方針に合う |
| 実現可能性 | OK | 既存 node 追加で実装可能 |
| 検証可能性 | OK | state と最終回答で検証可能 |
| ニーズ適合 | OK | ユーザー要求の最優先価値に対応 |
