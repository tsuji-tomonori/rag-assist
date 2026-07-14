# FR-084 isolated benchmark evaluation subject

- 要件ID: `FR-084`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-084`
- 関連カテゴリ: `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`

## 要件

- FR-084: システムは、benchmark 評価主体を server-side allowlist に登録された nonprivileged simulated identity に限定し、benchmark runner だけが isolated tenant/corpus 内で選択でき、実利用者の tenant または corpus access を拡張しないこと。

## 根拠と意図

評価 subject を request や dataset から任意指定できると、benchmark API が impersonation または権限拡張経路になる。評価専用 identity は通常利用者と分離し、実利用者向け route、token、session へ権限を波及させない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-084` |
| 説明 | runner 限定の allowlisted nonprivileged simulated benchmark subject |
| 根拠 | benchmark による impersonation、tenant 越境、通常 corpus access 拡張を防ぐ |
| 源泉 | `FR-040`、`apps/api/src/security/access-control-policy.test.ts`、`reports/working/20260502-1500-benchmark-runner-auth.md`、`reports/working/20260507-1308-benchmark-reset-documents.md` |
| Actor / trigger | benchmark runner が suite の評価 subject と corpus scope を解決するとき |
| 種類 | 機能要求 / evaluation / security |
| 依存関係 | `FR-040`, `FR-056`–`FR-060`, `FR-075` |
| 衝突 | dataset/user override や一般 route から任意 identity、tenant、corpus を指定する評価方式 |
| 受け入れ基準 | `AC-FR084-001`, `AC-FR084-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | QA / Security / RAG Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR084-001 runner-only simulated subject

- Given: approved suite に allowlisted nonprivileged simulated identity と isolated benchmark tenant/corpus が関連付けられている
- When: 認証済み benchmark runner が評価を開始する
- Then: server は allowlist から subject を解決し、その benchmark tenant/corpus の read/evaluate だけを許可して、通常 corpus の read、share、move、delete または管理操作を許可しない

### AC-FR084-002 no real-user access expansion

- Given: 通常利用者または user-controlled dataset が simulated identity、tenant、corpus、role の override を送信する
- When: 通常 API または benchmark API の認証・認可を評価する
- Then: override を拒否し、runner 以外に simulated subject を適用せず、実利用者の既存 tenant/corpus access と benchmark corpus access を一件も拡張しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 評価機能を impersonation と権限拡張経路にしないために必要 |
| 十分性 | OK | allowlist、非特権 identity、runner 限定、isolated scope、実利用者非拡張を含む |
| 理解容易性 | OK | benchmark の評価主体境界という一つの判断に限定した |
| 一貫性 | OK | `FR-040` の corpus 隔離と `FR-056`–`FR-060` の認可境界を強化する |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | runner route、server-owned suite manifest、subject allowlist、scoped policy で実現可能 |
| 検証可能性 | OK | runner positive、normal user override negative、cross-tenant/corpus matrix で確認できる |
| ニーズ適合 | OK | 本番認可を緩めずに再現可能な権限別 benchmark を行える |
| 実装適合 | OK（confirmed） | benchmark evaluation context が allowlisted suite、server-owned nonprivileged simulated subject/tenant/corpus だけを構築し、request override/cross-suite/cross-tenant を tests で拒否する |

## トレース

- 後方: `FR-040`、`apps/api/src/security/access-control-policy.test.ts`、`reports/working/20260502-1500-benchmark-runner-auth.md`、`reports/working/20260507-1308-benchmark-reset-documents.md`。
- 前方: benchmark subject registry、runner contract test、two-tenant/two-corpus negative matrix。
