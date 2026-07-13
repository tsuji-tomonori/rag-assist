# MemoRAG MVP 監視・検証ランブック

- ファイル: `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`
- 種別: `OPS_MONITORING`
- 状態: Draft
- 最終更新: 2026-07-13

## 目的

現行実装で利用できる health、ログ、benchmark、生成物 freshness を使い、障害と品質劣化の初動確認を再現可能にする。未実装の本番 RAG 監視機能は、利用可能であるかのように記載せず todo へ分離する。

## 現行の観測点

| 対象 | 現行の観測点 | 確認先 |
| --- | --- | --- |
| API 生存性 | health endpoint の HTTP status | `GET /health`、API Gateway/Lambda logs |
| chat / ingestion | request、error、処理段階の application log | CloudWatch Logs、対象 Lambda log group |
| debug trace | 認可された trace API と保存 artifact | `DES_API_001`、`DES_DATA_001` |
| benchmark | run status、report、runner log | benchmark API、Step Functions、CodeBuild logs |
| deploy | workflow run、CloudFormation event、smoke result | GitHub Actions、CloudFormation、health endpoint |
| API/docs drift | 自動生成物の freshness check | `npm run docs:openapi:check` |
| Web/infra docs drift | inventory の freshness check | `npm run docs:web-inventory:check`、`npm run docs:infra-inventory:check` |

認証情報、source 本文、chunk 本文、prompt、raw model response を一般ログへ出力しない。debug trace の raw data/redaction 契約には既知の不一致があるため、修正 task が完了するまで本番 trace の共有範囲を最小化する。

## 初動確認

1. 影響範囲、発生時刻、request/run ID、環境を記録する。
2. `GET /health` と直近 deploy/workflow status を確認する。
3. API Gateway、Lambda、Step Functions、CodeBuild の順に、同じ時刻と ID の error を追跡する。
4. RAG 品質事象は回答、引用、取得 evidence、answerability、debug trace、使用中の index/alias を突合する。
5. 権限事象は token や本文を転記せず、actor、tenant/resource、要求 permission、decision reason、audit event の有無を確認する。
6. deploy や設定変更が原因候補なら、CloudFormation event と直前差分を確認する。rollback、resource 削除、deploy は別途承認を得て実行する。

## ローカル／CI 検証

リポジトリ定義を正とし、実行前に `Taskfile.yml` または `package.json` の解決コマンドを確認する。

| 目的 | コマンド |
| --- | --- |
| docs 構成と自動生成物 | `task docs:check` |
| OpenAPI freshness | `npm run docs:openapi:check` |
| Web inventory freshness | `npm run docs:web-inventory:check` |
| infra inventory freshness | `npm run docs:infra-inventory:check` |
| hidden Unicode | `npm run docs:hidden-unicode:check` |

変更範囲に見合う lint、typecheck、test、build、smoke は `Taskfile.yml` と package scripts から追加選択する。未実施の確認は運用記録や PR で実施済みとしない。

## 既知の未実装監視

本番 stage/slice 別の RAG 品質・安全 drift、SLO alert、safe degradation/recovery action の control loop は未実装である。`FR-089`、`FR-093`、`SQ-008`、`SQ-012`–`SQ-015` と `GAP-RD-024` は `tasks/todo/20260713-2257-production-rag-monitoring.md` で追跡する。

## 受け入れ条件

- AC-OPS-MON-001: API、chat/ingestion、benchmark、deploy、docs freshness の現行観測点を特定できること。
- AC-OPS-MON-002: 障害調査時に機微な本文や credential を一般ログへ追加せず、時刻と ID で相関できること。
- AC-OPS-MON-003: 未実装の本番 RAG 監視を現行機能と誤認せず、対応 task と要求へ逆引きできること。
