# Web UI cross-screen quality evidence matrix

> 自動生成: `tools/web-inventory/generate-ui-quality-matrix.mjs`
> generated family registration: `tools/web-inventory/generate-web-inventory.mjs`
>
> `pass` は指定methodのevidenceが揃った場合だけ使用します。`blocked` は未検証またはmanual dependency、`fail` は確認済みdefect、`not_applicable` は根拠付き非該当です。automatedだけでmanual required scopeをpassへ読み替えません。

## 品質軸とevidence owner

| AC | 品質軸 | automated owner | automated evidence | manual owner | manual task |
| --- | --- | --- | --- | --- | --- |
| AC-SQ016-001 | viewport・zoom・reflow・content/function loss | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts`<br>`apps/web/e2e/layout-stress.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-002 | keyboard・focus order/visible/obscured・dialog recovery | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts`<br>`apps/web/e2e/login-keyboard.spec.ts`<br>`apps/web/e2e/keyboard-navigation.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-003 | accessible name・role・state・value・live/error semantics | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts`<br>`apps/web/e2e/screen-reader-semantics.spec.ts`<br>`apps/web/e2e/cross-browser-semantics.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-004 | text・non-text UI・focus indicator contrast・color independence | Phase A audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-005 | 24×24 minimum target・primary 44〜48px class target | Phase A candidate audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-006 | reduced motion・orientation・safe area・virtual keyboard・fixed UI | Phase A candidate audit / Phase B-C remediation | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-screen-audit.ts`<br>`apps/web/e2e/layout-stress.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
| AC-SQ016-007 | long/many/zero/loading/error/permission/partial/stale state | Phase C feature batches | `apps/web/e2e/visual-regression.spec.ts`<br>`apps/web/e2e/cross-browser-state.spec.ts`<br>`apps/web/e2e/layout-stress.spec.ts`<br>`.github/workflows/web-ui-quality.yml` | manual evidence task | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |
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
| chat | AC-SQ016-001 | pass | blocked | blocked | required E2E-UI-ZOOM-REFLOW-001のChromium／Firefox／WebKit 640/320 CSS px到達・root overflow 0に加え、required E2E-UI-LAYOUT-STRESS-001で320pxの長文回答・長い引用名とregion overflow 0を検証。実browser zoomは未検証 |
| chat | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、質問textboxへのTab到達、composerの3px focus indicator、Enter送信、処理中から回答への復帰をkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| chat | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001でChromium AX tree、E2E-UI-CROSS-BROWSER-SEMANTICS-001でFirefox／WebKitのlogin / chat ARIA snapshotとdynamic ARIA stateを検証。代表screen readerのmanual evidenceは未実施 |
| chat | AC-SQ016-004 | pass | blocked | blocked | required E2E-UI-CONTRAST-001で320 / 1280 CSS pxのchat color-contrast違反0、composerの実computed 3px focus indicator比3:1以上、permission stateの可視text・alert・disabled controlを検証。manual contrast reviewと実browser zoomは未実施 |
| chat | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| chat | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのcomputed auditとChromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001でreduced motion下の長文回答を検証。orientation / safe-area / virtual-keyboard実機は未検証 |
| chat | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001の初期／処理中／retry／error／permissionに加え、Chromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001で長文回答と長い引用名を検証。manual evidenceは未実施 |
| chat | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| assignee | AC-SQ016-001 | pass | blocked | blocked | 4 / 2 / 1 column remediation後、required E2E-UI-ZOOM-REFLOW-001をChromium／Firefox／WebKitの640/320 CSS pxで実行し、到達・root overflow 0を検証。実browser zoomは未検証 |
| assignee | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、ステータス絞り込み・検索・問い合わせ選択・回答入力・通知切替・一時保持と3px focus indicatorをkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| assignee | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001でworkspace／一覧／lane／選択中詳細／回答form、filter value、question pressed、notify checked、polite statusのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-003でFirefox／WebKitのARIA snapshotとfilter value・selected pressed・notify checked・visible polite draft statusを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| assignee | AC-SQ016-004 | pass | blocked | blocked | required E2E-UI-CONTRAST-002で320 / 1280 CSS pxの担当者対応color-contrast違反0、検索入力の実computed 3px focus indicator比3:1以上、permission stateの可視text・alert・private content suppressionを検証。manual contrast reviewと実browser zoomは未実施 |
| assignee | AC-SQ016-005 | pass | blocked | blocked | checkboxを24px、RailNav primary targetを44px classへ修正し、4 viewportで未解決candidate 0。manual touch evidenceは未実施 |
| assignee | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのreduced-motion computed auditはpass。orientation / safe-area / virtual-keyboard実機は未検証 |
| assignee | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001に加え、Chromium／Firefox／WebKit required E2E-UI-CROSS-BROWSER-STATE-003でloading→500→retry→confirmed emptyとHTTP 403を区別し、false zero、未確認kanban、private detail露出を防ぐ。manual evidenceは未実施 |
| assignee | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| history | AC-SQ016-001 | pass | blocked | blocked | 4 viewport auditのroot/unresolved overflow 0に加え、Chromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001で320pxの履歴35件・長いtitleとregion overflow 0を検証。実browser zoomは未検証 |
| history | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、履歴への到達、検索・並び替え・お気に入り絞り込み・会話選択、3px focus indicatorをkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| history | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001で履歴region/heading、検索searchbox、並び順comboboxのvalue、お気に入りcheckboxのchecked state、主要buttonのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-006でFirefox／WebKitのARIA snapshotとquery／sort value・favorites checked stateを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| history | AC-SQ016-004 | pass | blocked | blocked | muted foreground remediation後、1280px axe serious/critical blocker 0。manual contrast reviewは未実施 |
| history | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| history | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのcomputed auditとChromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001をreduced motionで検証。orientation / safe-area / virtual-keyboard実機は未検証 |
| history | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001に加え、Chromium／Firefox／WebKit required E2E-UI-CROSS-BROWSER-STATE-001でloading→500→retry→confirmed empty／403、false zero、private detail非表示を検証し、E2E-UI-LAYOUT-STRESS-001で履歴35件と長いtitleも検証。manual evidenceは未実施 |
| history | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| favorites | AC-SQ016-001 | pass | blocked | blocked | 4 viewport auditのroot/unresolved overflow 0に加え、Chromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001で320pxの確認済み0件とregion overflow 0を検証。実browser zoomは未検証 |
| favorites | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、お気に入りnavigationへのSpace到達、戻るbuttonへのTab到達、3px focus indicator、Enterによるチャット復帰をkeyboard-onlyで検証。favorite resume / delete journeyとmanual keyboard journeyは未完了 |
| favorites | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001でお気に入りregion/heading、項目一覧・target type見出し、戻るbuttonのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-007でFirefox／WebKitのARIA snapshotと会話／文書group、item label／target ID／アクセス不可cueを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| favorites | AC-SQ016-004 | pass | blocked | blocked | muted foreground remediation後、1280px axe serious/critical blocker 0。manual contrast reviewは未実施 |
| favorites | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| favorites | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのcomputed auditとChromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001をreduced motionで検証。orientation / safe-area / virtual-keyboard実機は未検証 |
| favorites | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001のloading→500→retry→confirmed empty／403に加え、Chromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001で確認済み0件を検証。manual evidenceは未実施 |
| favorites | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| benchmark | AC-SQ016-001 | pass | blocked | blocked | CI run 29516940570 / artifact 8383090126の4 viewportでroot/unresolved overflow 0。native input 1件はownerとkeyboard代替操作付きsupported_scroll。実browser zoomは未検証 |
| benchmark | AC-SQ016-002 | pass | blocked | blocked | 実行履歴をaccessible name / focus indicator付きscroll regionへ修正し、scrollable-region-focusable blocker 0。manual keyboard journeyは未実施 |
| benchmark | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001でbenchmark region/heading、suite・dataset・model・concurrency controlのname/role/value、実行履歴scroll region/tableのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-008でFirefox／WebKitのworkspace／job panel／control value／history scroll region／tableを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| benchmark | AC-SQ016-004 | pass | blocked | blocked | mode labelをAA muted tokenへ統一し、1280px axe serious/critical blocker 0。manual contrast reviewは未実施 |
| benchmark | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| benchmark | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのreduced-motion computed auditはpass。orientation / safe-area / virtual-keyboard実機は未検証 |
| benchmark | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001でruns/suitesのloading、部分500、retry→confirmed empty、両APIのHTTP 403を区別し、false zeroとprivate detail露出を防ぐ。manual evidenceは未実施 |
| benchmark | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| admin | AC-SQ016-001 | pass | blocked | blocked | required E2E-UI-ZOOM-REFLOW-001をChromium／Firefox／WebKitの640/320 CSS pxで実行し、到達・root overflow 0を検証。CSS viewport proxyであり実browser zoomは未検証 |
| admin | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、overviewのユーザー管理card、概要／ユーザーsection tab、ユーザー検索・状態・並び順・検索確定と3px focus indicatorをkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| admin | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001で管理workspace／heading／section navigation、ユーザー管理region、検索landmark／textbox、filter value、作成form、ユーザー一覧tableのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-005でFirefox／WebKitのworkspace／section navigation／current state、ユーザー管理region／search／filter value／作成form／table／polite取得statusを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| admin | AC-SQ016-004 | pass | blocked | blocked | muted foreground remediation後、1280px axe serious/critical blocker 0。manual contrast reviewは未実施 |
| admin | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| admin | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのreduced-motion computed auditはpass。orientation / safe-area / virtual-keyboard実機は未検証 |
| admin | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001でpartial/stale/source/as-of/retry recoveryを区別し、成功dataを保持する。manual evidenceは未実施 |
| admin | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| documents | AC-SQ016-001 | pass | blocked | blocked | required E2E-UI-ZOOM-REFLOW-001のChromium／Firefox／WebKit 640/320 CSS px到達・root overflow 0に加え、required E2E-UI-LAYOUT-STRESS-001で320pxの長いファイル名とregion overflow 0を検証。desktop row 6件はfocus可能なtable ownerとkeyboard代替操作付きsupported_scroll。実browser zoomは未検証 |
| documents | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、folder／filename search、type／status／folder／sort／page-size、文書detail trigger、dialog初期focus／focus trap／Escape／trigger復帰と3px focus indicatorをkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| documents | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001でworkspace／breadcrumb／folder tree／current context、folder／filename search、filter value、file table、detail dialog／主要action／disclosure expandedのChromium AX tree契約とrowのDOM aria-selectedを検証。E2E-UI-CROSS-BROWSER-SEMANTICS-004でFirefox／WebKitのworkspace／breadcrumb／folder tree／search・filter value／table／detail dialog ARIA snapshotとselected row・disclosure expanded stateを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| documents | AC-SQ016-004 | pass | blocked | blocked | required E2E-UI-CONTRAST-003で320 / 1280 CSS pxの文書画面color-contrast違反0、フォルダ検索入力の実computed 3px focus indicator比3:1以上、permission stateの可視text・alert・private content suppressionを検証。manual contrast reviewと実browser zoomは未実施 |
| documents | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| documents | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのcomputed auditとChromium／Firefox／WebKit required E2E-UI-LAYOUT-STRESS-001をreduced motionで検証。orientation / safe-area / virtual-keyboard実機は未検証 |
| documents | AC-SQ016-007 | pass | blocked | blocked | required E2E-UI-STATE-001に加え、Chromium／Firefox／WebKit required E2E-UI-CROSS-BROWSER-STATE-002でcatalog／folder／reindexのloading、文書取得500によるpartial、retry→confirmed empty、全resource 403を区別し、false zero／emptyとprivate detail露出を防ぐ。E2E-UI-LAYOUT-STRESS-001で長いファイル名も検証。manual evidenceは未実施 |
| documents | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |
| profile | AC-SQ016-001 | pass | blocked | blocked | required E2E-UI-ZOOM-REFLOW-001をChromium／Firefox／WebKitの640/320 CSS pxで実行し、到達・root overflow 0を検証。CSS viewport proxyであり実browser zoomは未検証 |
| profile | AC-SQ016-002 | pass | blocked | blocked | required E2E-UI-KEYBOARD-NAV-001をChromium／Firefox／WebKitで実行し、個人設定への到達、送信キー変更、チャット復帰、3px focus indicatorをkeyboard-onlyで検証。manual keyboard journeyは未実施 |
| profile | AC-SQ016-003 | pass | blocked | blocked | required E2E-UI-SR-SEMANTICS-001で個人設定region/heading、送信キーcomboboxのname/value、戻る・sign out buttonのChromium AX tree契約を検証。E2E-UI-CROSS-BROWSER-SEMANTICS-002でFirefox／WebKitのprofile ARIA snapshotと変更後combobox value・visible polite statusを検証。representative screen readerとnative Firefox／WebKit AX treeは未実施 |
| profile | AC-SQ016-004 | pass | blocked | blocked | required E2E-UI-CONTRAST-004で320 / 1280 CSS pxの個人設定color-contrast違反0、送信キーselectの実computed 3px focus indicator比3:1以上、変更statusの可視text・status role・polite live semanticsを検証。manual contrast reviewと実browser zoomは未実施 |
| profile | AC-SQ016-005 | pass | blocked | blocked | 4 viewportで24px minimumと44px primary targetの未解決candidate 0。manual touch evidenceは未実施 |
| profile | AC-SQ016-006 | pass | blocked | blocked | 4 viewportのreduced-motion computed auditはpass。orientation / safe-area / virtual-keyboard実機は未検証 |
| profile | AC-SQ016-007 | blocked | blocked | blocked | required E2E-UI-STATE-001で送信キーのsession-only scope、polite変更status、画面往復保持を限定検証する。FR-051の永続化、保存失敗/retry/permission、N/A分類とowner判断、manual evidenceは未完了 |
| profile | AC-SQ016-008 | not_applicable | blocked | blocked | manual required scopeは未実施 |

## Phase boundary

- Phase A: matrix、drift validator、computed DOM audit reportをownerとします。
- Phase B: AppShell / RailNavのtarget、focus、reflow remediationをownerとします。
- Phase C以降: feature batchごとのremediationとcontent extremesをownerとします。
- manual evidence task: representative screen reader、実browser 200% / 400% zoom、touch / real-deviceをownerとします。
