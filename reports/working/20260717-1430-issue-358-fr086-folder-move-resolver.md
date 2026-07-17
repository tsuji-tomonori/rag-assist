# Issue #358 FR-086 folder move 監査 resolver 作業レポート

## 受けた指示

Issue #358 の次の独立した rollback unit として exact `folder/move` security mutation audit resolver を PR #409 final head に積み、fresh worktree/task、実装、検証、文書・coverage・generated同期、日本語gitmoji commit、Draft stacked PR、semver、AC/self-review、task/report lifecycle、final-head CI、Issue進捗まで完遂する。folder/document delete、document move、admin transfer、merge/deploy/releaseは行わず、actual AWS未検証を明記する。

## 要件整理と判断

- successはmove markerがexact audit ID/actor/tenant/folderに相関し、`projections_converged|completed`、draft/marker/current subtreeが完全一致する場合だけ確定する。
- current verified actorのactive/same-tenant/`folder.move`とsource/destinationの`full` permissionを再評価する。
- marker-free preflight non-successと`rolled_back` non-successはexact before evidenceがある場合だけ元resultを維持する。
- owner/admin/local sharing identity、folder/document projection identityをmoveの不変条件として検証し、部分・混在・第三・corrupt・unauthorized stateを推測しない。
- resolverはread-onlyとし、IAMは`tenant-artifacts/*/folder-mutations/move/*`の`GetObject`だけを既存workerへ追加する。tenant hashをCDK tokenから静的導出できないためtenant segmentはwildcardだが、runtimeはauthorized tenantからexact keyを導出する。

## 実施作業

- `FolderMoveAuditAuthoritativeResolver`と11件のcontract testを追加した。
- production reconciliation workerへexact resolverを登録した。
- current DocumentGroups/folder policy/user group/membership/Cognito identityを再確認し、mutation APIは呼ばない構成にした。
- move lifecycle folder/document snapshot、audit state、current subtree、current authorizationをcanonicalに照合した。
- CDK IAM、static access-control policy、infra assertion/snapshot/generated inventoryを同期した。
- `REQ_FUNCTIONAL_086.md`のproduction coverageとrequirements coverageを更新した。

## 成果物

- `apps/api/src/security/folder-move-audit-reconciler.ts`
- `apps/api/src/security/folder-move-audit-reconciler.test.ts`
- worker registry、IAM、static/infra tests、CDK snapshot/generated infra inventory
- FR-086 requirement/coverage更新
- task `tasks/do/20260717-1412-issue-358-fr086-folder-move-resolver.md`

## 検証

- resolver direct: 11/11 pass。
- API full: 865/865 pass（最終実装 head）。
- infra full: 5 test files pass。
- API/infra typecheck: pass。
- `task docs:check`: pass。
- source audit: pass、`sha256:c5dc07964eebf01ccd913d3d8975d1c23b707ecf427d4b7ce1d81bed70d1c59c`、dataset-specific branch 0、artifact manifest mismatch 0。
- `task verify`: lint、全workspace typecheck/build pass。Web/Lambda bundle sizeの既存warningは継続。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。

## 指示への fit 評価

- exact folder moveだけを扱い、folder delete、document move/delete、admin transferを混在させていない。
- crash/retry/duplicate/partial/corrupt/unauthorizedをfail closedに固定し、domain mutationやcleanupを再実行しない。
- docs/coverage/generated/IAMを同じ変更単位で同期した。
- Draft PR、semver、AC/self-review、final-head CI、Issue進捗、task doneはPR lifecycleで追記する。

## 未対応・制約・リスク

- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambdaは未検証で、通常deploy後の確認が必要。
- tenant artifact rootはhashのためCDK tokenから静的にtenant ARNを作れず、IAM tenant segmentはwildcard。operation prefixはmove markerだけ、actionは`GetObject`だけに限定した。
- audit completion前に正当な後続mutationでcurrent stateが変わると、resolverは推測せずretry/quarantineへ進み得る。
- folder move markerをprojection convergenceのdurable証拠とし、resolverはmanifest/vectorを再列挙しない。
- folder delete、document move/delete、administrative principal transfer resolverはIssue #358の後続unitとしてopen。
- merge、deploy、releaseは実施しない。
