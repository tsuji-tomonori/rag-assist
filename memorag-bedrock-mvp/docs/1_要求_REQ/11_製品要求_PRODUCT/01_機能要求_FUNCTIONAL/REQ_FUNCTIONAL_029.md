# 要件定義（1要件1ファイル）

- 要件ID: `FR-029`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- FR-029: RAG アシスタントは、利用者質問が曖昧で、登録済み文書・memory card・検索候補に grounded な複数候補がある場合だけ、回答生成前に確認質問を返すこと。

## 受け入れ条件（この要件専用）

- AC-FR029-001: `POST /chat` は通常回答、回答不能、確認質問を `responseType` の `answer`、`refusal`、`clarification` で区別できること。
- AC-FR029-002: 「申請期限は？」のように対象が未指定で、corpus 上に複数の申請種別候補がある場合、`responseType=clarification` を返すこと。
- AC-FR029-003: 「経費精算の申請期限は？」のように対象が明示され、根拠が十分な場合、確認質問を出さず `responseType=answer` を返すこと。
- AC-FR029-004: corpus に候補を作れる根拠がない質問では、確認質問ではなく `responseType=refusal` を返すこと。
- AC-FR029-005: 確認質問の option は最大5件で、各 option が `memory`、`evidence`、`aspect`、`history` のいずれかの source と grounding を持つこと。
- AC-FR029-006: `includeDebug=true` の場合、`clarification_gate` trace に `ambiguityScore`、`reason`、`groundedOptionCount`、`rejectedOptions` を残すこと。
- AC-FR029-007: benchmark は `clarificationNeedF1`、`overClarificationRate`、`optionHitRate`、`postClarificationAccuracy` を summary metrics として出力できること。

## 要件の源泉・背景

- 源泉: ユーザーからの corpus-grounded clarification 実装依頼。
- 背景: 曖昧な質問を単一回答へ潰すと、対象違いの回答や根拠外の回答を生みやすい。
- 背景: 確認質問そのものが corpus に grounded していない場合、利用者が選んでも後続回答で使える根拠に接続できない。

## 要件の目的・意図

- 目的: 回答前の intent resolution により、RAG の根拠性と利用者体験を両立する。
- 意図: `answerability_gate` は回答可能性判定に集中させ、曖昧性判定を独立した `clarification_gate` として管理する。
- 意図: 「答える」「追加検索する」「確認質問する」「回答不能にする」の分岐を debug trace と benchmark で観測可能にする。
- 区分: 機能要求。

## 関連文書

- `memorag-bedrock-mvp/README.md`
- `memorag-bedrock-mvp/docs/API_EXAMPLES.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
