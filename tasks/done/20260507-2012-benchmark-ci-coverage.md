# benchmark CI と coverage gate の強化

## 保存先

`tasks/done/20260507-2012-benchmark-ci-coverage.md`

## 状態

done

## 背景

現行の MemoRAG CI は benchmark workspace の type-check と build は確認しているが、`npm test -w @memorag-mvp/benchmark` を実行していない。PR コメントには CI 結果が投稿されるが、benchmark test の結果は含まれていない。API coverage は C0 90% を gate している一方、C1 branches は 0% のため、希望値である C1 85% の現実性確認と対応方針が必要である。

## 目的

CI で benchmark test を確認し、その結果を PR コメントに含める。C0 statements 90% 以上、C1 branches 85% 以上を CI gate の目標とし、現実的でない場合は coverage 改善計画を task として残す。

## 対象範囲

- `.github/workflows/memorag-ci.yml`
- `memorag-bedrock-mvp/apps/api/package.json`
- 必要に応じて `tasks/todo/` の coverage 改善計画 task
- 必要に応じて `reports/working/` の作業レポート

## 方針

既存の CI 構成と PR コメント投稿処理を維持し、最小差分で benchmark test 行を追加する。API coverage の C1 gate は 85% へ上げてローカル実測し、未達なら CI gate として入れる前に改善計画 task を作る。Web coverage は既存 `vitest.config.ts` が C0 90% / C1 85% を要求しているため、CI コメント上でその結果が確認できる状態を維持する。

## 必要情報

- 既存 CI: `.github/workflows/memorag-ci.yml`
- API coverage script: `memorag-bedrock-mvp/apps/api/package.json`
- Web coverage threshold: `memorag-bedrock-mvp/apps/web/vitest.config.ts`
- benchmark test script: `memorag-bedrock-mvp/benchmark/package.json`
- 関連 skill: `worktree-task-pr-flow`, `implementation-test-selector`, `post-task-fit-report`, `japanese-git-commit-gitmoji`, `japanese-pr-title-comment`, `pr-review-self-review`

## 実行計画

1. CI に `Test benchmark` step を追加する。
2. PR コメントの results 表に benchmark test の行を追加する。
3. CI failure 条件に `benchmark_test` を追加する。
4. API coverage の C1 85% が現実的かローカルで確認する。
5. 未達の場合は、未達領域と改善方針を `tasks/todo/` に記録する。
6. 変更範囲に応じた検証を実行する。
7. 作業レポートを作成し、commit / push / PR / PR コメントまで進める。

## ドキュメントメンテナンス計画

CI と developer workflow の変更であり、API contract、RAG 挙動、認可境界、OpenAPI、運用 API 仕様は変更しない。README や要求 docs は原則更新不要と判断するが、PR 本文と作業レポートに CI 変更内容、coverage gate の扱い、未達時の改善 task を明記する。

## 受け入れ条件

- CI workflow に `npm test -w @memorag-mvp/benchmark` が含まれること。
- PR コメント表に benchmark test の結果行が含まれること。
- benchmark test 失敗時に CI が failure になること。
- API/Web coverage の C0 90% 以上、C1 85% 以上について、実測結果または未達時の改善計画が明記されること。
- 未達を達成済みとして PR コメント、作業レポート、最終回答に書かないこと。

## 検証計画

- `npm test -w @memorag-mvp/benchmark`
- API coverage gate 候補: `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`
- Web coverage: `npm run test:coverage -w @memorag-mvp/web`
- `git diff --check`
- 必要に応じて YAML/CI 差分の目視確認

## PRレビュー観点

- `benchmark` test が CI と PR コメントの両方に追加されていること。
- C0/C1 の値と閾値が PR コメントで誤解なく読めること。
- 未実行または未達の coverage を達成済みとして扱っていないこと。
- CI の `continue-on-error` 集約と最後の failure 判定が既存設計と整合していること。
- docs と実装の同期、RAG の根拠性、認可境界、dataset 固有 shortcut に影響しない変更範囲であること。

## 未決事項・リスク

- 決定事項: benchmark test は lightweight unit tests として CI に追加する。
- 決定事項: Web は既存設定で C0 90% / C1 85% を維持する。
- 実装時確認: API C1 85% はローカル実測で判断する。2026-05-07 の実測では C0 93.63%、C1 81.5% であり、C1 85% gate は未達だったため `tasks/todo/20260507-2012-api-c1-coverage-improvement.md` を作成した。
- 実装時確認: Web coverage は C0 91.95%、C1 85.08% で既存 gate を通過した。
- リスク: CI timeout 20 分に benchmark test 分の実行時間が加わるため、ローカルで実行時間を確認する。

## 完了メモ

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/157`
- 受け入れ条件確認コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。
- API C1 85% は未達のため、継続 task `tasks/todo/20260507-2012-api-c1-coverage-improvement.md` を作成済み。
