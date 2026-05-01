# MemoRAG MVP システムコンテキスト

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md`
- 種別: `ARC_CONTEXT`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

MemoRAG MVP のシステム境界、外部アクター、依存サービス、入出力、信頼境界を定義する。

## システム概要

MemoRAG MVP は、利用者がアップロードした文書を検索可能な memory/evidence として保持し、質問に対して根拠付き回答または回答不能理由を返す RAG システムである。

```mermaid
flowchart TB
  User[利用者]
  Evaluator[評価担当者]
  Operator[運用担当者]

  subgraph MemoRAG[MemoRAG MVP]
    Web[React Web UI]
    Api[Hono API on Lambda]
    Rag[RAG Workflow]
    Trace[Debug Trace]
  end

  Bedrock[Amazon Bedrock]
  DocStore[S3 Documents]
  VectorStore[S3 Vectors]
  Monitor[Monitoring Platform]

  User --> Web
  Web --> Api
  Evaluator --> Api
  Operator --> Trace
  Api --> Rag
  Rag --> Bedrock
  Rag --> DocStore
  Rag --> VectorStore
  Api --> Trace
  Api --> Monitor
```

## 外部アクター

| アクター | 主な操作 | 関心事 |
| --- | --- | --- |
| 利用者 | 文書アップロード、質問、回答確認、根拠確認 | 正確性、根拠、回答不能時の説明 |
| 評価担当者 | benchmark 実行、評価結果取得 | 再現性、品質指標、データセット管理 |
| 運用担当者 | debug trace 確認、監視、障害調査 | 調査性、コスト、復旧容易性 |
| セキュリティ管理者 | 認可方針確認、監査 | 権限外露出防止、監査可能性 |
| 開発者 | ローカル検証、機能改修、設計更新 | 変更容易性、テスト容易性 |

## 外部依存

| 依存先 | 用途 | 失敗時の扱い |
| --- | --- | --- |
| Amazon Bedrock | clue 生成、embedding、回答生成、judge | 回答生成または評価を失敗として trace に残す |
| S3 Documents | source、manifest、debug-runs の保存 | 文書登録、回答、trace 参照を失敗として扱う |
| S3 Vectors | memory/evidence vector search | 検索失敗として扱い、推測回答しない |
| API Gateway | API 公開 | 呼び出し失敗としてクライアントへ返す |
| CloudFront / S3 Frontend | UI 配信 | API には影響しないが利用者操作を阻害する |

## 入出力

| 種別 | 入力 | 出力 |
| --- | --- | --- |
| 文書取り込み | 文書本文、ファイル名、メタデータ | documentId、manifest、memory/evidence record |
| 質問応答 | question、modelId、search settings | answer、citations、answerability、debug metadata |
| 評価 | dataset case、API base URL、評価設定 | JSONL 結果、summary、Markdown report |
| 調査 | runId、日付、権限情報 | debug trace、retrieval results、model metadata |

## 信頼境界

- Browser と API の境界では、認証・認可・入力検証を API 側で実施する。
- API と Bedrock の境界では、プロンプトに入れる文書断片を検索済み evidence に限定する。
- API と S3 Vectors の境界では、検索対象 index と metadata filter を設計上の制御点とする。
- benchmark/debug 系 API は、本番または社内検証環境では認可対象とする。

## 前提・制約

- 初期検索基盤は `TC-001` に従い、OpenSearch 完全互換を目指さない。
- 最終回答の根拠は raw evidence chunk に限定する。
- 高抽象度 memory は検索補助であり、最終回答の引用根拠にはしない。
