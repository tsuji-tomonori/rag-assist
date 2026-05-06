# QA 回答文選択の汎用改善

保存先: `tasks/done/20260506-2331-qa-answer-selection-generalization.md`

状態: done

## 背景

ローカル QA sample で 50 件中 4 件の期待語句未一致が残っている。retrievalRecallAtK と citationHitRate は 1.0 のため、取得根拠や citation ではなく、取得済み根拠から回答文へ反映する情報選択に改善余地がある。

ユーザーから、固定値、期待語句、QA sample 固有の分岐、benchmark 特化の補正は使わず、汎用的な回答文選択改善として対応する指示がある。

## 目的

`memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts` を中心に、取得済み根拠から回答に渡す文脈の選択を汎用的に改善する。あわせて、同種の修正ミスを防ぐためレビュー観点、skill、設計方針へ禁止事項と確認観点を明文化する。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts`
- 関連する RAG unit test / benchmark sample test
- RAG 詳細設計または設計方針ドキュメント
- `skills/pr-review-self-review/SKILL.md` などレビュー観点に関係する skill
- 作業レポートと PR コメント

## 方針

- 固定値、期待語句リスト、QA sample のケース ID、benchmark suite 固有条件を実装に入れない。
- 根拠文の一般的な構造、質問との語彙的近さ、取得スコア、chunk の source/page/section 情報など、実運用にも妥当な信号だけを使う。
- retrieval と citation の責務は変更せず、回答生成へ渡す文脈選択の改善に閉じる。
- 改善できない場合でも、benchmark 特化の補正で数字だけを上げない。

## 必要情報

- 現在の PR #137 は main に merge 済み。
- 新 worktree は `origin/main` 起点の `codex/qa-answer-selection-improvement`。
- ユーザー補足: 「固定値は利用したくありません。ベンチマーク特化になってしまうためです。汎用的にできるようにして。キーワードを書かないで。」

## 実行計画

1. 現行の context assembly と benchmark QA 経路を確認する。
2. 期待語句未一致を再現し、根拠は取れているが回答文へ反映されない原因を切り分ける。
3. 汎用的な文脈選択ロジックを実装し、必要な unit test を追加・更新する。
4. 設計方針とレビュー skill に、benchmark 特化・期待語句注入を禁止する観点を追記する。
5. QA sample、関連 unit test、typecheck、diff check を実行する。
6. 作業レポート、commit、push、PR 作成、受け入れ条件コメント、task done 移動を完了する。

## ドキュメントメンテナンス計画

- RAG 回答文脈選択の設計に影響するため、`memorag-bedrock-mvp/docs/3_設計_DES/` 配下の該当設計を確認し、必要な方針を追記する。
- README、API examples、OpenAPI、運用手順、deploy docs は API 契約や運用手順が変わらない限り更新不要と判断する。
- PR 本文と作業レポートに、固定値・期待語句・benchmark 固有補正を使っていないこと、未実施検証があれば理由を明記する。

## 受け入れ条件

- [x] `context-assembler.ts` の改善が、固定値、期待語句リスト、QA sample 固有 ID、benchmark suite 固有分岐を含まない。
- [x] ローカル QA sample の期待語句未一致が改善する。完全解消できない場合は、残件の原因と固定値なしでの限界を明記する。
- [x] `retrievalRecallAtK` と `citationHitRate` が 1.0 から低下しない。
- [x] 関連 unit test / typecheck / benchmark sample が pass する。
- [x] レビュー観点、skill、設計方針に同種の benchmark 特化修正を防ぐ確認項目が追加される。
- [x] PR に受け入れ条件の確認結果を日本語でコメントする。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `API_BASE_URL=http://localhost:8788 task benchmark:sample` または同等のローカル QA sample 実行。API server が必要で実行できない場合は理由を記録する。

## PRレビュー観点

- RAG 品質改善が benchmark の期待語句や dataset 固有条件に依存していないか。
- 回答文選択の信号が、実運用文書にも成立する一般的な根拠構造と質問関連度に基づいているか。
- retrieval、citation validation、answerability gate の責務を混ぜていないか。
- benchmark 指標が改善しても、根拠性、拒否制御、認可境界を弱めていないか。
- docs と skill に再発防止観点が反映されているか。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/141
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/141#issuecomment-4389592736
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/141#issuecomment-4389595366
- 作業レポート: `reports/working/20260507-0020-qa-answer-selection-generalization.md`
- QA sample: total 50 / answerContainsRate 1 / retrievalRecallAtK 1 / citationHitRate 1 / failures 0
- CI: PR 作成直後のため、GitHub Actions の完了結果は未確認。

## 未決事項・リスク

- 決定事項: 期待語句を直接扱う修正は行わない。
- 決定事項: QA sample の数値改善より、汎用 RAG として妥当な文脈選択を優先する。
- リスク: ローカル API server や Bedrock 依存の benchmark 実行が必要な場合、環境制約で full sample を実行できない可能性がある。その場合は unit test と実行可能な benchmark test で代替し、未実施理由を明記する。
