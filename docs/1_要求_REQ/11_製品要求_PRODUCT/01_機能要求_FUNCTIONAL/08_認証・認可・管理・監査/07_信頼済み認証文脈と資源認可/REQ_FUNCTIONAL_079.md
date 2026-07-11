# FR-079 canonical role catalog

- 要件ID: `FR-079`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-079`
- 関連カテゴリ: `7. 評価・debug・benchmark`

## 要件

- FR-079: システムは、application role と permission の対応を一つの versioned canonical role catalog で定義し、identity provisioning、API 認可、Web capability、infra group、非同期 worker が同じ catalog version から role を解決すること。

## 根拠と意図

backend、infra、Web が別々の role 一覧を持つと、付与できない role、UI と API の不一致、stale worker permission が生じる。application role の namespace は resource group ID と分離し、未知 role を既知 group や既定 role として解釈しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-079` |
| 説明 | 全認証・認可面が参照する versioned canonical application-role catalog |
| 根拠 | role/permission drift と付与不能・過剰許可を防ぐ |
| 源泉 | `GAP-RD-022`, 現行 `authorization.ts` と Cognito group catalog の差分、role assignment 障害レポート |
| Actor / trigger | role の provision、解決、表示、認可、worker context 復元を行うとき |
| 種類 | 機能要求 / authorization governance |
| 依存関係 | `FR-056`, `FR-057`, identity adapter、catalog version propagation |
| 衝突 | backend role と Cognito group の件数・名称が一致せず、resource group と同じ文字列配列を共有する経路がある |
| 受け入れ基準 | `AC-FR079-001`, `AC-FR079-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Identity Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR079-001 全面の catalog 一致

- Given: canonical catalog version N に role R と permission set P が定義されている
- When: R を identity に付与し、API、Web、infra、worker で解決する
- Then: 各面は version N の R と P を同じ application-role namespace で解決する

### AC-FR079-002 未知 role と drift の fail closed

- Given: identity claim、設定、Web capability、infra group のいずれかに version N へ存在しない role、異なる permission set、または resource group ID の role 利用がある
- When: catalog consistency check または認可文脈構築を行う
- Then: 未知値を既定 role へ補完せず拒否し、drift を release/configuration error として記録する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | role を付与する面と強制する面の drift を防ぐために必要 |
| 十分性 | OK | 正常な version 一致と未知・不一致・namespace 混用を扱う |
| 理解容易性 | OK | canonical 対象、consumer、failure behavior を明示した |
| 一貫性 | OK | verified context は `FR-056`、個別 mutation は `FR-080` に分離した |
| 標準・契約適合 | OK | 一つの catalog authority invariant と専用 AC を一ファイルに記載した |
| 実現可能性 | OK | generated/shared catalog artifact と startup/CI consistency check で実現可能 |
| 検証可能性 | OK | backend/infra/Web/worker catalog contract test へ変換できる |
| ニーズ適合 | OK | 管理者が選択した role と実際の権限を一致させる |
| 原子性 | OK | role catalog の source of truth を一つにするという一つの invariant を規定する |
| 実装適合 | NG/conflict | backend 12 role と Cognito 9 group が一致せず複数定義がある |
| 合意 | pending | canonical catalog の owner と version rollout 手順を承認する必要がある |

## トレース

- 後方: `apps/api/src/authorization.ts`, `infra/lib/memorag-mvp-stack.ts`, `reports/bugs/20260506-2303-role-assignment-access-denied.md`, `GAP-RD-022`。
- 前方: generated role catalog、catalog parity test、role selector、`FR-080`。
