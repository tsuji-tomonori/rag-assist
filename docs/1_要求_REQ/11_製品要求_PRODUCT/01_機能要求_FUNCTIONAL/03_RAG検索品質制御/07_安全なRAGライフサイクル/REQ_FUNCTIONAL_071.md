# FR-071 非信頼根拠と prompt injection 防御

- 要件ID: `FR-071`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-071`
- 関連カテゴリ: `4. 回答検証・ガードレール`, `8. 認証・認可・管理・監査`

## 要件

- FR-071: システムは、取得文書、metadata、file name、会話、tool output を非信頼データとして扱い、その内部命令で system policy、認可、秘密情報、tool 実行を変更させないこと。

## 根拠と意図

XML escape は delimiter breakout を減らすが、文書に書かれた命令を意味的に拒否する保証ではない。取り込み、検索、生成、tool、出力で多層防御する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-071` |
| 説明 | direct/indirect prompt injection と poisoning の多層防御 |
| 根拠 | retrieved content による instruction override と data exfiltration を防ぐ |
| 源泉 | RAG ガイド §6.1.2（PDF p.146）、§8.3（PDF pp.193–194） |
| Actor / trigger | ingest、prompt build、generation、tool call、output validation |
| 種類 | 機能要求 / security |
| 依存関係 | `FR-068`–`FR-070`, tool authorization |
| 衝突 | 現行 prompt は evidence 限定だが untrusted instruction rule/detector/corpus がない |
| 受け入れ基準 | `AC-FR071-001`, `AC-FR071-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / RAG Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR071-001 instruction separation

- Given: 文書または metadata に system prompt 開示、ACL 無視、別文書取得、tool 実行を命じる文字列がある
- When: ingest/search/generation/tool planning を行う
- Then: データとして隔離し、命令として実行せず、認可・秘密・tool policy を deterministic code で維持する

### AC-FR071-002 検出・隔離

- Given: 文書または tool output に instruction override、secret exfiltration、policy bypass の疑いがある
- When: ingest または prompt assembly を行う
- Then: 承認済み policy に従って検出結果を記録し、対象を隔離または安全なデータ表現へ限定して、疑わしい命令を実行経路へ渡さない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 取得内容を命令として実行する攻撃を防ぐ |
| 十分性 | OK | ingest、prompt、tool、output の信頼境界を含む |
| 理解容易性 | OK | 公開 gate は `FR-075` へ分離した |
| 一貫性 | pending | threat model と false-positive は `Q-003` |
| 標準・契約適合 | OK | 1 要求 1 instruction isolation invariant と専用 AC を満たす |
| 実現可能性 | OK | delimiter、policy、detector、quarantine の多層制御で実現可能 |
| 検証可能性 | OK | injection corpus と tool/secret leak assertions |
| ニーズ適合 | OK | 根拠利用を維持しながら policy override を防ぐ |
| 実装適合 | partial/NG | structural escape はあるが semantic defense と quarantine はない |

## トレース

- 後方: `GAP-RD-014`, `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` の prompt injection gap。
- 前方: threat model、ingest quarantine、prompt contract、`FR-075`, `SQ-005`。
