# Web coverage TODO 対応

保存先: `tasks/done/20260507-2209-web-coverage-todo.md`

状態: done

## 背景

ユーザーから「webのカバレッジに関するtodoがあるので対応して /plan」と依頼された。`tasks/todo/` には Web coverage 専用の未着手 task は見当たらないが、`tasks/done/20260507-2012-benchmark-ci-coverage.md` に Web coverage の実測と gate 維持が記録されている。

## 目的

`@memorag-mvp/web` の coverage 状態を現在の `origin/main` ベースで再確認し、coverage gate に未達または改善余地がある場合は、低価値な実装詳細固定ではなくユーザー可視・保守価値のあるテストで補強する。

## スコープ

- 対象: `memorag-bedrock-mvp/apps/web`
- 対象外: API coverage、benchmark coverage、プロダクト挙動の変更

## 実施計画

1. Web coverage の現在値と不足ファイルを確認する。
2. coverage report から優先的に補うべき未検証分岐を特定する。
3. 必要な Web test を追加・修正する。
4. `@memorag-mvp/web` の coverage と typecheck を実行する。
5. ドキュメント更新要否を確認し、作業レポートを残す。

## ドキュメント保守方針

テスト追加のみでユーザー向け挙動、API、運用手順、CI command が変わらない場合、README や durable docs は更新しない。coverage gate や workflow を変更する場合のみ、関連 docs または task/report に反映する。

## 受け入れ条件

- `@memorag-mvp/web` の coverage TODO が調査され、現存する対象または代替解釈が task/report に明記されていること。
- `npm run test:coverage -w @memorag-mvp/web` が pass すること。
- TypeScript 変更がある場合、`npm run typecheck -w @memorag-mvp/web` が pass すること。
- coverage を上げるためだけの低価値な snapshot や実装詳細固定を追加していないこと。
- README、`docs/`、`memorag-bedrock-mvp/docs/` の更新要否が確認されていること。

## 検証計画

- `npm run test:coverage -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `git diff --check`

## PR review 観点

- `web` の coverage gate を弱めていないこと。
- 追加テストがユーザー可視の状態、入力、エラー、権限、データ分岐を確認していること。
- docs と実装の同期が崩れていないこと。

## リスク

- 既存の coverage が既に gate を満たしている場合、今回の作業は「TODO の実体調査 + 現状確認」が中心になる。
- coverage report の低いファイルが UI component でも、無意味な rendering test だけでは保守価値が低いため、必要な範囲に絞る。

## 実施結果

- `tasks/todo/` に Web coverage 専用の未着手 task は存在しないことを確認した。
- `tasks/done/20260507-2012-benchmark-ci-coverage.md` の Web coverage 記録を起点に、現行 `origin/main` ベースで `@memorag-mvp/web` coverage を再測定した。
- 初回測定は pass したが branch coverage が 85.16% と gate 近傍だったため、`DebugPanel` の replay graph、diagnostics、pending、JSON upload error/replay/clear のユーザー可視分岐をテストで補強した。
- 追加後の coverage は statements 92.30%、branches 85.97%、functions 90.97%、lines 95.31% で pass した。
- durable docs は未更新。理由: 今回はテスト追加のみで、UI/API/運用手順/CI command の挙動変更がないため。

## 実行した検証

- `npm run test -w @memorag-mvp/web -- src/features/debug/components/DebugPanel.test.tsx`: pass
- `npm run test:coverage -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
