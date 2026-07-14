# API コード対応ドキュメント自動生成

- 状態: done
- タスク種別: 機能追加
- 作成日時: 2026-07-13 22:37 JST
- 完了日時: 2026-07-14 09:42 JST

## 背景

API 実装の理解にソースコード読解が必要であり、AI が実装した処理、入出力、メッセージ、クエリ、シーケンス、単体テスト観点を自然言語で追跡できる生成ドキュメントが不足している。
参照実装 `.workspace/lazunex` の原理を調査し、同じくコードを解析元とする方式を rag-assist へ横展開する。

## 目的

アプリケーションコードと既存テストを解析し、対象 API ごとに次の 6 文書を再現可能かつ決定的に自動生成する。

- `detail-design_gen.md`
- `if_gen.md`
- `messages_gen.md`
- `query_gen.md`
- `sequence_gen.md`
- `unit-test_gen.md`

## スコープ

- `.workspace/lazunex` のコード解析・中間表現・テンプレート・生成・検証原理の調査
- rag-assist の API route、schema、handler、service、store/query、message、test の静的解析
- API 単位の 6 文書生成器と、生成物の網羅性・鮮度を確認する検証器
- repository command / CI から再生成・差分検査できる導線
- 生成方式と保守方法の durable docs

## 非対象

- API 挙動そのものの変更
- 文書生成専用の annotation、decorator、コメント、定数、設定などを実装コードへ追加すること
- LLM の非決定的な実行を生成の必須経路にすること
- Web UI、認可仕様、RAG 検索品質の変更

## 2026-07-14 再統合スコープ

- PR #341・#342 が確立した最新 `main` と統合し、正規 docs root と RAG release gate を維持する。
- `docs/generated/api-code/` の二階層構造、許可ファイル、provenance を `scripts/validate_docs.py` と unit test で明示的に検証する。
- 同じ関数へ直接・間接の複数経路がある場合、call graph の投影深さを最短経路へ正規化し、深い経路の先行走査で主要分岐が欠落しないようにする。
- 最新 runtime API から生成物を全件再生成し、旧 76 API／456 文書という記録を現行件数へ更新する。
- PR 本文、受け入れ確認、セルフレビュー、GitHub CI を final head で更新し、blocker がない場合だけ merge する。

## 計画

1. lazunex と rag-assist の構造を調査し、コードから API 文書へ至る対応関係を設計する。
2. route discovery と source/test analysis の中間表現を実装する。
3. API ごとの 6 Markdown renderer と出力 manifest / stale check を実装する。
4. representative API と全 API 網羅性を検証する unit / integration test を追加する。
5. repository command、CI、設計・運用ドキュメントを同期する。
6. 生成・lint・typecheck・test・docs check を実行し、失敗を修正して再実行する。

## ドキュメント保守計画

- `scripts/validate_docs.py` の正規 docs 構成・生成物 provenance 規則を確認し、生成物は `docs/generated/` 配下へ API 単位で配置する。
- 生成器の原理、入力ソース、非メタデータ方針、制約、再生成・検証手順を SWEBOK-lite の設計／運用文書へ記録する。
- `README.md`、`DES_DLD_011.md`、`DES_API_001.md`、`OPS_MONITORING_001.md`、`AGENTS.md` への影響を調査し、必要な最小範囲だけ更新する。

## 受け入れ条件

- [x] AC1: `.workspace/lazunex` の生成原理が、コード解析の入力、中間表現、生成テンプレート、対応関係、鮮度検証まで根拠付きで把握され、rag-assist の設計へ反映されている。
- [x] AC2: rag-assist の対象 API が実装コードから自動検出され、API ごとの安定した出力ディレクトリへ 6 文書すべてが生成される。
- [x] AC3: 6 文書は route/schema/handler/service/store/query/message/test の実コードに対応し、ソースを開かなくても主要な処理、分岐、入出力、永続化、メッセージ、呼び出し順、テスト状況を自然言語で把握できる。
- [x] AC4: 文書生成のためだけの annotation、decorator、コメント、定数、設定などのメタデータを実装へ追加しておらず、生成器が既存コードと既存テストを解析している。
- [x] AC5: API 追加・変更・削除後に再生成漏れや stale な生成物を検出できる repository command と CI gate があり、正規 docs validator も許可 shape と provenance を fail closed で検証する。
- [x] AC6: route discovery、コード対応、中間表現、6 renderer、全 API × 6 文書の網羅性、決定的再生成、代表的な複雑 API、call graph 最短深さを自動テストで検証している。
- [x] AC7: 生成物、生成手順、設計判断、既知の解析限界が正規 DES/OPS docs と作業レポートに記録されている。

## 2026-07-14 ローカル再統合 evidence

- integration base: PR #341 merge commit `2b3fdb85`
- generated: 95 APIs / 570 API documents / 572 files
- generator test: 8/8 pass（call graph 最短 depth fixture を含む）
- canonical docs validator unit: 9/9 pass
- `task docs:check`: pass
- 対象 ESLint、API typecheck/build、check-yaml、`git diff --check`: pass
- RAG release source audit: dataset-specific branch 0、artifact manifest mismatch 0
- GitHub final content CI: MemoRAG CI run 983、Semver run 1436 / 1437 が成功
- [x] AC8: 選定した lint、typecheck、unit/integration test、生成物 stale check、canonical docs check、`git diff --check` と final content head の GitHub CI が成功している。
- [x] AC9: main 向け PR、`semver:*` label、日本語の受け入れ条件確認、セルフレビュー、task done 更新が完了している。task/report だけを更新する metadata head の CI は merge 前に PR 上で再確認する。

## 2026-07-14 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/343
- integration commit: `bed5918d6a8991955f65facf3bd495a735c59d83`
- MemoRAG CI: run 983 success
- Semver label validation: run 1436 / 1437 success
- 受け入れ条件確認: comment `4964246601`
- セルフレビュー: comment `4964246707`
- 最終 metadata head は task/report の完了記録だけを変更し、同 head の CI・review thread・mergeability を merge 前に GitHub Apps で再確認する。

## 既存 publication 証跡（再統合前）

- Draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/343`
- label: `semver:minor`
- 実装 commit: `7af40f7f`
- セルフレビューコメント: 投稿済み（comment ID `4959441269`）
- 受け入れ条件確認コメント: 投稿済み（comment ID `4959445096`）
- GitHub Actions: コメント投稿時点では未確認。ローカル検証と区別する。

## 検証計画

- generator の対象 package に対する lint / typecheck
- generator unit / integration test
- 全 API を対象とした clean generation と二重生成の同一性確認
- checked-in 生成物と再生成結果の stale check
- repository-defined docs check（Taskfile の解決内容を事前確認）
- `git diff --check`
- 変更範囲が共有 build / CI に及ぶ場合は repository の broader verify

## PR レビュー観点

- 実装コードへ文書生成専用メタデータを混入していないか
- API discovery が route の追加・削除に追随し、漏れを隠さないか
- 各記述の根拠となるソース path / symbol が追跡可能か
- 推定と確認済み事実を混同せず、解析できない箇所を正直に表現するか
- docs と generator、checked-in 生成物、CI gate が同期しているか
- RAG の根拠性・認可境界・benchmark 固有値に影響していないか

## リスク

- 動的 route 登録、関数参照、factory、spread、computed expression の静的解決には限界がある。
- 全 API × 6 文書は生成量が大きいため、可読性、差分量、実行時間を両立する必要がある。
- query や message が service/store 間に分散しており、AST だけでは意味を完全に復元できない場合がある。
- CI で生成物全件を比較する際に、OS や依存バージョン由来の非決定性を排除する必要がある。
