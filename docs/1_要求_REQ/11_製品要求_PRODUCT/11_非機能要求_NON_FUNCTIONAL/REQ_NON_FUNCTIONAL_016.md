# 要件定義（1要件1ファイル）

- 要件ID: `NFR-016`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 要件

- NFR-016: production `AppView`、利用 persona/job、URL/access condition、canonical requirement、requirement-local acceptance criteria、implementation evidence、executable verification、および generated Web inventory の対応は双方向に追跡可能であり、参照切れ、孤立、重複、または stale artifact を pull request の品質 gate が fail closed で検出すること。

## 受け入れ条件（この要件専用）

- `AC-NFR016-001`: production source に存在する全 `AppView` が exactly one trace entry を持ち、view ID、URL pattern、access condition、persona、job、REQ、AC、verification ID、implementation/test evidence、および未達時の task を含むこと。
- `AC-NFR016-002`: trace に存在する requirement と acceptance ID が canonical `docs/1_要求_REQ/` に存在し、requirement file 内の AC と一致すること。
- `AC-NFR016-003`: implemented verification ID が test source に存在し、evidence path が repository 内に存在すること。planned/manual verification は implemented と表示せず、対応 task または evidence record を持つこと。
- `AC-NFR016-004`: missing view、orphan view、duplicate ID、invalid permission/persona/view、missing REQ/AC/test/evidence、generated stale の各 classification が validator test で非 0 になること。
- `AC-NFR016-005`: semantic trace validation が `task docs:check` と PR CI から実行され、対象 ID と修正可能な原因を出力すること。
- `AC-NFR016-006`: UI change PR は persona、変更前後、state coverage、a11y、responsive、canonical docs、generated inventory、unit/E2E/visual/manual verification、unverified risk を記録できること。
- `AC-NFR016-007`: 一時的な implementation/docs/test 不整合は dependent draft PR であり、解消 owner/期限/PR を明示し、default branch merge 時点では semantic trace gate が pass する場合だけ許可すること。

## 測定・検証

- `NONUI-UI-TRACE-001`: complete graph passes and generates 8-view summary。
- `NONUI-UI-TRACE-002`: each broken-reference class fails with actionable diagnostics。
- `npm run docs:web-inventory:check` and semantic trace test in `task docs:check` / CI。
- PR template inspection and a fixture UI change review。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の P0 artifact responsibility/trace/inconsistency policy と P1 semantic validator/PR template TODO。
- confirmed evidence: current generator checks file freshness but records all routes as `/ (client-state)` and has no REQ/AC/E2E graph。
- repository pattern: PR #343 source-backed API docs/freshness gate。

## 要件の目的・意図

- 目的: active UI implementation と正規 docs/test が別々に更新され、孤立画面・孤立要件・未検証 behavior を生むことを merge 前に検出する。
- 意図: source、canonical docs、test を一つの手書き文書へ複製せず、minimal authored metadata と各 authoritative source を validator で結ぶ。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `NFR-016` |
| 説明 | bidirectional semantic UI traceability and freshness gate |
| 根拠 | file freshness だけでは view→requirement→verification の意味的 stale を検出できない |
| 源泉 | GitHub Issue #345、Web inventory generator、PR #342/#343 |
| 種類 | 非機能要求（保守性・検証性） |
| 依存関係 | canonical docs policy、`FR-094`〜`FR-098`, `SQ-016`, `NFR-018` |
| 衝突 | authored mapping が第二の source of truth になるリスク |
| 受け入れ基準 | `AC-NFR016-001`〜`AC-NFR016-007` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・十分性 | pass | semantic trace と PR integration の双方を cover する。 |
| 一貫性 | pass | canonical docs/generated policy と PR #343 pattern を維持する。 |
| 実現可能性 | pass | existing TypeScript inventory parser/docs CI を拡張可能。 |
| 検証可能性 | pass | positive/negative fixture classes を明示した。 |

## 関連文書・task

- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/do/20260714-1317-issue-345-uiux-traceability-gate.md`
