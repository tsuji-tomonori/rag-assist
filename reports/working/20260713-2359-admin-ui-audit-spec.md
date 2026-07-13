# 管理画面 問題監査・改善方針・受け入れ条件 作業レポート

- 実施日時: 2026-07-13 23:59 JST
- 基準: `origin/main` / `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 作業ブランチ: `codex/admin-ui-audit-spec`
- タスク: `tasks/done/20260713-2318-admin-ui-problem-audit.md`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/344
- 状態: 調査成果物、PR、受け入れ条件確認、セルフレビュー完了

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

- 入口・結論: `docs/spec-recovery/18_admin_ui_audit_202607.md`
- input/fact: `19_admin_ui_input_inventory_202607.md`, `20_admin_ui_facts_202607.md`
- 改善task/AC/E2E: `21_admin_ui_tasks_202607.md`–`23_admin_ui_e2e_scenarios_202607.md`
- operation/requirement/spec: `24_admin_ui_operation_expectation_groups_202607.md`–`26_admin_ui_specifications_202607.md`
- trace/gap/open questions: `27_admin_ui_traceability_matrix_202607.md`–`29_admin_ui_open_questions_202607.md`
- 要件候補: `docs/spec-recovery/admin-ui-202607/requirements/REQ_AUI_001.md`–`REQ_AUI_013.md`
- index: `docs/spec-recovery/README.md`

## 検証結果

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` |成功 |既存必須成果物、2026-07 baseline、trace/AC構造を検証 |
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
