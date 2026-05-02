# MemoRAG MVP 高レベル設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- 種別: `DES_HLD`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

アーキテクチャで定義した RAG 構造を、実装可能なサブシステムと責務へ分解する。

## 対象範囲

- 文書取り込み
- memory/evidence record 生成
- 質問応答 workflow
- answerability gate
- citation validation
- debug trace
- conversation history
- human follow-up question
- authentication / authorization
- identity provisioning
- cost estimation
- benchmark evaluation

## コンポーネント

| コンポーネント | 入力 | 出力 | 関連要求 |
| --- | --- | --- | --- |
| Ingestion Handler | fileName、text、metadata | documentId、manifest | `FR-001`, `FR-002` |
| Memory Builder | source text、document metadata | memory record、evidence chunk | `FR-002`, `FR-020` |
| Query Orchestrator | question、settings、user context | answer/refusal、citations、metadata | `FR-003`, `FR-005` |
| Retriever | query/clue、filters | candidate chunks | `FR-016`, `FR-018`, `TC-001` |
| Retrieval Evaluator | candidates、required facts、action history | retrievalQuality、missingFactIds、nextAction、reason | `FR-016`, `FR-017` |
| Answerability Gate | question、evidence | answerability label、reason | `FR-014` |
| Answer Generator | question、supported evidence | grounded answer | `FR-003`, `FR-004` |
| Citation Validator | answer、candidate chunks | 引用IDの妥当性、citations | `FR-004`, `FR-005` |
| Answer Support Verifier | answer、cited evidence chunks | supported/unsupported sentence、supportingChunkIds | `FR-015` |
| Debug Trace Store | workflow events | run trace | `FR-010`, `NFR-005`, `NFR-006` |
| Conversation History Store | userId、conversation item | user-scoped conversation list | `FR-022`, `NFR-005` |
| Human Question Store | question ticket、answer draft、status | 担当者問い合わせと回答状態 | `FR-021`, `NFR-011` |
| Web Admin Workspace | `GET /me` permissions、documents、questions、debug runs、benchmark runs | Phase 1 RAG 運用管理 view | `FR-024`, `NFR-011` |
| Authorization Layer | Cognito group、permission | API 実行可否 | `NFR-010`, `NFR-011` |
| Identity Provisioning | email、password、confirmation code、Cognito trigger event | self sign-up user、`CHAT_USER` group membership | `FR-025`, `NFR-011` |
| Cost Estimator | usage meter、pricing catalog、期間 | service/component 別の概算料金 | `NFR-002`, `NFR-009` |
| Benchmark Runner | dataset case | result、summary、report | `FR-012`, `FR-019`, `SQ-001` |

## 責務分担

- Query Orchestrator は workflow の順序制御に集中し、検索、判定、生成、引用検証の個別ロジックを直接抱え込まない。
- Retriever は検索候補の取得に集中し、回答生成や引用文の作成を行わない。
- Answerability Gate は回答してよいかを判定し、回答文を生成しない。
- Citation Validator は回答が実在する evidence chunk を引用しているかを検証する。
- Answer Support Verifier は回答後の主要文が引用 chunk に支持されているかを検証し、不支持文がある場合は回答不能へ落とす。
- Conversation History Store は画面の会話履歴をユーザー単位で永続化し、履歴 item の schema version を保持する。
- Human Question Store は回答不能時の人手問い合わせを保存し、担当者による回答・解決状態を管理する。
- Web Admin Workspace は Phase 1 の管理導線を RAG 運用管理に限定し、文書管理、問い合わせ対応、debug/評価へ permission に応じて遷移させる。
- Authorization Layer は API 側の permission 判定を正とし、Web 側の Cognito group は表示制御と不要な事前取得の抑制に使う。
- Identity Provisioning は通常利用者の self sign-up とメール確認を扱い、確認済みユーザーには `CHAT_USER` のみを付与する。
- Identity Provisioning は `SYSTEM_ADMIN` などの上位権限を付与せず、上位権限付与は管理ユーザーの GitHub Actions または AWS 管理手順へ分離する。
- Cost Estimator は設計上の概算責務として分離し、Bedrock token、S3 Vectors、DynamoDB、Lambda などの利用量に公式料金表の単価を掛け合わせる。
- Cost Estimator は AWS 請求の正本ではなく、運用監視と予算逸脱検知のための概算値を扱う。
- Benchmark Runner は UI と独立して同等の質問評価を実行する。

## 主要フロー

1. API は認可と入力検証を行う。
2. Query Orchestrator は質問を正規化し、clue を生成する。
3. Retriever は memory/evidence index から候補を取得する。
4. RRF Rank Fusion は複数候補を統合する。
5. Retrieval Evaluator は必要事実が検索済み evidence で満たされているかを判断し、追加 evidence search、rerank、拒否のいずれかを選ぶ。
6. Answerability Gate は evidence だけで回答可能かを判定する。
7. Answer Generator は回答可能な場合だけ回答を生成する。
8. Citation Validator は回答が実在する evidence chunk を引用しているかを検証する。
9. Answer Support Verifier は回答文と引用 chunk の支持関係を検証する。
10. API は回答または拒否結果と trace metadata を返す。
11. Web UI は会話履歴 item を `schemaVersion` 付きで保存 API に送信する。
12. API は userId で会話履歴を分離し、本番環境では DynamoDB に保存する。
13. 回答不能時に利用者が担当者問い合わせを作成した場合、Web UI は作成済み ticket を会話に紐づけて表示する。
14. 担当者または管理者は問い合わせ一覧を取得し、回答または解決状態を更新する。
15. 運用担当者は `admin` view から文書管理、問い合わせ対応、debug/評価、性能テストの各導線へ遷移する。
16. 文書管理担当者は `documents` view で登録文書の一覧、アップロード、削除を実行する。
17. 利用量メーターは trace、document/vector manifest、DynamoDB item サイズ、Lambda 実行メトリクスから料金算出に必要な集計値を作る。
18. Cost Estimator は利用量に pricing catalog の単価を適用して、期間別・service 別の概算料金を算出する。
19. 未認証の通常利用者がアカウント作成を行う場合、Web UI は Cognito `SignUp` と `ConfirmSignUp` を使い、Cognito post-confirmation trigger が `CHAT_USER` のみを付与する。

## アーキテクチャ判断との関係

- `ARC_ADR_001`: サーバレス RAG と guard 付き pipeline の採用。
- `ARC_QA_001`: 根拠性、不回答品質、検索品質、セキュリティを品質属性として扱う。
