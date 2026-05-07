# API C1 coverage 85% 改善計画

## 保存先

`tasks/todo/20260507-2012-api-c1-coverage-improvement.md`

## 状態

todo

## 背景

`npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` を実行した結果、API tests 168 件は pass したが、C1 branches は 81.62% で 85% gate に未達だった。C0 statements は 93.66%、functions は 94.84%、lines は 93.66% で既存目標を満たしている。

## 目的

API の branch coverage を 85% 以上へ引き上げ、`@memorag-mvp/api` の `test:coverage` と CI で C1 85% を gate 化できる状態にする。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/analyze-input.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/execute-computation-tools.ts`
- `memorag-bedrock-mvp/apps/api/src/dependencies.ts`
- `memorag-bedrock-mvp/apps/api/src/adapters/user-directory.ts`
- `memorag-bedrock-mvp/apps/api/src/chat-run-events-stream.ts`
- `memorag-bedrock-mvp/apps/api/src/auth.ts`
- `memorag-bedrock-mvp/apps/api/src/app.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/text-extract.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/verify-answer-support.ts`
- 関連する `*.test.ts`
- gate 化時の `.github/workflows/memorag-ci.yml` と `memorag-bedrock-mvp/apps/api/package.json`

## 方針

branch coverage が低い file を、未検証の分岐が仕様上重要な順に確認する。RAG 品質や認可境界に関わる分岐は fixture や mock を使って明示的に test し、dataset 固有の期待語句や sample row 固有値による shortcut は追加しない。単純な defensive branch で実行価値が低い場合も、除外ではなくまず小さな unit test で確認できるか検討する。

## 必要情報

- 2026-05-07 実測値: C0 statements 93.66%、C1 branches 81.62%、functions 94.84%、lines 93.66%
- C1 下位候補:
  - `agent/nodes/analyze-input.ts`: 37.5% (3/8)
  - `agent/nodes/execute-computation-tools.ts`: 39.13% (9/23)
  - `dependencies.ts`: 64% (16/25)
  - `adapters/user-directory.ts`: 64% (32/50)
  - `chat-run-events-stream.ts`: 64.86% (24/37)
  - `auth.ts`: 66.66% (10/15)
  - `app.ts`: 68.87% (166/241)
  - `rag/text-extract.ts`: 69.81% (74/106)
  - `agent/nodes/verify-answer-support.ts`: 70.66% (53/75)

## 実行計画

1. `apps/api/coverage/coverage-summary.json` と HTML/text report を確認し、85% 到達に必要な branch 数を見積もる。
2. `analyze-input.ts` と `execute-computation-tools.ts` の未通過分岐を unit test で追加確認する。
3. `auth.ts`、`app.ts`、`user-directory.ts` は認証・認可境界を弱めない観点で normal/error/permission branch を追加する。
4. `text-extract.ts` は PDF/OCR/Textract/invalid input の error branch と fallback branch を追加する。
5. `chat-run-events-stream.ts` と `verify-answer-support.ts` は SSE payload、missing data、unsupported answer repair failure などの branch を追加する。
6. API coverage が C1 85% 以上になったら、`test:coverage` と CI の `--branches` を 85 に変更する。
7. 変更後に API tests と必要な static policy tests を再実行する。

## ドキュメントメンテナンス計画

test coverage 改善のみで API contract や runtime behavior を変更しない場合、README、OpenAPI、要求 docs は更新不要。認可・RAG・benchmark の仕様分岐を明確化する test を追加した結果、仕様解釈を補足する必要が出た場合は、関連する `REQ_NON_FUNCTIONAL_010.md`、`REQ_NON_FUNCTIONAL_011.md`、`REQ_FUNCTIONAL_019.md` または作業レポートに反映する。

## 受け入れ条件

- `npm run test:coverage -w @memorag-mvp/api` が C0 statements 90% 以上、C1 branches 85% 以上で pass すること。
- CI の API coverage command が `--branches 85` を含むこと。
- 追加 test が認証・認可、RAG 根拠性、benchmark dataset 境界を弱めていないこと。
- benchmark expected phrases、QA sample 固有値、dataset 固有分岐を実装に追加していないこと。
- 未実行の検証を PR 本文やコメントで実施済み扱いしないこと。

## 検証計画

- `npm run test:coverage -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- 認可 route や `app.ts` を変更した場合: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`

## PRレビュー観点

- C1 85% 到達が実測値で示されていること。
- coverage を上げるためだけの無意味な assertions や implementation detail 固定がないこと。
- 認可境界、debug trace、benchmark API、document ACL、RAG evidence handling を弱めていないこと。
- failure/error branch の test が運用上あり得る入力や依存 failure を表していること。

## 未決事項・リスク

- 決定事項: 現時点では API C1 85% gate は未達のため、この task で改善してから gate 化する。
- リスク: `app.ts` の branch 数が多く、85% 到達には endpoint contract test の追加が必要になる可能性がある。
- リスク: coverage だけを目的に低価値な test を増やすと保守性が下がるため、認可・RAG・外部依存 failure の重要分岐を優先する。
