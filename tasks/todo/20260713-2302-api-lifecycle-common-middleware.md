# API lifecycle と common middleware gate の完成

- 状態: todo
- タスク種別: API・品質実装
- 作成日: 2026-07-13
- 関連要件: `FR-053`, `FR-055`

## 背景

runtime OpenAPI と一部 docs quality gate はあるが、REST/oRPC/shared contract の網羅 drift、lifecycle/deprecated metadata、breaking-change approval、worker/common middleware の一貫性は未完成である。

## 目的と範囲

公開 API contract の単一 source、生成物 freshness、breaking-change 判定、共通 auth/CORS/error/request ID contract を HTTP/worker 境界で固定する。

## 受け入れ条件

- [ ] 公開 route/schema と OpenAPI/shared client の drift を CI で検出する。
- [ ] lifecycle/deprecated/breaking metadata と承認 flow を機械可読にする。
- [ ] auth、CORS、error sanitize、request ID が protected/public/OPTIONS で一貫する。
- [ ] bypass route、stale generated docs、breaking schema の否定試験を追加する。
- [ ] chat / ingest / benchmark / async agent の identifier、状態、event、artifact、idempotency を共通 worker contract または明示的な差分契約として定義する。
- [ ] worker ごとの missing identifier、別 tenant、replay、terminal state、artifact 追跡を executable test で検証する。

## 検証・文書

- OpenAPI/docs check、API contract/security policy test、Web client typecheck を実行する。
- `FR-053`, `FR-055`, `DES_API_001` と generated provenance を更新する。

## リスク

CloudFront/Cognito entrypoint は `20260522-2120-cloudfront-single-entry-implementation.md` と調整する。
