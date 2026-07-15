# 要件定義（1要件1ファイル）

- 要件ID: `FR-095`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `9. UI/UX 基盤`
- L2主機能群: `9.2 共通状態契約`
- L3要件: `FR-095`
- 関連カテゴリ: 全機能カテゴリ

## 要件

- FR-095: 主要画面が非定常な data/request state を表示するとき、システムは `loading`、`empty`、`error`、`permission denied`、`partial success`、`stale data`、`retrying/recovered` を異なる状態として示し、対象と利用可能な次操作を関連付ける。

## 受け入れ条件（この要件専用）

- `AC-FR095-001`: request 中は対象 region を `aria-busy` または同等の programmatic state で示し、既存 content/operation を不必要に覆わないこと。
- `AC-FR095-002`: 0 件を確認できた `empty` と、failure、permission denied、未取得、stale を同じ zero/blank state として表示しないこと。
- `AC-FR095-003`: error は affected target、利用者向け原因、次に可能な retry/back/support action を示し、通知が必要な error は `role="alert"` または同等の live semantics を持つこと。
- `AC-FR095-004`: partial success は成功部分と失敗部分を対象単位で分け、全件成功または全件失敗と表示しないこと。
- `AC-FR095-005`: stale data は source/as-of と refresh/retry availability を示し、fresh data と区別すること。
- `AC-FR095-006`: retry 成功/失敗は対象 region と programmatic status に反映し、前の global message だけを残さないこと。

## 検証

- `E2E-UI-STATE-001`: loading/empty/403/500/partial/stale/retry recovery variants。
- component tests: state semantics、live region、target association、false-zero prevention。
- No Mock Product UI review: missing data を固定 count/date/user/capacity で補わない。

## 実装状況（2026-07-14）

- `apps/web/src/shared/ui/ResourceState.tsx` は `loading`、`content`、`empty`、`error`、`permission`、`partial`、`stale`、`retrying`、`recovered` を discriminated union と native alert/status/busy semantics で表す。
- `apps/web/src/shared/ui/useResourceStateController.ts` は part 単位の `Promise.allSettled`、401/403 分類、初回失敗、部分成功、取得済み content を保持する stale refresh、retry/recovered、競合 request の破棄を扱う。raw failure detail は表示 state に保存しない。
- chat、history/favorites、questions、documents、benchmark、admin の adapter は未取得・失敗・permission の値を 0 件/blank/未提供へ変換せず、利用可能 part だけを表示する。
- `E2E-UI-STATE-001` は Chromium で loading→500→retry→confirmed empty、HTTP 403、admin partial→recovered、refresh failure→source/as-of 付き stale→recovered を検証する。
- component/controller test は全 variant、focus、target/action、false-zero、partial、permission、stale、retry race を検証する。代表 screen reader と real-device の手動証跡は `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の未完了範囲である。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の common state contract TODO。
- confirmed evidence: `AppShell` の error は plain `.error-banner` であり、loading 以外の common contract を持たない。
- 分析: `reports/working/20260714-1317-issue-345-uiux-spec-analysis.md` の `GAP-UI-003`。

## 要件の目的・意図

- 目的: 利用者が「データがない」「見られない」「取得に失敗した」「古い」の違いを判断し、回復できるようにする。
- 意図: feature ごとの wording/layout は design へ分離し、状態の意味と必要情報を横断 requirement として固定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-095` |
| 説明 | common asynchronous state and recovery contract |
| 根拠 | false zero/blank/global-only error は利用者判断と recovery を妨げる |
| 源泉 | GitHub Issue #345、`AppShell` current source |
| 種類 | 機能要求 |
| 依存関係 | 各 feature read/mutation requirement、`FR-094`, `NFR-017`, `SQ-016` |
| 衝突 | feature-specific error detail と共通 public-safe wording の境界 |
| 受け入れ基準 | `AC-FR095-001`〜`AC-FR095-006` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・十分性 | pass | Issue が列挙した全 common states を別意味として含む。 |
| 一貫性 | pass | feature result と API error detail を置換せず表示契約を定める。 |
| 実現可能性 | pass | shared primitive と feature adapter に分けて導入できる。 |
| 検証可能性 | pass | state variant ごとの component/E2E が可能。 |

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/done/20260714-issue-345-shared-ui-state-contract.md`
