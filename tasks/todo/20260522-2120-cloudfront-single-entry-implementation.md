# CloudFront単一入口構成の実装タスク分解

- 状態: todo
- タスク種別: 機能追加
- 作成日: 2026-05-22
- 関連要件: `TC-003`
- 関連ADR: `ARC_ADR_005`

## 背景

`TC-003` と `ARC_ADR_005` で、CloudFrontを本番公開の単一入口として採用する方針を定義した。設計・実装は後続タスクであり、traceability上の `design TBD` が流れないよう、実装領域ごとに受け入れ条件を分類して追跡する。

## 目的

CloudFront単一入口構成の後続実装を、SPA、CloudFront/CDK、API middleware、Cognito、WebSocket、direct origin/security regressionの単位へ分けて実施できる状態にする。

## 範囲

- SPA relative path
- CloudFront/CDK behavior
- API common middleware / CORS
- Cognito callback
- WebSocket ticket / authorizer / connection table
- direct origin / wildcard CORS / security regression tests

## 受け入れ条件分類

| 実装タスク | 対応する受け入れ条件 |
|---|---|
| SPA relative path | `AC-TC003-010`, `AC-TC003-011`, `AC-TC003-012`, `AC-TC003-035` |
| CloudFront/CDK behavior | `AC-TC003-001` から `AC-TC003-008`, `AC-TC003-036` から `AC-TC003-041`, `AC-TC003-031` |
| API common middleware / CORS | `AC-TC003-009`, `AC-TC003-013`, `AC-TC003-014`, `AC-TC003-015`, `AC-TC003-018` から `AC-TC003-023`, `AC-TC003-032`, `AC-TC003-034` |
| Cognito callback | `AC-TC003-016`, `AC-TC003-017` |
| WebSocket ticket / authorizer / connection table | `AC-TC003-024` から `AC-TC003-030`, `AC-TC003-034` |
| direct origin / wildcard CORS / security regression tests | `AC-TC003-001`, `AC-TC003-009`, `AC-TC003-010`, `AC-TC003-014`, `AC-TC003-018` から `AC-TC003-023`, `AC-TC003-031`, `AC-TC003-032`, `AC-TC003-035` |

## 実装前の追加タスク化方針

- 各実装タスクは、着手時に専用の `tasks/do/` ファイルへ分割する。
- CloudFront/CDK behaviorを実装するPRでは、WebSocket behaviorのHost header除外、query string転送、`Sec-WebSocket-Key` / `Sec-WebSocket-Version` 転送、cache disabledをCDK assertionで固定する。
- API common middlewareを実装するPRでは、本番CORS wildcard禁止、allowlist外preflight拒否、OPTIONS/public/protected endpointの共通処理、error sanitizeをAPI testで固定する。
- WebSocket ticket実装PRでは、TTL、1回利用、失敗時401/403、成功時connection保存をunit/integration testで固定する。

## 検証計画

- 実装タスクごとに `TC-003` の該当受け入れ条件をtest caseへ落とす。
- インフラ実装ではCDK assertionまたはsnapshot testを実行する。
- API実装ではAPI unit/contract testを実行する。
- Web UI実装ではweb unit/typecheck/buildを実行する。

## リスク

- 本ファイルは後続実装の追跡タスクであり、単独では `TC-003` を満たさない。
- 実AWS環境のCloudFront/WebSocket挙動は、CDK assertionだけでなくpreviewまたは検証環境での疎通確認が必要になる。
