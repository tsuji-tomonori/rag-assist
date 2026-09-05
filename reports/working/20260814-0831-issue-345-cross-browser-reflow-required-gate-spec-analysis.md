# Issue #345 cross-browser reflow required gate仕様分析

## Input inventory

| Source | Type | Reliability | Summary |
| --- | --- | --- | --- |
| GitHub Issue #345と最新43 comments | issue evidence | confirmed | manual zoom未完了、#462で自動証跡を継続 |
| Draft PR #462 final head `eb513ddf` | PR evidence | confirmed | current main祖先、cross-browser keyboard／semantic required 6件 |
| `apps/web/e2e/zoom-reflow.spec.ts` | executable specification | confirmed | 640/320 CSS px、5 view、root overflow、proxy boundary |
| `.github/workflows/web-ui-quality.yml`と`apps/web/package.json` | CI contract | confirmed | Firefox／WebKit requiredとscheduled visualを分離 |
| `SQ-016`, `NFR-018`, `DES_UI_UX_001` | canonical requirements/design | confirmed | reflow、browser scope、manual evidence分離 |
| `ui-traceability.json`, `ui-quality-matrix.json` | authored machine-readable source | confirmed | E2Eと8 AppViewsのstatusを生成物へ供給 |
| open PR #461 | overlap risk | confirmed | shared UI production pathを変更するため今回scopeから除外 |

## Report facts

- confirmed: latest mainは`8e542b31`で前回から不変。
- confirmed: #462はmainを祖先に含むbehind 0 / ahead 62、Draft・mergeable。
- confirmed: Chromium requiredは既存reflow proxyを実走する。
- confirmed: Firefox／WebKit requiredはkeyboard／semanticだけでreflowを実走しない。
- confirmed: reflow proxy自身が実browser zoomではない境界をartifactへ記録する。
- confirmed: manual browser zoom baselineはblockedであり、automationからpassへ昇格できない。

## Candidate tasks

1. 採用: 既存reflow proxyをFirefox／WebKit requiredへ限定追加する。
2. 見送り: production CSSの追加修正。現時点でconfirmed defectがなく、#461と競合する。
3. blocked: 実browser 200%／400% zoom実測。承認済みmanual matrixと実行環境が未確定。

## Acceptance criteria

task `AC-20260814-001`〜`005`を正とする。境界値、CI scope、manual evidence分離、traceability、検証／GitHub記録をそれぞれ原子的に扱う。permission／loading／error／retryは本sliceがproduction data stateを変更しないため非該当であり、既存`E2E-UI-STATE-001`の契約を変更しない。

## E2E and non-UI scenarios

- `E2E-UI-ZOOM-REFLOW-001`: 640/320 CSS pxで5 viewへ到達し、root overflow 0とartifact boundaryをFirefox／WebKitで確認する。
- non-UI: script discovery 10件、canonical/generated freshness、manual status blockedを確認する。

## Operation and expectation groups

| Group | Operation | Observable expectation |
| --- | --- | --- |
| viewport boundary | 640/320 CSS pxを設定 | 200%/400%相当率が一致 |
| permission-aware navigation | 最大権限personaでmobile menuから5 viewへ移動 | 各regionとURLへ到達 |
| reflow | viewごとにroot dimensions取得 | `scrollWidth <= clientWidth` |
| evidence honesty | JSON artifactとmatrixを確認 | proxy boundary明記、manual/overall blocked |
| CI scope | PR workflowを実行 | Firefox 5件＋WebKit 5件、scheduled visual非重複 |

## Requirement and specification synthesis

- `SQ-016 / AC-SQ016-001`: cross-browser automated reflow evidenceを追加する。
- `NFR-018 / AC-NFR018-004`: Firefox／WebKit required scopeへ限定reflowを追加する。
- `DES_UI_UX_001`: required browser matrixとmanual exclusionを同期する。
- 新規要件は作らず、既存の一意な正本だけを更新する。

## Traceability and gaps

```text
chat/documents/assignee/admin/profile
  -> SQ-016 / NFR-018
  -> AC-SQ016-001 / AC-NFR018-004
  -> E2E-UI-ZOOM-REFLOW-001
  -> Firefox/WebKit required workflow
```

- open_question: 実browser zoomのenvironment／owner／approved matrixは未確定。
- missing evidence: representative screen reader、manual zoom、touch／real device。
- conflict: なし。viewport proxyをmanual zoomと明確に分離する。

