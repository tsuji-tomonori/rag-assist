# アップロード時の RAG safety interlock 障害修正

- 状態: do
- タスク種別: 修正
- 着手: 2026-07-16 21:13 JST

## 背景

文書アップロード後の取り込みで `RAG is temporarily unavailable because a required safety control is not satisfied.` が返り、文書を登録できない。

## 目的

RAG safety control の fail-closed 境界を維持したまま、隔離 runtime でも文書を強制隔離して ingest observation を生成できる回復経路を復旧する。

## 対象範囲

- production RAG safety interlock の操作別判定
- 回帰テスト
- 障害レポート
- RAG monitoring 運用文書
- 対象外: runtime quarantine の手動解除、live AWS データ変更、deploy / merge

## なぜなぜ分析

### 問題文

2026-07-16、dev 環境の文書アップロード後の取り込みが、RAG safety interlock の汎用エラーで失敗した。本来は異常時も文書を staging / quarantine に受け入れ、通常 RAG への公開だけを遮断できる必要がある。

### confirmed

- エラーメッセージの既定値は `RagSafetyInterlockError` に定義され、現行コードでは対象 runtime が `quarantinedRuntimeProfileVersions` に含まれる分岐から投げられる。
- `runIngestPipeline()` は `operation: "ingest"` で interlock を呼び、返却された `documentQuarantineRequired` が true なら admission を `quarantined` に変更する。
- 既存テストは `documentQuarantineRequired: true` の状態で ingest を許可し、publication / promotion を拒否する境界を要求している。
- bootstrap 後の monitor は必須 signal 不足を fail とし、zero-tolerance signal の不足を critical violation として candidate quarantine を実行し得る。
- 現行の runtime quarantine 判定は operation 判定より前にあり、chat / search / ingest / publication / promotion を一律拒否する。

### inferred

- 報告された環境では bootstrap 後の monitoring window が現行 runtime を quarantine に追加し、アップロード済みオブジェクトの ingest が共通判定で拒否された可能性が高い。live safety-state artifact は未取得のため、対象 alert / blocking reason は未確認である。
- ingest が拒否されると ingest source sample を追加できず、必須 observation の収束が遅れる自己回復阻害が生じる。

### root cause

candidate quarantine を「通常 RAG で利用してはならない runtime」として操作別に扱わず、文書を強制隔離できる ingest にも一律適用したため、公開を防ぐ safety action が安全な取り込み・観測経路まで遮断した。

### open_question

- live safety state の `blockingReasons`、alert、action、発生時刻はリポジトリ内情報だけでは確定できない。
- 修正後に production source sample が全必須 observation へ収束する時間は live AWS での継続確認が必要である。

### 全影響範囲を覆う対応

- quarantined runtime では ingest のみ許可し、返却 decision の `documentQuarantineRequired` を強制的に true にする。
- chat / search / publication / promotion の拒否、missing / invalid / expired state、runtime mismatch の拒否は維持する。
- interlock 単体テストと ingest pipeline の quarantine テストで、公開可能 artifact が生成されないことを確認する。
- 運用文書に操作別境界と回復手順を明記する。

## 実施計画

1. 現行挙動を固定する失敗回帰テストを追加する。
2. safety interlock を操作別に修正する。
3. 障害レポートと monitoring runbook を更新する。
4. targeted test、API typecheck / build、docs check、diff check を実行する。
5. commit、push、main 向け PR、受け入れ条件コメント、セルフレビューを実施する。

## ドキュメント保守計画

- `reports/bugs/` に事象、影響、RCA、対策、検証、live 未確認事項を記録する。
- `OPS_MONITORING_001.md` に quarantine 中の操作別 interlock と、強制隔離 ingest による回復観測を追記する。
- API shape と認可 route は変えないため OpenAPI と access-control policy は変更しない。

## 受け入れ条件

- [x] quarantined runtime で `operation: "ingest"` が成功し、`documentQuarantineRequired: true` を返す。
- [x] 同じ状態で chat、search、publication、promotion は引き続き拒否される。
- [x] ingest pipeline が対象文書を approved / published にせず quarantined staging artifact として扱う。
- [x] missing、invalid、expired safety state と runtime mismatch の fail-closed 挙動を維持する。
- [x] 障害レポートと運用文書が原因、修正境界、未確認事項を正確に記載する。
- [x] 選定した API test、typecheck、build、docs check、`git diff --check` が成功する。
- [ ] 日本語の PR、受け入れ条件コメント、セルフレビューが記録される。
- [x] 作業完了レポートを `reports/working/` に残す。

## 検証計画

- `node --import tsx --test --test-name-pattern='FR-093' apps/api/src/rag/production-rag-monitor.test.ts`
- ingest pipeline の対象テスト（追加後にテスト名を確定）
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `task docs:check`
- `git diff --check`
- 変更ファイルを対象とする `pre-commit run --files ...`

## 検証結果

- `node --import tsx apps/api/src/rag/production-rag-monitor.test.ts`: 修正前 fail -> 修正後 pass（11 tests）
- `NODE_ENV=test node --import tsx apps/api/src/rag/admission-lifecycle.test.ts`: pass（10 tests）
- `npm test -w @memorag-mvp/api`: pass（802 tests）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run build -w @memorag-mvp/api`: pass
- `npm run lint`: pass
- `task docs:check`: API code docs freshness で fail -> `task docs:api-code` 後 pass
- `git diff --check`: pass
- `pre-commit run --files <changed-files>`: pass

## PR レビュー観点

- quarantined runtime の利用範囲を ingest にだけ限定していること。
- quarantined ingest が `documentQuarantineRequired` を必ず true にし、通常 RAG 公開を弱めないこと。
- authorization、tenant、admission、publication fence の境界を変更していないこと。
- benchmark expected phrase、dataset 固有値、QA sample 固有分岐を追加していないこと。
- docs と実装、テスト結果、未検証の live AWS 状態が同期していること。

## リスク

- ingest 自体は embedding / storage の外部処理を行うため、quarantine 中もコストが発生する。ただし通常 RAG 公開は行わない。
- live safety state を直接確認していないため、報告事象の環境固有 blocking reason は推定として扱う。
