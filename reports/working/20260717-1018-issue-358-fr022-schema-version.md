# Issue #358 FR-022 schemaVersion 契約統一 作業完了レポート

## 受けた指示

Issue #358 の P1-A / FR-022 について、独立 worktree と task md を用い、履歴調査、schemaVersion の migration/default 契約実装、仕様・coverage・生成物同期、検証、draft PR、semver、日本語コメント、final-head CI、Issue 進捗、task done まで完遂する。merge / deploy / release は行わない。

## 要件整理と判断

- persisted `schemaVersion` 欠落は導入時契約どおり legacy v1 と解釈する。
- explicit v1/v2 は読めるようにし、unknown version は黙って補正せず fail closed とする。
- 新規 write は multi-turn state 導入後の current v2 とし、v1 の更新保存も data を保持して v2 へ昇格する。
- list read は storage を書き換えない。破壊的な一括 migration と実 AWS migration は対象外とする。

この判断は初期導入レポート、commit `12f50338`、FR-022 正本、current source/design の矛盾を突き合わせて決定した。根本原因は read legacy default と current write default の混同、および API/store/Web/docs を横断する contract test の欠落である。

## 実施作業

- API に legacy v1/current v2 の named constant と read/write 別 normalization を追加した。
- local/DynamoDB store を missing=v1、v1/v2 preserve、unknown reject に統一した。
- new/v1 write を v2 へ正規化し、message と optional field を保持するよう固定した。
- Web の型と新規会話 producer を v2 に同期した。
- API/shared contract、local/DynamoDB store、Web hook/App test を追加・更新した。
- FR-022、data/API design、requirement trace、baseline、coverage を current contract と同期した。
- 仕様回復分析を別レポート `20260717-1005-issue-358-fr022-schema-version-spec-analysis.md` に残した。

## 成果物

- API/store/Web/shared contract の version normalization と回帰 test
- FR-022/DES/coverage/traceability の更新
- task md と本作業レポート
- draft PR、semver label、AC/self-review/final-head CI/Issue コメント（PR 作成後に追記）

## 検証

- API 全体 coverage: 807 tests passed。Statements/Lines 90.46%、Branches 80.45%、Functions 92.93%。
- Web 全体: 61 files / 442 tests passed。
- shared contract 全体: 2 tests passed。
- API targeted contract/store/requirements coverage、Web targeted hook/API: passed。
- `task verify`: lint、全 workspace typecheck/build passed。
- `task docs:check`: docs/OpenAPI/generated freshness/Web・infra inventory/hidden Unicode passed。
- source audit: dataset-specific branch 0、artifact manifest mismatch 0。
- `git diff --check`: passed。

初回の contract direct `tsx` は sandbox IPC 制約、Web direct root Vitest は workspace config 不適用、requirements coverage の root 実行は cwd 前提で失敗した。repository 定義の runner/cwd に修正し、同じ検証対象を成功まで再実行した。Web 全体で検出した旧 v1 write 期待値 2 件も current v2 へ修正して再実行した。

## 指示への fit 評価

実装、仕様同期、mixed-version/default/migration contract、広範検証は指示に適合している。RAG 根拠性、認可、tenant partition、API route は変更していない。README/AGENTS/運用手順は公開操作や運用方式を変更しないため更新不要と判断した。source-backed generated docs は freshness check が成功し、生成差分は不要だった。

## 重複 PR と取り込み時注意

- #387 は conversation history、API schema、coverage、baseline、generated docs と広く重複する。
- #388/#392 は `apps/api/src/schemas.ts` と generated docs 周辺に重複がある。
- 本変更では不要な `apps/api/src/schemas.ts` 直接編集を避けたが、取り込み順にかかわらず最終 merge 前に contract/full tests と generator freshness を再実行する必要がある。

## 未対応・制約・リスク

- 実 AWS item の version 分布、unknown version の存在、production migration は未検証・未実施。
- unknown persisted version が既にあれば read は fail closed となるため、production 適用前に分布調査が必要。
- `npm ci` の audit は既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。本変更では依存更新を行っていない。
- merge / deploy / release は行わない。
- rollback は本変更 commit の revert で可能であり、保存済み item の一括 rewrite は実施していない。
