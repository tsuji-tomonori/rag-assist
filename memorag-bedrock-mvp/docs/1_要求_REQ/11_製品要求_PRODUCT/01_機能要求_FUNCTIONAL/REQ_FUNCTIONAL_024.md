# 要件定義（1要件1ファイル）

- 要件ID: `FR-024`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- FR-024: 未認証の通常利用者がログイン画面から Cognito アカウントを作成してメール確認を完了したとき、システムは当該利用者に最小権限の `CHAT_USER` のみを払い出せること。

## 受け入れ条件（この要件専用）

- AC-FR024-001: Web UI は未認証利用者にメールアドレス、パスワード、パスワード確認によるアカウント作成フォームを提供すること。
- AC-FR024-002: Web UI は Cognito から送信された確認コードを入力するフォームを提供すること。
- AC-FR024-003: Cognito self sign-up の確認完了時、システムは対象ユーザーを `CHAT_USER` group に追加すること。
- AC-FR024-004: Cognito self sign-up 経由では `ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`BENCHMARK_RUNNER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を付与しないこと。
- AC-FR024-005: 上位権限が必要な場合、管理ユーザーは GitHub Actions の Cognito ユーザー作成 workflow または AWS 管理手順で後から付与できること。
- AC-FR024-006: アカウント作成または確認コード検証に失敗した場合、Web UI は認証済み session を作成しないこと。

## 要件の源泉・背景

- 源泉: 2026-05-02 のユーザー指示「通常ユーザーはログイン画面からユーザーごとにアカウント作成できるようにしたい。その時は最小権限のみで払い出し、上位権限は管理ユーザーが付与する想定」。
- 背景: GitHub Actions から `SYSTEM_ADMIN` を作成する管理経路は運用証跡が残るため維持する一方、通常利用者のアカウント作成は管理者作業に依存しない導線が必要である。
- 背景: self sign-up 利用者へ上位 Cognito group を自動付与すると権限昇格になるため、最小権限の `CHAT_USER` に限定する必要がある。

## 要件の目的・意図

- 目的: 通常利用者の初回利用開始をログイン画面で完結させる。
- 意図: self sign-up と上位権限付与の責務を分離し、最小権限の原則を保つ。
- 意図: 管理者権限の付与は GitHub Actions または AWS 管理操作の証跡に寄せる。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-024` |
| 説明 | Cognito self sign-up と最小権限 `CHAT_USER` 払い出し |
| 根拠 | 通常利用者の自己登録と上位権限の管理者付与を分離するため |
| 源泉 | 2026-05-02 ユーザー指示、Cognito 認証運用方針 |
| 種類 | 機能要求 |
| 依存関係 | `NFR-011`、`DES_HLD_001`、`DES_DLD_004`、`DES_API_001`、Cognito User Pool、post-confirmation trigger |
| 衝突 | self sign-up を許可するため、従来の「ユーザー作成を提供しない」Phase 1 記述は管理者向けユーザー管理 UI/API の未提供として解釈し直す |
| 受け入れ基準 | `AC-FR024-001` から `AC-FR024-006` |
| 優先度 | A |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 通常利用者が管理者作業なしで初回アカウントを作成できる |
| 十分性 | OK | 作成、確認、最小権限、上位権限後付け、失敗時 session 抑止を含む |
| 理解容易性 | OK | self sign-up 経路と管理者付与経路を分けている |
| 一貫性 | OK | `NFR-011` の RBAC 方針と最小権限に沿う |
| 標準・契約適合 | OK | Cognito の sign-up / confirm flow と group-based RBAC に適合する |
| 実現可能性 | OK | Web UI、Cognito User Pool、post-confirmation trigger で実装可能 |
| 検証可能性 | OK | Web unit test と CDK assertion で確認可能 |
| ニーズ適合 | OK | ユーザー指示の「通常ユーザーはログイン画面から」「最小権限のみ」「上位権限は管理ユーザー」を満たす |

## 関連文書

- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_004.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
- `2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
