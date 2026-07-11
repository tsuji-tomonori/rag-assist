# FR-080 role 付与・剥奪 guard

- 要件ID: `FR-080`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-080`
- 関連カテゴリ: なし

## 要件

- FR-080: システムは、role の付与または剥奪を確定する前に、actor の mutation permission、対象 principal の active・同一 tenant、`FR-079` の canonical role、変更理由、自己昇格・last-admin 喪失の禁止を一つの guard で検証し、許可された変更だけを authoritative identity の canonical role set へ確定すること。

## 根拠と意図

管理台帳だけを変更する role 操作は、Cognito/JWT の正本と乖離する。変更前 guard と authoritative role set の確定を一つの mutation contract にし、監査 payload は `FR-086`、session/worker の current authorization 反映は `FR-090` に分離する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-080` |
| 説明 | role grant/revoke の事前 guard と authoritative role set 確定 |
| 根拠 | self escalation、last admin 喪失、別 tenant 操作、stale session/worker 権限を防ぐ |
| 源泉 | `GAP-RD-022`, role assignment access-denied report、RAG ガイド §8.1.2–8.1.7 |
| Actor / trigger | 管理者が application role を principal へ付与または剥奪するとき |
| 種類 | 機能要求 / authorization / identity lifecycle |
| 依存関係 | `FR-056`, `FR-057`, `FR-060`, `FR-079`, `FR-086`, `FR-090`, authoritative identity adapter |
| 衝突 | 現行 role 操作は assign 中心で、revoke、last-admin、reason、session/worker 反映が一つの contract になっていない |
| 受け入れ基準 | `AC-FR080-001`, `AC-FR080-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Identity Platform / Audit |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR080-001 不正 mutation の全体拒否

- Given: actor に role mutation permission がない、target が inactive/別 tenant、role が catalog 外、reason が空、未承認の自己昇格、または変更後に administrative recovery principal が 0 になる条件のいずれかがある
- When: role grant または revoke を要求する
- Then: authoritative identity、管理台帳、session、queued work の role set を一切変更せず拒否する

### AC-FR080-002 canonical role set の確定

- Given: すべての guard を満たす reason 付き role grant/revoke と、`FR-086` に従う監査対象がある
- When: mutation を確定する
- Then: canonical role set を authoritative identity へ条件付き保存し、管理台帳だけの部分更新を成功扱いにせず、session/worker の再評価は `FR-090` に従う

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | role 管理操作そのものの privilege escalation と stale authorization を防ぐために必要 |
| 十分性 | OK | actor/target/tenant/catalog/reason/self/last-admin と authoritative role set の確定を扱う |
| 理解容易性 | OK | mutation 前の guard と確定後の期待状態を明示した |
| 一貫性 | OK | catalog は `FR-079`、監査 payload は `FR-086`、session/worker 再評価は `FR-090` に委譲した |
| 標準・契約適合 | OK | 一つの role mutation contract と専用 AC を一ファイルに記載した |
| 実現可能性 | OK | identity adapter と conditional update で実現可能 |
| 検証可能性 | OK | grant/revoke × actor/target/tenant/self/last-admin の mutation matrix test へ変換できる |
| ニーズ適合 | OK | 管理者が意図した role 変更を安全かつ実効状態へ反映できる |
| 原子性 | OK | role mutation を許可・確定する単一 contract を規定する |
| 実装適合 | NG/partial | ledger と Cognito/JWT の同期、revoke、last-admin guard が不足する |
| 合意 | pending | administrative recovery role と session revoke SLO を承認する必要がある |

## トレース

- 後方: `reports/bugs/20260506-2303-role-assignment-access-denied.md`, `apps/api/src/authorization.ts`, `GAP-RD-001`, `GAP-RD-022`。
- 前方: role mutation API、identity adapter contract test、`FR-086`, `FR-090`, `SQ-006`。
