# Issue #345 admin semantic required gate 仕様分析

## Input inventory

| source | date | type | reliability |
|---|---|---|---|
| Issue #345 | 2026-08-21確認 | issue正本 | confirmed |
| current `main@8e542b31` | 2026-08-21確認 | repository base | confirmed |
| Draft PR #462 `73bc6e42` | 2026-08-20 | 実装・正本・生成物 | confirmed |
| open PR #461／#464 | 2026-08-21確認 | 並行変更 | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | PR #462 head | 品質要求正本 | confirmed |
| `DES_UI_UX_001.md` | PR #462 head | UI設計正本 | confirmed |
| `ui-quality-matrix.json` | PR #462 head | machine-readable evidence | confirmed |
| `ui-traceability.json` | PR #462 head | screen／requirement trace | confirmed |
| `screen-reader-semantics.spec.ts` | PR #462 head | required AX E2E | confirmed |
| `AdminWorkspace.tsx`／`AdminUserPanel.tsx` | PR #462 head | production semantic contract | confirmed |

## 正本レビュー判定

- 判定: **不合格（今回scope着手前）**。`admin / AC-SQ016-003`は既存semantic DOMがある一方、required AX evidenceとmachine-readable合否が欠落しているため。
- 対象範囲: adminの`SQ-016 / AC-SQ016-003`と、それを担う設計・E2E・trace・matrix・生成文書。
- 実行可否: test-only GET fixtureと既存accessible contractで自動証跡まで実装可能。manual evidence、Firefox／WebKit native AX tree、#461統合後再検証はこの資料だけでは完了不可。

## 重大指摘

| ID | 箇所 | 重大度 | 問題 | 根拠 | 影響 | 修正案 | 確認方法 |
|---|---|---|---|---|---|---|---|
| UI-345-20260821-01 | `admin / AC-SQ016-003` | Major | 管理画面のname／role／value契約がrequired AX E2Eへ結線されていない | matrixはautomated blocked、共有AX E2Eにadmin scenarioがない | 実装済みsemanticsの退行をCIで検知できず、画面→要求→AC→E2Eを追跡できない | GET限定fixtureと代表AX contractを共有E2Eへ追加し、正本・trace・matrix・生成物を同期する | targeted E2E、trace／matrix tests、docs check、final-head CI |

## 観点別評価

| 観点 | 判定 | 根拠 |
|---|---|---|
| 正本・スコープ | 合格 | SQ-016とadminの既存ACを使用し、新規要求を作らない |
| 文書間整合性 | 不合格 | adminだけAC-SQ016-003のtest traceが欠落 |
| 要求品質 | 合格 | ACはname／role／stateの観測可能な期待を持つ |
| 技術的実現可能性 | 合格 | 既存CDP AX readerとproduction semantic DOMを再利用できる |
| テスト可能性 | 不合格 | admin fixtureとexpected AX nodesが未定義 |
| トレーサビリティ | 不合格 | admin→AC-SQ016-003→E2Eのリンクがない |

## Candidate tasks

| candidate | priority | duplication／conflict | decision |
|---|---:|---|---|
| admin semantic AX contract | P0 | #461が変更しないtest／docsへ限定できる | 採用 |
| #461 production component修正 | P0 | open PRのscopeと直接重複 | 不採用 |
| manual screen reader／実zoom | P0 | 現環境で代表機器・読み上げ確認ができない | blocked維持 |
| FR-051 persistence | P1 | owner判断が未確定 | blocked維持 |

## Traceability gap

| requirement | design | implementation | test | gap before | intended state |
|---|---|---|---|---|---|
| SQ-016 / AC-SQ016-003 | DES_UI_UX_001 admin row | existing AdminWorkspace／AdminUserPanel | E2E-UI-SR-SEMANTICS-001 | admin scenarioなし | automated pass、manual／overall blocked |

## 修正順序

1. GET限定fixtureとadmin AX contractを共有required E2Eへ追加する。
2. adminの要求・設計・authored trace／matrixを一意に同期する。
3. generatorで派生文書を同期し、targeted testとCIで検証する。
4. #461統合後の最終DOM再実走とmanual evidenceを未完了として引き継ぐ。

## 残課題・未確認

- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機。
- Firefox／WebKit native accessibility tree。
- #461統合後の最終DOM／accessible name再確認。
- FR-051 persistenceのowner判断、API C1 80.48%。

