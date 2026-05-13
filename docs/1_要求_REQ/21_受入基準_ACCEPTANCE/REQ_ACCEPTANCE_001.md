# MemoRAG MVP 横断受入基準

- ファイル: `docs/1_要求_REQ/21_受入基準_ACCEPTANCE/REQ_ACCEPTANCE_001.md`
- 種別: `REQ_ACCEPTANCE`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

複数要求にまたがる完了条件、BDD シナリオ、評価観点を定義する。

個別要件の受け入れ条件は各 `REQ_*` ファイルを正とし、本ファイルは横断シナリオを扱う。

## 受入シナリオ

### AC-RAG-001: 根拠付き回答

Given 利用者が文書を登録済みである。

When 利用者が登録文書の内容で回答可能な質問を送信する。

Then システムは回答本文を返す。

And 回答には少なくとも 1 件の citation を含む。

And citation は登録文書の evidence chunk を参照する。

### AC-RAG-002: 根拠不足時の回答拒否

Given 登録文書に質問へ回答する根拠が存在しない。

When 利用者がその質問を送信する。

Then システムは推測回答を返さない。

And 回答不能理由を返す。

And debug trace に `UNANSWERABLE` または同等の判定を残す。

### AC-RAG-003: 引用支持検証

Given 回答生成後の回答文が存在する。

When Citation Validator が回答文と引用 chunk を検証する。

Then 主要主張が引用 chunk で支持されていることを確認する。

And unsupported claim がある場合は、その回答をそのまま最終回答にしない。

### AC-RAG-004: 検索制御の追跡

Given 複数 clue または query で検索を実行する。

When システムが evidence 候補を統合する。

Then RRF または同等の順位融合結果を trace に残す。

And 検索評価による next action と理由を actionHistory に残す。

### AC-RAG-005: 通常チャットの hybrid evidence 検索

Given 利用者が通常のチャット質問を送信する。

When agent workflow が evidence を検索する。

Then システムは lightweight lexical retrieval と S3 Vectors semantic search の候補を RRF または同等の方式で統合する。

And 検索 step は query 数、retrieval source 別件数、index/alias version 情報を trace に残せる。

### AC-RAG-006: Grounded 確認質問

Given 利用者質問が対象未指定で、登録済み文書または memory card から複数候補を作れる。

When 利用者がその質問を送信する。

Then システムは `responseType=clarification` の確認質問を返す。

And 確認質問の option は文書、memory、evidence、または history 由来の grounding を持つ。

And 候補を作れる根拠がない場合は確認質問ではなく回答不能として扱う。

### AC-SEC-001: benchmark/debug API 認可

Given 本番または社内検証環境である。

When 未認可利用者が benchmark/debug 系 API にアクセスする。

Then システムは実行または参照を拒否する。

And 文書本文、引用 chunk、debug trace を返さない。

### AC-SEC-002: 担当者問い合わせの権限分離

Given 通常利用者が `CHAT_USER` group のみを持つ。

When 利用者が回答不能な質問を担当者へ送信する。

Then システムは問い合わせ ticket を作成する。

And Web UI は `GET /questions` と `GET /debug-runs` を事前取得しない。

### AC-SEC-003: Phase 1 RAG 運用管理 API 認可

Given 本番または社内検証環境である。

When 一般チャット利用者が問い合わせ一覧、問い合わせ詳細、回答登録、解決済み化、debug trace 詳細、または debug JSON download にアクセスする。

Then システムは権限不足として拒否する。

And 問い合わせ本文、回答本文、debug trace、JSON download URL を返さない。

### AC-SEC-004: 問い合わせ対応 role の分離

Given 問い合わせ対応者が `ANSWER_EDITOR` role を持つ。

When 問い合わせ一覧を参照する。

Then システムはユーザー管理権限を要求せずに問い合わせ一覧を返す。

And ユーザー管理 API またはロール付与 API は Phase 1 の管理画面に提供しない。

When 問い合わせ対応者が回答登録または解決済み化を実行する。

Then API は `answer:publish` 権限により操作を許可する。

### AC-HIST-001: 会話履歴の本人分離

Given 認証済み利用者が会話を行う。

When Web UI が会話履歴 item を保存する。

Then API は `schemaVersion: 1` の item を userId 単位で保存する。

And 別 userId の履歴として返さない。

### AC-EVAL-001: RAG 品質評価

Given benchmark dataset が用意されている。

When benchmark runner を実行する。

Then fact coverage、faithfulness、context relevance、不回答精度を含む summary を出力する。

And Markdown report を生成できる。

## 関連要求

- `FR-003`, `FR-004`, `FR-005`
- `FR-014`, `FR-015`, `FR-016`, `FR-017`, `FR-018`, `FR-019`, `FR-021`, `FR-022`, `FR-023`, `FR-024`, `FR-025`, `FR-026`, `FR-029`, `FR-031`, `FR-032`, `FR-033`, `FR-034`, `FR-035`, `FR-036`, `FR-037`, `FR-038`, `FR-039`, `FR-040`
- `NFR-010`, `NFR-011`, `NFR-012`, `NFR-013`, `SQ-001`, `SQ-002`

## 関連設計

- `2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
