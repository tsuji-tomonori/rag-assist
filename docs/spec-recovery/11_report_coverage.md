# Report Coverage

## 結論

現時点の task は、作業レポート 1 件につき 1 task ではなく、product behavior に関係する作業レポートを task family へ集約したものである。

`reports/working/*.md` 384 件と `reports/bugs/*.md` 7 件、合計 391 件をファイル単位で全量分類した。commit、PR 作成、merge/rebase、競合解消、CI コメント投稿、task acceptance 確認だけのレポートは、ユーザー価値や observable behavior に直接つながる task としては扱わない。

## 分類結果

| 分類 | 件数 | task 化 |
|---|---:|---|
| commit/PR/merge/CI コメント/競合解消/task acceptance のみ | 181 | 原則対象外 |
| docs/requirements/process | 32 | product behavior に関係するものだけ対象 |
| auth/RBAC/security | 29 | 対象 |
| chat/RAG answer/question | 21 | 対象 |
| search/retrieval | 26 | 対象 |
| debug/trace | 10 | 対象 |
| history/favorite/UI | 14 | 対象 |
| documents/ingest/OCR/upload | 9 | 対象 |
| benchmark/evaluation | 21 | 対象 |
| API/infra/ops | 11 | 対象 |
| 未分類または横断 | 37 | 追加精査 |

## 追加した task family

| Task | 根拠カテゴリ | 要約 |
|---|---|---|
| TASK-011 | auth/RBAC/security | 認証・初回パスワード・自己登録を制御する |
| TASK-012 | API/infra/ops | API 契約と CORS/request validation を維持する |
| TASK-013 | history/favorite/UI | チャット UI の操作性を維持する |
| TASK-014 | history/favorite/UI | 履歴を検索・並び替え・通知確認する |
| TASK-015 | documents/ingest/OCR/upload | PDF/OCR/大容量文書を安全に ingest する |
| TASK-016 | chat/RAG answer/question | RAG 回答可能性 policy を調整・評価する |
| TASK-017 | search/retrieval | chunking と retrieval adoption gate を管理する |
| TASK-018 | debug/trace | Debug trace を時系列で再現し artifact として取得する |
| TASK-019 | benchmark/evaluation | Benchmark dataset adapter と metrics を管理する |
| TASK-020 | benchmark/evaluation, API/infra/ops | Benchmark 実行の timeout・cost・artifact を制御する |
| TASK-021 | auth/RBAC/security | 管理画面でユーザー・role・全ユーザー一覧を扱う |
| TASK-022 | API/infra/ops | API route を領域別に分割して仕様同期を維持する |
| TASK-023 | docs/requirements/process | 仕様・要件 docs の coverage を継続管理する |
| TASK-024 | 全量レポート分類 | 作業レポートを仕様化対象と対象外に分類する |

## 残課題

- 391 件すべての本文精読は未実施。今回の追加は全量ファイル分類とカテゴリ単位の task family 抽出である。
- 未分類または横断カテゴリ 37 件は、次バッチで本文精読して既存 task への統合または新規 task 化を判断する。
- 代表ソース以外はカテゴリ source として扱っており、全 report への個別 `RPT-*` ID 採番は未実施。
