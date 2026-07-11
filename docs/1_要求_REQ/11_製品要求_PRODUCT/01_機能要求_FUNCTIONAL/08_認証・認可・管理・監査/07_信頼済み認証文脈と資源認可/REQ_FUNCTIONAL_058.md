# FR-058 アカウント状態とセッション失効

- 要件ID: `FR-058`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-058`
- 関連カテゴリ: `7. 評価・debug・benchmark`

## 要件

- FR-058: システムは、アカウントの停止または削除を authoritative identity source と既存 session に反映し、その actor による新規操作、待機中処理、永続化を拒否すること。

## 根拠と意図

管理台帳の表示だけを suspended にしても、JWT と Cognito user が有効なら操作は続行できる。長時間 run は submit 時だけでなく開始時と commit 前にも現在状態を確認する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-058` |
| 説明 | account lifecycle と session/worker 失効の一貫反映 |
| 根拠 | 停止・退職・削除後の利用継続を防ぐ |
| 源泉 | RAG ガイド §8.1.7（PDF pp.188–189）、現行 account audit |
| Actor / trigger | 管理者が suspend/delete/restore したとき、worker が開始・commit するとき |
| 種類 | 機能要求 / security |
| 依存関係 | identity directory, token revocation, `FR-057`, `FR-090`, `SQ-006` |
| 衝突 | 管理 API は現在 admin ledger の status だけを更新する |
| 受け入れ基準 | `AC-FR058-001`, `AC-FR058-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Identity / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR058-001 停止反映

- Given: active user が有効 session と queued run を持つ
- When: 管理者が user を suspended または deleted にする
- Then: identity source を更新し、既存 session を失効させ、以後の API と worker 実行を拒否する

### AC-FR058-002 失効処理の不完全成功禁止

- Given: account status の authoritative update、session/token revoke、管理台帳更新のいずれかが失敗する
- When: suspend または delete の結果を確定する
- Then: account を active のまま成功表示せず、deny-first の失効状態と reconciliation 対象を記録し、長時間処理の再評価は `FR-090` に従う

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 停止・削除後も有効 token や queued run で操作を継続できる状態を防ぐために必要 |
| 十分性 | OK | authoritative identity、既存 session、管理台帳、部分失敗時の deny/reconciliation を扱う |
| 理解容易性 | OK | account lifecycle event と不完全成功の扱いを明示した |
| 一貫性 | OK | worker の account/role/resource 再評価は `FR-090`、伝播時間は `SQ-006` に分離した |
| 標準・契約適合 | OK | RAG ガイドの current authorization と revocation propagation 原則に適合する |
| 実現可能性 | OK | identity adapter、session revoke、管理台帳を transaction/outbox で接続できる |
| 検証可能性 | OK | active token を持つ user の suspend/delete と identity/session/ledger 部分失敗で確認できる |
| ニーズ適合 | OK | 退職・停止・削除された利用者のアクセスを速やかに止められる |
| 原子性 | OK | account lifecycle の強制反映を規定する |
| 実装適合 | NG | `memorag-service.ts:1498-1509`; `UserDirectory` に disable/revoke がない |
| 合意 | pending | 反映 SLO と deleted user の保持方針は未確定 |

## トレース

- 後方: `reports/working/20260514-1529-b-authorization-3layer.md`, `GAP-RD-001`, `GAP-RD-011`。
- 前方: identity adapter、session/token revoke、account lifecycle reconciliation、`FR-090`, `SQ-006`, account audit。
