# 会話履歴・お気に入り・人手問い合わせ詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_007.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-07
- 状態: Draft

## 何を書く場所か

会話履歴、お気に入り、回答不能時の人手問い合わせをユーザー境界付きで扱う設計を定義する。

## 対象

- Conversation History Store
- Favorite Store
- Conversation Search Index
- Human Question Store
- Answer Draft Manager
- Assignee Workflow

## 関連要求

- `FR-021`
- `FR-022`
- `FR-028`
- `FR-030`
- `NFR-005`
- `NFR-011`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `save_conversation_item` | userId、conversationId、message item、schemaVersion | saved item、updated conversation summary |
| `list_conversations` | userId、pagination、filters | user-scoped conversation list |
| `search_conversations` | userId、query、filters | matching conversation summaries |
| `set_favorite` | userId、conversationId、itemId、favorite state | favorite state |
| `create_human_question` | userId、conversationId、original question、refusal metadata | ticketId、ticket status |
| `update_human_answer` | assignee user、ticketId、draft answer、status | updated ticket、audit event |

## データ責務

| データ | 所有境界 | 説明 |
|---|---|---|
| conversation item | userId | 質問、回答、拒否、引用、trace reference、schemaVersion を保持する。 |
| favorite state | userId | 利用者が保存した conversation item または conversation summary を示す。 |
| conversation search index | userId | 履歴検索用の軽量 index。権限外 userId の item を返さない。 |
| human question ticket | userId と担当者 permission | 回答不能時の問い合わせ、状態、担当者、回答案を保持する。 |
| answer draft | 担当者 permission | 担当者による回答案。公開前後の状態を持つ。 |

## 処理手順

### 会話履歴保存

1. Web UI は `/chat` の結果を `schemaVersion` 付き conversation item として保存 API に送る。
2. API は認証済み userId と request userId の一致を確認する。
3. Conversation History Store は conversationId が未指定の場合に新規 conversation を作る。
4. item には responseType、citations、answerability reason、trace reference を保存する。
5. 保存後、conversation summary と検索 index を更新する。

### 会話履歴表示・検索

1. API は userId と pagination を受け取り、所有者境界で conversation list を返す。
2. conversation detail は同一 userId の conversationId だけ取得できる。
3. Conversation Search Index は userId と query で絞り込む。
4. 検索結果には raw prompt、内部 debug trace、権限外 chunk text を含めない。

### お気に入り

1. 利用者は conversation または conversation item をお気に入りに設定する。
2. Favorite Store は userId、target id、favorite state を保存する。
3. お気に入り一覧は userId で分離し、削除済み conversation は通常一覧から除外する。
4. favorite state は回答内容の正本ではなく、履歴 item への参照として扱う。

### 人手問い合わせ

1. 回答不能または利用者が追加確認を求める場面で、Web UI は問い合わせ作成 API を呼ぶ。
2. Human Question Store は original question、conversation reference、refusal reason、status を保存する。
3. 担当者または管理者は permission に応じて ticket list を取得する。
4. Answer Draft Manager は draft answer、internal note、公開状態、解決状態を更新する。
5. 公開済み回答は対象利用者の conversation に紐づけて表示できる。
6. 状態変更は audit event として保存する。

## 権限境界

- 通常利用者は自分の conversation、favorite、問い合わせだけを作成・参照できる。
- 担当者は割り当てられた問い合わせまたは permission が許す範囲の問い合わせだけを参照・更新できる。
- 管理者向け一覧でも、debug trace 本文や内部 metadata は別 permission で保護する。
- Web UI の表示制御だけに依存せず、API route で userId と permission を必ず検証する。

## エラー処理

| 事象 | 方針 |
|---|---|
| conversation owner 不一致 | 403 とし、存在有無を過剰に示さない。 |
| schemaVersion 未対応 | 保存を拒否するか、互換変換可能な場合だけ変換して保存する。 |
| favorite 対象不在 | not found とし、favorite state を作らない。 |
| ticket 更新権限なし | 403 とし、draft answer を保存しない。 |
| 公開済み ticket の不正更新 | 状態遷移規則に反する更新を拒否する。 |
| 検索 index 更新失敗 | 履歴保存結果には影響を metadata で示し、再 index 対象として記録する。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| 履歴保存 | `schemaVersion` 付き item が userId 単位で保存される。 |
| 所有者境界 | 他 userId の conversation detail を取得できない。 |
| お気に入り | favorite state の追加、解除、一覧が userId で分離される。 |
| 履歴検索 | userId 外の conversation が検索結果に出ない。 |
| 問い合わせ作成 | refusal metadata と conversation reference が ticket に紐づく。 |
| 担当者更新 | permission なしで draft answer を更新できない。 |
| debug 非漏えい | 履歴や問い合わせ通常 response に raw prompt や内部 ACL metadata が出ない。 |
