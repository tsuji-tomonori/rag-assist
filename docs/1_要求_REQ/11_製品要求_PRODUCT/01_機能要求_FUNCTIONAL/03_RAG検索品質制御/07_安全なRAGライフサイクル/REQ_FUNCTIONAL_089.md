# FR-089 safe degradation invariant

- 要件ID: `FR-089`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-089`
- 関連カテゴリ: `4. 回答検証・ガードレール`, `8. 認証・認可・管理・監査`

## 要件

- FR-089: システムは、dependency 障害、timeout、overload または cost limit による retry、fallback、縮退経路でも、authentication/authorization、data classification/usage、prompt-injection/tool policy、grounding、citation、output secret guard、trace redaction を維持し、維持できない場合は限定回答、保留または失敗を返すこと。

## 根拠と意図

可用性や費用のために安全 control を外すと、障害時ほど権限外情報、未分類資料、根拠なし回答、誤引用を返しやすくなる。縮退は回答能力を狭めてもよいが、安全境界を狭めてはならない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-089` |
| 説明 | retry/fallback/degradation path の safety guard invariant |
| 根拠 | 障害・高負荷・費用上限時の security/grounding bypass を防ぐ |
| 源泉 | `SQ-008`、RAG ガイド §8.5–8.6（PDF pp.198–203）、`docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` |
| Actor / trigger | runtime が timeout、circuit open、dependency failure、overload、cost limit を検出するとき |
| 種類 | 機能要求 / resilience / security / RAG safety |
| 依存関係 | `FR-068`, `FR-070`, `FR-071`, `FR-073`, `FR-075`, `FR-088`, `SQ-008` |
| 衝突 | latency/cost を優先して認可 filter、classification、support/citation validation を省略する fallback |
| 受け入れ基準 | `AC-FR089-001`, `AC-FR089-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | SRE / Security / RAG Quality |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR089-001 dependency degradation

- Given: vector DB、LLM、OCR、classification service、cache のいずれかが timeout、error または circuit open になり、代替経路候補がある
- When: runtime が retry、fallback または縮退を選択する
- Then: authentication/authorization、tenant filter、classification/usage、prompt-injection/tool policy、grounding、citation、output secret guard、trace redaction を通常経路と同等に強制し、いずれかを強制できなければ権限外・未分類・攻撃由来・根拠なし・未 redaction の結果を返さず、限定回答、保留または失敗を選ぶ

### AC-FR089-002 unsafe fallback rejection

- Given: fast/degraded profile または cost/load policy が一つ以上の必須 guard を無効化する構成を要求する
- When: profile を有効化するか、その経路へ routing する
- Then: 構成または route を拒否し、guard 省略経路を実行せず、全 fallback path の結果に authorization、classification/usage、injection/tool、grounding、citation、secret/output、redaction の判定記録を残す

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 障害・高負荷時に安全境界を外さないために必要 |
| 十分性 | OK | 主な縮退 trigger、authorization/classification/injection/tool/grounding/citation/secret/redaction guard、unsafe profile 拒否、安全側の結果を含む |
| 理解容易性 | OK | 性能目標ではなく縮退時に維持する一つの safety invariant に限定した |
| 一貫性 | OK | `SQ-008` の品質制約を runtime の観測可能な振る舞いへ具体化する |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | guard 共通 pipeline、profile validation、fail-closed routing で実現可能 |
| 検証可能性 | OK | dependency fault injection と guard-bypass profile negative test で確認できる |
| ニーズ適合 | OK | 可用性を追求して機密性・根拠性・引用正確性を犠牲にしない |
| 実装適合 | partial | 個別 timeout はあるが全 fallback path の guard parity 契約は不足する |

## トレース

- 後方: `SQ-008`、`FR-068`、`FR-070`、`FR-071`、`FR-073`、`FR-088`。
- 前方: fallback policy validator、dependency fault-injection suite、safe degradation promotion gate。
