# 要件定義（1要件1ファイル）

- 要件ID: `SQ-016`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 要件

- SQ-016: 権限別の主要 user journey は、WCAG 2.2 Level AA を基準として、320〜1280 CSS px、200%/400% zoom、keyboard、representative screen reader、touch、reduced motion、および long/many/zero/error content state で content または function を失わず完了できること。

## 受け入れ条件（この要件専用）

- `AC-SQ016-001`: 320/375/768/1280px と 200%/400% zoom で、normal page flow が two-dimensional scroll を必要とせず、permitted content/action/focus を loss/overlap/clip しないこと。
- `AC-SQ016-002`: 全 interaction は keyboard-only で操作でき、focus order/visible/obscured、dialog trap/restore、Escape、skip/recovery が relevant WCAG condition を満たすこと。
- `AC-SQ016-003`: controls/status/media expose correct accessible name, role, state, value, description, current/busy/live/error semantics to representative screen readers。
- `AC-SQ016-004`: normal text 4.5:1、large text 3:1、meaningful non-text UI/focus indicator 3:1 の relevant contrast を満たし、color alone で state を伝えないこと。
- `AC-SQ016-005`: interaction target は 24×24 CSS px minimum を満たし、primary/icon actions は layout が許す範囲で 44〜48px class target を提供すること。
- `AC-SQ016-006`: reduced motion preference で non-essential animation を抑え、orientation、safe area、virtual keyboard、fixed navigation が primary input/action/status を隠さないこと。
- `AC-SQ016-007`: long text/file names、多数件、0件、loading/error/permission/partial/stale state でも reading/operation order and target context remain intact。
- `AC-SQ016-008`: automated check だけで合格とせず、`NFR-018` の manual evidence が required scope を満たすこと。

## 品質条件と測定

| 条件 | 水準 | 測定 |
| --- | --- | --- |
| Conformance | relevant WCAG 2.2 A/AA; Japan-facing reference JIS X 8341-3:2016 AA | criteria review + automated/manual evidence |
| Reflow | 320/375/768/1280px, 200%/400% zoom without content/function loss | Playwright + browser zoom/manual |
| Input | keyboard/touch/pointer/screen reader primary journeys | E2E + manual |
| Contrast | text/UI/focus/state relevant ratios | token/tool/manual review |
| Target size | WCAG 2.2 24px minimum; 44–48px primary target where practical | computed/layout inspection |
| Content extremes | long/many/zero/error/stale/reduced motion | deterministic fixtures |

## 要件の源泉・背景

- 源泉: GitHub Issue #345 accessibility/responsive TODO and full completion conditions。
- standard: WCAG 2.2 Level AA; JIS X 8341-3:2016 Level AA reference for Japan-facing service。
- confirmed evidence: mobile profile link is hidden at <=720px, inventory has 18 missing and 22 warning items, 390px chat visual exists but full matrix/manual evidence does not。

## 要件の目的・意図

- 目的: disability、input modality、viewport、zoom、motion preference、content volume により permitted primary journey が利用不能になることを防ぐ。
- 意図: automated violation count ではなく journey completion and measurable UI conditions を quality level とする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-016` |
| 説明 | cross-screen accessible and responsive primary-journey quality |
| 根拠 | current source/test cannot prove permitted journeys from 320px through desktop |
| 源泉 | GitHub Issue #345、WCAG 2.2、JIS X 8341-3:2016 reference |
| 種類 | サービス品質制約（accessibility/responsive usability） |
| 依存関係 | `FR-094`〜`FR-098`, `NFR-017`, `NFR-018` |
| 衝突 | information density, target size, and fixed navigation require feature-specific tradeoffs without losing function |
| 受け入れ基準 | `AC-SQ016-001`〜`AC-SQ016-008` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加。2026-07-17 `AC-SQ016-002` の shell skip link と login 前 keyboard-only journey の自動証跡を追加。2026-08-03 個人設定のkeyboard-only journeyとChromium AX tree契約をrequired gateへ追加。2026-08-04 チャットの処理中・SSE再接続・安全なerror・権限案内をrequired gateへ追加。2026-08-05 個人設定のsession-only scopeとpolite変更statusの限定証跡を追加。2026-08-06 履歴のkeyboard-only journeyとChromium AX tree契約をrequired gateへ追加。2026-08-07 benchmarkのChromium AX tree契約をrequired gateへ追加。2026-08-08 お気に入りのkeyboard-only到達・復帰とChromium AX tree契約をrequired gateへ追加。2026-08-10 チャット質問入力の3px focus indicatorとkeyboard-only送信・回答復帰をrequired gateへ追加。2026-08-12 loginと主要画面のkeyboard journeyをFirefox／WebKitのPR required gateへ追加。2026-08-13 login / chatのARIA snapshotとchat動的ARIA stateをFirefox／WebKitのPR required gateへ追加。2026-08-14 640 / 320 CSS pxのreflow proxyをFirefox／WebKitのPR required gateへ追加。2026-08-15 320 CSS pxのcontent-extreme fixtureをFirefox／WebKitのPR required gateへ追加。2026-08-16 履歴のloading／error／permission／retry state contractをFirefox／WebKitのPR required gateへ追加。2026-08-17 担当者対応の名前付きlandmark、3px focus indicator、keyboard-only journey、Chromium AX tree契約をrequired gateへ追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・十分性 | pass | viewport/input/a11y/content states in Issue are represented. |
| 一貫性 | pass | existing chat-only `SQ-004` remains a narrower condition. |
| 実現可能性 | pass with manual dependency | code/test fixes are feasible; screen-reader/real-device evidence requires the named environments. |
| 検証可能性 | pass | numeric thresholds and journey evidence are explicit. |

## 現在の自動証跡（2026-08-17）

- `E2E-UI-SKIP-001`: 認証後 shell の最初の keyboard focus で skip link を表示し、desktop 1280×720 / mobile 320×720 の双方で反復 navigation を越えて一意な `main` landmark へ focus を移す。
- `E2E-UI-LOGIN-KEYBOARD-001`: login 前の email から secondary action までの DOM 順 Tab order、3px outline、native required validation、Space による remember 切替、password 上の Enter submit、認証後 chat 到達、horizontal containment を 1280×720 / 320×720 で検証する。PR required gateではChromium、Firefox、WebKitで実行し、rejected authentication の alert/form description/focus/retry は component test で検証する。
- `E2E-UI-STATE-001`: chat の初期案内→処理中→SSE timeout→`Last-Event-ID`再接続→回答回復、HTTP 500のprivate detail非表示、`chat:create`不足時の明示案内と送信抑止、history / favorites / assignee の loading→500→retry→confirmed empty と HTTP 403、benchmark の loading→500 partial→retry→confirmed empty と HTTP 403、admin の partial→retry→recovered と source/as-of 付き stale→retry→recovered、documents の catalog / reindex loading→部分500→retry→confirmed empty と全resource HTTP 403を required Chromium UI quality gate で検証する。profileは送信キーが現在のsign-in sessionだけ有効である説明、polite変更status、画面往復時の値保持だけを限定検証する。`FR-051`の永続化、保存失敗/retry/permission、N/A分類とowner判断が未完了のため、profileの `AC-SQ016-007` automated status は `blocked` を維持する。
- `E2E-UI-KEYBOARD-NAV-001`: チャットの質問textboxへTabで到達し、composerの3px focus indicator、既定Enter送信、処理中から回答への復帰を検証する。あわせて履歴の検索・並び順・お気に入り絞り込み・会話選択、お気に入りへの到達・チャット復帰、担当者対応のステータス絞り込み・検索・問い合わせ選択・回答入力・通知切替・一時保持、個人設定の送信キー変更とチャット復帰を3px focus indicator付きで検証する。PR required gateではChromium、Firefox、WebKitで実行する。
- `E2E-UI-SR-SEMANTICS-001`: チャットのregion / form / textbox /送信buttonとidle→回答処理中→完了に伴うbusy / polite live state、履歴のregion / heading / searchbox / combobox value / checkbox checked state /主要button、お気に入りのregion / heading / target type見出し /戻るbutton、担当者対応のworkspace /一覧 / lane /選択中詳細 /回答form landmark・filter value・選択state・通知checked state・polite status、benchmarkのregion / heading / suite・dataset・model・concurrency control value /実行履歴scroll region・table、ならびに個人設定のregion / heading / combobox value /主要buttonをChromium accessibility treeで検証し、JSON evidenceをPlaywright reportへ添付する。
- `E2E-UI-CROSS-BROWSER-SEMANTICS-001`: login formとchat region / form / textbox / buttonのname・roleをPlaywright ARIA snapshotで検証し、chatのidle→処理中→完了に伴う`aria-busy` / `aria-live`と処理中articleのroleを同じFirefox／WebKit projectで検証する。snapshotとstate JSONにはbrowser project名とevidence boundaryを付ける。
- `E2E-UI-CROSS-BROWSER-STATE-001`: 履歴のloading→HTTP 500→retry→confirmed emptyとHTTP 403をFirefox／WebKitのPR required gateで検証し、未確認dataをempty／zeroへ変換せず、private detailを表示しないことを確認する。state JSONにはbrowser project名、状態系列、test-only fixture境界を付ける。
- `E2E-UI-ZOOM-REFLOW-001`: 1280px基準の200%相当（640 CSS px）／400%相当（320 CSS px）でchatからdocuments / assignee / admin / profileへ到達し、document rootの水平overflowがないことをChromium／Firefox／WebKitのPR required gateで検証する。JSON evidenceにはbrowser project名、CSS viewport、各viewのURL／dimensions、実browser zoomではないboundaryを付ける。
- `E2E-UI-LAYOUT-STRESS-001`: 320 CSS pxとreduced motionで長文回答の先頭／末尾、長い引用・ファイル名、履歴35件、確認済みお気に入り0件をchat / documents / history / favoritesで表示し、document rootと対象regionの水平overflowがないことをChromium／Firefox／WebKitのPR required gateで検証する。JSON evidenceにはbrowser project名、viewport、fixture量、URL／dimensions、実browser zoom・実支援技術・実機ではないboundaryを付ける。
- Firefox／WebKitの自動証跡はlogin / chatのsemantic contract、履歴の代表resource state、主要keyboard journey、5 viewのCSS viewport reflow proxy、4 viewの320 CSS px content-extreme fixtureに限定する。representative screen reader、browser UIを操作する実200%/400% zoom、text-only zoom、OS scaling、touch／real device、Firefox／WebKit native accessibility treeのengine固有debug出力、非対象画面のbrowser evidenceを代替しない。

## Phase別 evidence contract（2026-07-16）

- Phase Aは8 AppViewsと `AC-SQ016-001`〜`008` を結ぶmachine-readable matrix、canonical screen drift検出、computed DOM baselineを提供する。
- automated evidenceとmanual evidenceを別statusとして保持し、overallはrequired methodに `fail` があれば `fail`、未実施があれば `blocked` とする。
- target sizeはWCAG例外の適用判断が必要なため、computed 24×24未満をcandidateとして収集し、例外確認前にpass / failを断定しない。
- Phase B以降はAppShell / RailNavとfeature batchのremediationをownerとし、Phase AのbaselineだけからSQ-016適合を宣言しない。
- representative screen reader、実browser 200% / 400% zoom、touch / real-deviceはmanual evidence taskのrequired scopeに残す。

## Phase B remediation contract（2026-07-17）

- Phase Aで確定したroot overflow、serious color contrast、keyboardから到達できないhorizontal scroll regionは、Phase Bでproduction sourceとregression assertionを同時に修正する。
- 24×24 minimumに加え、RailNavのprimary navigationは44px class targetとして明示的に監査する。target-size candidateは例外へ自動変換せず、未解決ならPlaywrightをfailureにする。
- nested overflowは、要素、分類、意図、owner、代替操作をartifactへ記録できる場合に限り、装飾・visually hidden label・keyboard操作可能なscroll regionとして分類する。根拠を記録できないcandidateはfailureのまま残す。
- automated reflow / axe / computed target evidenceがpassしても、representative screen reader、実browser 200% / 400% zoom、touch / real-deviceが未実施である間は該当manual statusとoverall statusを`blocked`に保つ。
- Login / auth、API permission、RAG retrieval / grounding、benchmark dataset behaviorはPhase Bの変更対象外とする。

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`
- `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
