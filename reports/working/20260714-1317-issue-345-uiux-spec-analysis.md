# Issue #345 UI/UX 基盤・実装同期 仕様分析

- 作成日: 2026-07-14
- 対象 issue: `https://github.com/tsuji-tomonori/rag-assist/issues/345`
- 基準 branch: `origin/main`
- 基準 commit: `b9fb39becc9a9cdee65c2cd1bfe593b8f6d0309a`
- active task: `tasks/do/20260714-1317-issue-345-uiux-traceability-gate.md`
- 状態表記: `confirmed` / `inferred` / `conflict` / `open_question`

## Input inventory

| ID | Source | 日付 | 種別 | 信頼度 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `RPT-345` | GitHub Issue #345 | 2026-07-14 調査基準 | owner 要求 | confirmed | P0/P1 TODO、日次進行、全体完了条件、対象外 |
| `PR-341` | GitHub PR #341 | merged 2026-07-14 | 実装・要件証跡 | confirmed | FR-056〜FR-093、SQ-005〜SQ-015、正規 docs 統合 |
| `PR-342` | GitHub PR #342 | merged 2026-07-14 | docs 構成変更 | confirmed | REQ/ARC/DES/OPS/generated の正規配置、legacy docs root 削除 |
| `PR-343` | GitHub PR #343 | merged 2026-07-14 | generator / CI | confirmed | source-backed API docs と freshness gate |
| `PR-344` | GitHub PR #344 | merged 2026-07-14 | 管理 UI 再監査 | confirmed | 旧監査の非規範化、管理 UI 残余 gap task |
| `SRC-APP` | `apps/web/src/app/` | current main | production source | confirmed | 8 `AppView`、route guard、navigation、URL state、個人設定 |
| `SRC-CSS` | `apps/web/src/styles/` | current main | production CSS | confirmed | responsive、account 導線、focus、reduced motion、共通 status |
| `GEN-WEB` | `docs/generated/web-ui-inventory.json` | current main | generated inventory | confirmed | 画面、機能、component、操作、静的 a11y metadata |
| `TOOL-WEB` | `tools/web-inventory/generate-web-inventory.mjs` | current main | generator source | confirmed | inventory の抽出・出力・freshness check |
| `TEST-WEB` | `apps/web/src/**/*.test.*` | current main | unit/component test | confirmed | navigation、URL hydration、permission、feature component |
| `E2E-WEB` | `apps/web/e2e/`, `apps/web/playwright.config.ts` | current main | browser test | confirmed | Chromium desktop、390px snapshot、chat/doc/admin 等の導線 |
| `CI-WEB` | `.github/workflows/e2e.yml`, `.github/workflows/memorag-ci.yml` | current main | CI workflow | confirmed | E2E workflow_dispatch、main CI の inventory freshness |
| `DOC-REQ` | `docs/1_要求_REQ/` | current main | canonical requirement | confirmed | atomic requirement、AC、baseline、trace |
| `DOC-ARC` | `docs/2_アーキテクチャ_ARC/README.md` | current main | canonical architecture policy | confirmed | docs root、generated responsibility、authored analysis routing |
| `TASK-ADMIN` | `tasks/todo/20260714-1011-admin-ui-governance-quality.md` | 2026-07-14 | implementation task | confirmed | admin responsive/a11y、URL、server-authoritative data |
| `TASK-CHAT` | `tasks/todo/20260713-2304-responsive-chat-ui-verification.md` | 2026-07-13 | implementation task | confirmed | chat responsive/state/E2E gap |
| `TASK-PREF` | `tasks/todo/20260713-2301-user-preferences.md` | 2026-07-13 | implementation task | confirmed | FR-051 persistent personal settings |

## Report facts

| ID | Source | 抽出事実 | 対象 | 信頼度 | 備考 |
| --- | --- | --- | --- | --- | --- |
| `FACT-345-001` | `RPT-345` | Issue は UI/UX、a11y、responsive、状態、docs/implementation 同期を継続的な品質基盤として扱う。 | 全 Web UI / docs / CI | confirmed | 見た目だけの全面刷新は対象外。 |
| `FACT-345-002` | `PR-341`〜`PR-344` | 起票時に未 merge だった #341〜#344 はすべて current main に merge 済みである。 | P0 dependency | confirmed | source metadata と merge commit を GitHub Apps で確認。 |
| `FACT-345-003` | `PR-342`, `DOC-ARC` | 正規 docs は REQ/ARC/DES/OPS/generated の 5 root であり、`docs/spec/` と `docs/spec-recovery/` は正規ではない。 | docs responsibility | confirmed | #344 の監査 bundle は `reports/working/` にある。 |
| `FACT-345-004` | `SRC-APP` | `AppView` は `chat`, `assignee`, `history`, `favorites`, `benchmark`, `admin`, `documents`, `profile` の 8 個である。 | app shell | confirmed | `apps/web/src/app/types.ts`。 |
| `FACT-345-005` | `SRC-APP` | `AppRoutes` は assignee、benchmark、documents、admin に route-level boolean guard を持つが、chat、history、favorites、profile は view guard を持たない。 | authorization UI boundary | confirmed | API authorization の代替とは扱わない。 |
| `FACT-345-006` | `SRC-APP` | `useAppShellState` は `?view=` と document path/query を初期化・`popstate` で読む。 | URL/deep link | confirmed | document state は folder/document/migration/query/filter/sort を含む。 |
| `FACT-345-007` | `SRC-APP` | 通常 view と document URL の書き込みは `history.replaceState` を使い、利用者操作ごとの history entry を積まない。 | browser history | confirmed | back/forward の期待と現実が partial。 |
| `FACT-345-008` | `SRC-CSS` | 720px 以下では `.account-button` が `display: none` になり、個人設定への navigation control が消える。 | mobile navigation | confirmed | Issue の P0 指摘が current main でも再現する source evidence。 |
| `FACT-345-009` | `SRC-CSS`, `SRC-APP` | 720px 以下で rail item の text も消え、permission により項目が増えた場合の overflow/menu 代替がない。 | mobile navigation | confirmed | icon-only button は `title` と visible text の CSS 非表示に依存。 |
| `FACT-345-010` | `SRC-APP` | `AppShell` の共通 error は `.error-banner` の文字列だけで、`role="alert"`、error category、対象、retry action を持たない。 | common state contract | confirmed | loading は `LoadingStatus` を使う。 |
| `FACT-345-011` | `SRC-APP`, `TASK-PREF` | 個人設定 view は存在するが、送信 shortcut は `useState("enter")` の session-local state であり、authoritative persistence は未実装である。 | profile/preferences | confirmed | FR-051 task と整合。 |
| `FACT-345-012` | `GEN-WEB` | current inventory は 8 screens、12 features、59 components、339 interactions を記録する。 | inventory | confirmed | Issue 起票時の 58 components / 323 interactions から main が進行。 |
| `FACT-345-013` | `GEN-WEB` | documents feature は 143 interactions で、全 feature 中もっとも操作密度が高い。 | document IA | confirmed | 起票時 132 から増えている。 |
| `FACT-345-014` | `GEN-WEB` | 静的 a11y inventory は `ok` 299、`missing` 18、`warning` 22 を返す。 | a11y metadata | confirmed | 自動静的解析だけで WCAG 適合とは判定しない。 |
| `FACT-345-015` | `TOOL-WEB`, `GEN-WEB` | generated screen inventory は全 view の route を `/ (client-state)` としており、現在の query/path behavior と requirement/test trace を表現しない。 | generated docs | confirmed | freshness は file equality を見るが semantic trace を見ない。 |
| `FACT-345-016` | `E2E-WEB` | Playwright project は Desktop Chrome 1 個だけである。 | browser matrix | confirmed | `projects: [{ name: 'chromium', ...Desktop Chrome }]`。 |
| `FACT-345-017` | `E2E-WEB` | visual regression は login、chat、documents、assignee、benchmark、admin、debug と 390px chat snapshot を持つ。 | visual evidence | confirmed | history/favorites/profile と 320px/400% zoom は未確認。 |
| `FACT-345-018` | `CI-WEB` | E2E workflow は `workflow_dispatch` のみで、PR 必須 check ではない。 | CI gate | confirmed | smoke/nightly とも Chromium のみ。 |
| `FACT-345-019` | `TEST-WEB` | URL hydration/popstate と permission-aware RailNav の unit test はある。 | existing test evidence | confirmed | full history semantics、denied deep link、mobile overflow は未検証。 |
| `FACT-345-020` | `PR-344`, `TASK-ADMIN` | admin-specific remaining work is already tracked and must not be duplicated. | admin UI | confirmed | existing task is reused after format/trace update. |
| `FACT-345-021` | `DOC-REQ` | `FR-042`, `FR-043`, `SQ-004` cover chat keyboard/copy/non-overlap but do not cover all AppViews. | requirements | confirmed | cross-screen requirements are missing. |
| `FACT-345-022` | `RPT-345`, `E2E-WEB` | manual keyboard、screen reader、320px/400% zoom、real-device evidence is not present in current sources. | release evidence | confirmed | absence is not proof of failure, but completion is unproven. |
| `FACT-345-023` | `RPT-345`, current source | URL/history and personal-settings reachability show implementation has advanced in parts but remains internally inconsistent. | issue status | conflict | `AppView` query support exists, yet generated docs and history semantics lag. |
| `FACT-345-024` | `DOC-ARC`, `PR-343` | source-backed generated docs/freshness gates are an established repository pattern. | solution constraint | confirmed | UI trace gate should extend the pattern instead of creating a parallel spec tree. |

## Candidate tasks

### `TASK-345-01`: UI semantic traceability and stale detection gate

- Actor: developer / reviewer
- Intent: every production view and UI change can be traced to user purpose, requirement, acceptance, and verification
- Outcome: broken or orphaned trace fails locally and in CI
- Component: Web inventory generator / canonical docs / CI / PR template
- Source: `FACT-345-004`, `FACT-345-012`〜`FACT-345-015`, `FACT-345-024`
- Confidence: confirmed
- Repository task: `tasks/do/20260714-1317-issue-345-uiux-traceability-gate.md`

### `TASK-345-02`: Permission-aware mobile navigation reachability

- Actor: authenticated standard user / assignee / admin / operator
- Intent: reach every permitted view and personal settings on narrow or highly zoomed layouts
- Outcome: no permitted destination disappears, overlaps, or becomes off-screen
- Component: `RailNav` / responsive CSS / navigation tests
- Source: `FACT-345-005`, `FACT-345-008`, `FACT-345-009`
- Confidence: confirmed

### `TASK-345-03`: Addressable URL, history, deep-link, and denied-route recovery

- Actor: authenticated user
- Intent: reload, bookmark, back/forward, and deep-link application views safely
- Outcome: the visible view and restorable workspace state match the URL; denied targets recover without exposing data
- Component: `useAppShellState` / app routing / permission resolution
- Source: `FACT-345-005`〜`FACT-345-007`, `FACT-345-019`, `FACT-345-023`
- Confidence: confirmed

### `TASK-345-04`: Common asynchronous UI state and recovery contract

- Actor: all UI personas
- Intent: distinguish loading, empty, error, permission denied, partial success, stale data, and retry
- Outcome: false zero/blank states are not shown and recovery actions are contextual and accessible
- Component: AppShell / shared UI primitives / feature hooks
- Source: `FACT-345-010`, Issue P0 common-state TODO
- Confidence: confirmed

### `TASK-345-05`: High-impact operation clarity and contextual result feedback

- Actor: document manager / assignee / administrator / operator
- Intent: understand target, effect, recoverability, and result before and after risky actions
- Outcome: delete/share/permission/stop/publish actions cannot be mistaken for another target and results attach to the affected row/item
- Component: documents / admin / benchmark / questions / shared dialog and status UI
- Source: Issue P0 risky-operation TODO and P1 feedback TODO
- Confidence: confirmed

### `TASK-345-06`: Document workspace information architecture and predictable context

- Actor: document reader / manager
- Intent: complete primary work without scanning 143 equally weighted controls
- Outcome: primary/detail/risky operations are progressively disclosed and query/filter/sort/selection state restores predictably
- Component: `DocumentWorkspace` / document URL state / document CSS
- Source: `FACT-345-013`, Issue P1 document IA/state TODO
- Confidence: confirmed

### `TASK-345-07`: Chat and assignee end-to-end state journey

- Actor: standard user / answer editor
- Intent: follow question through processing, answer/refusal, citation, follow-up, and human escalation/response
- Outcome: one coherent state transition is visible and testable across chat/history/assignee
- Component: chat / questions / history
- Source: Issue P1 chat journey and feedback TODO; `TASK-CHAT`
- Confidence: confirmed

### `TASK-345-08`: Admin UI governance quality completion

- Actor: admin / operator
- Intent: preserve source/as-of/filter/selection context and operate at scale without mock data
- Outcome: existing #344 residual gap task is implemented without duplicating the audit
- Component: admin UI / admin API contract
- Source: `FACT-345-020`
- Confidence: confirmed
- Existing repository task: `tasks/todo/20260714-1011-admin-ui-governance-quality.md`

### `TASK-345-09`: Cross-screen WCAG 2.2 AA and responsive remediation

- Actor: keyboard, screen-reader, low-vision, touch, reduced-motion, and narrow-screen users
- Intent: complete permitted primary journeys without losing content or operation
- Outcome: relevant WCAG 2.2 A/AA conditions and the agreed viewport/zoom/data-state matrix pass
- Component: all production Web screens and CSS
- Source: `FACT-345-008`〜`FACT-345-010`, `FACT-345-014`, `FACT-345-022`
- Confidence: confirmed

### `TASK-345-10`: UI vocabulary, tokens, and common primitive consistency

- Actor: all users / maintainers
- Intent: recognize actions and states consistently without internal enum/ID knowledge
- Outcome: user-facing terminology and state visuals derive from approved metadata/tokens/primitives
- Component: `globals.css`, feature CSS, shared controls, display metadata
- Source: Issue P1 wording and design-foundation TODO
- Confidence: confirmed

### `TASK-345-11`: Automated accessibility, mobile, visual, and browser quality gate

- Actor: developer / reviewer
- Intent: detect severe a11y and layout regressions before merge
- Outcome: representative axe, mobile Chromium, visual snapshots, and the decided Firefox/WebKit scope run as required CI checks
- Component: Playwright config/tests / CI
- Source: `FACT-345-016`〜`FACT-345-018`
- Confidence: confirmed

### `TASK-345-12`: Manual accessibility and real-device release evidence

- Actor: release verifier
- Intent: verify the behavior automation cannot prove
- Outcome: keyboard, representative screen reader, 320px/400% zoom, and real-device evidence is recorded per release scope
- Component: release verification / reports / PR evidence
- Source: `FACT-345-022`, WCAG skill policy
- Confidence: confirmed

## Acceptance criteria

### `AC-NFR016-001`: Every production AppView has complete semantic trace

- Task: `TASK-345-01`
- Type: traceability
- Confidence: confirmed

Given production source declares an `AppView`.

When UI trace validation runs.

Then the view has exactly one view ID, URL pattern, access condition, persona, job, requirement, requirement-local AC, executable verification ID, implementation evidence, and unresolved gap/task if not complete.

### `AC-NFR016-002`: Broken and orphaned UI trace fails closed

- Task: `TASK-345-01`
- Type: error_path
- Confidence: confirmed

Given a view, requirement, AC, test ID, permission, persona, or evidence path is missing, duplicated, invalid, or unreferenced.

When local docs validation or PR CI runs.

Then the command exits non-zero and reports the offending ID and reason.

### `AC-FR094-001`: Permitted destinations remain reachable at narrow width and high zoom

- Task: `TASK-345-02`
- Type: boundary / permission
- Confidence: confirmed

Given a persona has its maximum permitted navigation items.

When the application is used at 320 CSS px or equivalent 400% zoom.

Then every permitted AppView and personal settings can be reached without two-dimensional page scrolling, overlap, clipping, or hidden-only controls.

### `AC-FR094-002`: URL, reload, back/forward, and deep link match visible state

- Task: `TASK-345-03`
- Type: normal_path / data_persistence
- Confidence: confirmed

Given an authenticated user navigates across views and restorable workspace state.

When the user reloads, bookmarks, or uses browser back/forward.

Then the URL and visible state remain consistent and previous history entries are restored in order.

### `AC-FR094-003`: Denied deep links recover safely

- Task: `TASK-345-03`
- Type: permission / security
- Confidence: confirmed

Given the URL targets a view or resource the user cannot access.

When the application resolves the target.

Then no protected data is fetched or rendered, an explicit permission state is announced, and a permitted recovery destination is offered.

### `AC-FR095-001`: Common state variants are distinguishable and recoverable

- Task: `TASK-345-04`
- Type: loading / empty / error / permission / partial / stale / retry
- Confidence: confirmed

Given any major view is loading, has no data, fails, is denied, succeeds partially, or holds stale data.

When the state is rendered.

Then visible and programmatic status, source/as-of where relevant, affected target, and the allowed next action are presented without converting the state to a false zero or blank view.

### `AC-FR096-001`: Risky operation explains target, impact, recoverability, and result

- Task: `TASK-345-05`
- Type: safety / error_path / audit
- Confidence: confirmed

Given a user initiates delete, share, permission change, stop, disable, publish, cutover, or rollback.

When confirmation and completion feedback are shown.

Then the target, effect, recovery/irreversibility, reason requirement, progress, success/failure, and audit/result reference are unambiguous and associated with the affected item.

### `AC-FR097-001`: Workspace query and selection context is predictable

- Task: `TASK-345-06`, `TASK-345-08`
- Type: data_persistence / boundary
- Confidence: confirmed

Given search, filter, sort, selected item, or detail panel state exists.

When the user navigates, reloads, or returns from detail.

Then approved restorable state is reflected in the URL or explicit persisted state, invalid values fail safely, and selection remains visibly identified.

### `AC-FR098-001`: High-density UI distinguishes primary, detail, and risky operations

- Task: `TASK-345-06`, `TASK-345-08`, `TASK-345-10`
- Type: usability / boundary
- Confidence: confirmed

Given zero, one, or many records and long labels/file names.

When a user opens a high-density workspace.

Then primary actions are immediately discoverable, secondary detail is progressively disclosed, risky actions are separated, and internal IDs/enums are not required for ordinary completion.

### `AC-UI-JOURNEY-001`: Chat-to-human-support journey is one coherent state flow

- Task: `TASK-345-07`
- Type: normal_path / error_path / RAG quality
- Confidence: confirmed

Given an authenticated user asks answerable and unanswerable questions.

When chat processing, answer/refusal, citation inspection, follow-up, escalation, and assignee response occur.

Then each transition has a visible/programmatic state, RAG citations/refusal remain grounded, and the related conversation/ticket keeps its context.

### `AC-SQ016-001`: Primary journeys satisfy the accessibility and responsive matrix

- Task: `TASK-345-09`
- Type: non_functional
- Confidence: confirmed

Given widths 320/375/768/1280px, 200%/400% zoom, keyboard-only input, representative screen readers, reduced motion, long text, many/zero items, and error states.

When permitted primary journeys are completed.

Then content and function are not lost, focus remains visible/unobscured, controls expose correct name/role/state/value, normal text and meaningful UI meet relevant contrast, and touch targets meet WCAG 2.2 minimums.

### `AC-NFR017-001`: Equivalent UI semantics use common vocabulary and primitives

- Task: `TASK-345-10`
- Type: consistency / maintainability
- Confidence: confirmed

Given equivalent navigation, status, form, dialog, risky action, and feedback semantics appear in different features.

When their implementation and generated inventory are reviewed.

Then approved user vocabulary, design tokens, and shared primitives represent them consistently without production mock fallback values.

### `AC-NFR018-001`: Automated UI quality gates fail severe regressions

- Task: `TASK-345-11`
- Type: CI / non_functional
- Confidence: confirmed

Given a pull request changes production UI or its canonical contract.

When required checks run.

Then serious automated accessibility violations, mobile Chromium failures, stale visual baselines, broken semantic trace, and failures in the approved cross-browser scope block merge.

### `AC-NFR018-002`: Manual evidence is explicit and cannot be replaced by automation

- Task: `TASK-345-12`
- Type: manual verification
- Confidence: confirmed

Given a release or PR claims the full accessibility gate.

When evidence is reviewed.

Then keyboard, representative screen-reader, 320px/400% zoom, and real-device results identify environment, scope, pass/fail, unresolved defects, and date; missing evidence remains unchecked and blocks full Issue completion.

## E2E and non-UI scenarios

### `NONUI-UI-TRACE-001`: UI trace validator accepts the current complete graph

- Acceptance criteria: `AC-NFR016-001`, `AC-NFR016-002`
- Actor: developer
- Priority: P0
- Confidence: confirmed

#### 前提条件

- 8 AppViews, canonical requirements, requirement-local ACs, verification IDs, and evidence paths are registered.

#### 操作

1. UI trace validator を実行する。

#### 期待値

- exit code 0 になる。
- 8 AppViews の bidirectional trace summary が生成される。
- source `AppView` と manifest view set に差分がない。

### `NONUI-UI-TRACE-002`: UI trace validator rejects each broken-reference class

- Acceptance criteria: `AC-NFR016-002`
- Actor: developer
- Priority: P0
- Confidence: confirmed

#### 操作

1. missing view、orphan view、duplicate ID、invalid permission/persona、missing REQ/AC/test/evidence fixture を個別に検証する。

#### 期待値

- 各 fixture が非 0 で失敗し、対象 ID と分類を含む error を返す。

### `E2E-UI-NAV-001`: Standard user can reach all permitted destinations on mobile

- Acceptance criteria: `AC-FR094-001`
- Target: app navigation
- Actor: standard user
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. 320px viewport で sign in する。
2. mobile navigation を開く。
3. chat、history、favorites、permitted documents、personal settings を順に開く。

#### 期待値

- 許可 destination が欠落せず、現在地が programmatically announced される。
- 権限外 destination は表示されず、単に画面外へ隠れた状態にならない。
- page-level horizontal scroll に依存しない。

### `E2E-UI-NAV-002`: Maximum-permission persona navigation does not overflow

- Acceptance criteria: `AC-FR094-001`
- Actor: system admin / operator
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. 320px と 400% zoom 相当で maximum-permission session を開く。
2. 全 navigation item と personal settings を keyboard と touch 相当操作で辿る。

#### 期待値

- navigation item が重ならず、off-screen only にならない。
- focus が固定 navigation に隠れない。

### `E2E-UI-ROUTE-001`: Reload and back/forward restore view state

- Acceptance criteria: `AC-FR094-002`
- Actor: authenticated user
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. chat → documents filter/selection → history → profile と遷移する。
2. reload、back、forward を実行する。
3. current URL を新しい tab 相当で開く。

#### 期待値

- 各 history entry と visible view/state が一致する。
- invalid query values are removed or mapped to an explicit safe state.

### `E2E-UI-ROUTE-002`: Denied deep link exposes no protected content

- Acceptance criteria: `AC-FR094-003`
- Actor: user without target permission
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. admin/documents/benchmark deep link を直接開く。

#### 期待値

- protected API/data is not fetched or rendered.
- permission denied state and safe permitted destination are announced.

### `E2E-UI-STATE-001`: Error, stale, partial, and retry states remain distinct

- Acceptance criteria: `AC-FR095-001`
- Actor: any persona
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. representative API responses for loading, empty, 403, 500, partial success, stale data, and retry success を順に inject する。
2. retry action を実行する。

#### 期待値

- state semantics and target are visually and programmatically distinct.
- empty is not rendered for failure/permission/stale states.
- retry result updates the associated region and live status.

### `E2E-UI-RISK-001`: Risky operation context remains attached to the target

- Acceptance criteria: `AC-FR096-001`
- Actor: manager/admin/operator
- Priority: P0
- Confidence: confirmed

#### 画面操作

1. document delete、share change、benchmark cancel、alias publish の代表操作を開始する。
2. confirmation を cancel / execute する。
3. success and failure response を確認する。

#### 期待値

- dialog accessible name and description identify the target/effect/recovery.
- completion or failure feedback appears on the target row/card/panel and in an appropriate live region.

### `E2E-UI-DOCUMENTS-001`: Document workspace preserves task context and progressive disclosure

- Acceptance criteria: `AC-FR097-001`, `AC-FR098-001`
- Actor: document reader / manager
- Priority: P1
- Confidence: confirmed

#### 画面操作

1. long filename and many-item dataset で search/filter/sort を設定する。
2. item を選択して detail を開き、secondary/risky operations を展開する。
3. reload and return navigation を実行する。

#### 期待値

- current query/filter/sort/selection and result context remain clear and restore according to contract.
- primary operations are not displaced by all 143 interactions at once.

### `E2E-UI-CHAT-001`: Answerable/refusal/follow-up/escalation journey remains coherent

- Acceptance criteria: `AC-UI-JOURNEY-001`
- Actor: standard user / assignee
- Priority: P1
- Confidence: confirmed

#### 画面操作

1. grounded question を送信し、answer and citations を確認する。
2. unsupported question を送信し、refusal and follow-up を確認する。
3. human escalation を作成し、assignee が回答し、利用者が history から結果を確認する。

#### 期待値

- processing/answer/refusal/citation/follow-up/ticket states remain linked to the same conversation and ticket.
- RAG grounding, refusal, citation, and authorization invariants remain unchanged.

### `E2E-UI-A11Y-001`: Primary journeys work with keyboard and representative screen reader

- Acceptance criteria: `AC-SQ016-001`, `AC-NFR018-002`
- Actor: keyboard / screen-reader user
- Priority: P1
- Confidence: confirmed requirement; execution evidence open

#### 画面操作

1. login、chat、documents、admin、questions の代表 journey を keyboard-only で完了する。
2. representative screen reader で name/role/state/value/order/status を確認する。

#### 期待値

- no keyboard trap exists; dialogs trap and restore focus; Escape behavior is intentional.
- focus is visible and not obscured.
- status, error, busy, and current navigation are announced.

### `E2E-UI-RESPONSIVE-001`: Viewport, zoom, motion, and content extremes preserve function

- Acceptance criteria: `AC-SQ016-001`
- Actor: low-vision / touch user
- Priority: P1
- Confidence: confirmed requirement; execution evidence open

#### 画面操作

1. 320/375/768/1280px、200%/400% zoom、reduced motion で representative views を開く。
2. long text/file names、many/zero records、error states を表示する。

#### 期待値

- no content or function loss, unintended two-dimensional page scroll, overlap, or clipped focus occurs.
- touch targets, contrast, and reduced-motion behavior meet the defined quality requirement.

### `NONUI-UI-GATE-001`: UI pull request gate detects stale or severe regression

- Acceptance criteria: `AC-NFR018-001`
- Actor: CI
- Priority: P1
- Confidence: confirmed

#### 操作

1. source-only UI change、missing trace、serious axe violation、mobile failure、visual mismatch、selected cross-browser failure fixture を評価する。

#### 期待値

- required gate fails with actionable diagnostics.
- non-UI-only changes do not receive an unrelated false-positive failure.

## Operation and expectation groups

### Group: Application navigation and routing

| OP ID | Scenario | 操作 | 対象 |
| --- | --- | --- | --- |
| `OP-UI-001` | `E2E-UI-NAV-001` | mobile navigation を開く | application shell |
| `OP-UI-002` | `E2E-UI-NAV-001`, `E2E-UI-NAV-002` | permitted destination を選ぶ | AppView navigation item |
| `OP-UI-003` | `E2E-UI-ROUTE-001` | reload/back/forward/deep link | browser history / URL |
| `OP-UI-004` | `E2E-UI-ROUTE-002` | denied deep link を開く | protected view |

| EXP ID | Scenario | 期待値 | 検証方法 |
| --- | --- | --- | --- |
| `EXP-UI-001` | `E2E-UI-NAV-001`, `E2E-UI-NAV-002` | permitted destinations and profile are reachable without overflow | Playwright mobile + zoom/manual |
| `EXP-UI-002` | `E2E-UI-ROUTE-001` | URL/history and visible state remain synchronized | unit + E2E |
| `EXP-UI-003` | `E2E-UI-ROUTE-002` | denied target exposes no protected data and offers safe recovery | permission E2E/network assertions |

### Group: Common state and risky feedback

| OP ID | Scenario | 操作 | 対象 |
| --- | --- | --- | --- |
| `OP-UI-005` | `E2E-UI-STATE-001` | retry を実行する | contextual state panel |
| `OP-UI-006` | `E2E-UI-RISK-001` | risky operation を確認/cancel/execute する | target row/item/dialog |

| EXP ID | Scenario | 期待値 | 検証方法 |
| --- | --- | --- | --- |
| `EXP-UI-004` | `E2E-UI-STATE-001` | loading/empty/error/permission/partial/stale/retry are distinct | component + E2E + a11y |
| `EXP-UI-005` | `E2E-UI-RISK-001` | target/effect/recovery/result remain associated | dialog/row assertions + audit evidence |

### Group: High-density workspace and user journey

| OP ID | Scenario | 操作 | 対象 |
| --- | --- | --- | --- |
| `OP-UI-007` | `E2E-UI-DOCUMENTS-001` | search/filter/sort/select/detail | document workspace |
| `OP-UI-008` | `E2E-UI-CHAT-001` | ask/inspect citation/follow-up/escalate/respond | chat/questions/history |

| EXP ID | Scenario | 期待値 | 検証方法 |
| --- | --- | --- | --- |
| `EXP-UI-006` | `E2E-UI-DOCUMENTS-001` | context restores and action hierarchy remains clear | URL/component/visual E2E |
| `EXP-UI-007` | `E2E-UI-CHAT-001` | state transitions preserve conversation, ticket, grounding, and authorization | E2E + API assertions |

### Group: Accessibility and responsive quality

| OP ID | Scenario | 操作 | 対象 |
| --- | --- | --- | --- |
| `OP-UI-009` | `E2E-UI-A11Y-001` | keyboard and screen-reader journey | representative primary flows |
| `OP-UI-010` | `E2E-UI-RESPONSIVE-001` | viewport/zoom/motion/content matrix | all major screens |

| EXP ID | Scenario | 期待値 | 検証方法 |
| --- | --- | --- | --- |
| `EXP-UI-008` | `E2E-UI-A11Y-001` | name/role/state/value/order/focus/status are usable | axe + keyboard + representative screen reader |
| `EXP-UI-009` | `E2E-UI-RESPONSIVE-001` | no content/function loss or unintended two-dimensional scroll | Playwright + zoom/manual + real device |

### Group: Artifact synchronization and release gate

| OP ID | Scenario | 操作 | 対象 |
| --- | --- | --- | --- |
| `OP-UI-011` | `NONUI-UI-TRACE-001`, `NONUI-UI-TRACE-002` | semantic trace validator を実行 | source/docs/test manifest |
| `OP-UI-012` | `NONUI-UI-GATE-001` | UI CI gate を実行 | PR diff / representative E2E |

| EXP ID | Scenario | 期待値 | 検証方法 |
| --- | --- | --- | --- |
| `EXP-UI-010` | `NONUI-UI-TRACE-001`, `NONUI-UI-TRACE-002` | complete graph passes; broken graph fails with IDs | Node unit + docs check |
| `EXP-UI-011` | `NONUI-UI-GATE-001` | severe regression blocks merge; unrelated changes avoid false positives | CI fixture / workflow inspection |

## Requirements and specification candidates

| ID | 種別 | 要求・仕様候補 | Confidence | Primary verification |
| --- | --- | --- | --- | --- |
| `FR-094` | functional | 認証済み利用者は、許可された AppView と個人設定を安定 URL、mobile navigation、browser history から到達・復元でき、拒否 target から安全に復帰できる。 | confirmed | `E2E-UI-NAV-001`, `E2E-UI-NAV-002`, `E2E-UI-ROUTE-001`, `E2E-UI-ROUTE-002` |
| `FR-095` | functional | 全主要画面は loading/empty/error/permission/partial/stale/retry を共通意味で区別し、対象と次操作を示す。 | confirmed | `E2E-UI-STATE-001` |
| `FR-096` | functional | 高影響操作は対象、影響、回復可否、理由、進捗、結果を対象 context に結びつける。 | confirmed | `E2E-UI-RISK-001` |
| `FR-097` | functional | high-density workspace は search/filter/sort/selection/detail の approved restorable state を予測可能に保つ。 | confirmed | `E2E-UI-DOCUMENTS-001` |
| `FR-098` | functional | high-density workspace は primary/detail/risky operations を段階化し、利用者語彙と選択 context で ordinary task を完了可能にする。 | confirmed | `E2E-UI-DOCUMENTS-001` |
| `SQ-016` | service quality | permission-aware primary journeys は WCAG 2.2 AA と viewport/zoom/input/content-state matrix で content/function loss なく完了できる。 | confirmed | `E2E-UI-A11Y-001`, `E2E-UI-RESPONSIVE-001` |
| `NFR-016` | non-functional | production AppView、requirement、AC、implementation、verification、generated inventory の semantic trace は双方向に完全で、stale/orphan を CI が fail closed で検出する。 | confirmed | `NONUI-UI-TRACE-001`, `NONUI-UI-TRACE-002` |
| `NFR-017` | non-functional | equivalent UI semantics は approved vocabulary、tokens、common primitives、honest data state で一貫して表す。 | confirmed | component/inventory/No Mock review |
| `NFR-018` | non-functional | UI release evidence は automated a11y/mobile/visual/selected browsers と manual keyboard/screen-reader/zoom/real-device を区別して記録する。 | confirmed | `NONUI-UI-GATE-001`, `E2E-UI-A11Y-001` |
| `SPEC-UI-TRACE-001` | design | authored trace manifest is the minimal mapping source; production source and canonical docs remain authoritative for declared views/requirements/AC/test evidence. | inferred | validator unit / generated output |
| `SPEC-UI-STATE-001` | design | common state primitive exposes kind, title, detail, target, source/as-of, busy/live semantics, and allowed recovery action without fake data. | inferred | component tests |
| `SPEC-UI-NAV-001` | design | mobile navigation uses a semantic, keyboard/touch-operable disclosure that retains current state and all permitted destinations. | inferred | navigation E2E/a11y |

## Traceability matrix

| Source | Fact | Task | AC | E2E / non-UI | OP/EXP | Requirement / spec | Current evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RPT-345` | `FACT-345-004`, `012`〜`015` | `TASK-345-01` | `AC-NFR016-001`, `002` | `NONUI-UI-TRACE-001`, `002` | `OP-UI-011`, `EXP-UI-010` | `NFR-016`, `SPEC-UI-TRACE-001` | Web inventory generator/freshness only | partial |
| `RPT-345` | `FACT-345-005`, `008`, `009` | `TASK-345-02` | `AC-FR094-001` | `E2E-UI-NAV-001`, `002` | `OP-UI-001`, `002`; `EXP-UI-001` | `FR-094`, `SPEC-UI-NAV-001` | desktop RailNav tests; mobile profile hidden | conflict |
| `RPT-345` | `FACT-345-006`, `007`, `019`, `023` | `TASK-345-03` | `AC-FR094-002`, `003` | `E2E-UI-ROUTE-001`, `002` | `OP-UI-003`, `004`; `EXP-UI-002`, `003` | `FR-094` | query hydration/popstate; replaceState only | partial |
| `RPT-345` | `FACT-345-010` | `TASK-345-04` | `AC-FR095-001` | `E2E-UI-STATE-001` | `OP-UI-005`, `EXP-UI-004` | `FR-095`, `SPEC-UI-STATE-001` | loading component; plain global error text | partial |
| `RPT-345` | Issue risky operation / feedback | `TASK-345-05` | `AC-FR096-001` | `E2E-UI-RISK-001` | `OP-UI-006`, `EXP-UI-005` | `FR-096` | feature-specific dialogs/tests exist; cross-screen audit missing | partial |
| `RPT-345` | `FACT-345-013` | `TASK-345-06` | `AC-FR097-001`, `AC-FR098-001` | `E2E-UI-DOCUMENTS-001` | `OP-UI-007`; `EXP-UI-006` | `FR-097`, `FR-098` | document URL state and #346 onboarding exist | partial |
| `RPT-345` | Issue chat journey | `TASK-345-07` | `AC-UI-JOURNEY-001` | `E2E-UI-CHAT-001` | `OP-UI-008`, `EXP-UI-007` | existing `FR-003`〜`005`, `FR-009`, `FR-021`, `FR-031`〜`037`, `FR-095` | chat/document smoke exists; full handoff missing | partial |
| `PR-344` | `FACT-345-020` | `TASK-345-08` | `AC-FR097-001`, `AC-FR098-001` | admin variants of workspace/risk scenarios | `OP-UI-006`, `007` | existing admin requirements plus `FR-096`〜`098` | `TASK-ADMIN` | todo |
| `RPT-345` | `FACT-345-008`〜`010`, `014`, `022` | `TASK-345-09` | `AC-SQ016-001` | `E2E-UI-A11Y-001`, `E2E-UI-RESPONSIVE-001` | `OP-UI-009`, `010`; `EXP-UI-008`, `009` | `SQ-016` | 390px chat visual; static a11y warnings | partial |
| `RPT-345` | Issue vocabulary/tokens | `TASK-345-10` | `AC-NFR017-001` | component/inventory verification | common-state OP/EXP | `NFR-017` | globals token and shared components exist; feature drift unaudited | partial |
| `RPT-345` | `FACT-345-016`〜`018` | `TASK-345-11` | `AC-NFR018-001` | `NONUI-UI-GATE-001` | `OP-UI-012`, `EXP-UI-011` | `NFR-018` | Chromium workflow_dispatch only | partial |
| `RPT-345` | `FACT-345-022` | `TASK-345-12` | `AC-NFR018-002` | `E2E-UI-A11Y-001`, `E2E-UI-RESPONSIVE-001` | `OP-UI-009`, `010`; `EXP-UI-008`, `009` | `NFR-018`, `SQ-016` | no authoritative manual evidence found | missing |

## Issue TODO coverage

| Issue TODO | Evidence or task | Current assessment |
| --- | --- | --- |
| #341〜#344 dependency/overlap/conflict | `FACT-345-002`, `003`; `TASK-345-01` records resolution | resolved in main; evidence to publish |
| #342 legacy docs deletion vs #344 addition conflict | `PR-342`, `PR-344`, `FACT-345-003` | resolved; audit lives under reports |
| Canonical/generated/test/report sync targets | `TASK-345-01`, `NFR-016` | milestone 1 implementation complete; PR/CI evidence pending |
| AppView/persona/job/REQ/AC/E2E mapping | `TASK-345-01`, `SPEC-UI-TRACE-001` | 8-view manifest and generated trace implemented |
| Temporary PR inconsistency conditions/deadline/blocker | `TASK-345-01`, canonical UI design policy | canonical policy implemented |
| 320px/400% permitted views and personal settings | `TASK-345-02`, `FR-094` | confirmed gap |
| Maximum permission navigation overflow | `TASK-345-02`, `E2E-UI-NAV-002` | confirmed gap |
| URL/history/reload/deep link/denied recovery | `TASK-345-03`, `FR-094` | partial implementation |
| Risky operations clarity | `TASK-345-05`, `FR-096` | partial; cross-screen evidence missing |
| Common state contract | `TASK-345-04`, `FR-095` | confirmed gap |
| Four-persona journeys | `TASK-345-06`〜`TASK-345-09`; trace manifest | pending |
| Document 143-operation IA | `TASK-345-06`, `FR-098` | confirmed gap |
| Search/filter/sort/selection predictability | `TASK-345-03`, `006`, `008`; `FR-097` | partial |
| Chat coherent state transition | `TASK-345-07`, existing chat requirements, `FR-095` | partial |
| Target-attached feedback | `TASK-345-04`, `005`; `FR-095`, `FR-096` | partial |
| User vocabulary and no raw enum/ID dependency | `TASK-345-10`, `NFR-017` | partial |
| WCAG 2.2 AA audit | `TASK-345-09`, `SQ-016` | static evidence only; incomplete |
| Icon-only navigation semantics | `TASK-345-02`, `009` | confirmed gap at 720px CSS |
| Viewport/zoom/motion/content extremes | `TASK-345-09`, `SQ-016` | 390px chat only; incomplete |
| Mobile login/chat/documents/admin/questions E2E | `TASK-345-11`, `NFR-018` | incomplete |
| CSS tokens/common primitives | `TASK-345-10`, `NFR-017` | partial |
| Automated accessibility CI failure | `TASK-345-11`, `NFR-018` | missing |
| Representative visual regression | `TASK-345-11`, `NFR-018` | partial; not required PR gate |
| Mobile Chromium required and Firefox/WebKit scope | `TASK-345-11`, `NFR-018` | missing |
| Semantic trace validator | `TASK-345-01`, `NFR-016` | implemented; local positive/negative tests pass |
| UI PR template fields | `TASK-345-01`, `NFR-016` | implemented; PR usage evidence pending |

## Gap analysis and open questions

### `GAP-UI-001`: Mobile profile navigation is removed

- Category: missing_boundary_case / accessibility
- Severity: high
- Confidence: confirmed
- Evidence: `apps/web/src/styles/responsive.css` hides `.account-button` at 720px.
- Requirement: `FR-094`, `SQ-016`
- Task: `TASK-345-02`

### `GAP-UI-002`: Browser history semantics are incomplete

- Category: no_specification / missing_boundary_case
- Severity: high
- Confidence: confirmed
- Evidence: all URL writes call `replaceState`.
- Requirement: `FR-094`
- Task: `TASK-345-03`

### `GAP-UI-003`: Common error and recovery semantics are absent

- Category: missing_error_path
- Severity: high
- Confidence: confirmed
- Evidence: AppShell error is unstructured text without alert/retry/target.
- Requirement: `FR-095`
- Task: `TASK-345-04`

### `GAP-UI-004`: High-impact operation feedback is not governed cross-feature

- Category: missing_error_path / interaction_safety
- Severity: high
- Confidence: inferred
- Evidence: feature-specific confirmations exist, but target/effect/recoverability/result is not validated by one cross-screen contract.
- Requirement: `FR-096`
- Task: `TASK-345-05`

### `GAP-UI-005`: Document workspace density and restoration remain incomplete

- Category: usability / missing_boundary_case
- Severity: high
- Confidence: confirmed
- Evidence: current inventory reports 143 document interactions while full primary/detail/risky hierarchy and restoration evidence is absent.
- Requirement: `FR-097`, `FR-098`
- Task: `TASK-345-06`

### `GAP-UI-006`: Chat-to-assignee state journey is not verified end to end

- Category: missing_scenario
- Severity: high
- Confidence: confirmed
- Evidence: feature tests exist, but one question-to-human-response state transition across chat/history/assignee is absent.
- Requirement: existing chat/question requirements, `FR-095`
- Task: `TASK-345-07`

### `GAP-UI-TRACE-001`: Generated screen routes contradict current URL behavior

- Category: conflict
- Severity: high
- Confidence: confirmed
- Evidence: generator emits `/ (client-state)` for all views while source reads `?view=` and document paths.
- Requirement: `NFR-016`
- Task: `TASK-345-01`

### `GAP-UI-007`: Cross-screen accessibility and responsive completion is unproven

- Category: missing_non_functional
- Severity: high
- Confidence: confirmed
- Evidence: static inventory findings remain and the full viewport/input/content-state matrix has not been run.
- Requirement: `SQ-016`, `NFR-018`
- Task: `TASK-345-09`

### `GAP-UI-008`: Automated accessibility/mobile/browser release gate is incomplete

- Category: missing_non_functional
- Severity: high
- Confidence: confirmed
- Evidence: one Desktop Chrome project, no axe dependency/gate, and E2E remains workflow-dispatch only.
- Requirement: `NFR-018`, `SQ-016`
- Task: `TASK-345-11`

### `GAP-UI-009`: Manual accessibility release evidence is absent

- Category: missing_non_functional
- Severity: high
- Confidence: confirmed
- Evidence: no authoritative keyboard, representative screen-reader, 400% zoom, or real-device evidence was found.
- Requirement: `NFR-018`, `SQ-016`
- Task: `TASK-345-12`

### `GAP-UI-PREF-001`: Personal settings are reachable on desktop but not persisted

- Category: no_specification / data_persistence
- Severity: medium
- Confidence: confirmed
- Evidence: `submitShortcut` is local React state initialized to `enter`.
- Requirement: existing `FR-051`, `FR-094`
- Task: existing `TASK-PREF`, plus `TASK-345-02` for reachability.

### Open questions

| ID | Related | Question | Proposed default | Why it remains open |
| --- | --- | --- | --- | --- |
| `OQ-UI-001` | `NFR-018` | Which Firefox/WebKit checks are required on every PR vs scheduled? | Chromium desktop + mobile required on PR; Firefox/WebKit representative journey scheduled until runtime is stable | CI duration and existing browser installation are not measured yet. |
| `OQ-UI-002` | `NFR-018`, `SQ-016` | Which representative screen-reader environments are release evidence? | NVDA + current Chrome on Windows and VoiceOver + current Safari on iOS/macOS for primary journeys | Current execution environment cannot itself prove those manual checks. |
| `OQ-UI-003` | `FR-094` | Should canonical non-document URLs use paths or `?view=`? | Preserve backward-compatible `?view=` first; define path migration only through ADR if needed | Changing deployed routing/CloudFront fallback may affect infra. |
| `OQ-UI-004` | `NFR-018` | Which visual baselines are PR required? | login, chat empty/answer, documents, questions, admin at desktop and mobile; remaining views smoke-only | Baseline runtime cost and flake rate need measurement. |

## RAG quality and security impact

- The UI foundation does not alter retrieval, answerability, grounding, citation validation, or support verification algorithms.
- Chat journey tests must continue to assert answer/refusal/citation behavior from existing `FR-003`〜`FR-005`, `FR-014`, `FR-015` and must not hard-code benchmark phrases into production logic.
- Permission-denied routing must prevent protected fetch/render but remains defense in depth; API authorization and tenant/resource filtering remain authoritative.
- UI trace metadata may reference RAG/security requirements but must never expose raw prompt, chunk text, debug trace, ACL metadata, or internal memo to unauthorized users.
- Test/visual fixtures remain isolated from production components in accordance with No Mock Product UI.

## Requirement validation review

| 観点 | 確認結果 | メモ |
| --- | --- | --- |
| 必要性 | pass | Each candidate maps directly to an Issue TODO or confirmed current gap. |
| 十分性 | partial | Repository-level requirements are covered; manual environment ownership remains open. |
| 理解容易性 | pass | Actors, conditions, outcomes, IDs, and current status are explicit. |
| 一貫性 | pass with gap | Existing partial URL/mobile/E2E behavior is recorded instead of overwritten. |
| 標準・契約適合 | pass | WCAG 2.2 AA, JIS X 8341-3:2016 reference, canonical docs routing, and No Mock Product UI are retained. |
| 実現可能性 | pass | Tasks are decomposed by coherent implementation outcome; manual evidence is separated. |
| 検証可能性 | pass | Every candidate requirement has automated or manual scenario IDs. |
| ニーズ適合 | pass | The set addresses continuous UI quality and docs/implementation synchronization, not a cosmetic rewrite. |

## Validator applicability

`scripts/validate_spec_recovery.py` does not exist in current main. The repository's applicable canonical validators are `scripts/validate_docs.py`, Web inventory freshness, and the semantic UI trace validator implemented by `TASK-345-01`. The missing script is therefore recorded rather than claimed as run.
