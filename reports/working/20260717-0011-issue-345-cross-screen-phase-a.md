# 作業レポート（Phase A）

保存先: `reports/working/20260717-0011-issue-345-cross-screen-phase-a.md`

## 受けた指示

- PR #361 final headをbaseに、cross-screen remediationをatomic phaseへ分割して進める。
- Phase Aは画面×品質軸matrixとautomated audit harnessに限定する。
- AppShell / RailNav / target / focus / reflowの本番修正はPhase B、feature修正はPhase C以降へ分離する。
- #378へstackせず、auth production filesはTC-003 stage 4との競合回避のため初期scopeから外す。

## 要件整理

| ID | 要件 | 状況 |
| --- | --- | --- |
| R1 | 8 AppViews × `AC-SQ016-001`〜`008` のmachine-readable matrix | 対応 |
| R2 | canonical driftとfalse passを検出するvalidator / unit test | 対応 |
| R3 | computed DOMからtarget/focus/overflow/motion/state candidateを収集するaudit | 対応 |
| R4 | 320/375/768/1280px × 8画面のPlaywright baseline | 実装済み、local browser runはsandbox blocked、CI待ち |
| R5 | `SQ-016` / `DES_UI_UX_001` / generated inventory同期 | 対応 |
| R6 | 本番UI/authをPhase Aで変更しない | 対応 |

## 検討・判断

- route、permission、persona、journeyは既存 `ui-traceability.json` をcanonicalとし、matrixへ重複コピーせずgeneratorで結合した。
- evidence状態はautomated / manual / overallを分離し、required manualが未実施ならoverallをblockedにする。自動検証だけからSQ-016適合を宣言しない。
- 24×24 targetはWCAG例外があるためcomputedサイズをcandidateとして収集し、Phase Aで即時failへ固定しない。
- browser baselineは既存 `@ui-quality` scopeへ追加し、PR #361のrequired gateと共存させる。
- sandbox制約の回避目的でproduction commandやauth実装を変更せず、local E2Eは未実施としてCIへ委譲する。

## 実施内容

- `tasks/todo/` のcross-screen taskを `tasks/do/` へ移し、分類、RCA、Phase境界、Phase A Done条件を追記。
- `ui-quality-matrix.json`、validator / generator / unit test、generated Markdownを追加。
- canonical view / AC drift、不正status、missing evidence、manual evidenceなしのpass、overall derivation mismatchを検出。
- computed DOM audit helperでroot/nested overflow、accessible name、focus activation/obscuration、target size、reduced motion、state semanticsを収集。
- `E2E-UI-CROSS-SCREEN-AUDIT-001` で8画面×4 viewportと1280px axe serious/criticalをJSON attachmentへまとめるtestを追加。
- package scripts / Taskfile description、`SQ-016`、`DES_UI_UX_001`、UI trace manifest、generated inventoryを同期。

## 成果物

| 成果物 | 内容 |
| --- | --- |
| `tools/web-inventory/ui-quality-matrix.json` | 8画面×8 ACのevidence state |
| `tools/web-inventory/ui-quality-matrix.mjs` | drift / status / evidence validatorとMarkdown renderer |
| `tools/web-inventory/ui-quality-matrix.test.mjs` | validator regression test |
| `tools/web-inventory/generate-ui-quality-matrix.mjs` | generator / freshness check |
| `docs/generated/web-ui-quality-matrix.md` | persona / journey / owner / evidence一覧 |
| `apps/web/e2e/cross-screen-audit.ts` | computed DOM audit helper |
| `apps/web/e2e/visual-regression.spec.ts` | 8画面×4 viewport audit test |

## 検証

### pass

- `npm ci`
- targeted ESLint（helper移動後）
- `npm run typecheck -w @memorag-mvp/web`
- `npm run docs:web-trace:test`: 12 tests pass
- `npm run docs:web-inventory:check`
- `task docs:check`（provenance修正後）
- `npm test -w @memorag-mvp/web`: 61 files / 442 tests pass
- targeted Playwright `--list`: Chromium 1 testを解決
- changed filesへのpre-commit: pass
- `git diff --check`

### 未実施・制約

- targeted Playwright browser run: `tsx` IPCとlocalhost `0.0.0.0:8787` listenがsandboxで `EPERM`。権限昇格は行わず、draft PR CIで実行する。
- representative screen reader、実browser 200% / 400% zoom、touch / real-device: manual evidence taskの未完了scope。
- AppShell / RailNav / feature remediation: Phase B以降のscope。
- `npm ci` は既存lockfileに対して8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。本taskはdependency変更を含まず、`npm audit fix` はscope外として実行していない。

## Fit評価

総合fit: 4.4 / 5.0（88%）

matrix、validator、computed audit、Playwright test、docs同期は実装・静的検証済み。本番UI/authを混ぜないphase境界も維持した。実browser baselineとCI artifactはPR作成後の確認待ちであり、Phase Aはpartially completeとする。
