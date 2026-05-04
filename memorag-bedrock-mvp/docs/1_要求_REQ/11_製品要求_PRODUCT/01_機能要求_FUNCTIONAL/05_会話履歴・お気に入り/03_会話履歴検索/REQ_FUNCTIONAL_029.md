# 要件定義（1要件1ファイル）

- 要件ID: `FR-029`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `5. 会話履歴・お気に入り`
- L2主機能群: `5.3 会話履歴検索`
- L3要件: `FR-029`
- 関連カテゴリ: なし

## 要件

- FR-029: 利用者は取得済みの自分の会話履歴を、表記ゆれ、部分一致、軽い英数字 typo を吸収して検索できること。

## 受け入れ条件（この要件専用）

- AC-FR029-001: 履歴検索は `/conversation-history` で取得した認証済み userId の履歴だけを対象にし、他 userId の履歴を検索対象に含めないこと。
- AC-FR029-002: 検索語は URL query に載せず、画面内の取得済み履歴に対して filter すること。
- AC-FR029-003: 検索は NFKC 正規化と lowercase により、全角・半角、大小文字の違いを吸収すること。
- AC-FR029-004: 日本語の連続語は 2-gram / 3-gram により、`経費精算`、`経費 精算`、`経費の精算` のような部分一致を扱えること。
- AC-FR029-005: 英数字は prefix と Levenshtein 距離 1 から 2 の軽い typo 補正を扱えること。ただし typo 補正は 4 文字以上の ASCII token に限定すること。
- AC-FR029-006: 検索対象は `title`、user / assistant message text、`sourceQuestion`、`questionTicket.title`、`questionTicket.question`、citation fileName に限定し、retrieved full text、debug trace、内部メモなどの内部 metadata は検索対象にしないこと。
- AC-FR029-007: 検索結果の並び順は完全一致と user message の一致を優先し、同程度のスコアではお気に入りと更新日時を tie-break に使うこと。
- AC-FR029-008: 検索結果の snippet は該当 message または問い合わせ title/question の短い抜粋に限定し、debug trace や内部 metadata を表示しないこと。

## 要件の源泉・背景

- 源泉: 会話履歴の Phase 1 あいまい検索実装方針。
- 背景: 既存 UI の履歴検索は lowercase 部分一致のみであり、全半角、表記ゆれ、日本語の連続語、軽い英数字 typo で過去会話を見つけにくかった。
- 背景: 会話履歴は本人データであるため、MVP では LLM や embedding を使う semantic search ではなく、取得済み本人履歴に閉じた lightweight lexical fuzzy search を優先する。

## 要件の目的・意図

- 意図: 個人履歴のプライバシー、削除同期、コストを増やさずに、履歴再発見性を改善する。
- 意図: 将来 server-side search を追加する場合も、検索対象フィールドと内部 metadata 非表示の境界を維持できるようにする。

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/01_会話履歴管理/REQ_FUNCTIONAL_022.md`
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/02_お気に入り管理/REQ_FUNCTIONAL_028.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
