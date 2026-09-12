# Issue #345 文書semantic証跡 仕様分析

## Input inventory

| Source | Type | Reliability | Finding |
| --- | --- | --- | --- |
| Issue #345 / Draft PR #462 | issue / PR | confirmed | keyboard、screen reader、320px／400% zoom、状態契約と追跡の継続改善を要求する |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | confirmed | `AC-SQ016-003`はaccessible name／role／state／valueと支援技術証跡を要求する |
| `DES_UI_UX_001.md` | canonical design | confirmed | documents rowは「keyboard/axe」と記す一方、`AC-SQ016-003`とsemantic E2Eを追跡していない |
| `ui-quality-matrix.json` | authored quality matrix | confirmed | documentsの`AC-SQ016-003` automatedは`blocked`である |
| `ui-traceability.json` | authored trace | confirmed | documentsは`SQ-016`、`AC-SQ016-003`を参照していない。共有E2E IDはview間重複を許さないためglobal quality evidenceで結線する |
| `screen-reader-semantics.spec.ts` | required E2E | confirmed | documentsは高位landmarkだけを検査し、検索、filter value、table、row actionを検査しない |
| open PR #461 | parallel PR | confirmed | documents production componentを直接変更するため、今回のproduction変更は競合を増やす |

## Report facts

- current `main@8e542b31`は前回確認から不変で、#462 head `e62ad80d`はbehind 0だった。
- #462の未解決review threadは0件である。
- #341〜#344はmainへ統合済みで、現在の正本はmainと#462 stackに一意である。
- documentsのreflow、target size、motion、resource stateは既存自動証跡でpass、keyboard、semantic、contrastとmanual／overallはblockedである。
- 既存semantic E2Eはdocuments workspace、folder tree、file list、current contextまでをAX evidenceへ含めるが、画面固有control／value／table actionを固定しない。

## Candidate tasks

| Candidate | Priority | Decision |
| --- | --- | --- |
| documents semantic required gate | high | selected。既存required E2Eを小さく拡張し、正本とmachine-readable traceの不整合を解消できる |
| documents keyboard journey | high | deferred。画面内操作が広く、#461のproduction差分との競合評価が必要 |
| admin keyboard／semantic gate | high | deferred。管理画面はoperation数が多く、1画面1ACより大きい |
| manual screen reader／real zoom | high | blocked。承認済み実行環境、owner、cadenceが未確定で、自動化へ代替できない |

## Acceptance criteria

- `AC-20260818-001`（confirmed）: documentsのlandmark、search、filter values、table、detail dialog／主要action／disclosure expandedをChromium AX treeで検査し、選択行のDOM `aria-selected`とJSON evidenceを添付する。
- `AC-20260818-002`（confirmed）: fixtureをPlaywright routeへ限定し、production／permission contractを変更しない。
- `AC-20260818-003`（confirmed）: `documents → SQ-016 → AC-SQ016-003 → quality matrix global evidence → E2E-UI-SR-SEMANTICS-001 → Chromium required`を追跡し、manual／overallはblockedを維持する。
- `AC-20260818-004`（confirmed）: code、unit、E2E、正本、authored matrix、生成物、GitHub記録を同期する。

## E2E and non-UI scenarios

### E2E-UI-SR-SEMANTICS-001 documents増分

1. documents、document groups、reindex migrationsへtest-only fixtureを返す。
2. navigationからdocumentsを開く。
3. workspace、breadcrumb、folder tree、file list、contextを取得する。
4. folder／filename searchbox、type／status／folder／sort／page-size comboboxのname／valueを取得する。
5. named file tableとfixture文書のdetail buttonを取得する。
6. detail action後のDOM `aria-selected`、detail dialog、close／ask action、disclosure expanded stateを取得する。
7. normalized Chromium AX JSONをbrowser project名付きで添付する。

### NONUI-UI-TRACE-001

- authored traceへdocumentsの`SQ-016`／`AC-SQ016-003`を追加し、共有verification IDは重複登録しない。
- quality matrixのautomatedだけをpassへ更新する。
- trace validator、matrix validator、generated inventory freshnessを確認する。

## Operation and expectation groups

| Group | Operations | Expectations |
| --- | --- | --- |
| orient | workspace、breadcrumb、folder tree、current context | stable named landmarks |
| find | folder search、filename search、filters | native role、visible name、current value |
| identify | file table、detail action | table name、document-specific action name |
| understand | AX tree inspection | normalized name／role／value evidence |

## Requirement and design routing

- Requirement: 既存唯一正本`SQ-016`の証跡節と変更履歴だけを更新する。
- Design: `DES_UI_UX_001`のdocuments rowとsemantic contractへAC／E2E／自動証跡境界を追加する。
- Trace: `ui-traceability.json`のdocuments viewへ`SQ-016`を追加し、shared verificationはquality matrixのglobal evidenceとUI正本へ記録する。
- Quality: `ui-quality-matrix.json`のautomatedだけをpassへ更新する。
- Generated: 正規generatorでWeb trace／quality matrix／inventoryを同期する。

## Gap analysis and open questions

- `open_question`: representative screen readerの対象環境、owner、cadence。
- `open_question`: 実browser 200%／400% zoom、text-only zoom、OS scaling、touch／real deviceの承認済み環境。
- `confirmed gap`: documents keyboard journeyとcontrast baseline。
- `confirmed gap`: #461統合後の最終DOM再検証、FR-051、API C1 85%、OQ-UI-002。
- 本変更は上記を完了扱いにしない。
