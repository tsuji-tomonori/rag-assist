# MMRAG-DocQA benchmark 性能改善

- 状態: done
- 作成日時: 2026-05-07 13:46
- 対象 worktree: `.worktrees/mmrag-benchmark-performance`

## 背景

`.workspace/bench_20260507T043640Z_5710a31c` の benchmark artifact では、`mmrag-docqa-v1` の 3 行がすべて `資料からは回答できません。` で失敗している。
`retrieval_recall_at_20=0%`、`citation_hit_rate=0%`、`p95_latency_ms=30884` であり、期待 corpus `mmrag-docqa-method.md` ではなく無関係な要求章 `.tex` が検索上位に入っている。

## 目的

MMRAG-DocQA sample benchmark で期待 corpus を検索・回答経路に乗せ、誤拒否と不要な検索 iteration を減らす。

## スコープ

- benchmark corpus / dataset / runner 設定
- RAG 検索・回答可否判定に関わる最小修正
- 関連テストと必要なドキュメント更新

## 非スコープ

- MMRAG-DocQA 本番 paper corpus への差し替え
- benchmark の期待語句を実装へ直接 hard-code する修正
- 通常利用者の認可境界を広げる変更

## 受け入れ条件

- AC1: `mmrag-docqa-v1` の sample corpus `mmrag-docqa-method.md` が、該当質問の retrieval / selected context に入ることをテストで確認できる。
- AC2: 期待 corpus に十分な根拠がある場合、`sufficient_context_gate` 相当の判定で誤って `UNANSWERABLE` に落ちないことをテストで確認できる。
- AC3: 検索が同じ action を繰り返すだけのケースで、不要な最大 iteration 依存を避ける改善を検討し、実装または見送り理由を記録する。
- AC4: 既存の benchmark / RAG / API テストが選定範囲で pass する。
- AC5: 認可境界、RAG 根拠性、benchmark 固有値 hard-code の有無をセルフレビューで確認する。

## 作業計画

1. artifact の trace と現在のコードから原因を切り分ける。
2. 期待文書 hit を阻害している ranking / alias / corpus metadata / query planning のどれが主因か確認する。
3. 最小修正を入れ、回帰テストを追加する。
4. 変更範囲に応じて docs 更新要否を判断する。
5. テスト、作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを実施する。

## ドキュメントメンテ計画

- benchmark corpus の metadata / alias / local verification 手順が変わる場合は `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` または `memorag-bedrock-mvp/docs/OPERATIONS.md` を更新する。
- 実装内部の最小修正のみで既存運用手順が変わらない場合は、作業レポートに「durable docs 更新不要」と理由を残す。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `git diff --check`

## PR レビュー観点

- docs と実装が同期しているか。
- 変更範囲に見合うテストがあるか。
- RAG の根拠性・拒否ポリシーを弱めていないか。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないか。
- BENCHMARK_RUNNER / benchmark corpus の認可境界を弱めていないか。

## リスク

- production API の live benchmark 再実行には token / AWS / 外部サービス制約がある。
- LLM 出力の揺れを完全には単体テストで再現できないため、決定的な検索・判定ロジックを中心に固定する。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/150
- 作業レポート: `reports/working/20260507-1405-mmrag-benchmark-performance.md`
- 受け入れ条件確認コメント: PR #150 に投稿済み。
- 検証: API / benchmark の test と typecheck、`git diff --check origin/main...HEAD`、local mock API に対する `mmrag-docqa-v1` sample benchmark を実行し pass / 指標改善を確認済み。

## 残制約

- production API / Bedrock を使った live benchmark は未実行。
- mock benchmark の `answerableAccuracy=0.3333` は mock final answer の期待文字列不足による残制約として PR 本文と作業レポートに記載済み。
