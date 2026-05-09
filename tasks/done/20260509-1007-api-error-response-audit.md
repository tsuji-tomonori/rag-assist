# API error response audit

状態: done

## 背景

Benchmark log error hardening では Hono `app.onError` と benchmark logs 周辺を修正したが、他の API / Lambda entrypoint で raw error message を response へ返していないか追加確認が必要。

## 目的

API 全体のエラー応答を確認し、内部詳細が response に出る経路を修正する。あわせてテスト内の AWS account ID は実在値に見える値を避け、`111111111111` のような意味のない fixture 値にする。

## Scope

- `memorag-bedrock-mvp/apps/api/src` の route / Lambda entrypoint / error response。
- 追加済み API error hardening test。
- 必要に応じた task/report/PR コメント更新。

## Plan

1. `err.message` / `error.message` / `String(err)` を response へ渡す箇所を検索する。
2. response へ raw error を返す経路を固定文言へ修正し、詳細は log に残す。
3. AWS account ID を含むテスト fixture を `111111111111` へ置換する。
4. 対象テストと `git diff --check` を実行する。

## Documentation Maintenance Plan

- API shape を変えず error body の安全化だけを行うため、恒久 docs は原則不要。
- 再発防止は既存の `skills/api-error-response-hardening/SKILL.md` に従う。

## 受け入れ条件

- [x] API / Lambda entrypoint で raw internal error を response body に直接返す箇所を確認する。
- [x] 発見した raw error response 経路を固定文言へ修正する。
- [x] 詳細 error は server log 側に残る。
- [x] テスト内の AWS account ID fixture は実在値に見える値ではなく `111111111111` を使う。
- [x] 関連テストと `git diff --check` が pass する。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`

## Validation Result

- `rg` で API response へ `err.message` / `String(err)` を返す箇所を確認。残件は validation response と server-side user directory summary log のみ。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## Risks

- 既存クライアントが streaming endpoint の raw 500 body に依存している場合、表示文言が変わる。
