# MemoRAG MVP RAG パイプラインビュー

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
- 種別: `ARC_VIEW`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

MemoRAG MVP の論理ビュー、ランタイムビュー、データ配置ビューを記述する。

## ビューの目的

要件、アーキテクチャ決定、詳細設計を接続するため、RAG の主要構造と実行時の責務分担を明確にする。

## 論理ビュー

```mermaid
flowchart TB
  Web[Web UI]
  Cognito[Cognito User Pool]
  SignupRole[Post-confirmation Role Assignment]
  Api[API Server]
  Auth[Auth / Authorization]
  Orchestrator[Query Orchestrator]
  Retriever[Hybrid Retriever]
  Lexical[Lightweight Lexical Retriever]
  Semantic[S3 Vectors Semantic Retriever]
  Fusion[RRF Rank Fusion]
  Judge[Answerability Judge]
  Prompt[Prompt Builder]
  Llm[LLM Gateway]
  Citation[Citation Validator]
  Eval[Benchmark / Evaluation]
  Trace[Telemetry / Debug Trace]
  Questions[Human Question Store]
  History[Conversation History Store]
  Ingest[Ingestion Worker]
  Chunk[Chunking / Memory Builder]
  Store[(S3 Documents / S3 Vectors)]

  Web --> Api
  Web --> Cognito
  Cognito --> SignupRole
  SignupRole --> Cognito
  Api --> Auth
  Api --> Orchestrator
  Orchestrator --> Retriever
  Retriever --> Lexical
  Retriever --> Semantic
  Lexical --> Fusion
  Semantic --> Fusion
  Fusion --> Judge
  Judge --> Prompt
  Prompt --> Llm
  Llm --> Citation
  Citation --> Api
  Orchestrator --> Trace
  Api --> Questions
  Api --> History
  Eval --> Api
  Api --> Ingest
  Ingest --> Chunk
  Chunk --> Store
  Lexical --> Store
  Semantic --> Store
```

## 構成要素

| 要素 | 責務 |
| --- | --- |
| Web UI | 文書登録、質問、回答、引用、担当者問い合わせ、会話履歴、debug trace 参照の操作面を提供する。 |
| Cognito User Pool | sign-in、self sign-up、確認コード検証、Cognito group を管理する。 |
| Post-confirmation Role Assignment | self sign-up 確認済みユーザーへ `CHAT_USER` のみを付与する。 |
| API Server | API 受付、認可、RAG workflow 呼び出し、レスポンス整形を行う。 |
| Auth / Authorization | Cognito ID token の group から API permission を判定する。 |
| Query Orchestrator | 検索、回答可能性判定、回答生成、引用検証、trace 記録を制御する。 |
| Hybrid Retriever | 通常チャットの evidence 検索で lexical retrieval、semantic search、RRF、ACL guard、diagnostics 生成を束ねる。 |
| Lightweight Lexical Retriever | BM25、CJK n-gram、prefix、ASCII fuzzy、alias expansion で語句一致候補を取得する。 |
| S3 Vectors Semantic Retriever | query embedding と metadata filter により意味検索候補を取得する。 |
| RRF Rank Fusion | 複数 clue、query、retrieval source の evidence 検索結果を順位融合する。 |
| Answerability Judge | 検索済み evidence だけで回答可能かを判定する。 |
| Prompt Builder | evidence、質問、回答制約を LLM prompt に変換する。 |
| LLM Gateway | Bedrock model 呼び出しを集中管理する。 |
| Citation Validator | 回答文と引用 chunk の支持関係を検証する。 |
| Benchmark / Evaluation | fact coverage、faithfulness、context relevance、不回答精度を測定する。 |
| Human Question Store | RAG が回答できない質問を担当者対応 ticket として保持する。 |
| Conversation History Store | userId 単位の会話履歴を保持する。 |

## ランタイムビュー

```mermaid
sequenceDiagram
  actor U as User
  participant API as API Server
  participant RAG as Query Orchestrator
  participant LX as Lexical Retriever
  participant VS as S3 Vectors
  participant BR as Bedrock
  participant TR as Debug Trace

  U->>API: POST /chat
  API->>RAG: question, modelId, settings, user context
  RAG->>BR: generate clues
  BR-->>RAG: clues
  RAG->>LX: lexical evidence search
  LX-->>RAG: lexical candidates
  RAG->>VS: semantic evidence search with metadata filter
  VS-->>RAG: semantic candidates
  RAG->>RAG: dedupe / RRF / ACL guard / retrieval evaluation
  RAG->>TR: retrieval diagnostics when trace enabled
  RAG->>BR: answerability judge
  BR-->>RAG: ANSWERABLE/PARTIAL/UNANSWERABLE
  alt answerable
    RAG->>BR: generate grounded answer
    BR-->>RAG: answer
    RAG->>RAG: validate citations
  else not answerable
    RAG->>RAG: finalize refusal
  end
  RAG->>TR: persist trace when enabled
  RAG-->>API: answer/refusal, citations, metadata
  API-->>U: response
```

## データ配置ビュー

| データ | AWS | ローカル |
| --- | --- | --- |
| source | `documents/<documentId>/source.txt` | `.local-data/documents/<documentId>/source.txt` |
| manifest | `manifests/<documentId>.json` | `.local-data/manifests/<documentId>.json` |
| debug trace | `debug-runs/<yyyy-mm-dd>/<runId>.json` | `.local-data/debug-runs/<yyyy-mm-dd>/<runId>.json` |
| human question | DynamoDB question table | `.local-data/questions.json` |
| conversation history | DynamoDB conversation history table | `.local-data/conversation-history.json` |
| memory vectors | `memory-index` | `.local-data/memory-vectors.json` |
| evidence vectors | `evidence-index` | `.local-data/evidence-vectors.json` |

## ビューから見えるリスク

- LLM judge を常時実行するとレイテンシとコストが増える。
- debug trace に質問、文書断片、モデル出力が含まれるため認可が必要である。
- RRF と再検索を追加すると ranking の説明責任が増えるため、actionHistory と score を trace に残す必要がある。
- hybrid retrieval を通常チャット本線へ入れると latency と trace 情報量が増えるため、retrievalDiagnostics に query 数、source 件数、version 情報を残して評価で調整する必要がある。
- 通常利用者の UI が担当者一覧や debug trace 一覧を事前取得すると不要な 403 と権限過多を招くため、Cognito group に応じて取得対象を分ける必要がある。
- self sign-up を許可すると任意メールアドレスの登録試行が増えるため、Cognito 確認コードと `CHAT_USER` のみの自動付与で初期権限を抑える必要がある。
