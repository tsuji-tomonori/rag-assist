# 管理画面 未確定事項（2026-07）

## 記録規則

以下は repository evidence から確定できない。owner が決定するまで `open_question` とし、実装者が固定値、demo fallback、都合のよい既定値で埋めない。決定時は decision record、effective date、影響する requirement/spec/AC を更新する。

| ID | Owner | 決めること | 未決である根拠 / 影響 | 決定までの制約 | Trace |
| --- | --- | --- | --- | --- | --- |
| `OQ-AUI-001` | FinOps | production pricing の正本はAWS公開価格、契約価格、CUR/Billingのどれか |現行/PR candidateは固定価格、過去reportはBilling/CURを正本候補とする |金額をactual billと表現しない | `REQ-AUI-002`, `SPEC-AUI-002` |
| `OQ-AUI-002` | FinOps / Legal | discount、commitment、free tier、tax、currency conversionを推定へ含めるか |repositoryに計算契約がない |対象外項目とcurrencyをbreakdownに明示 | `AC-AUI-017`, `021`, `157` |
| `OQ-AUI-003` | FinOps / Platform | `actual`, `system_measured`, `estimated`, `missing` の正式定義 |現行benchmarkを根拠なくactualと表示する |provider請求quantity以外をactualと断定しない | `AC-AUI-004`, `017`, `020` |
| `OQ-AUI-004` | FinOps | decimal precision、rounding mode、UIの微小額表現 |現行4桁丸めは正値を0にし得る |内部値を丸めて保存せず、正値を0表示しない | `AC-AUI-018`, `022` |
| `OQ-AUI-005` | FinOps / Product | anomaly rule、budget threshold、比較期間と通知先 |chapterは異常表示を期待するが値がない |固定thresholdをUIへ埋め込まない | `AC-AUI-030`–`032`, `125` |
| `OQ-AUI-006` | Identity / Security | user status、application roles、resource groupsのauthoritative sourceと同期方向 |ledger/Cognito/JWTが別の真実を持つ |同期時に未知値をdrop/default化しない | `REQ-AUI-004`–`007` |
| `OQ-AUI-007` | Security / Product | system presetのみか、custom role create/updateを提供するか |permissionだけ存在しroute/UIはない |実行不能な編集controlを表示しない | `GAP-AUI-012`; `AC-AUI-052` |
| `OQ-AUI-008` | Security / Legal | deleteをsoft/hardどちらにし、PII・audit・関連履歴をどれだけ保持するか |現行はledger statusのみ |削除確認で未確定効果を断定しない | `REQ-AUI-006`; `AC-AUI-078` |
| `OQ-AUI-009` | Security / Identity | suspend/delete後の既存session/token失効上限 |Cognito disableだけでは既発行tokenの扱いが別途必要 |失効上限を満たすrequest-time enforcementなしに完了しない | `AC-AUI-072` |
| `OQ-AUI-010` | Product / Platform / Ops | user/event/auditのpage size、最大規模、latency SLO、sort key |実production規模・SLOが不明 |固定sliceを全件契約にしない | `AC-AUI-040`, `084`, `100`, `147` |
| `OQ-AUI-011` | Security / Compliance | audit retention、legal hold、削除条件 | `FR-086` はfieldを示すが期間は未確定 |期限を実装固定せずretention statusを監査 | `AC-AUI-105` |
| `OQ-AUI-012` | Security / Ops | auditの改変検知方式、SIEM転送、転送失敗時の運用 |単一JSON ledgerは要件を満たさないが採用基盤は未定 |少なくともversion/atomicity/alertを欠かさない | `REQ-AUI-008`, `SPEC-AUI-008` |
| `OQ-AUI-013` | Security / Privacy | audit/exportのPII allowlist、masking、signed URL expiry、download audit |現行exportとreportに統一policyがない |secret/token/raw prompt/権限外resourceを含めない | `AC-AUI-097`, `103`–`105`, `155` |
| `OQ-AUI-014` | Product / Ops | quality-action APIをoverviewへ統合するか廃止するか、cardのowner/expiry/dedupe |APIはあるがWeb consumerがない |scope外targetの件数を返さない | `GAP-AUI-025`; `AC-AUI-123`–`125` |
| `OQ-AUI-015` | Product / Accessibility QA | support browser、OS、screen reader、mobile device matrix |静的inventoryだけで実AT結果がない |最低限320px/400%/keyboard/contrastを省略しない | `REQ-AUI-012`; `AC-AUI-145` |
| `OQ-AUI-016` | Platform / Ops / FinOps | PR #339の再利用範囲、dual-read期間、許容差、cutover/rollback owner |未merge・current main差分・live未検証 |許容差超過またはlive未確認でcutoverしない | `REQ-AUI-013`; `AC-AUI-152`–`158` |
| `OQ-AUI-017` | Product / Security | `usage:read:own` / `cost:read:own` の本人向けsurfaceを提供するかpermissionを廃止するか |catalogにあるがconsumerがない |global routeへown permissionを誤適用しない | `GAP-AUI-036`; `AC-AUI-009`, `039` |
| `OQ-AUI-018` | Security | SYSTEM_ADMIN等の強権限grant/revokeに二者承認・step-up認証・cooldownが必要か |現行にも新要件にも運用決定がない |少なくともself/last-admin/same-tenant/reasonを必須にする | `REQ-AUI-005`; `AC-AUI-057`–`061` |
| `OQ-AUI-019` | Identity / Product | user create時の招待、temporary credential、email確認、初期role setのUX |現行ledger-only createからは決められない |実際にlogin不能なuserをactive成功と表示しない | `AC-AUI-069`, `070` |
| `OQ-AUI-020` | Product / Security | resource groupのowner/manager、membership、folder visibility、bulk操作のpolicy |chapterはgroup管理を期待するが現行surfaceがない |application roleと同じfield/controlで代替しない | `REQ-AUI-007`; `AC-AUI-087`, `092` |
| `OQ-AUI-021` | Search / RAG Governance | alias publish/reject/disableの承認者、理由必須transition、差分評価gate |現行固定理由/no-opと章仕様の期待に差がある |server state/version/reason/auditを最低条件にする | `REQ-AUI-011`; `AC-AUI-126`–`133` |
| `OQ-AUI-022` | Product / Localization |管理画面の正式な日本語用語、raw code表示、英語locale提供範囲 |section/raw role/permissionと日本語が混在 | role/group、利用量/料金、状態の概念を混同しない | `AC-AUI-144` |

## 決定テンプレート

各questionを閉じる際は次を記録する。

1. Decision と選択肢、選択理由、却下案。
2. Owner / approver、決定日、effective date、review date。
3. 更新する requirement/spec/AC/API/schema/permission/runbook。
4. migration/backfill、互換性、security/privacy/costへの影響。
5. 自動・手動・liveの検証方法とrollback条件。
