# FR-067 一時添付の所有者・会話・期限境界

- 要件ID: `FR-067`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-067`
- 関連カテゴリ: `2. チャットQA・根拠提示・回答不能制御`, `3. RAG検索品質制御`

## 要件

- FR-067: システムは、一時添付を owner、tenant、chat scope、expiry に限定し、永続文書一覧または別会話の検索対象へ含めないこと。

## 根拠と意図

一時添付は永続共有資料と異なる資源であり、同じ ACL fallback を使うと別会話や別利用者へ混入する。一時性は UI 非表示だけでなく検索・cache・cleanup まで強制する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-067` |
| 説明 | temporary attachment の owner/chat/expiry isolation |
| 根拠 | 別会話・別利用者・期限後の検索混入を防ぐ |
| 源泉 | 旧 `FR-041`, RAG ガイド §8.1.5（PDF p.188） |
| Actor / trigger | user が chat へ一時文書を添付・検索するとき |
| 種類 | 機能要求 / security / lifecycle |
| 依存関係 | `FR-056`, `FR-060`, `FR-066`, `FR-070` |
| 衝突 | 旧 `FR-041` は永続共有と一時添付を一要求に含む |
| 受け入れ基準 | `AC-FR067-001`〜`AC-FR067-004` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Product / Security |
| 変更履歴 | 2026-07-11 初版、2026-07-17 authoritative session context と回答前再認可を追加 |

## 受け入れ条件

### AC-FR067-001 scope isolation

- Given: user A/chat X の未期限切れ一時添付がある
- When: user B、chat Y、通常 documents list、scope 指定なし検索から参照する
- Then: 題名、本文、chunk、memory、citation を候補または response に含めない

### AC-FR067-002 expiry と再認可

- Given: 一時添付が期限切れ、owner suspended、tenant/chat scope 不一致のいずれかである
- When: queued run、retry、cache hit を含む検索を行う
- Then: 現在条件で拒否し、cleanup 対象として追跡する

### AC-FR067-003 authoritative scope normalization

- Given: tenant+user+session に束縛された `sessionDocumentContext` が active/terminal な一時 evidence reference を保持する
- When: `/chat`、`/chat-runs`、`/search` が通常 scope と一時 scope を正規化する
- Then: active かつ current authorization を満たす最大20件だけを通常 scope へ合成し、client request だけでは一時 scope を追加または terminal state から復活できない

### AC-FR067-004 answer/citation/trace boundary

- Given: 検索開始後に一時 evidence の owner、tenant、session scope、expiry、document permission のいずれかが無効になる
- When: 回答生成前または citation 確定前に current evidence を再認可する
- Then: 対象 source document/chunk を回答と citation から除外し、十分な根拠が残らなければ回答不能とする。user-safe trace は件数と bounded reason code だけを記録し、tenant/user/session ID または権限外資源の存在を列挙しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 一時添付が別利用者、別会話、通常文書一覧、期限後の検索へ混入することを防ぐために必要 |
| 十分性 | OK | owner、tenant、chat scope、expiry、一覧非表示、authoritative normalization、queued/cache/answer 前再確認を扱う |
| 理解容易性 | OK | 一時資源を利用できる主体・会話・期間と禁止対象を明示した |
| 一貫性 | OK | tenant は `FR-060`、deny-first cleanup は `FR-066`、検索再認可は `FR-070` に委譲した |
| 標準・契約適合 | OK | RAG ガイドの session separation、data minimization、expiry hard filter に適合する |
| 実現可能性 | OK | protected metadata、scope filter、expiry check、cleanup ledger で実現できる |
| 検証可能性 | OK | owner×chat×tenant×expiry×queued run/cache の否定 matrix で確認できる |
| ニーズ適合 | OK | 利用者が会話内だけで資料を安全に使い、永続共有へ意図せず残さない |
| 原子性 | OK | temporary resource の境界を規定する |
| 実装適合 | OK（confirmed） | temporary attachment は B1 context から scope を正規化し、current tenant/owner/chat/expiry を search と answer/citation 確定前に強制する。client-only scope、terminal/expired scope、cross-owner/session、multi-scope retrieval、bounded trace summary の direct tests を持つ |
| 合意 | pending | expiry 値と legal retention は未確定 |

## トレース

- 後方: 旧 `FR-041`, `document-routes.ts:165-175`。
- 前方: temporary store/index/cache cleanup、multi-user E2E。
