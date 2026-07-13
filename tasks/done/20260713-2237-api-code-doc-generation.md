# API コード対応ドキュメント自動生成

- 状態: done
- タスク種別: 機能追加
- 作成日時: 2026-07-13 22:37 JST

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

## 計画

1. lazunex と rag-assist の構造を調査し、コードから API 文書へ至る対応関係を設計する。
2. route discovery と source/test analysis の中間表現を実装する。
3. API ごとの 6 Markdown renderer と出力 manifest / stale check を実装する。
4. representative API と全 API 網羅性を検証する unit / integration test を追加する。
5. repository command、CI、設計・運用ドキュメントを同期する。
6. 生成・lint・typecheck・test・docs check を実行し、失敗を修正して再実行する。

## ドキュメント保守計画

- `docs/DOCS_STRUCTURE.md` を確認し、生成物は `docs/generated/` 配下へ API 単位で配置する。
- 生成器の原理、入力ソース、非メタデータ方針、制約、再生成・検証手順を SWEBOK-lite の設計／運用文書へ記録する。
- `README.md`、`docs/LOCAL_VERIFICATION.md`、`docs/API_EXAMPLES.md`、`AGENTS.md` への影響を調査し、必要な最小範囲だけ更新する。

## 受け入れ条件

- [x] AC1: `.workspace/lazunex` の生成原理が、コード解析の入力、中間表現、生成テンプレート、対応関係、鮮度検証まで根拠付きで把握され、rag-assist の設計へ反映されている。
- [x] AC2: rag-assist の対象 API が実装コードから自動検出され、API ごとの安定した出力ディレクトリへ 6 文書すべてが生成される。
- [x] AC3: 6 文書は route/schema/handler/service/store/query/message/test の実コードに対応し、ソースを開かなくても主要な処理、分岐、入出力、永続化、メッセージ、呼び出し順、テスト状況を自然言語で把握できる。
- [x] AC4: 文書生成のためだけの annotation、decorator、コメント、定数、設定などのメタデータを実装へ追加しておらず、生成器が既存コードと既存テストを解析している。
- [x] AC5: API 追加・変更・削除後に再生成漏れや stale な生成物を検出できる repository command と CI gate がある。
- [x] AC6: route discovery、コード対応、中間表現、6 renderer、全 API × 6 文書の網羅性、決定的再生成、代表的な複雑 API の内容を自動テストで検証している。
- [x] AC7: 生成物、生成手順、設計判断、既知の解析限界が durable docs と作業レポートに記録されている。
- [x] AC8: 選定した lint、typecheck、unit/integration test、生成物 stale check、docs check、`git diff --check` が成功している。
- [x] AC9: main 向け PR を作成し、日本語の受け入れ条件確認コメントとセルフレビューコメントを投稿している。

## 完了証跡

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
