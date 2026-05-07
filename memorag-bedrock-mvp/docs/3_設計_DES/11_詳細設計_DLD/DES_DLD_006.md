# 文書取り込み・知識ベース詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_006.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-07
- 状態: Draft

## 何を書く場所か

文書取り込み、memory/evidence 生成、文書台帳、index lifecycle の入出力、処理手順、例外処理、テスト観点を定義する。

## 対象

- Ingestion Handler
- Memory Builder
- Document Catalog
- Index Lifecycle Manager
- source text / manifest / evidence chunk
- blue-green reindex stage / cutover / rollback

## 関連要求

- `FR-001`
- `FR-002`
- `FR-007`
- `FR-008`
- `FR-020`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `ingest_document` | fileName、text、metadata、user context | documentId、source text reference、draft manifest |
| `build_memory_and_evidence` | source text、document metadata、chunk policy | memory records、evidence chunks、chunk manifest |
| `stage_index` | evidence chunks、indexVersion candidate | staged index manifest、validation summary |
| `cutover_index` | staged indexVersion、current indexVersion | active indexVersion、cutover result |
| `rollback_index` | previous indexVersion、active indexVersion | restored active indexVersion、rollback result |
| `delete_document` | documentId、user context | deletion marker、updated catalog status |

## データ責務

| データ | 正本 | 説明 |
|---|---|---|
| source text | object storage または local data store | 取り込み元文書本文。回答 API へ直接露出しない。 |
| manifest | Document Catalog | 文書 ID、metadata、status、indexVersion、source text reference を保持する。 |
| memory record | Memory Builder output | 文書の要約的・抽象的な記憶表現。質問理解や clue 生成に使う。 |
| evidence chunk | search index / vector store | 回答根拠として引用可能な最小単位。chunk id と source location を持つ。 |
| lifecycle event | Document Catalog / Debug Trace Store | stage、cutover、rollback、delete の操作証跡。 |

## 処理手順

### 文書登録

1. API は文書管理 permission と入力サイズ、fileName、metadata schema を検証する。
2. Ingestion Handler は documentId を採番し、source text reference と draft manifest を作成する。
3. Ingestion Handler は metadata のうち検索 filter に使う項目と内部項目を分離する。
4. Memory Builder は chunk policy に従って source text を分割する。
5. Memory Builder は memory record と evidence chunk を生成し、chunk id、source location、documentId を付与する。
6. Document Catalog は status を `indexed_pending_cutover` または同等の staged 状態へ更新する。
7. Debug Trace Store は ingest summary、chunk count、indexVersion candidate を保存する。

### 文書の QA 利用可能化

1. Index Lifecycle Manager は staged index を作成する。
2. staged index の chunk count、manifest consistency、vector metadata、ACL metadata を検証する。
3. 検証が通った場合だけ active indexVersion へ cutover する。
4. cutover 後、Document Catalog は対象 document を QA 利用可能状態へ更新する。
5. 検証が失敗した場合は active indexVersion を変更せず、失敗理由を lifecycle event として保存する。

### 文書削除

1. API は文書削除 permission と documentId の存在を検証する。
2. Document Catalog は削除対象を logical delete 状態にする。
3. Index Lifecycle Manager は削除済み文書を含まない staged index を作る。
4. 検証後に cutover し、active index から対象 document の evidence chunk を除外する。
5. rollback 可能期間中は previous indexVersion と deletion marker を保持する。

### rollback

1. 運用担当者は previous indexVersion と rollback 理由を指定する。
2. API は rollback permission を検証する。
3. Index Lifecycle Manager は previous indexVersion の manifest と storage reference が存在することを確認する。
4. active indexVersion を previous indexVersion へ戻す。
5. Document Catalog と Debug Trace Store に rollback event を保存する。

## 境界と制約

- Ingestion Handler は検索順位、回答生成、回答可否判定を行わない。
- Memory Builder は benchmark dataset 固有の期待語句や QA sample 固有値を chunk 生成へ埋め込まない。
- manifest metadata は任意 JSON を保存できても、通常検索 response へ返す metadata は allowlist で制限する。
- ACL metadata は候補生成と後段 guard の両方で使える形にする。
- active indexVersion の切り替えは request 中に変化しない単位で扱う。

## エラー処理

| 事象 | 方針 |
|---|---|
| metadata validation 失敗 | 400 相当として取り込みを拒否し、source text を保存済み正本にしない。 |
| source text 保存失敗 | document status を QA 利用可能にせず、失敗理由を返す。 |
| memory/evidence 生成失敗 | staged index を作らず、active indexVersion を維持する。 |
| staged index 検証失敗 | cutover しない。既存 index を維持し、validation summary を保存する。 |
| rollback 対象不在 | rollback を拒否し、active indexVersion を変更しない。 |
| 削除対象が存在しない | not found とし、他文書の indexVersion を変更しない。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| 文書登録 | manifest、source text reference、documentId が生成される。 |
| evidence 生成 | chunk id、documentId、source location が欠落しない。 |
| QA 利用可能化 | staged index 検証後にだけ active indexVersion が更新される。 |
| cutover 失敗 | active indexVersion が維持される。 |
| rollback | previous indexVersion へ戻り、rollback event が残る。 |
| 文書削除 | logical delete と再 index により検索対象から除外される。 |
| metadata 非漏えい | `searchAliases`、ACL metadata、内部 project code が通常 response に出ない。 |
| dataset 固有分岐防止 | benchmark 期待語句や sample ID に依存した chunk 補正がない。 |
