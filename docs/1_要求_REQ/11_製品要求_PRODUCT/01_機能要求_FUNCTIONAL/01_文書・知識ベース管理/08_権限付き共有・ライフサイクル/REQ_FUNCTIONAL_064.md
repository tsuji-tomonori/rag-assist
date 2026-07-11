# FR-064 read-only 共有資源の発見・選択

- 要件ID: `FR-064`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-064`
- 関連カテゴリ: `2. チャットQA・根拠提示・回答不能制御`, `8. 認証・認可・管理・監査`

## 要件

- FR-064: システムは、`readOnly` 以上の実効権限を持つ利用者に、許可されたフォルダーと文書を発見・閲覧し、チャットの検索 scope として選択する導線を提供すること。

## 根拠と意図

共有 API が正しくても、一般利用者が共有資料を発見・選択できなければ共有という利用目的を満たさない。read-only と管理 UI は分離する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-064` |
| 説明 | read-only shared resource の discovery/view/chat scope UX |
| 根拠 | 共有された資料を一般利用者が実際に利用できるようにする |
| 源泉 | 文書共有 reports、`CHAT_USER` permission、現行 Web audit |
| Actor / trigger | `CHAT_USER` 等が documents/chat を開くとき |
| 種類 | 機能要求 / UI |
| 依存関係 | `FR-061`, `FR-063`, server capabilities |
| 衝突 | 現行 Web は documents view を manage permission だけで表示する |
| 受け入れ基準 | `AC-FR064-001`, `AC-FR064-002` |
| 優先度 | A |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Product / Web |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR064-001 read-only 利用

- Given: 利用者が folder または document に `readOnly` を持ち、管理 permission を持たない
- When: Web を開く
- Then: 許可資源の最小 summary を表示し、閲覧、許可された download、chat scope 選択を提供する

### AC-FR064-002 管理操作の分離

- Given: 同じ利用者が共有方針変更、移動、削除、reindex を試みる
- When: server capability が `false` または欠損である
- Then: 操作を表示・実行せず fail closed にし、ACL principal や非公開 metadata を summary に含めない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | read-only 共有を受けても資料を発見・選択できない現状を解消するために必要 |
| 十分性 | OK | safe summary、閲覧、許可 download、chat scope 選択、管理操作拒否を扱う |
| 理解容易性 | OK | read-only actor が利用できる操作と禁止される管理操作を分けて記述した |
| 一貫性 | OK | server enforcement は `FR-057` / `FR-076`、document permission は `FR-063` に委譲した |
| 標準・契約適合 | OK | least privilege と server capability を正とする fail-closed UI 原則に適合する |
| 実現可能性 | OK | reader summary endpoint、capability response、read-only workspace で実現できる |
| 検証可能性 | OK | owner↔CHAT_USER の direct/folder share Web E2E で確認できる |
| ニーズ適合 | OK | 一般利用者が管理権限なしで許可資料を RAG の根拠として利用できる |
| 原子性 | OK | read-only resource 利用導線を規定する |
| 実装適合 | NG | `usePermissions.ts:39-49`, `AppRoutes.tsx:43-50` |
| 合意 | pending | download 可否と summary allowlist を承認する |

## トレース

- 後方: `GAP-RD-006`, 2026-05-21 share/move UI reports。
- 前方: Web navigation、DocumentWorkspace read-only mode、ChatComposer scope selector。
