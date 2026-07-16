# 文書アップロードが RAG safety interlock で失敗する

## 概要

- 発生日: 2026-07-16（報告時刻以前。正確な発生時刻は未確認）
- 検知: 利用者の文書アップロード操作
- 環境: dev と推定（2026-07-16 の RAG quality policy bootstrap 後）
- 重大度: `S1_high`
- 状態: `resolved_local`
- 表示メッセージ: `アップロードに失敗しました: RAG is temporarily unavailable because a required safety control is not satisfied.`

文書の転送後に実行される ingest pipeline が、production RAG monitoring の safety interlock で拒否された。修正前は現行 runtime が candidate quarantine に含まれると、chat / search / publication / promotion だけでなく ingest も一律拒否した。

## 期待結果と実結果

- 期待結果: quarantine 中でも文書を非公開の staging artifact として取り込み、`documentQuarantineRequired` に従って通常 RAG への publication を防ぎながら ingest observation を生成できる。
- 実結果: `assertRagSafetyInterlock(operation: "ingest")` が汎用 `RagSafetyInterlockError` を投げ、文書の解析・隔離保存・observation 生成へ進めない。

## 影響

- 利用者は文書をアップロードしても取り込みを完了できない。
- ingest source sample が追加されず、必須 monitoring observation の収束を妨げる。
- chat / search を止める安全側の制御は必要だが、修正前は安全な隔離取り込みまで停止し、回復に必要な観測経路を失う。
- 既存の upload object は ingest run の失敗処理に従う。live 環境での残存 object と run status は未確認である。

## 証拠

- エラーの完全一致文字列は `RagSafetyInterlockError` の既定 message である。
- 現行コードで既定 message を投げる operation path は、対象 runtime が `quarantinedRuntimeProfileVersions` に含まれる分岐である。
- `runIngestPipeline()` は `operation: "ingest"` で interlock を呼び、decision の `documentQuarantineRequired` が true なら admission reason `rag_monitor_document_quarantine` を付けて staging / quarantined / non-publishable にする。
- 修正前の回帰テストは、quarantined runtime の ingest で同じ `RagSafetyInterlockError` を再現した。
- 2026-07-16 の bootstrap 作業レポートは、初回 deploy 後も source sample が揃うまで unavailable signal の継続確認が必要であると記録している。

## なぜなぜ分析

| Why | 質問 | 回答 | 根拠 |
| ---: | --- | --- | --- |
| 1 | なぜアップロードが失敗したか | upload 後の ingest pipeline が `RagSafetyInterlockError` を投げたため。 | 利用者メッセージと `runIngestPipeline()` の呼び出し経路 |
| 2 | なぜ ingest が interlock で拒否されたか | 現行 runtime が `quarantinedRuntimeProfileVersions` に含まれると、operation を見る前に一律拒否したため。 | `assertRagSafetyInterlock()` の修正前判定順序 |
| 3 | なぜ quarantine 中の ingest まで拒否したか | candidate runtime の通常利用禁止と、文書を強制隔離できる offline ingest を同じ境界として扱ったため。 | operation-specific な publication / responseMode 判定との不整合 |
| 4 | なぜ回復を妨げたか | ingest を実行できないため、ingest manifest と worker outcome の source sample を追加できないため。 | `ProductionRagObservationProducer` の ingest producer 経路 |
| 5 | なぜテストで検出できなかったか | `documentQuarantineRequired: true` の ingest 許可はテストしたが、現行 runtime 自体が quarantined の組合せをテストしていなかったため。 | 修正前の `production-rag-monitor.test.ts` と `admission-lifecycle.test.ts` |

## 根本原因

candidate quarantine を operation 別に適用せず、通常 RAG での利用を止めるべき chat / search / publication / promotion と、強制文書隔離によって安全に継続できる ingest を一律に遮断した設計不整合である。

monitor が必須 signal 不足を fail-closed とすること自体は要件どおりであり、quarantine state の手動解除や threshold 緩和は対策にしない。

## 修正内容

- quarantined runtime でも `operation: "ingest"` だけは interlock を通す。
- runtime quarantine から返す ingest decision は、保存 state の値にかかわらず `documentQuarantineRequired: true` とする。
- chat / search / publication / promotion は同じ状態で引き続き拒否する。
- safety state の missing / invalid / expired、active runtime mismatch は従来どおり ingest を含め fail-closed にする。
- ingest pipeline test で admission が `quarantined`、lifecycle が `staging`、publication が false、vector が空であることを固定する。

## 再発防止

- interlock の各 operation を同一 quarantined state で検査する組合せテストを維持する。
- runtime quarantine と document quarantine の合成結果を decision で明示する。
- monitoring runbook に「ingest は強制隔離で継続、通常 RAG 利用と publication は拒否」という回復境界を記載する。
- bootstrap / source不足時は state を手動正常化せず、alert / action / observation を確認し、隔離 ingest で観測を追加する。

## 検証

### 修正前

- `node --import tsx apps/api/src/rag/production-rag-monitor.test.ts`: 新規回帰ケースが報告と同じ `RagSafetyInterlockError` で fail。
- 初回は専用 worktree の依存がなく親 worktree の古い contract export を解決して失敗したため、`npm ci` 後に再現を確認した。

### 修正後

- `node --import tsx apps/api/src/rag/production-rag-monitor.test.ts`: pass（11 tests）。
- `NODE_ENV=test node --import tsx apps/api/src/rag/admission-lifecycle.test.ts`: pass（10 tests）。
- `npm test -w @memorag-mvp/api`: pass（802 tests）。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `npm run build -w @memorag-mvp/api`: pass。
- `npm run lint`: pass。
- `task docs:check`: 初回は API code document freshness で fail。`task docs:api-code` で 97 API・582 文書を再生成後に pass。
- `git diff --check`: pass。

## 未確認・残リスク

- live docs bucket の `quality-control/runtime/safety-state.json`、alert、action、blocking reason は未取得であり、環境固有の最初の critical signal は未確認である。
- local 修正は live AWS へ未 deploy であり、実環境の upload 再試行は未実施である。
- quarantine 中の ingest は解析・embedding・保存コストを使用するが、通常 RAG へは公開しない。
- quarantine / freeze / limited state の解除条件は本修正では変更しない。

## フォローアップ

- オーナー: RAG Ops / Security / RAG Quality
- 期限: 修正 deploy 後
- 確認: 対象 alert/action と safety state を取得し、隔離 ingest の成功、manifest の quarantine、source sample 増加、通常 publication の拒否を確認する。
- 効果指標: safety-interlock 起因の ingest 失敗件数、quarantined ingest 件数、`UnavailableObservationCount`、必須 observation の収束状況。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260716-211300-UPLOAD-RAG-SAFETY",
  "created_at": "2026-07-16T21:13:00+09:00",
  "incident_type": "runtime_error",
  "failure_mode": "safety_interlock_recovery_deadlock",
  "severity": "S1_high",
  "status": "resolved_local",
  "summary": "Document ingest was rejected when the active runtime was quarantined, preventing safe staging and recovery observations.",
  "expected": "Quarantined-runtime ingest continues with mandatory document quarantine and no normal RAG publication.",
  "actual": "The shared runtime quarantine branch rejected ingest with RagSafetyInterlockError.",
  "confidence": "high_for_code_path_medium_for_live_trigger",
  "validation": {
    "passed": [
      "node --import tsx apps/api/src/rag/production-rag-monitor.test.ts",
      "NODE_ENV=test node --import tsx apps/api/src/rag/admission-lifecycle.test.ts",
      "npm test -w @memorag-mvp/api",
      "npm run typecheck -w @memorag-mvp/api",
      "npm run build -w @memorag-mvp/api",
      "npm run lint",
      "task docs:check",
      "git diff --check"
    ],
    "pending": [
      "live AWS upload verification after deploy"
    ]
  },
  "redactions": []
}
```
