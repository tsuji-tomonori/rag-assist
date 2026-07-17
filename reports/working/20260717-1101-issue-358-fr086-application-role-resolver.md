# Issue #358 FR-086 application role 監査 resolver 作業完了レポート

## 受けた指示

Issue #358 の未完了 resolver / contract unit から、指定 open PR と重複しない最小の domain resolver を選び、fresh worktree、task、実装・検証、stacked Draft PR、受け入れ条件コメント、セルフレビュー、final-head CI、Issue 進捗まで Worktree Task PR Flow を完遂する。merge / deploy / release は行わない。

## 要件整理と判断

- PR #386/#389/#391/#394 は resource-group resolver、#399 は bounded retry/quarantine、#384/#388/#392/#395/#398 はそれぞれ広域 FR-014、WebSocket、trace、signup、schemaVersion を対象とする。
- 指定 PR に `applicationRole.replace` resolver はなく、producer と verified identity provider は既に存在するため、application role を最小の独立 unit とした。
- base は PR #399 の head `9d52c9dabe934809166259e9ceb81238c09f8421`、branch `codex/issue-358-fr086-retry-quarantine` とした。
- authoritative current state と durable audit evidence の一致だけを検証し、role mutation、session revoke、managed-state callback は再実行しない。
- pending current=before や第三状態は結果を推測せず、#399 の bounded retry/quarantine に委譲する。

## なぜなぜ分析の要約

application role producer が common outbox intent を作成しても、worker registry に同 target/operation resolver がないため crash 後は selection failure になる。target/operation ごとの resolver coverage を producer 追加時に固定する contract が不足していたことが根本原因である。exact resolver、worker/static policy、requirements coverage、FR-086 正本文書を一体で更新した。

## 実施作業

- `applicationRolePrincipal/applicationRole.replace` exact resolver と contract test を追加した。
- Cognito current identity の subject / tenant / active status / application roles を再確認し、pending proposed 一致、durable completion 一致、early null failure を収束させた。
- valid な caller role 順は catalog 順へ正規化し、unknown / duplicate / empty / boundary-crossing / inactive / ambiguous state は fail closed にした。
- duplicate 8 workers が immutable completed event 1 件へ収束することを object-store outbox で確認した。
- production worker registry に resolver を登録し、verified identity provider 未設定時は起動設定境界で fail closed にした。
- worker IAM に Cognito `ListUsers` / `AdminGetUser` / `AdminListGroupsForUser` の user-pool 限定 read-only 権限だけを追加し、group mutation / session revoke 権限がないことを infra test に固定した。
- FR-086、requirements coverage、static security policy、generated infra inventory、infra snapshot を同期した。

## 成果物

- `apps/api/src/security/application-role-audit-reconciler.ts`
- `apps/api/src/security/application-role-audit-reconciler.test.ts`
- production worker / security policy / requirements coverage 更新
- infra least-privilege IAM / test / snapshot / generated inventory 更新
- `docs/1_要求_REQ/.../REQ_FUNCTIONAL_086.md` 更新
- task: `tasks/do/20260717-1047-issue-358-fr086-application-role-resolver.md`

## 検証

- `npm ci`: 成功。既存 audit 指摘 8 件（low 2 / moderate 1 / high 5）、依存関係変更なし。
- API full test: 836/836 成功、失敗 0。
- API typecheck: 成功。
- infra test / bundle: 5 files / 38 tests 成功。
- `task docs:infra-inventory`: 成功。
- `task docs:check`: 成功（API-code 97 API / 582 docs を含む）。
- source audit: dataset-specific branch 0、artifact manifest mismatch 0、audit ID `sha256:86700b07bb7563478b50f827cc6cbda4c535504059c088b0dd938e4cf0e28ef4`。
- `task verify`: 成功。lint、全 workspace typecheck/build を通過。Web chunk size は既存の非 blocking warning。
- `git diff --check` / `pre-commit run`: 成功。
- 初回 API typecheck の optional provider / readonly JSON 型エラーと infra snapshot stale は、production config guard、JSON 配列変換、snapshot/inventory 再生成後の再実行で解消した。

## 指示への fit 評価

domain resolver は指定 open PR にない exact operation に限定し、mutation replay を行わず、tenant / identity boundary と secret minimization を維持した。README、OpenAPI、UI、route contract は変更対象外であり、FR-086 正本文書と generated infra docs のみ同期した。RAG 根拠性、認可の通常資源境界、benchmark expected words、QA/dataset 固有分岐は変更していない。

## 未対応・制約・リスク

- 実 AWS Cognito の read consistency、EventBridge duplicate delivery、Lambda worker、managed-state callback timing は未検証。
- current=before の pending intent は durable result を推測できないため quarantine し得る。手動 quarantine 解除、alarm、管理 UI は対象外。
- folder / document / principal resolver は Issue #358 の後続作業。
- PR は #386→#389→#391→#394→#399 の stacked chain に依存し、base 更新時は再検証が必要。
- #395/#388 も共有 infra / generated inventory を変更するため rebase 時に機械的競合の可能性があるが、resolver / contract file は非重複。
- rollback は本 branch の commits を revert し、worker resolver 登録と read-only IAM を除去する。外部 state mutation は追加していない。
- merge / deploy / release は実施しない。

## PR lifecycle

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/401
- base: PR #399 / `codex/issue-358-fr086-retry-quarantine`
- label: `semver:patch`
- 日本語の受け入れ条件コメントとセルフレビューコメントを登録済み。
- initial head `1c1fd2d8d1df570831843bbe0219c6d1b2208f0a` の MemoRAG CI run #1146 は success。
- task 完了更新後の final-head CI は PR top-level comment と Issue #358 進捗コメントへ記録する。evidence 自体で head を再更新し続けないため、本レポートは再編集しない。
