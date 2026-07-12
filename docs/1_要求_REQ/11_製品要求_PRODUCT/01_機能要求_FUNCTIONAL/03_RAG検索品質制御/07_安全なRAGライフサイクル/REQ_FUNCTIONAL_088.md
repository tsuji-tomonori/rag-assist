# FR-088 trace data minimization/redaction

- 要件ID: `FR-088`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-088`
- 関連カテゴリ: `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`

## 要件

- FR-088: システムは、trace の収集、保存、表示、download を承認済み診断目的の allowlisted field に最小化し、永続化または外部出力の前に機微値と権限外内容を redaction すること。

## 根拠と意図

trace は再現性に有用だが、raw question、会話、根拠、回答、ACL、secret を集積すると knowledge base より危険な複製になる。redacted field 名の宣言ではなく、保存・出力される実データへ policy を適用する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-088` |
| 説明 | purpose-bound trace field allowlist と save/export 前 redaction |
| 根拠 | debug artifact への secret、個人情報、権限外 evidence の残存を防ぐ |
| 源泉 | `FR-074`、`docs/spec-recovery/16_current_state_gap_analysis_202607.md` の `GAP-RD-018`、RAG ガイド §8.4（PDF pp.195–197） |
| Actor / trigger | API/worker が trace を収集、保存、表示または download するとき |
| 種類 | 機能要求 / observability / privacy / security |
| 依存関係 | `FR-056`–`FR-060`, `FR-070`, `FR-074` |
| 衝突 | raw question/history/evidence/answer の保存と redactedFields metadata だけに依存する方式 |
| 受け入れ基準 | `AC-FR088-001`, `AC-FR088-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Privacy / RAG Ops |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR088-001 minimize and redact before persistence

- Given: trace 候補に raw credential、secret、個人情報、raw question/history、retrieved text、answer、ACL、権限外 chunk が含まれる
- When: trace record または artifact を永続化する
- Then: purpose/visibility 別 field allowlist と field/content redaction を書き込み前に適用し、不要な raw 値と権限外内容を保存せず、redaction 不能時は当該 field または record の保存を fail closed にする

### AC-FR088-002 minimized view and download

- Given: canary secret と別 tenant/corpus の文字列を含む trace fixture があり、trace 閲覧権限を持つ operator がいる
- When: operator が trace を表示または download する
- Then: 許可された診断 field だけを返し、canary secret、権限外本文、不要な個人識別値を一件も含めず、metadata 上の redaction 宣言だけで成功扱いにしない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | trace を二次的な機微データ集積にしないために必要 |
| 十分性 | OK | 目的制約、field allowlist、保存前 redaction、表示/download、fail closed を含む |
| 理解容易性 | OK | 再現情報の選定ではなく trace data の最小化境界に限定した |
| 一貫性 | OK | `FR-074` の再現可能 trace に追加する保存・出力制約である |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | schema projection、field/content sanitizer、visibility policy で実現可能 |
| 検証可能性 | OK | secret/PII/unauthorized canary の stored/view/download assertion で確認できる |
| ニーズ適合 | OK | 調査可能性を保ちながら trace 経由の情報漏えいを防ぐ |
| 実装適合 | OK（confirmed） | save/view/download 共通の `trace-sanitizer.ts` が secret/PII/raw body/unauthorized evidence を allowlist/hash/redaction し、sanitizer/graph tests が生値非保存を検証する |

## トレース

- 後方: `FR-074`、`GAP-RD-018`、debug trace redaction 作業レポート。
- 前方: trace visibility schema、save/export sanitizer、secret/unauthorized fixture tests。
