# Conversation History Service 抽出 詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- 種別: `DES_DLD`
- 要件ID: Issue-359-Phase4p
- 作成日: 2026-07-18
- 状態: Draft

## 目的

`MemoRagService` に残る conversation history の save/list/get/delete orchestration を `ConversationHistoryService` へ分離し、PR #387 が確立した session-local evidence の認可境界と API 契約を維持する。

## 責務と依存境界

`ConversationHistoryService` は次の narrow ports だけを受け取る。

- conversation history store の save/list/get/delete
- favorite store の list
- tenant/user partition key resolver
- session document context resolver
- conversation history normalizer
- display comparator

session document context の所有者、tenant、scope、expiry、terminal 非復活の判断は service 内へ移動しない。`MemoRagService.resolveSessionDocumentContext` を callback として注入し、authorization が完了した値だけを save へ渡す。

## 処理契約

### save

1. subject と tenant から owner key を一度解決する。
2. facade の session document context resolver を呼ぶ。
3. resolver が成功した場合だけ、解決済み context と `isFavorite: false` を含む入力を同じ owner partition へ保存する。
4. resolver/store failure はそのまま伝播し、成功を返さない。

### list

1. 同じ owner key で history と favorites を取得する。
2. 各 history を schema version 3 の canonical item へ normalize する。
3. `targetType=chatSession` の favorite だけを `isFavorite` に投影する。
4. favorite を先頭、同一区分は `updatedAt` 降順にし、先頭20件を返す。

### get

同じ owner partition の id だけを取得する。存在時は normalize し、不在時は `undefined` を返す。route は従来どおり `undefined` を 404 に変換する。

### delete

同じ owner partition で get を先行する。不在なら store delete を呼ばず `false`、存在すれば delete 成功後に `true` を返す。route は `false` を 404 に変換する。

## セキュリティと no-mock 境界

- route-level `chat:read:own`、`chat:create`、`chat:delete:own` は変更しない。
- tenant/user partition key の fail-closed behavior は既存 resolver を再利用する。
- session-local evidence の current manifest/owner/tenant/session/TTL 検証を変更しない。
- missing item は他 owner の存在を列挙せず、同じ not-found contract とする。
- 架空 history、favorite、session context、fallback tenant を生成しない。

## 受け入れ条件

- AC-359-4P-001: resolver failure 後に store save が実行されない。
- AC-359-4P-002: four methods が単一 owner partition を維持する。
- AC-359-4P-003: list の normalize/favorite/order/20件を維持する。
- AC-359-4P-004: get/delete の not-found と store failure を維持する。
- AC-359-4P-005: routes/schema/permission/session-context security/RAG reauthorization に差分がない。

## 検証

service unit test、temporary attachment boundary test、API full suite、root CI、OpenAPI/API-code docs freshness checkを実行する。actual AWS/DynamoDB と manual UI は本抽出の対象外とする。

## stacked integration

本設計は PR #387 current head `9a215ac08e5788c9dbb74b48e94b2243c85f609d` を exact base とする stacked Draft PR である。#387 が更新された場合は、session-context contract と generated docs を再監査して rebase/再検証する。
