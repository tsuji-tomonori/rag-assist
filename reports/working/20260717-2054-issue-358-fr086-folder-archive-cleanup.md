# Issue #358 FR-086 folder archive cleanup repair/ledger 作業レポート

保存先: `reports/working/20260717-2054-issue-358-fr086-folder-archive-cleanup.md`

## 1. 受けた指示

- Draft PR #426 final head `9c771e4622b741708f06381edf8fbe266f8f4930` から Issue #358 の残作業と open PR ownership を再 RCA する。
- owner 判断を要せず既存 Draft PR と重複しない最小 bounded unit を、新規 worktree/branch/task で実装・検証する。
- docs、作業レポート、Draft stacked PR、semver、日本語 AC/self-review、implementation/final-head CI、Issue進捗、clean/upstream/remote一致まで止めずに進める。
- actual AWS/manual operation、merge、deploy、releaseは行わない。

## 2. 要件整理

| 要件ID | 要件 | 対応状況 |
| --- | --- | --- |
| R1 | Issue/PR/docs/task/report/code/testを横断し、残作業・重複・因果をRCAする | 対応済み |
| R2 | 最小の非重複unitをowner判断なしで選定する | folder archive cleanup producer/worker evidenceを選定 |
| R3 | archive CAS、audit、repair、ledger、workerをexact identityで相関する | 対応済み |
| R4 | 部分失敗、race、tenant/resource越境をfail closedにする | 対応済み |
| R5 | 正本文書・generated docs・testを同期し、repository-wide validationを行う | 対応済み |
| R6 | Draft PRとremote CIを含む外部lifecycle evidenceを残す | PR作成前。後続commitでtaskへ結果を記録する |
| R7 | AWS/manual/merge/deploy/releaseを実施済みとしない | 遵守 |

## 3. RCAと判断

- `confirmed`: PR #426までのbounded unitとopen Draft PR ownershipにはfolder archive producerのcleanup repair/ledger hardeningが含まれない。PR #415のtask/reportとFR-066/FR-086はこの欠落を明示していた。
- `confirmed`: 既存`FolderArchiveService`はempty folderのpermission/descendant/document guard、CAS archive、security auditを持つ一方、revocation cleanup repair/ledgerを登録していなかった。
- `confirmed`: 既存cleanup coordinator/repair workerは`folder` resourceを表現できるが、default authoritative verifierは`share_revoked`だけを認め、`archived` folderを検証できなかった。
- `inferred`: audit intentと相関する`folder-archive:<auditIntentId>`、deny version `folder:<archived.updatedAt>`、exact known targetsで既存contract内の一意な操作境界を構成できる。
- `conflict`: producerだけを直すと、post-CAS登録失敗時に既存audit resolverがarchived stateだけでsuccessを確定できる。このためresolverへread-onlyのexact repair/ledger evidence確認を加えた。
- `open_question`: actual AWSのS3 conditional write、DynamoDB current read、EventBridge duplicate delivery、Lambda retry timingは未検証である。
- 採用しなかった候補は、PR #422と重複するprincipal transfer、owner threshold/UI acceptanceが未確定のalarm/operator UI、AWS account/deployを要するlive evidence、owner承認待ちのSQ/benchmarkである。

根本原因は、security-impacting folder archive producer追加時に、audit resolver coverageだけでなくrevocation cleanup trigger、pre-CAS repair、post-CAS ledger、worker authoritative verifierまで同時に要求するcontract testがなかったことである。

## 4. 実施作業

- `FolderArchiveService`で全validation後かつCAS前にcleanup repairを保存し、CAS失敗時はabandonedへ遷移するようにした。
- archive成功後にdeny committed、ledger register、cleanup registeredを順に永続化し、post-CAS失敗ではarchived stateとrepairとpending auditを保持してAPI successを返さないようにした。
- operation/audit/tenant/folder/before/after version/timestampと5つのknown targetをexactに構成する登録helperを追加した。
- production cleanup workerへexact archived folder identity/version/timestamp verifierとfolder-scoped queued/ingest reference照合を追加した。
- folder delete audit resolverへexact repair/ledgerのread-only検証を追加し、worker recovery前のsuccess確定を拒否した。resolverはdomain stateやcleanup evidenceを変更しない。
- normal、repair prepare failure、CAS failure、post-CAS ledger failure、worker replay、missing/reactivated state、other folder/tenant isolation、resolver evidence missingをunit/contract/static policyで検証した。
- FR-066/FR-086正本、requirements coverage、delete-document-groupsのsource-backed generated API docsを同期した。

## 5. 成果物

| 成果物 | 内容 |
| --- | --- |
| `apps/api/src/folders/folder-archive-service.ts` | pre-CAS repair、post-CAS ledger、exact registration contract |
| `apps/api/src/rag/_shared/security/production-revocation-cleanup.ts` | archived folder authoritative verificationとfolder reference isolation |
| `apps/api/src/security/folder-delete-audit-reconciler.ts` | exact cleanup evidenceのread-only success gate |
| 関連API test/static policy/requirements coverage | normal/negative/crash/recovery/tenant boundaryの回帰防止 |
| `docs/1_要求_REQ/.../REQ_FUNCTIONAL_066.md`、`REQ_FUNCTIONAL_086.md` | 正本要件とactual AWS open evidenceの同期 |
| `docs/generated/api-code/delete-document-groups-groupid/*_gen.md`、manifest | source-backed API docs freshness |
| `tasks/do/20260717-2008-issue-358-next-bounded-unit.md` | RCA、scope、AC、検証計画とlifecycle証跡 |

## 6. 検証結果

- 関連5 test files: 成功。folder archive、folder delete resolver、production cleanup、static access policy、requirements coverageを実行した。
- `npm run typecheck -w @memorag-mvp/api`: 成功。
- `npm run test:coverage -w @memorag-mvp/api`: 初回sandbox内では5つのHTTP suiteが`/tmp/tsx-1000/*.pipe listen EPERM`で失敗した。明示承認後にsandbox外で同一コマンドを再実行し、902/902 tests成功、statements/lines 90.75%、functions 93.50%、branches 80.23%を確認した。
- `task docs:check`: 初回にsource-backed docsのstaleを検知したため`task docs:api-code`で再生成し、再実行でcanonical、OpenAPI、98 API/588 docs freshness、Web trace 8 tests、Web/infra inventory、hidden Unicodeの全項目成功。
- `task verify`: lint、全workspace typecheck、全build成功。Vite 500 kB chunkとLambda bundle size warningは既存warningであり失敗なし。
- `npm run rag:release:source-audit`: 成功。source audit `sha256:6cd43e...`、dataset-specific branch 0、artifact manifest mismatch 0。
- `npm run ci`: 成功。contract 4、API 902、Web 442、Infra 38、Benchmark 102、全build成功。
- `git diff --check`: 成功。
- `pre-commit run`: git-secrets、hidden Unicode、trailing whitespace、EOF、large files、merge conflicts、debug statements、line endingの全適用hook成功（非該当hookはskipped）。

`npm ci`が報告した既存dependency vulnerability 8件（low 2、moderate 1、high 5）は本unitで`audit fix`していない。

## 7. ドキュメント・API・UI・infra影響

- README、運用/deploy手順: 新規利用者操作、設定、deploy手順を追加していないため変更不要。
- OpenAPI/API example: route、request/response、status codeの公開contractを変更していないため変更不要。
- source-backed API docs: service/resolver内部contract変更を反映するため再生成した。
- UI: production Web UI、hooks、stores、permission表示を変更していないため非該当。
- infra: CDK、IAM、schedule、alarm、Lambda wiringを変更していないため非該当。

## 8. セルフレビュー

- docsと実装/testの同期: FR-066/FR-086、requirements coverage、generated source docsを同期した。
- 変更範囲に見合うtest: pre/post CASの部分失敗、worker recovery、exact identity、other tenant/resource isolation、resolver fail-closedをdirect testし、repository full CIまで成功した。
- RAG根拠性・認可境界: retrieval/citation contractは変更せず、archive後derived stateのtenant/resource境界を強化した。
- benchmark固有化: 期待語句、QA sample固有値、dataset固有分岐を実装へ追加していない。source auditでも0件を確認した。
- security: route permissionやresponse schemaを変更せず、resolverはread-onlyで、missing/drift/reactivation/cross-tenant evidenceを成功扱いしない。
- residual risk: CAS失敗後の`markAbandoned`自体が失敗した場合はprepared repairが残り得るが、authoritative folderがactive/missing/driftならworker verifierがledger再生を拒否し、auditも非成功またはpendingから成功へ誤確定しない。actual AWS retry behaviorは未検証である。

blocking指摘はない。

## 9. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
| --- | ---: | --- |
| 指示網羅性 | 4.8/5 | 実装・local/CI validationまで完遂。external PR lifecycleは後続中 |
| 制約遵守 | 5.0/5 | 専用worktree/branch/task、非重複、no merge/deploy/releaseを遵守 |
| 成果物品質 | 4.8/5 | exact durable evidence、failure/recovery/isolation test、docs同期を実施 |
| 説明責任 | 5.0/5 | RCA、未検証AWS、sandbox failure、dependency riskを明記 |
| 検収容易性 | 4.8/5 | task AC、test結果、成果物、PR予定を追跡可能 |

**総合fit: 4.9/5（約98%）**

Draft PR、remote implementation/final-head CI、Issue進捗、clean/upstream/remote一致を後続lifecycleで完遂する。actual AWS/manual evidenceは未検証のため、production behaviorを実証済みとはしない。

## 10. 未対応・制約・リスク

- 未対応: actual AWS S3/DynamoDB/EventBridge/Lambda/manual operation evidence。
- 制約: GitHub AppsのPR操作toolはこの実行環境に公開されていないため、repository skillに従い`gh` fallbackを使用する予定である。
- リスク: stacked base PR #426がDraftのため、本PRはそのfinal headを前提とする。
- 禁止事項: merge、deploy、release、production/external state変更は実施しない。
