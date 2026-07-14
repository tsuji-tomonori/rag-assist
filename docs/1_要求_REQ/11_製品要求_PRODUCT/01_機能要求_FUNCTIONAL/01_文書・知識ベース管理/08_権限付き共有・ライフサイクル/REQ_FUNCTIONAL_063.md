# FR-063 文書実効権限の優先順位付き合成

- 要件ID: `FR-063`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-063`
- 関連カテゴリ: `8. 認証・認可・管理・監査`, `3. RAG検索品質制御`

## 要件

- FR-063: システムは、文書の実効権限を、強制 deny、管理主体 invariant、通常 policy の explicit deny、文書直接 grant、所属フォルダーの実効権限の順序を定めた一つの versioned 合成規則で算出すること。

## 規範的な優先順位

1. verified identity 不成立、account 非 active、authoritative tenant 欠損・不一致、文書 lifecycle 非 active、文書 identity/integrity 不成立は強制 deny とし、すべての principal を `none` にする。
2. 強制 deny がなく、資源 record で確認できる active same-tenant owner/adminPrincipal には `FR-077` の `full` invariant を適用する。
3. その他の principal は、policy 欠損・読取不能を `none` とし、通常 policy の explicit deny を direct/folder allow より優先する。
4. 残る複数 allow path は承認済み versioned rule で合成し、入力、寄与、最終結果、deny reason を同じ decision schema で返す。

通常 policy に owner/adminPrincipal を対象とする explicit deny を保存すること自体を `FR-077` で拒否する。したがって、本要件の「explicit deny 優先」は非管理主体に対する通常 policy、または全 principal に対する上記の強制 deny を指す。

## 根拠と意図

現行は直接 grant と folder permission の max を取るが、明示 deny、複数 folder、direct `full` が許す管理操作の合意がない。規則を一意にし、全経路へ適用する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-063` |
| 説明 | mandatory deny、administrative-principal invariant、ordinary deny、direct/folder grant の deterministic composition |
| 根拠 | 同じ文書に複数の許可経路がある場合の一貫性 |
| 源泉 | RAG ガイド §3.5.7–3.5.8（PDF p.80）、現行 `DocumentPermissionService` |
| Actor / trigger | document list/read/share/move/delete/reindex/search |
| 種類 | 機能要求 / authorization |
| 依存関係 | `FR-057`, `FR-061`, `FR-077` |
| 衝突 | 実装は max、章仕様は source folder full を要求する操作がある |
| 受け入れ基準 | `AC-FR063-001`, `AC-FR063-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Product / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR063-001 deny と管理主体 invariant の優先順位

- Given: direct または folder allow があり、同時に account/tenant/lifecycle の強制 deny、または非管理主体に対する通常 policy の explicit deny がある
- When: 文書実効権限を算出する
- Then: 強制 deny は principal の種別にかかわらず `none`、通常 policy の explicit deny は非管理主体を `none` にし、強制 deny のない active same-tenant owner/adminPrincipal だけは `FR-077` に従って `full` とする

### AC-FR063-002 許可経路の一貫合成

- Given: 同一 tenant の active 文書に direct grant と複数 folder grant がある
- When: list、search、memory、citation、operation guard で評価する
- Then: versioned policy に定義した同じ合成結果を返し、各寄与と deny reason を監査可能にする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | direct、folder、deny の複数経路で同じ文書の権限結果が変わることを防ぐために必要 |
| 十分性 | OK | mandatory deny、管理主体 invariant、ordinary explicit deny、direct grant、複数 folder grant、寄与と reason の記録を扱う |
| 理解容易性 | OK | mandatory deny と通常 policy deny を区別し、管理主体 invariant を含む優先順位と versioned rule を明示した |
| 一貫性 | OK | folder 算出 `FR-061`、操作別権限 `FR-076`、owner invariant `FR-077` と責務を分離した |
| 標準・契約適合 | OK | deterministic decision、deny priority、document-to-chunk authorization 維持に適合する |
| 実現可能性 | OK | `DocumentPermissionService` の decision schema と versioned composition rule を拡張できる |
| 検証可能性 | OK | direct×folder×deny×multi-folder×operation の matrix test で確認できる |
| ニーズ適合 | OK | 共有方法や利用経路が変わっても文書権限を予測可能にする |
| 原子性 | OK | document permission の合成規則だけを規定する |
| 実装適合 | OK（confirmed） | `document-permission-service.ts` が mandatory deny→ordinary deny→administrative principal→direct/folder allow の合成順を固定し、contribution 付き matrix test を持つ |
| 合意 | pending | direct `full` の操作範囲と max/min を承認する必要がある |

## トレース

- 後方: `document-permission-service.ts:68-91,309-325`、章仕様 move 条件。
- 前方: `FR-064`–`FR-066`, `FR-070`, `FR-077`, permission decision record。
