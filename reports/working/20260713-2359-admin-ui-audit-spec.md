# 管理画面 問題監査・改善方針・受け入れ条件 作業レポート

- 実施日時: 2026-07-13 23:59 JST
- 初回基準: `origin/main` / `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 再検証基準: `origin/main` / `c6eff7deef0d8f3d06d66391be181e45b058aaaf`
- 作業ブランチ: `codex/admin-ui-audit-spec`
- タスク: `tasks/done/20260713-2318-admin-ui-problem-audit.md`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/344
- 状態: 初回調査の latest main 再統合と content validation 完了。task/report のみの metadata head CI を merge gate として確認中

## 受けた指示

管理画面で、利用しても料金算出が0になること、ロール一覧が見にくいことを起点に、問題点をすべて洗い出し、改善方針と受け入れ条件を整理する。

## 要件整理

- 既知の2症状だけでなく、管理画面全sectionと関連API/store/schema/auth/tests/docs/reportsを対象にする。
- current implementationの確定事実、要件とのconflict、影響推定、owner判断待ちを区別する。
- 各問題にseverity、影響、根拠、改善task、原子的なGiven/When/Then、E2Eまたは非UI検証を結び付ける。
- 料金、閾値、保持期間、identity運用などrepositoryから確定できない値を架空に補わない。
- 本タスクではproduction codeを変更せず、後続実装の要件・仕様候補を作る。

## 調査・判断の要約

1. 料金0の直接原因は、current mainの`AdminLedger.usage`が0初期化される一方、chat/RAG/provider実行時の加算経路を持たないことである。さらに期間外quantity、固定単価、benchmark単位不一致、微小額丸めがあり、0以外も監査可能な月次費用ではない。
2. role API/storeは複数roleを扱うが、Webは単一select値を1件配列で保存する。付与操作が既存role全体を消すため、可読性だけでなくdata/security integrityのP0問題である。
3. suspend/deleteは管理ledgerだけを変更し、Cognito disable/session revoke/request-time status enforcementを行わない。UIの「利用できなくなる」という説明と実際のsecurity boundaryが一致しない。
4. 初期query失敗は`console.warn`へ捨てられ、overviewが空配列長を0件として表示し得る。error/missing/loading/forbidden/staleとzero/emptyを分ける共通contractが必要である。
5. auditは成功したuser/role操作の直近100件だけ、shared JSON ledgerはversion/conditional writeなし、aliasは固定reject理由とclient架空state/timeを使う。強権限操作の説明責任・競合制御が不足する。
6. role/user探索、usage/cost分析、export、actionable dashboard、responsive/a11y、用語、scale/live testにも横断gapがある。
7. 未マージPR #339はusage event/completeness/monthly/exportの有力候補だが、Scan 1,000件、tenant固定、汎用固定price、live AWS未検証、current mainとの差分があり、完了扱いにせずmigration taskへ分離した。

## 実施作業

- Web admin components/hooks/API clients/styles/tests、API routes/schemas/service/store/auth/catalog/infra/testsを静的調査した。
- `FR-027`, `FR-079`, `FR-080`, `FR-086`、chapter §§10–14、design/spec-recovery、関連work/bug reports、generated Web inventoryを照合した。
- GitHub Appsで2026-07-13時点のPR #339のopen/未merge状態、head、workflow、candidate code/reportを確認した。
- 81件のfact、36件のgap、13件のtask、158件の原子的AC、17件のE2E/非UIscenario、13件の1要件1ファイル候補、13件のspecification、22件のopen questionを作成した。
- 既存の`ADM` ID familyとの衝突をID検査で検出し、新規成果物を`AUI` prefixへ改名した。
- source→fact→gap→task→requirement→specification→AC→E2Eと、その逆引きをtrace matrixへ記録した。
- GitHub Appsでmain向けPR #344を作成し、`semver:patch` label、日本語のセルフレビュー、受け入れ条件確認を記録した。

## 成果物

- 入口・結論: `reports/working/admin-ui-audit-202607/18_admin_ui_audit_202607.md`
- input/fact: `19_admin_ui_input_inventory_202607.md`, `20_admin_ui_facts_202607.md`
- 改善task/AC/E2E: `21_admin_ui_tasks_202607.md`–`23_admin_ui_e2e_scenarios_202607.md`
- operation/requirement/spec: `24_admin_ui_operation_expectation_groups_202607.md`–`26_admin_ui_specifications_202607.md`
- trace/gap/open questions: `27_admin_ui_traceability_matrix_202607.md`–`29_admin_ui_open_questions_202607.md`
- 要件候補（非規範の履歴）: `reports/working/admin-ui-audit-202607/requirements/REQ_AUI_001.md`–`REQ_AUI_013.md`
- index: `reports/working/admin-ui-audit-202607/README.md`
- latest main 再検証: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`
- 残余実装: `tasks/todo/20260714-1011-admin-usage-cost-integrity.md`、`tasks/todo/20260714-1011-admin-access-audit-state.md`、`tasks/todo/20260714-1011-admin-ui-governance-quality.md`

## 検証結果

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| 旧 spec-recovery validator |成功 |初回時点の必須成果物、2026-07 baseline、trace/AC構造を検証 |
| `npm run docs:hidden-unicode:check` |成功 | `docs reports tasks` の不可視Unicode controlなし |
| AUI ID sequence/count check |成功 | 81 facts、36 gaps、13 tasks、158 AC、17 E2E、13 specs、22 open questions |
| AUI reference bounds/collision check |成功 |範囲外参照なし、既存`ADM` familyとの衝突なし |
| requirement required-section/attribute check |成功 |13ファイルすべてにSWEBOK-lite必須section/attributeあり |
| `pre-commit run --files ...` |成功 | git-secrets、hidden Unicode、trailing whitespace、EOF、large file、merge conflict、debug statement、line ending |
| `git diff --cached --check` |成功 |28ファイル、2,220行のstage済み差分に空白errorなし |

API/Web production codeを変更していないため、lint/typecheck/unit/build/OpenAPI/Web inventory/API access-control testは変更適合性の検証対象外とした。調査で挙げた後続AC/E2E、実Cognito、実Bedrock/DynamoDB/S3、実請求照合、320px/400% zoom、keyboard/screen reader/contrastは本タスクで実施済みではなく、後続実装のrelease gateである。

## 指示へのfit評価

- 問題の網羅:基準commitから観測可能な管理画面全surfaceを、data truth、機能欠落、state、information architecture、authorization/security、integrity/audit、scale、responsive/a11y、test/spec driftで分類した。
- 改善方針:各gapを依存順のtaskとAPI/read model/UI/security/migration仕様候補へ結び付けた。
- 受け入れ条件:正常・error・permission・boundary・empty/loading/recovery・security/NFRを158件の独立判定へ分割した。
- 未確定値:22件をowner付きopen questionへ分離し、実装fallbackを許可していない。
- workflow完了: taskの10受け入れ条件をPR上で確認した後、taskを`tasks/done/`へ移す更新を同じPR branchへ反映する。

## 未対応・制約・リスク

- 実AWS Billing/CUR、Cognito User Pool、Bedrock provider response、production traffic/scaleは参照していない。
- 利用者interview、実端末、screen reader、contrast、400% zoomの結果はないため、UX/a11yの影響度にはevidence gapが残る。
- pricing source、session失効上限、delete/retention、strong-role承認、pagination/SLO、audit/SIEM、rollout許容差はowner決定が必要である。
- 本成果物は`proposed / non-normative`であり、既存canonical product baselineを自動更新していない。
- GitHub ActionsはPR作成後に別途実行されるため、最終回答時点の結果をrepository外のPR状態として確認する。

## 2026-07-14 latest main 再統合

- PR #341–#343 の merge 後、旧 spec-recovery docs root は canonical docs policy で削除・禁止されているため復活させなかった。
- 初回監査 bundle は基準 commit `9cd904d3` の非規範な履歴証跡として `reports/working/admin-ui-audit-202607/` へ移した。
- 36 gap を current source/test で再判定し、`resolved` 4、`partially_resolved` 10、`open` 22 とした。
- canonical role catalog、fenced role mutation、authoritative user create、account suspend/restore/delete は改善済みとして補正した。
- Usage/Cost の完全計測、Web multi-role editor、query/error state、共通 audit read model、alias governance、pagination、responsive/a11y は残余 task へ分けた。
- PR #339 は open・未 merge・mergeable false の candidate であり、tenant/Scan/pricing/live evidence の gap を残すため、そのまま取り込まない。
- production behavior を変更せず、proposed requirement の owner decision もないため canonical REQ/ARC/DES/OPS は更新不要と判断した。

### 再統合後のローカル検証

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| `python3 scripts/validate_docs.py` |成功 | canonical docs root、trace、legacy path 不在を確認 |
| `python3 -m unittest scripts.test_validate_docs` |成功 | 9 tests |
| 36 gap status/count check |成功 | `resolved` 4、`partially_resolved` 10、`open` 22 |
| `task docs:check` |成功 | canonical docs、OpenAPI、API code 95/570、Web/infra inventory、hidden Unicode |
| `pre-commit run --files <32 files>` |成功 | merge conflict、large file、Unicode、whitespace 等 |
| `git diff --cached --check` |成功 | latest main に対する audit/task 差分 |

初回の `python3 scripts/test_validate_docs.py` は package import path を満たさない起動方法だったため `ModuleNotFoundError` となり、module 起動へ修正して 9/9 が成功した。最初の `task docs:check` は親 worktree の古い `@memorag-mvp/contract` を解決して失敗した。専用 worktree で `npm install` を実行して workspace link を current main へ同期し、再実行で全 check が成功した。install audit は 8 vulnerabilities（low 2、moderate 1、high 5）を報告し、本調査 PR では互換性影響を伴う自動修正をしていない。

最終 content head `b95274736128d23a512d0511fd8c80a210443dec` の GitHub Actions は、MemoRAG CI run 985 と Semver run 1439 が成功した。PR 本文、`semver:patch`、日本語の受け入れ条件確認（comment `4964510488`）、セルフレビュー（comment `4964510575`）も確認した。本更新で task を `tasks/done/` へ移す。task/report のみを変更する metadata head の GitHub CI と最終コメントは repository 外の merge gate として、merge 直前に別途確認する。
