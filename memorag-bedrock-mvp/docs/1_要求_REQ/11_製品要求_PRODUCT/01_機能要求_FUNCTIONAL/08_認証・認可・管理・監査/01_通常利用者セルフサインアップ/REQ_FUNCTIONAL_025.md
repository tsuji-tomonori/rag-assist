# 要件定義（1要件1ファイル）

- 要件ID: `FR-025`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.1 通常利用者セルフサインアップ`
- L3要件: `FR-025`
- 関連カテゴリ: なし


## 要件

- FR-025: 未認証の通常利用者がログイン画面から Cognito アカウントを作成してメール確認を完了したとき、システムは当該利用者に最小権限の `CHAT_USER` のみを払い出せること。

## 受け入れ条件（この要件専用）

- AC-FR025-001: Web UI は未認証利用者にメールアドレス、パスワード、パスワード確認によるアカウント作成フォームを提供すること。
- AC-FR025-002: Web UI は Cognito から送信された確認コードを入力するフォームを提供すること。
- AC-FR025-003: Cognito self sign-up の確認完了時、システムは対象ユーザーを `CHAT_USER` group に追加すること。
- AC-FR025-004: Cognito self sign-up 経由では `ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`BENCHMARK_OPERATOR`、`BENCHMARK_RUNNER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を付与しないこと。
- AC-FR025-005: 上位権限が必要な場合、管理ユーザーは GitHub Actions の Cognito ユーザー作成 workflow または AWS 管理手順で後から付与できること。
- AC-FR025-006: アカウント作成または確認コード検証に失敗した場合、Web UI は認証済み session を作成しないこと。
- AC-FR025-007: Web UI はアカウント作成時に Cognito パスワード条件を送信前から表示し、入力中に各条件の達成状態を利用者へ示すこと。

## 要件の源泉・背景

- 源泉: 2026-05-02 ユーザー依頼「通常ユーザーはログイン画面からユーザーごとにアカウント作成できるようにしたい。その時は最小権限のみで払い出し、上位権限は管理ユーザーが付与する想定」。
- 背景: GitHub Actions の Cognito ユーザー作成 workflow は、管理ユーザーが `SYSTEM_ADMIN` を含む上位 role を作成できる運用導線として維持する。
- 背景: 通常利用者の初期作成導線と、管理ユーザーによる上位権限付与導線を分離し、self sign-up では権限昇格を起こさないようにする必要がある。

## 要件の目的・意図

- 目的: 通常利用者が管理者作業なしでアカウント作成を開始できるようにする。
- 意図: self sign-up の初期権限を `CHAT_USER` に固定し、上位権限は管理ユーザーの明示操作に限定する。
- 意図: GitHub Actions からの `SYSTEM_ADMIN` 付与は管理者操作として維持し、通常利用者向けの public sign-up とは別の信頼境界に置く。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-025` |
| 説明 | Cognito self sign-up による通常利用者アカウント作成と最小権限付与 |
| 根拠 | 通常利用者のセルフサービス作成と上位権限付与の職務分離 |
| 源泉 | 2026-05-02 ユーザー依頼 |
| 種類 | 機能要求 |
| 依存関係 | Cognito User Pool、post-confirmation trigger、`CHAT_USER` group、GitHub Actions Cognito user creation workflow |
| 衝突 | self sign-up の利便性と権限付与の最小化 |
| 受け入れ基準 | `AC-FR025-001` から `AC-FR025-007` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版。2026-05-06 パスワード条件の事前表示と達成状態表示を追加。 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 管理ユーザー作業なしの通常利用者アカウント作成に必要 |
| 十分性 | OK | sign-up、確認コード、最小権限、自動 session 非作成、パスワード条件の事前提示を含む |
| 理解容易性 | OK | self sign-up と上位権限付与を別経路として記述し、パスワード条件の表示責務も明示している |
| 一貫性 | OK | `NFR-011` の最小権限と Cognito group 方針に沿う |
| 標準・契約適合 | OK | Cognito の確認コードと post-confirmation trigger を使う |
| 実現可能性 | OK | Amplify Auth と CDK の Cognito trigger で実装可能 |
| 検証可能性 | OK | Web UI test、auth client test、CDK assertion で確認可能 |
| ニーズ適合 | OK | 通常利用者はログイン画面から作成し、上位権限は管理ユーザーが付与する想定に対応する |

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_011.md`
- `2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_004.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
