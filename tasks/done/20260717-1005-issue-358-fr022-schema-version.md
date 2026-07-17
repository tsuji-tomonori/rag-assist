# Issue #358 FR-022 schemaVersion 契約統一

- 状態: done
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-022

## 背景

会話履歴は 2026-05-02 に `schemaVersion: 1` を導入し、保存値に version がない legacy item は v1 と解釈する契約だった。2026-05-14 の multi-turn state 追加で API の current version は v2 へ上がった一方、API schema の default、新規 Web payload、local/DynamoDB store の legacy read、正本設計文書が同時に更新されず、v1/v2 の意味が経路ごとに異なっている。

## 目的

後方互換を維持しながら、persisted legacy item、API write、Web 新規 item、mixed-version read/update の契約を v1/v2 の明示的な境界として統一する。

## スコープ

- 会話履歴の current write version と legacy read version の定数・正規化
- local / DynamoDB store の mixed-version read/write behavior
- Web の新規会話 payload
- API/shared contract と関連 unit/contract test
- FR-022、data/API design、coverage/generated docs の同期
- PR #387 / #388 / #392 との重複評価と取り込み時注意の記録

## 対象外

- DynamoDB 全 item を一括更新する online/offline migration
- 本番 AWS データへの migration 実行
- 会話履歴以外の schemaVersion 統一
- merge / deploy / release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 時点の `origin/main` では、FR-022 が version 未指定 legacy item を v1 と扱うよう求める一方、API/shared schema と store の read default は v2、Web の新規 item は v1、設計文書は current v1 と記載しており、同じ item の version 解釈が経路で一致しない。

### confirmed

- `REQ_FUNCTIONAL_022.md` AC-FR022-004 は未指定の既存 item を v1 として扱う。
- `reports/working/20260502-1103-history-schema-version-docs.md` は v1 導入時に API/store 未指定値を v1 補完すると決定した。
- commit `12f50338` は multi-turn optional state の追加と同時に API current version を v2 に上げ、API/shared schema の default と新規 store write default を v2 にした。
- local/DynamoDB store の read helper は missing version に current version v2 を補完する。
- Web type と新規 payload は引き続き v1 を送る。
- `DES_DATA_001.md` と `DES_API_001.md` は current v1 と記載する。

### inferred

- v2 は multi-turn state field を導入した current write format であり、v1 item は optional field 欠落のまま安全に読み取れる。
- v1 item の更新保存時に current v2 へ昇格させる read-time/write-time migration が、破壊的な一括 migration より安全で後方互換性が高い。

### open_question

- 実 AWS 上の legacy item 件数と version 分布は未確認。今回の correctness は fixture/contract test で固定し、本番 migration は実施しない。

### 根本原因

- schema version 変更時に、persisted legacy read、new write、Web producer、正本文書を同時検査する単一 contract test がなかった。
- read default と write default に同じ current-version 定数を流用し、legacy missing value の意味を独立して表現していなかった。

### 全影響範囲を覆う是正

- legacy read version と current write version を別の named constant / normalization path として表現する。
- v1/missing/v2/unknown、Web producer、v1 update-to-v2 migration を一つの contract suite で固定する。
- requirement/design/coverage/generated を実装と同期し、将来の version bump で契約差分を検出可能にする。

## 採用する期待動作

- persisted `schemaVersion` 欠落は legacy v1 と解釈する。
- explicit v1 と v2 は read 可能とし、unknown version は fail closed で拒否する。
- 新規 API/Web write は current v2 を永続化・返却する。
- v1 item を更新保存する場合は v2 へ昇格し、optional field がない v1 data は失わない。
- list read だけでは storage を書き換えない。migration は次回 write 時に行い、読み取りに副作用を持たせない。

## 実施計画

1. source/history/PR overlap を固定し、task/spec analysis を記録する。
2. version normalization と store contract を実装する。
3. Web producer と型を current v2 に同期する。
4. API/shared contract、store、Web test を追加・更新する。
5. FR-022/DES/coverage/generated docs を同期する。
6. targeted から broad validation へ進め、失敗を修復する。
7. report、commit、draft PR、AC/self-review、task done lifecycle、final-head CI、Issue進捗まで完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_022.md`: current v2、legacy missing=v1、read/write migration AC を原子的に追記する。
- `DES_DATA_001.md`: read/write version normalization と migration を記述する。
- `DES_API_001.md`: current v2 request/response と legacy list behavior を記述する。
- requirements coverage と generator freshness を更新・確認する。
- README / AGENTS / operation docs は公開手順・運用変更がないため更新不要かを差分後に再確認する。

## 受け入れ条件

- [x] AC1: version 未指定の persisted legacy item を local/DynamoDB store が v1 として返す。
- [x] AC2: explicit v1 と v2 が同じ一覧で読み取れ、unknown version は拒否される。
- [x] AC3: API schema で version 未指定の新規 write は v2 になり、store へ v2 が保存される。
- [x] AC4: Web が作成する新規会話履歴 item は `schemaVersion: 2` を送る。
- [x] AC5: v1 item の更新保存は current v2 へ昇格し、既存 message/optional field を保持する。
- [x] AC6: list read は保存先を書き換えず、副作用のない backward-compatible read である。
- [x] AC7: API/shared contract、runtime type、Web type、store、fixture、FR-022/DES/coverage/generated docs の version 語彙が一致する。
- [x] AC8: 選定した test/typecheck/build/lint/docs/source audit が成功する。
- [x] AC9: draft PR に semver、重複 PR、未検証の実 AWS migration、rollback を記載し、日本語 AC/self-review/final-head CI evidence を残す。

## 検証計画

- API/shared contract と conversation history store の targeted test
- Web history hook/API targeted test
- API/Web/contract typecheck・test・build
- root lint、`task docs:check`、source audit、`git diff --check`、pre-commit
- final-head GitHub Actions / semver label validation

## PR レビュー観点

- read default v1 と new write v2 が混同されていないか
- v1 update migration が data loss / write-on-read を起こさないか
- unknown version を v1/v2 へ黙って矯正していないか
- API/Web/shared contract の version 語彙が一致するか
- #387 の conversation history/schema/generated docs、#388/#392 の `apps/api/src/schemas.ts` と取り込み時再生成が必要か
- RAG の根拠性、認可、tenant 境界を変更していないか

## リスク

- open PR の schema/generated docs と競合する。merge 順に generator と contract/full tests の再実行が必要。
- 実 AWS item 分布は未検証。unknown version が既に存在する場合、今回の fail-closed により read が失敗するため運用調査が必要。
- v1 を更新保存すると v2 へ昇格するため、旧 client が返却 version を厳密に v1 と仮定している場合は影響し得る。ただし Web producer は同一 PR で v2 に同期する。

## 検証結果（PR 作成前）

- API 全体 coverage: 807 tests passed、Statements/Lines 90.46%、Branches 80.45%、Functions 92.93%。
- Web 全体: 61 files / 442 tests passed。
- shared contract: 2 tests passed。API targeted contract/store/requirements coverage と Web targeted hook/API も成功。
- `task verify`: root lint、全 workspace typecheck/build 成功。
- `task docs:check`: docs/OpenAPI/source-backed generated docs/Web・infra inventory/hidden Unicode check 成功。生成物の追加更新は不要。
- source audit: dataset-specific branch 0、artifact manifest mismatch 0。
- `git diff --check`: 成功。
- 初回の contract direct `tsx` は sandbox IPC 制約、Web direct root Vitest は workspace config 不適用、requirements coverage の root 実行は cwd 前提で失敗した。いずれも repository 定義に沿う runner/cwd へ修正し、同じ対象を成功まで再実行した。
- 実 AWS item 分布と production migration は対象外かつ未検証。

## PR / CI evidence

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/398
- semver: `semver:patch`。label 適用後の Validate Semver Label run 1613 は成功。
- AC コメント: https://github.com/tsuji-tomonori/rag-assist/pull/398#issuecomment-4998106747
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/398#issuecomment-4998107623
- 初期 implementation head `b11f14cbec312463fa6fe7f83b0ae9bcc58e6ab7` の MemoRAG CI run 1139 は成功。
- label 適用前の Validate Semver Label run 1612 は失敗したが、同じ head に `semver:patch` を付与した後の run 1613 が成功し、期待する最終状態へ収束した。
- lifecycle commit 後の final-head CI と Issue #358 進捗コメントは、最終 push 後に追記確認する。
