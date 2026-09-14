# Issue #345 担当者対応a11y証跡 仕様分析

## Input inventory

| Source | Type | Reliability | Finding |
| --- | --- | --- | --- |
| Issue #345 / Draft PR #462 | issue / PR | confirmed | keyboard、screen reader、320px／400% zoom、状態契約と追跡の継続改善を要求する |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | confirmed | `AC-SQ016-002`はkeyboard-only、`AC-SQ016-003`はname／role／state／valueを要求する |
| `DES_UI_UX_001.md` | canonical design | confirmed | assigneeはfilter／select／answerを主要jobとするがkeyboard／AX evidenceの記録がない |
| `ui-quality-matrix.json` | authored quality matrix | confirmed | assigneeの`AC-SQ016-002`／`003`だけがautomated `blocked`である |
| `AssigneeWorkspace.tsx` / `questions.css` | production source | confirmed | native controlsはあるが回答form／詳細の名前付きlandmarkと画面固有3px focus規則がない |
| keyboard／semantic E2E | required tests | confirmed | navigation到達だけで、assignee内部journey／AX contractは未実装である |

## Report facts

- current `main@8e542b31`は前回から不変で、#462 head `72721b53`はbehind 0だった。
- open PR #461とは`AssigneeWorkspace.tsx`が同一pathだが、#461はshared UI import、今回変更はlandmark／IDの別hunkである。統合時は#461のimportを保持して今回のsemanticsを再適用し、生成Web inventoryを最終sourceから再生成する。
- #341〜#344はmainへ統合済みであり、正本競合はない。
- assigneeのreflow、target size、resource状態は既存自動証跡でpass、manual／overallはblockedである。

## Candidate tasks

| Candidate | Priority | Decision |
| --- | --- | --- |
| assignee keyboard／AX required gate | high | selected。2つの残存automated blockerを同一画面・同一journeyで解消できる |
| assignee contrast automation | medium | deferred。computed／axe baseline全体の設計判断を伴い、今回のbounded scopeを超える |
| favorites resume／delete journey | medium | deferred。既存keyboard passの残余業務journeyであり、assigneeのblocked軸を優先する |
| manual screen reader／real zoom | high | blocked。承認済み実行環境、owner、matrixが未確定で、自動化へ代替できない |

## Acceptance criteria

- `AC-20260817-001`（confirmed）: assigneeのfilter、search、question selection、answer input、notify toggle、temporary holdをkeyboard-onlyで操作し、3px focus indicatorとpolite resultを確認する。
- `AC-20260817-002`（confirmed）: workspace、queue、lane、detail、answer form、control value／stateをChromium AX treeで検査しJSON evidenceを添付する。
- `AC-20260817-003`（confirmed）: `assignee → SQ-016 → AC-SQ016-002 / 003 → E2E-UI-KEYBOARD-NAV-001 / SR-SEMANTICS-001 → Chromium required`を追跡する。
- `AC-20260817-004`（confirmed）: code、unit、E2E、正本、authored matrix、生成物、GitHub記録を同期し、manual未実施をpassへ変更しない。

## E2E and non-UI scenarios

### E2E-UI-KEYBOARD-NAV-001 assignee増分

1. navigationから担当者対応へSpaceで移動する。
2. ステータスselectへTabで到達し、ArrowDownで未対応へ変更する。
3. searchboxへTabで到達し、fixtureの問い合わせを絞り込む。
4. question buttonへTabで到達し、3px focusとpressed stateを確認してEnterで選択する。
5. 回答内容、通知checkbox、一時保持buttonをkeyboard-onlyで操作する。
6. visible polite statusに一時保持結果が現れることを確認する。

### E2E-UI-SR-SEMANTICS-001 assignee増分

1. 名前付きworkspace／queue／kanban／lane／detail／answer formを取得する。
2. filter value、question pressed、notify checked、draft status live stateを取得する。
3. normalized JSONをPlaywright reportへ添付し、期待node欠落時に非0終了する。

### NONUI-UI-TRACE-001

- authored traceとquality matrixのview／AC／E2E IDを検証し、生成Web inventory freshnessを確認する。

## Operation and expectation groups

| Group | Operations | Expectations |
| --- | --- | --- |
| discover | navigate、filter、search | DOM順、visible 3px focus、value更新、対象保持 |
| select | question button Enter | stable accessible name、`pressed=true`、detail context保持 |
| compose | answer input、notify Space、hold Enter | labelled controls、checked state、polite result、API mutationなし |
| understand | AX tree inspection | named landmarks、form、control role／name／value／state |

## Requirement and design routing

- Requirement: 既存唯一正本`SQ-016`の証跡節と変更履歴だけを更新する。新しい要件は作らない。
- Design: `DES_UI_UX_001`のassignee rowへAC、E2E、実装証跡を追加する。
- Trace: `ui-traceability.json`のassignee viewへ`SQ-016`と2 E2Eを追加する。
- Quality: `ui-quality-matrix.json`のautomatedだけをpassへ更新し、manual／overallはblockedを維持する。
- Generated: 正規generatorで`docs/generated/web-ui-inventory.json`とquality matrixを同期する。

## Gap analysis and open questions

- `open_question`: representative screen readerの対象環境、owner、cadence。
- `open_question`: 実browser 200%／400% zoom、text-only zoom、OS scaling、touch／real deviceの承認済み環境。
- `confirmed gap`: assignee contrastのcomputed／axe baselineとmanual review。
- `confirmed gap`: FR-051 preference persistence、API C1 85%、OQ-UI-002。
- 本変更は上記を完了扱いにしない。
