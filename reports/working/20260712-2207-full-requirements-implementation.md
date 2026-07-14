# 追加要件完全実装 作業レポート

- 実施日時: 2026-07-12 22:07 JST
- branch: `codex/full-requirements-implementation`
- task: `tasks/do/20260711-1518-full-requirements-implementation.md`
- 状態: repository implementation / #342 統合後 local acceptance verified、final CI teardown failure の修復をローカル検証済み・GitHub CI 待ち、live operational acceptance は follow-up へ分離

## 受けた指示

`FR-056`–`FR-093` と `SQ-005`–`SQ-015` の実行計画を作成し、production path の実装、テスト、受け入れ判定、証跡、Draft PR まで進める。未実施の検証や未承認の閾値・実測を完了扱いにしない。

## 要件整理と判断

- verified identity、tenant/owner/resource permission、deny-first revoke、current worker authorization、response minimization を共通境界として実装した。
- 永続文書の source governance と、一時添付の owner/tenant/chat/expiry 境界を分離した。一時添付は `warning/unverified/eligible_with_warning` を保持し、永続文書の管理者承認を偽装しない temporary 専用 policy とした。
- RAG admission/extraction/chunk/security envelope、staged publication、replay、safe degradation、quality observation/promotion を fail-closed にした。
- 未承認 threshold、live AWS、representative workload、chaos、billing は repository 実装と分離し、pending のまま記録した。

## 実施作業

- `FR-056`–`FR-093`: 認証・認可、3×7 操作、共有・membership・transfer・move/delete、durable audit/repair、RAG lifecycle、worker reauthorization、monitoring/observation を実装・修復した。
- `SQ-005`–`SQ-015`: versioned evidence schema、stage/slice gate、zero-tolerance signal、latency/availability/recovery/cost の fail-closed control を実装した。
- benchmark seed の list/delete は authoritative benchmark tenant/scope/owner identity に限定し、caller-controlled ACL metadata を認可根拠から除外した。
- 一時添付は同一会話の次質問へ scope を引き継ぎ、永続一覧へ混入せず回答/citation に利用できるよう修正した。
- local chat event ledger は temporary file + atomic rename とし、worker 書き込み中の SSE partial JSON read を防止した。
- Web の fake usage/cost fallback を honest unavailable state へ置換し、benchmark 履歴を 380px 以下の内部スクロールへ同期した。
- OpenAPI、Web/infra inventory、REQ/ARC/DES/OPS、要件 trace/evidence を同期した。README と運用文書は実装・検証手順変更に合わせて更新した。
- 2026-07-14 に main（#342）の正規 docs 構成を統合し、legacy `docs/spec` / `docs/spec-recovery` を復活させず、実行計画と implementation evidence を `reports/working/` へ移した。#342 で更新された AGENTS.md、Taskfile、docs validator、正規文書構成を維持した。
- workflow 競合は `docs_structure` guard と RAG release source audit／promotion gate の両方を残し、要件 coverage test は正規 docs/task/report path と production code/test trace を併存させた。
- live AWS、承認済み閾値、実 workload、通知／drift／rollback drill、負荷／chaos／課金照合は `tasks/todo/20260714-0104-full-requirements-operational-acceptance.md` へ明示的に移管した。

## 検証結果

- #342 統合後 final workspace suites:
  - contract 1/1
  - API 765/765
  - Web 307/307
  - infra 38/38
  - benchmark 102/102
- `npm run test:e2e:smoke -w @memorag-mvp/web`: runtime 実装 head で 4/4 pass。#342 統合は docs/task/workflow/test trace のみのため再実行していない。
- `npm run lint`: pass
- `npm run typecheck --workspaces --if-present`: pass
- `npm run build --workspaces --if-present`: pass
- `npm run ci`: pass。sandbox では listener を使う test が `listen EPERM` となったため、ユーザー承認を得た同一コマンドの実 runner 再実行で全件 pass を確認した。
- `npm run docs:openapi:check`: pass
- `npm run docs:web-inventory:check`: pass
- `npm run docs:infra-inventory:check`: pass
- `python3 scripts/validate_docs.py`: pass
- `python3 -m unittest scripts/test_validate_docs.py`: 6/6 pass
- `task docs:check`: pass
- `npm run docs:hidden-unicode:check`: pass
- `npm run rag:release:source-audit`: pass。dataset-specific branch 0、artifact manifest mismatch 0。
- `npm run cdk -w @memorag-mvp/infra -- synth`: pass。既知の MFA/WAF cdk-nag warning は残るが synth failure はない。
- `npm run check:dynamodb-gsi-update-limit -w @memorag-mvp/infra -- /tmp/pr341-base-template.json test/__snapshots__/memorag-mvp-stack.snapshot.json`: pass
- `git diff --check`: pass
- GitHub Actions: head `d36f6675e3633747b5e273ab178a184561615c0f` の MemoRAG CI run 979、Validate Semver Label run 1432 は success。task done 記録 head `591187a4` の run 980 は Web 307/307 成功後、`useAppShellState.test.ts` の `useFavorites` 未 mock fetch が teardown まで残った `EnvironmentTeardownError` で failure。assertion／coverage failure ではなく test isolation の欠落として修復・再検証する。
- run 980 修復後: `useAppShellState.test.ts` 4/4、Web coverage 307/307、対象 ESLint、Web typecheck、`task docs:check`、`git diff --check` は pass。`useFavorites` を test double に置換し、HTTP fetch と pending RPC をテスト外へ隔離した。修復 head の GitHub Actions を final gate とする。
- read-only 最終再監査: production-path blocker 0。benchmark seed 削除の認可 subject と verified runner の audit/tombstone attribution、共有 corpus mapping、mismatched owner 拒否を再確認した。

### 検証中に検出して修復した主な失敗

- API contract/fixture、benchmark seed list/delete、FR-082 PDF page-gap fixture、Web role navigation、OpenAPI guard schema の不整合を修復した。
- 手動 API 全件診断で 20 件失敗したが、公式 package script の `LOCAL_AUTH_*` / `BENCHMARK_EVALUATION_*` を欠いた診断コマンドが原因だった。公式 script で 657/657 を確認し、偽陽性として記録した。
- E2E は local identity/store 設定不足、旧 benchmark selector/confirm flow、temporary attachment scope 消失、local SSE partial JSON race を検出し、修復後 4/4 pass とした。
- benchmark seed の一覧が空になる回帰は authoritative identity 判定へ修復し、対象 contract は約2秒で完了した。
- benchmark seed 削除の初回監査で resource owner を actor として記録する blocker を検出した。認可 subject と verified runner attribution を分離し、`smoke-agent-v1` 等の共有 corpus owner は suite registry から解決するよう修復した。API 658/658 と独立再監査 blocker 0 を確認した。
- 最終 workspace 一括実行では Web role navigation 1件が `/me` 解決前の同期 assertion で失敗した。権限依存 nav を待機する test に修復し、対象 41/41 と Web 全体 307/307 を再実行した。API/infra/benchmark/contract は同一一括実行で全件成功した。
- Draft PR の初回 CI では API coverage 用環境変数不足と SNS topic の TLS policy 不足を検出した。package script と同じ test environment を利用し、SNS の insecure transport deny policy、infra test/snapshot を追加した。
- 2回目の CI では SNS policy 追加後の infra inventory 未同期と API test 選択差を検出した。通常 script は shell 展開された一部階層のみを実行する一方、workflow は未展開の重複 recursive glob を `tsx` に渡していたため、1本の quoted recursive glob と `node --import tsx --test --test-concurrency=1` に統一した。C1 は未達を非表示にせず `tasks/todo/20260712-coverage-api-c1-recovery.md` へ継続した。
- 修正後の sandbox coverage は全97 test file を一意に選択し、listener 不使用の92 file が pass、localhost listener を必要とする5 file は sandbox の `EPERM` で未完了だった。Statements/lines 88.32%、branches 79.82%、functions 90.89% はこの5 file 未実行時の参考値であり、coverage gate の最終判定には使用しない。実 runner の結果は PR CI で確認する。
- 3回目の CI では infra inventory を含む全項目が成功し、API coverage だけが5 test failure を返した。reader/share route fixture は policy file を server 起動後に直接 seed しており、初期 cache 状態に依存していたため seed 後起動へ変更した。PDF 3件は `pdf-parse` 1.x の legacy pdf.js が Node `Buffer` を current Node 上で binary data として安定認識せず、runner に `pdftotext` がない場合だけ OCR path へ落ちていた。本番 extractor から exact `Uint8Array` を渡して host binary 非依存に修正し、FR-082 text-processing 27/27、API typecheck/lint を確認した。
- 4回目の CI では PDF 3件が解消し、reader document cache と upload 直後の share read の2件だけが残った。reader server を全 document fixture 作成後に起動し、share read は5秒上限の bounded convergence 待機へ変更した。失敗時にも coverage JSON summary を PR コメントへ出すよう workflow を修正した。失敗時参考値は tests 756/758、statements/lines 89.71%、branches 80.06%、functions 91.97% であり、未完了2 test の後半を含まない。
- 5・6回目の CI で残った reader/share 2件を実 listen 環境でも再現し、通常文書が source governance 未承認の `quarantined` 状態であること、share fixture が `LocalObjectStore` 外へ grant を書いていたこと、direct `full` grant は source folder `full` を要求する move 境界を迂回しないことを確認した。fixture を承認・公開ライフサイクル、active document ID、tenant-scoped object key、resource-hidden 404 契約へ同期し、対象2/2を確認した。
- child process route test は c8 親 process の coverage に算入されないため、Bedrock、CodeBuild/CloudWatch Logs、S3 object store、replay source snapshot の AWS/境界 adapter unit test を追加した。API 全件は 765/765 pass、statements/lines 90.03%（50212/55772）、functions 92.48%、branches 80.08%。C0 gate は維持したまま達成し、C1 は継続 task の対象とした。
- task done 記録後の Web CI では、hook test が `useFavorites` を mock しておらず実 HTTP fetch を開始し、全 assertion 完了後の worker teardown で pending RPC が検出された。favorites hook を hoisted mock に追加し、対象 4/4 と Web coverage 全 307/307、lint/typecheck/docs を再実行して pending fetch が消えたことを確認した。

## 成果物

- 実行計画: `reports/working/20260711-1518-full-requirements-execution-plan.md`
- 要件別証跡: `reports/working/20260712-2207-full-requirements-implementation-evidence.csv`
- task: `tasks/do/20260711-1518-full-requirements-implementation.md`
- live operational acceptance follow-up: `tasks/todo/20260714-0104-full-requirements-operational-acceptance.md`
- runtime/API/Web/infra/benchmark/test/docs 一式
- 本レポート

## 指示への fit 評価

- repository implementation と local acceptance は要件 ID 別 evidence および全回帰で確認した。
- production UI/API の mock/fake fallback は追加せず、unavailable/permission/error を正直に表示する。
- benchmark期待語句、QA sample 固有値、dataset 固有分岐は production source audit で 0。
- production deploy、migration 実行は行っていない。PR merge は 2026-07-14 の追加指示を受け、最終 CI 後に実施する。

## 未対応・制約・リスク

- `FR-066`: AWS registry backfill/convergence と live cleanup duration は未実施。
- `FR-093`: live notification、drift、rollback drill は未実施。
- `SQ-005`–`SQ-015`: approved dataset/threshold/window/owner/workload/price catalog を用いた live/load/chaos/cost/billing acceptance は未実施。
- API C1 branches 85% は未達として `tasks/todo/20260712-coverage-api-c1-recovery.md` で追跡する。C0 statements/functions/lines 90% は blocking gate のまま維持する。
- `npm install` 時点の audit は 4 vulnerabilities（low 1、moderate 1、high 2）を報告した。本タスクでは依存更新による互換性変更を実施していない。
- PR #341 は #342 統合後 head で本文・受け入れコメント・セルフレビューを更新し、`semver:minor`、Draft 解除、レビュー提出なし、未解決 thread なしを確認した。final metadata head の Web teardown failure を修復し、その CI 成功後に task を done へ戻して exact head SHA で merge する。live 運用 evidence の完了は主張せず、専用 follow-up task で継続する。
