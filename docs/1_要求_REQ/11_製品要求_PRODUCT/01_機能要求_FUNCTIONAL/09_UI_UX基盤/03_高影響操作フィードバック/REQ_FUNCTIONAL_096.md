# 要件定義（1要件1ファイル）

- 要件ID: `FR-096`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `9. UI/UX 基盤`
- L2主機能群: `9.3 高影響操作フィードバック`
- L3要件: `FR-096`
- 関連カテゴリ: 文書管理、問い合わせ、benchmark、管理・監査

## 要件

- FR-096: 利用者が削除、共有、権限変更、停止、無効化、公開、切替、または rollback を開始したとき、システムは対象、影響、回復可否、必要理由、処理状態、および結果を対象 context に関連付けて示す。

## 受け入れ条件（この要件専用）

- `AC-FR096-001`: confirmation は操作名だけでなく target の利用者向け識別情報と影響範囲を accessible name/description で示すこと。
- `AC-FR096-002`: irreversible または recovery 条件付き操作は、取消可能時点、回復/rollback 可否、必要理由を実行前に示すこと。
- `AC-FR096-003`: processing、success、failure、partial success は対象 row/card/answer/document と関連付き、画面上部の generic message だけに依存しないこと。
- `AC-FR096-004`: duplicate submit を防ぎつつ、timeout/unknown result を無条件成功または無条件失敗に変換しないこと。
- `AC-FR096-005`: security/administrative mutation では actor、target、reason、result、version/audit reference を API が返す範囲で表示または調査可能にすること。ただし unauthorized user に内部情報を開示しない。

## 検証

- `E2E-UI-RISK-001`: representative delete/share/cancel/publish operations。
- component/API contract tests: accessible dialog metadata、target association、unknown/partial result。
- authorization review: UI confirmation を API permission enforcement の代替にしない。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の risky operation と target-attached feedback TODO。
- existing related requirements: `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086`。
- 分析: `reports/working/20260714-1317-issue-345-uiux-spec-analysis.md`。

## 要件の目的・意図

- 目的: 利用者が別 target への誤操作、影響の誤認、処理結果の取り違えを起こさないようにする。
- 意図: domain mutation rules は既存 requirement/API を正とし、本要件は利用者が判断・追跡する UI behavior を定める。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-096` |
| 説明 | high-impact operation clarity and contextual result feedback |
| 根拠 | generic confirmation/message は target と recoverability を誤認させる |
| 源泉 | GitHub Issue #345、既存 security mutation requirements |
| 種類 | 機能要求 |
| 依存関係 | `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086`, `FR-095` |
| 衝突 | audit detail と unauthorized information minimization の境界 |
| 受け入れ基準 | `AC-FR096-001`〜`AC-FR096-005` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・ニーズ適合 | pass | 誤操作と結果誤認の双方を直接減らす。 |
| 一貫性 | pass | existing domain/audit requirements を UI から参照する。 |
| 実現可能性 | pass | shared dialog/status metadata と feature adapter で実装可能。 |
| 検証可能性 | pass | target/effect/recovery/result を独立 assertion にできる。 |

## 実装状況（2026-07-14）

- `apps/web/src/shared/ui/operationOutcome.ts` は `processing`、`success`、`failure`、`partial`、`unknown` を共通 outcome として定義し、HTTP 408/504、abort、network/timeout を根拠なく成功または確定失敗へ変換しない。
- `apps/web/src/shared/ui/OperationFeedback.tsx` は action、target、reason、影響、回復条件と、API が返した actor、result reference、version、audit reference を対象付き status/alert として表示する。API 未提供値は生成せず、必要な管理画面でのみ「API 応答で未提供」と示す。
- history delete、document delete/share/reindex migration、benchmark start/cancel、admin user status/role と alias disable/publish の代表操作は、API 応答前の重複送信を防ぎ、mutation 確定後の refresh failure を `partial`、timeout/network を `unknown` として扱う。最後の履歴を削除して empty state へ遷移した場合も確定結果を保持する。
- `E2E-UI-RISK-001` は Chromium で delete/share/cancel/publish の confirmation、mutation request、target-attached result、API version/reference と代表 `OperationFeedback` の axe 結果を検証する。unit/component tests は duplicate、known failure、unknown、partial と API response parsing を補完する。
- UI confirmation は既存の route-level permission、resource capability、server guard、version/reason/audit contract を代替しない。本変更は API route または authorization policy を変更しておらず、質問画面を含む全 feature の exhaustive coverage、screen reader、実 browser zoom、real device、Firefox/WebKit は後続 task の未検証範囲である。

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/done/20260714-issue-345-risky-operation-feedback.md`
