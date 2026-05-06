# MemoRAG MVP RAG 詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

RAG workflow の処理手順、判定、例外処理、テスト観点を定義する。

## 対象

- `analyze_input`
- `normalize_query`
- `retrieve_memory`
- `generate_clues`
- `embed_queries`
- `search_evidence`
- `retrieval_evaluator`
- `rerank_chunks`
- `answerability_gate`
- `generate_answer`
- `validate_citations`
- `verify_answer_support`
- `finalize_response`
- `finalize_refusal`
- `estimate_cost`

## 入出力

| 処理 | 入力 | 出力 |
| --- | --- | --- |
| `answerability_gate` | question、candidate evidence chunks | `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE`、reason |
| `validate_citations` | answer、citations、candidate chunks | 引用ID検証済み answer、citations |
| `verify_answer_support` | answer、cited evidence chunks | supported、unsupportedSentences、supportingChunkIds、reason |
| `retrieval_evaluator` | retrieved chunks、required facts、action history | retrievalQuality、missingFactIds、conflictingFactIds、riskSignals、llmJudge、nextAction、reason |
| `rank_fusion` | ranked chunk lists | fused ranked chunks、score details |
| `estimate_cost` | usage meter、pricing catalog | service/component 別の概算料金 |

## 処理手順

### Runtime policy

1. RAG runtime の検索件数、検索実装上限、検索 budget、score 正規化、memory / clue 件数、citation 件数、確認質問 option 件数は `agent/runtime-policy.ts` の `ragRuntimePolicy` を唯一の参照元にする。
2. LLM 呼び出しの `temperature` と `maxTokens` は `llmOptions()` を通して、clue、memory card、retrieval judge、sufficient context judge、answer support verifier、repair、final answer の用途別に決定する。
3. 回答可能性、partial evidence 継続、LLM judge による conflict 解消、answer support verifier の fallback、確認質問 gate の confidence は `ragRuntimePolicy.confidence` から取得する。
4. `config.ts` は `RAG_*` 環境変数を読み取り、`runtime-policy.ts` は範囲を clamp して本番運用で不正値が workflow や `/search` 実装に流れないようにする。
5. retrieval parameter、BM25 parameter、RRF parameter、answer policy は profile として id / version を持ち、debug trace と benchmark artifact に記録する。
6. SWEBOK 要求分類固有の anchor や invalid answer pattern は default path に置かず、document metadata または内部 config で選択された domain policy から参照する。
7. 新しい RAG 判定値、件数上限、LLM 呼び出し設定を追加する場合は、node 内に直書きせず `config.ts` と `runtime-policy.ts` を先に拡張する。

### 回答可能性判定

1. 検索済み evidence chunk から質問に必要な fact を抽出する。
2. evidence だけで主要 fact を満たせる場合は `ANSWERABLE` とする。
3. 一部だけ満たせる場合は `PARTIAL` とし、追加検索または限定回答を候補にする。
4. 根拠不足の場合は `UNANSWERABLE` とし、回答生成へ進めない。
5. 判定結果、理由、参照 chunk_id を debug trace に保存する。

### 検索評価と action 選択

1. 候補 chunk 数、top score、required fact coverage を評価する。
2. 必要事実がすべて evidence で支持される場合は `retrievalQuality=sufficient` とし、`nextAction=rerank` を選ぶ。
3. 一部の必要事実が不足する場合は `retrievalQuality=partial` とし、不足 fact を含めた追加 evidence search、または既に支持された chunk の隣接 context 展開を選ぶ。
4. 関連 evidence がない、または score が低すぎる場合は `retrievalQuality=irrelevant` とし、未実施であれば `query_rewrite`、実施済みであれば search budget の範囲で追加 evidence search を選ぶ。
5. `期限`、`条件`、`手順`、`方法`、`資料` のような汎用語だけの fact は単独では supported とせず、compound term や値 anchor を伴う evidence で判定する。
6. `RequiredFact` は fact type、subject、scope、expected value type、confidence、planner source を optional field として持ち、deterministic planner が hot path で補完する。
7. 同一 required fact の high-score chunk 間で期限・金額・期間・回数・状態・version・条件などの typed claim が食い違う場合は `riskSignals[type=typed_claim_conflict]` と `conflictingFactIds` に記録する。
8. typed claim の subject / predicate / scope が異なる値は直ちに conflict としない。ただし scope なし claim と明示 scope claim の値違いは `riskSignals[type=uncertain_scope_conflict]` として LLM judge の追加確認対象にする。
9. `riskSignals` がある場合だけ LLM judge に委譲し、同一 scope の矛盾か、scope 差分や誤検出で説明できるかを `llmJudge` に保存する。
10. LLM judge が高信頼で `NO_CONFLICT` と判定した場合のみ conflict 候補を解消し、それ以外は `retrievalQuality=partial` として現行条件・適用範囲の追加検索へ進める。
11. `矛盾`、`廃止`、`無効`、`取消` などの cue は初期 heuristic では拒否確定に使わず、追加検索または後段 gate の判断対象とする。
12. 選択した action は `RetrievalEvaluation.nextAction` として debug trace に保存する。

### Adaptive retrieval diagnostics

1. `/search` は lexical / semantic count、fused count に加え、retrieval profile id / version、score distribution、top gap、lexical / semantic overlap、adaptive decision を diagnostics に含める。
2. adaptive strategy は `RAG_ADAPTIVE_RETRIEVAL=true` の opt-in とし、default は固定 topK / threshold 互換を維持する。
3. adaptive decision は absolute score だけでなく relative gap、rank overlap、coverage を説明用 signal として記録する。
4. diagnostics は alias 定義、ACL metadata、allowed user list、raw prompt、過剰な chunk text を含めない。

### Plan-ACT action 実行

1. `evidence_search` は `search_evidence` を呼び、`POST /search` と同じ hybrid retriever を使って ACL guard 済み evidence を取得する。
2. `query_rewrite` は不足 fact、検索複雑度、rewrite strategy から追加 query を作り、同じ search step 内で hybrid retrieval を実行する。
3. `expand_context` は既にアクセス許可済みの retrieved chunk を起点に、同一 document の前後 chunk を source text から再構成して候補へ追加する。
4. `rerank` と `finalize_refusal` は検索 loop の停止 action として扱い、それぞれ rerank または拒否 finalize へ進む。
5. 各 action の hit count、新規 evidence 件数、top score、retrieval diagnostics は `actionHistory` と debug trace に保存する。

### Citation validation と回答支持検証

1. `validate_citations` は LLM 出力 JSON を解析し、`usedChunkIds` が `selectedChunks` の `key` または `chunkId` に対応するかを確認する。
2. 有効な citation がない場合、または回答 JSON が不正な場合は `citation_validation_failed` として拒否する。
3. `verify_answer_support` は引用済み evidence chunk だけを使い、回答文の主要文が明示的に支持されるかを判定する。
4. 支持されない主要文がある場合は `unsupported_answer` として回答不能に落とす。
5. unsupported sentence count と対応 chunk_id を trace に保存する。

### 料金算出

1. `debug_trace`、document/vector manifest、CloudWatch metrics、DynamoDB metrics から `UsageMeter` を作る。
2. Bedrock 料金は model ID、region、tier ごとの input token、output token、embedding token 単価を `PricingCatalogEntry` から取得する。
3. S3 Vectors 料金は PUT、logical storage、query API、query data processed を分けて算出する。
4. DynamoDB 料金は on-demand read/write request unit、storage、PITR を分けて算出する。
5. Lambda 料金は request count と `memoryGb * durationSeconds` の GB-second で算出する。
6. service/component ごとの小計と合計を `CostEstimate` に保存する。
7. 単価が未登録、または usage source が概算の場合は `confidence=estimated_usage` とし、請求額として断定しない。

## エラー処理

| 事象 | 方針 |
| --- | --- |
| Bedrock 呼び出し失敗 | 外部モデル失敗として trace に残し、推測回答しない。 |
| S3 Vectors 検索失敗 | 検索失敗として扱い、回答不能または API エラーを返す。 |
| evidence なし | `UNANSWERABLE` として回答不能を返す。 |
| citation 不支持 | unsupported claim を含む回答をそのまま返さない。 |
| debug trace 保存失敗 | 回答処理は可能な範囲で継続し、保存失敗を metadata に含める。 |
| pricing catalog 未登録 | 料金算出をスキップし、対象 service/component を未算出として記録する。 |
| usage meter 不足 | 実測値ではなく概算値として扱い、confidence を下げる。 |

## テスト観点

- 根拠がある質問で citation 付き回答が返ること。
- 根拠が不足する質問で推測回答せず回答不能が返ること。
- unsupported claim が検出された場合にそのまま返されないこと。
- 複数 clue の検索結果が RRF で安定して統合されること。
- `query_rewrite` と `expand_context` が schema 定義だけでなく action executor から実行されること。
- actionHistory に検索判断と理由が保存されること。
- benchmark 実行時に fact coverage と faithfulness が出力されること。
- 料金算出時に Bedrock、S3 Vectors、DynamoDB、Lambda の単価単位を混同しないこと。
- pricing catalog がない場合に誤った 0 円表示をしないこと。
