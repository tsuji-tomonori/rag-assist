# 要件定義（1要件1ファイル）

- 要件ID: `FR-094`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `9. UI/UX 基盤`
- L2主機能群: `9.1 アプリケーションナビゲーション`
- L3要件: `FR-094`
- 関連カテゴリ: 認証・認可・管理・監査、文書・知識ベース管理

## 要件

- FR-094: 認証済み利用者が画面遷移を開始したとき、システムは権限で許可された全 `AppView` と個人設定へ、安定した URL、browser history、および現在の viewport で操作可能な navigation から到達・復元できるようにする。ただし、権限外 target は表示または取得せず、安全な許可済み画面へ復帰できる状態を示す。

## 受け入れ条件（この要件専用）

- `AC-FR094-001`: 320 CSS px および 400% zoom 相当で、最大権限 persona を含む各 persona の許可済み AppView と個人設定が、重なり、欠落、画面外だけの操作、page-level two-dimensional scroll なしで到達可能であること。
- `AC-FR094-002`: 利用者が view または restorable workspace state を変更したとき、URL が visible state と一致し、reload、bookmark、back、forward、deep link で同じ状態または明示された安全な代替状態を復元すること。
- `AC-FR094-003`: 権限外 view/resource の deep link では protected API/data を取得・表示せず、permission denied と許可済み recovery destination を可視かつ programmatic に示すこと。
- `AC-FR094-004`: navigation の current item、expanded state、accessible name、focus order が keyboard、touch、screen reader で判別可能であり、固定 navigation が focus を完全に隠さないこと。
- `AC-FR094-005`: unknown、obsolete、または不正な view/query/path は silent fallback で異なる保護画面を表示せず、canonical URL と安全な state へ正規化すること。

## 検証

- `E2E-UI-NAV-001`: standard user の 320px mobile navigation。
- `E2E-UI-NAV-002`: maximum-permission persona の 320px/400% zoom navigation。
- `E2E-UI-ROUTE-001`: reload/back/forward/deep-link restoration。
- `E2E-UI-ROUTE-002`: denied deep link の non-disclosure と recovery。
- unit: `useAppShellState` URL parser/history policy、`RailNav` permission/current/focus semantics。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の「利用不能・誤操作リスク」。
- confirmed evidence: `apps/web/src/app/types.ts` の 8 AppViews、`apps/web/src/app/hooks/useAppShellState.ts` の query/path hydration と `replaceState`、`apps/web/src/styles/responsive.css` の 720px 以下における `.account-button` 非表示。
- 分析: `reports/working/20260714-1317-issue-345-uiux-spec-analysis.md`。

## 要件の目的・意図

- 目的: viewport、zoom、input modality、権限、直接 URL 利用によって主要導線が失われることを防ぐ。
- 意図: visual layout、history implementation、permission recovery を「許可された destination へ予測可能に到達する」という一つの利用者能力へ結びつける。
- 対象外: API authorization の代替、未許可 view の存在開示、CloudFront routing 方針の無根拠な変更。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-094` |
| 説明 | permission-aware addressable application navigation |
| 根拠 | narrow/high-zoom UI で個人設定導線が消え、history semantics が partial である |
| 源泉 | GitHub Issue #345、current Web source/test |
| 種類 | 機能要求 |
| 依存関係 | `FR-024`, `FR-051`, `FR-057`, `FR-091`, `SQ-016` |
| 衝突 | 現行 `replaceState` と利用者操作ごとの back/forward 期待、720px CSS の account 非表示 |
| 受け入れ基準 | `AC-FR094-001`〜`AC-FR094-005` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・ニーズ適合 | pass | permitted destination の実到達不能を解消する。 |
| 一貫性 | pass with gap | API authorization を正とし、UI は非開示と recovery を追加する。 |
| 実現可能性 | pass | 既存 AppView/query/popstate を段階的に拡張できる。 |
| 検証可能性 | pass | mobile/zoom/history/permission の独立 scenario がある。 |

## 関連文書・task

- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/todo/20260714-issue-345-mobile-navigation.md`
- `tasks/todo/20260714-issue-345-url-history-routing.md`
