# 要件定義（1要件1ファイル）

- 要件ID: `NFR-010`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-010: 本番または社内検証環境では、benchmark API と debug trace API は認可された利用者だけが実行または参照できること。

## 受け入れ条件（この要件専用）

- AC-NFR010-001: `AUTH_ENABLED=true` の場合、`/benchmark/query` は未認証リクエストを拒否すること。
- AC-NFR010-002: benchmark 実行権限は一般チャット利用権限と分離できること。
- AC-NFR010-003: debug trace 参照権限は管理者または検証者に限定できること。
- AC-NFR010-004: local 開発時に認証を無効化できる既存の開発体験は維持されること。
- AC-NFR010-005: `GET /debug-runs/{runId}` は debug trace 一覧と同じ権限境界で保護されること。
- AC-NFR010-006: `POST /debug-runs/{runId}/download` は debug trace 一覧と同じ権限境界で保護されること。
- AC-NFR010-007: `POST /benchmark/query` は `benchmark:query` を要求し、管理画面の非同期 benchmark run 起動権限 `benchmark:run` と分離すること。
- AC-NFR010-008: `POST /benchmark/search` は `benchmark:query` を要求し、通常利用者向け `POST /search` の `rag:doc:read` 境界と分離すること。
- AC-NFR010-009: `POST /benchmark/search` の dataset user 指定は benchmark runner endpoint に限定し、通常利用者向け `POST /search` の認証主体を上書きできないこと。

## 要件の源泉・背景

- 源泉: ユーザー提示の「ついでに直した方がよい点」、現行 `app.ts` の認証 middleware 対象確認。
- 背景: 現行の認証 middleware 対象に `/benchmark/query` が含まれておらず、benchmark response には retrieved chunk や debug 情報が含まれうる。

## 要件の目的・意図

- 目的: 社内資料、検索結果、debug trace の不用意な露出を防ぐ。
- 意図: 評価APIを便利に保ちつつ、本番系では管理対象にする。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-010` |
| 説明 | benchmark/debug 系 API の認可制御 |
| 根拠 | benchmark API は通常の利用者向け公開 API ではない |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 非機能要求 |
| 依存関係 | `authMiddleware`、`requirePermission`、API route 定義 |
| 衝突 | benchmark runner の実行には token 準備が必要になる |
| 受け入れ基準 | `AC-NFR010-001` から `AC-NFR010-009` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-05-01 初版、2026-05-04 benchmark query と benchmark run 起動の permission 分離を追加、同日 search benchmark runner 用 endpoint の認可境界を追加、2026-05-05 search benchmark dataset user の適用範囲を追加 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 情報露出リスクを下げる |
| 十分性 | OK | benchmark と debug trace の一覧、詳細、download を含む |
| 理解容易性 | OK | 対象 API と条件が明確 |
| 一貫性 | OK | 既存認証方式を拡張するだけ |
| 標準・契約適合 | OK | 社内資料保護方針に合う |
| 実現可能性 | OK | `app.ts` と権限定義で対応可能 |
| 検証可能性 | OK | auth on/off と role 切り替えの API test で確認可能 |
| ニーズ適合 | OK | 評価基盤拡張前の安全対策 |
