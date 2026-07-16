# Web UI cross-screen quality evidence matrix

> 自動生成: `tools/web-inventory/generate-ui-quality-matrix.mjs`
> generated family registration: `tools/web-inventory/generate-web-inventory.mjs`
>
> `pass` は指定methodのevidenceが揃った場合だけ使用します。`blocked` は未検証またはmanual dependency、`fail` は確認済みdefect、`not_applicable` は根拠付き非該当です。automatedだけでmanual required scopeをpassへ読み替えません。

## 品質軸とevidence owner

| AC | 品質軸 | automated owner | automated evidence | manual owner | manual task |
| --- | --- | --- | --- | --- | --- |
| AC-SQ016-001 | viewport・zoom・reflow・content/function loss | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-002 | keyboard・focus order/visible/obscured・dialog recovery | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-003 | accessible name・role・state・value・live/error semantics | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-004 | text・non-text UI・focus indicator contrast・color independence | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-005 | 24×24 minimum target・primary 44〜48px class target | Phase A candidate audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-006 | reduced motion・orientation・safe area・virtual keyboard・fixed UI | Phase A candidate audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-007 | long/many/zero/loading/error/permission/partial/stale state | Phase C feature batches | `apps/web/e2e/visual-regression.spec.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-008 | manual evidence required scope | not applicable | - | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |

## 画面・persona・journey

| view | route | permission | persona | primary journey |
| --- | --- | --- | --- | --- |
| chat | / | なし | `standard-user`<br>`answer-editor`<br>`operator`<br>`system-admin` | `JOB-UI-CHAT: 質問し、回答・回答不能・根拠・確認質問・人手対応への状態を追う` |
| assignee | /?view=assignee | `canAnswerQuestions` | `answer-editor`<br>`system-admin` | `JOB-UI-ASSIGNEE: 許可された問い合わせを検索・選択し、回答または下書きを安全に更新する` |
| history | /?view=history | なし | `standard-user`<br>`answer-editor`<br>`operator`<br>`system-admin` | `JOB-UI-HISTORY: 自分の会話を検索・選択・再開・削除する` |
| favorites | /?view=favorites | なし | `standard-user`<br>`answer-editor`<br>`operator`<br>`system-admin` | `JOB-UI-FAVORITES: 自分のお気に入り会話を確認し、再開または解除する` |
| benchmark | /?view=benchmark | `canReadBenchmarkRuns` | `operator`<br>`system-admin` | `JOB-UI-BENCHMARK: benchmark run を開始・監視・停止し、成果物を確認する` |
| admin | /?view=admin | `canSeeAdminSettings` | `system-admin` | `JOB-UI-ADMIN: 管理対象の source/as-of/context を確認して許可された governance 操作を行う` |
| documents | /documents | `canReadDocuments` | `operator`<br>`system-admin` | `JOB-UI-DOCUMENTS: 許可された文書を発見・登録・共有・移動し、取り込みと索引状態を追う` |
| profile | /?view=profile | なし | `standard-user`<br>`answer-editor`<br>`operator`<br>`system-admin` | `JOB-UI-PROFILE: 本人の設定状態を確認・変更し、安全に sign out する` |

## evidence state

| view | AC | automated | manual | overall | note |
| --- | --- | --- | --- | --- | --- |
| chat | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| chat | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| chat | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| chat | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| chat | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| chat | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| chat | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| chat | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| assignee | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| assignee | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| assignee | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| assignee | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| assignee | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| assignee | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| assignee | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| assignee | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| history | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| history | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| history | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| history | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| history | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| history | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| history | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| history | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| favorites | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| favorites | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| favorites | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| favorites | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| favorites | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| favorites | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| favorites | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| favorites | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| benchmark | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| benchmark | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| benchmark | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| benchmark | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| benchmark | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| benchmark | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| benchmark | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| benchmark | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| admin | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| admin | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| admin | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| admin | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| admin | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| admin | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| admin | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| admin | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| documents | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| documents | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| documents | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| documents | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| documents | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| documents | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| documents | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| documents | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| profile | AC-SQ016-001 | blocked | blocked | blocked | computed reflow baselineと実browser zoom evidence待ち |
| profile | AC-SQ016-002 | blocked | blocked | blocked | focus candidate auditとkeyboard journey evidence待ち |
| profile | AC-SQ016-003 | blocked | blocked | blocked | axe/name-state baselineとscreen reader evidence待ち |
| profile | AC-SQ016-004 | blocked | blocked | blocked | computed/axe contrast baselineとmanual review待ち |
| profile | AC-SQ016-005 | blocked | blocked | blocked | target candidateの例外分類とremediation待ち |
| profile | AC-SQ016-006 | blocked | blocked | blocked | reduced-motion baselineとdevice evidence待ち |
| profile | AC-SQ016-007 | blocked | blocked | blocked | content-state matrixのfeature evidence待ち |
| profile | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |

## Phase boundary

- Phase A: matrix、drift validator、computed DOM audit reportをownerとします。
- Phase B: AppShell / RailNavのtarget、focus、reflow remediationをownerとします。
- Phase C以降: feature batchごとのremediationとcontent extremesをownerとします。
- manual evidence task: representative screen reader、実browser 200% / 400% zoom、touch / real-deviceをownerとします。
