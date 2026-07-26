# Issue #358 FR-002 ingest progress truthfulness

- 保存先: `tasks/done/20260718-0240-issue-358-fr002-ingest-progress-truth.md`
- 状態: done
- タスク種別: 修正
- stacked base: PR #439 final head `b251a6023790071d9f94d1091fd53d71bae5bffe`

## 背景

Issue #358 P1-C は FR-002 の文書取り込み UI について、polling 回数から進捗段階を推定する経路を廃止し、API の `run.stage` と明示的な unknown state を表示するよう求める。PR #439 後の read-only 監査で、Web API client が `pollCount` を `extracting`、`chunking`、`embedding`、`indexing` へ機械変換し、API が返す optional `stage` を Web type で受け取っていないことを確認した。

## 目的

local upload handoff の実際の操作状態と、document ingest run API が返す stage だけを user-visible progress の根拠にする。stage が欠落または未知の場合は、詳細工程を推定せず明示的な unknown / unavailable state として表示する。success だけを complete とし、既存の rejected / failed / cancelled error と manifest refresh / auth / scope contract は維持する。

## 対象範囲

- Web の `DocumentIngestRun` response type と stage-to-presentation mapping
- polling count 由来 phase progression の除去
- known API stage、missing / unknown stage、repeat polling、terminal state の API client tests
- `DocumentUploadState` と progress panel の unknown / server-derived presentation
- hook / component regression tests
- FR-002 canonical requirement と requirements coverage evidence
- generated Web inventory / source-backed docs の更新要否確認
- work report、Draft stacked PR、two-head CI、Issue progress、clean / upstream / remote lifecycle

対象外:

- API schema、document ingest store / worker / route、backend stage 粒度の追加
- `/events` subscription、polling interval / timeout の変更
- upload authorization、tenant / scope、manifest refresh / QA retrieval の変更
- actual AWS / manual E2E、scanner、migration、retention、owner policy
- merge、deploy、release

## なぜなぜ分析 / RCA

### 問題文

`waitForDocumentIngestRun` は API の詳細 stage を参照せず、polling 回数が増えるたびに利用者へ extracting → chunking → embedding → indexing と表示する。backend の実処理工程が進んでいなくても表示だけが進むため、API 由来でない推定値が実際の状態として見える。

### confirmed

- `apps/web/src/features/documents/api/documentsApi.ts` は `pollPhases` と `pollCount` から phase を決める。
- Web の `DocumentIngestRun` type は `stage` を持たず、API response の optional field を捨てる。
- API canonical schema は `DocumentIngestRunSchema.stage` を optional string として返す。
- runtime は少なくとも `queued`、`running`、`preprocessing`、`extracting`、`done`、`rejected`、`failed`、`cancelled` を run stage または terminal state として記録する。
- UI は現在「詳細ステップは API status から推定」と表示するが、Issue #358 は poll-count 推定の廃止と explicit unknown を要求する。
- FR-002 AC-FR002-001 は UI の工程表示を API 由来状態に限定し、No Mock Product UI は推定値を actual data として表示することを禁止する。
- open PR に FR-002 / document ingest progress を所有する unit はない。PR #375 の requirements evidence sync は FR-002 を対象に含めず、#345 PR 群は当該 API client / progress panel を変更しない。

### inferred

- client-local な `preparing`、`transferring`、`creatingRun` は実際に開始した処理の直前に emit されるため、polling 推定とは異なり維持できる。
- known API stage は pure mapper で presentation state へ変換し、同じ run response の再取得で勝手に進ませないことで再発を防げる。
- absent / unknown stage を専用 `unknown` phase として扱えば、古い API response と将来の未知 stage を backward-compatible に正直に表示できる。

### conflict

- backend が現在永続化しない chunk / embedding / indexing 詳細を UI だけで維持する案は、API 由来条件と No Mock Product UI に反するため不採用。
- raw unknown stage を complete または既知の詳細工程へ丸める案は、unavailable を success / actual progress に誤変換するため不採用。
- 本 unit で backend の stage 粒度や events subscription まで拡張する案は、最小 UI truthfulness fix を越えるため不採用。

### open_question

- 将来 backend が chunk / embedding / vector stage を run record へ永続化するかは未確定。本 unit は未知 stage を安全に表示し、勝手な詳細 mapping を追加しない。
- API start response は stage を返さないため、最初の poll 前は status だけが判明する。詳細 stage は unknown として扱う。

### 因果と根本原因

- 発生: async ingest UI を段階的に見せる際、実 stage contract の不足を polling 回数で補完した。
- 流出: Web response type が optional `stage` を表現せず、tests も最終 manifest の取得だけを確認して intermediate progress の出所を検証しなかった。
- 根本原因: user-visible progress の各値を API response / local operation / explicit unavailable のどれに由来するか型と mapper で固定せず、時間経過を domain progress へ変換できる構造を許したこと。
- 全範囲対策: poll-derived state を削除し、source-aware type / pure mapper / unknown state / repeated polling regression tests / canonical docs を一組で追加する。

## 採用する期待動作

- local preparing / transferring / creatingRun は実際の client operation に由来する状態として維持する。
- async run polling 中は API の known stage だけを user-visible phase の根拠にする。
- stage が missing または unknown の場合は `unknown` とし、extracting / chunking / embedding / indexing を推定表示しない。
- 同じ status / stage を何回取得しても表示 state は変化しない。
- `succeeded` かつ manifest がある場合だけ complete とする。
- rejected / failed / cancelled は既存 error contract を維持する。

## Rollback 境界

- rollback は Web response type、stage mapper、progress UI/tests、FR-002 evidence を一括で戻す。
- API / data / auth / infra を変更しないため data rollback は不要。
- rollback 後は poll-count pseudo progress が復活し、API stage と UI 表示が再び乖離する。

## 実行計画

1. source-aware stage type と pure mapper の regression tests を先に追加する。
2. pollCount / pollPhases を除去し、known stage / unknown presentation を実装する。
3. hook / progress panel tests と No Mock Product UI trace を更新する。
4. FR-002 canonical requirement / coverage / generated inventory の必要範囲を同期する。
5. targeted / full validation、report、purpose-separated commits、Draft stacked PR、two-head CI、Issue progress、clean / upstream / remote 一致を完遂する。

## ドキュメント保守計画

- FR-002 の「API 由来」と「詳細 unavailable」の契約を、poll-count 推定を許さない表現へ同期する。
- requirements coverage の FR-002 evidence を実質的な API client / component tests へ置き換える。
- README、API examples、operations、OpenAPI は public API / operation 非変更のため更新不要か差分後に再確認する。
- generated Web inventory と source-backed API docs は公式 task で freshness を確認し、必要な生成差分だけを含める。

## 受け入れ条件

- [x] AC1: PR #439 後の Issue / open PR / docs / code / test を read-only 監査し、FR-002 を非重複の最小 safe unit として vet する。
- [x] AC2: confirmed / inferred / conflict / open_question、原因、影響、rollback 境界を実装前に記録する。
- [x] AC3: 同じ running response を反復 polling しても user-visible phase が時間経過だけで進まない。
- [x] AC4: known API stage だけを source-aware mapper で presentation state へ変換する。
- [x] AC5: missing / unknown stage は explicit `unknown` とし、既知の詳細工程または complete へ昇格しない。
- [x] AC6: `succeeded` + manifest のみ complete、rejected / failed / cancelled は既存 error contract を維持する。
- [x] AC7: preparing / transferring / creatingRun は実 client operation 由来として維持し、auth / scope / manifest refresh を変更しない。
- [x] AC8: progress panel が missing optional data を架空工程で埋めず、honest unavailable state を live region 内へ表示する。
- [x] AC9: FR-002 canonical requirement / requirements coverage / 必要な generated Web inventory を実装と同期する。
- [x] AC10: targeted mapper / API client / hook / component tests、Web lint / typecheck / full coverage / build、docs / inventory、task verify、source audit、root CI、pre-commit / diff check を成功させる。
- [ ] AC11: report、目的別 commit、Draft stacked PR、`semver:patch`、日本語 body / AC / self-review / verification、two-head CI、Issue #358 progress を完遂する。
- [x] AC12: local HEAD / upstream / remote 一致と clean worktree を確認し、actual AWS / manual E2E、backend/schema、migration、scanner、merge、deploy、release を未実施として記録する。

## 外部証跡

- Draft stacked PR: [#440](https://github.com/tsuji-tomonori/rag-assist/pull/440)
- implementation head: `5499ee11a906bdfaeb4aa96617aedd476c773c0c`
- implementation CI: [run 29602528837](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29602528837) — success
- initial AC: [comment 5006089178](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089178)
- initial self-review: [comment 5006089406](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089406)
- initial verification: [comment 5006089591](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089591)
- work report: `reports/working/20260718-0314-issue-358-fr002-ingest-progress-truth.md`
- AC11 の final-head CI / final comments / Issue progress / remote 一致は lifecycle commit 後に外部証跡として PR / Issue へ記録する。

## Done 条件

- AC1〜AC12 の deliverables と validation evidence が揃い、unavailable / unverified を pass または actual progress と表現していない。
- production UI の表示値が local operation、API response、terminal result、または explicit unknown のいずれかへ trace できる。
- backend / API schema / auth / scope / manifest refresh / RAG retrieval を変更していない。
- docs と実装、変更範囲に見合う tests、RAG 根拠性・認可境界、dataset 固有分岐不在をセルフレビューする。
- task lifecycle commit 後に final-head CI と external evidence を確認する。

## 検証計画

- direct: stage mapper、documents API polling、useDocuments hook、DocumentWorkspace progress panel。
- Web: lint、typecheck、full test coverage、build。
- docs / inventory: requirements coverage、generated Web inventory / semantic trace、`task docs:check`。
- repository: `task verify`、`npm run rag:release:source-audit`、`npm run ci`、`pre-commit run`、`git diff --check`。
- remote: implementation head / final head GitHub Actions。

## PR レビュー観点

- pollCount / elapsed time から domain phase を生成する production path が残っていないか。
- missing / unknown optional stage を架空工程・成功・zero として表示していないか。
- known stage mapping が backend の現行 contract を過剰解釈していないか。
- terminal errors、manifest refresh、auth / tenant / scope を退行させていないか。
- accessible live region で current state と unavailable reason を理解できるか。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐、mock fallback を追加していないか。

## リスク

- backend が coarse stage しか返さない期間は、UI の詳細工程が unknown または broad processing になる。これは虚偽の詳細表示より安全であり、本 unit の意図どおりである。
- PR #439 への stacked Draft のため、base 更新時は Web / docs / requirements coverage の conflict を再確認する。
- #345 の documents UI tests と同じ feature area を含むが、既存 open PR は progress panel / API polling を変更しない。rebase 時の test fixture conflict は再確認する。
